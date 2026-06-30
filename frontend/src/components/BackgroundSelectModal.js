import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { ABILITY_LABELS } from '../utils/dnd';
import { buildFeatAttachPatch, resolveFeatChoice } from '../utils/featChoices';
import FeatChoiceModal from './FeatChoiceModal';

// 2024-style backgrounds (backend/data/backgrounds.json - only 4 entries: Acolyte,
// Criminal, Sage, Soldier) each grant three things in one choice: an ability score
// allocation (+2/+1 split, or +1 to all three, across 3 eligible abilities), a fixed set
// of skill proficiencies (no choice), and a specific Origin feat. Previously none of this
// was modeled at all - Character had no background field, and nothing applied any of it.
// This is a one-shot wizard: pick background -> allocate ability scores -> (if the
// granted feat itself needs a choice, e.g. Magic Initiate) resolve that -> single commit.
export default function BackgroundSelectModal({ onClose }) {
  const { character, setCharacter } = useCharacter();
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState('');
  const [allocMode, setAllocMode] = useState('two_one'); // 'two_one' = +2/+1, 'all_three' = +1/+1/+1
  const [plusTwoAbility, setPlusTwoAbility] = useState('');
  const [plusOneAbility, setPlusOneAbility] = useState('');
  const [step, setStep] = useState('pick'); // pick | feat_choice | saving
  const [error, setError] = useState(null);
  const [pendingFeat, setPendingFeat] = useState(null);

  useEffect(() => {
    api.get('/content/backgrounds').then(r => setBackgrounds(r.data || [])).finally(() => setLoading(false));
  }, []);

  const bg = backgrounds.find(b => b.name === picked);
  const eligible = bg?.ability_scores || [];

  // Deliberately keyed on `picked` only, not `eligible` (which is derived from it on every
  // render) - re-running this every time `eligible` changes identity would never let the
  // player's own selection stick. No eslint-disable comment per this repo's standing rule
  // (react-hooks/exhaustive-deps isn't configured here, and a disable directive referencing
  // an unconfigured rule has broken the Render build outright before).
  useEffect(() => {
    if (eligible.length) {
      setPlusTwoAbility(eligible[0]);
      setPlusOneAbility(eligible[1] || eligible[0]);
    }
  }, [picked]);

  const skillsFromBg = (bg?.proficiencies || []).filter(p => p.startsWith('Skill: ')).map(p => p.replace('Skill: ', ''));
  // backgrounds.json's `feat` field is inconsistently shaped in the source data - Acolyte's
  // is an object ({name, note, index}), Criminal/Sage/Soldier's are plain strings - handle
  // both rather than assuming one shape and silently breaking for 3 of the 4 backgrounds.
  const featName = typeof bg?.feat === 'string' ? bg.feat : bg?.feat?.name;

  // Folds the ability allocation + fixed skills + feat attach (and the feat's own choice
  // patches, if any) into ONE single api.put - same single-commit pattern every other
  // multi-step flow in this app uses (LevelUpFlowModal, TrackerTab's choice-feat confirm),
  // to avoid the stale-closure-overwrite bug class from sequential saves.
  const finalize = async (featChoiceData) => {
    setStep('saving');
    setError(null);
    try {
      const ab = character.ability_scores || {};
      const newAb = { ...ab };
      if (allocMode === 'all_three') {
        eligible.forEach(a => { newAb[a] = Math.min(20, (parseInt(ab[a]) || 10) + 1); });
      } else {
        newAb[plusTwoAbility] = Math.min(20, (parseInt(ab[plusTwoAbility]) || 10) + 2);
        if (plusOneAbility !== plusTwoAbility) newAb[plusOneAbility] = Math.min(20, (parseInt(ab[plusOneAbility]) || 10) + 1);
      }

      const td = character.tracker_data || {};
      let newTd = { ...td };
      const existingSkills = newTd.skill_proficiencies || td.skill_proficiencies || [];
      const mergedSkills = [...existingSkills];
      skillsFromBg.forEach(s => { if (!mergedSkills.includes(s)) mergedSkills.push(s); });
      newTd.skill_proficiencies = mergedSkills;

      let newAe = character.ae_data || {};
      let newSd = null;
      if (featName) {
        const r = await api.get('/content/feats');
        const featObj = (r.data || []).find(f => f.name === featName);
        if (featObj) {
          const patch = await buildFeatAttachPatch(featObj, { ...character, tracker_data: newTd, ae_data: newAe });
          if (patch !== 'duplicate') {
            newAe = patch.newAe;
            newTd = patch.newTd;
            if (patch.newSd) newSd = patch.newSd;
            if (featChoiceData) {
              const choice = await resolveFeatChoice(featObj, featChoiceData);
              if (choice) {
                if (choice.saveProficiencyAdd) {
                  const ex = newTd.save_proficiencies || td.save_proficiencies || [];
                  if (!ex.includes(choice.saveProficiencyAdd)) newTd.save_proficiencies = [...ex, choice.saveProficiencyAdd];
                }
                if (choice.skillProficienciesAdd?.length) {
                  const ex = newTd.skill_proficiencies || [];
                  const m = [...ex];
                  choice.skillProficienciesAdd.forEach(s => { if (!m.includes(s)) m.push(s); });
                  newTd.skill_proficiencies = m;
                }
                if (choice.newFeature) {
                  const { key: fKey, ...fData } = choice.newFeature;
                  newTd.features = { ...newTd.features, [fKey]: fData };
                }
                if (choice.newKnownSpells?.length) {
                  const sd = newSd || character.spell_data || {};
                  newSd = { ...sd, known_spells: [...(sd.known_spells || []), ...choice.newKnownSpells] };
                }
                if (choice.abilityScoreIncrease) {
                  Object.entries(choice.abilityScoreIncrease).forEach(([k, v]) => {
                    newAb[k] = Math.min(20, (parseInt(newAb[k]) || 10) + v);
                  });
                }
              }
            }
          }
        }
      }

      const r2 = await api.put(`/characters/${character.id}`, {
        background: picked,
        ability_scores: newAb,
        tracker_data: newTd,
        ae_data: newAe,
        ...(newSd ? { spell_data: newSd } : {}),
      });
      setCharacter(r2.data);
      onClose();
    } catch {
      setError('Could not apply background - try again.');
      setStep('pick');
    }
  };

  const handleConfirmPick = async () => {
    if (!bg) return;
    if (featName) {
      const r = await api.get('/content/feats');
      const featObj = (r.data || []).find(f => f.name === featName);
      if (featObj?.choice_type) { setPendingFeat(featObj); setStep('feat_choice'); return; }
    }
    finalize(null);
  };

  return (
    <>
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        {step !== 'saving' && <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>}
        <h2>Choose a Background</h2>

        {step === 'saving' && <div style={{color:'var(--text-dim)',textAlign:'center',padding:20}}>Applying...</div>}

        {step === 'pick' && (
          <>
            {error && <div style={{color:'var(--danger)',fontSize:12,marginBottom:10}}>{error}</div>}
            {loading ? (
              <div style={{color:'var(--text-dim)',fontSize:12}}>Loading...</div>
            ) : (
              <>
                <div className="form-group">
                  <label>Background</label>
                  <select value={picked} onChange={e => setPicked(e.target.value)}>
                    <option value="">Select...</option>
                    {backgrounds.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>

                {bg && (
                  <>
                    <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>
                      Grants: {skillsFromBg.join(', ')}{featName ? ` · ${featName} feat` : ''}
                    </div>

                    <div className="form-row" style={{marginBottom:8}}>
                      <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={allocMode==='two_one'} onChange={() => setAllocMode('two_one')} /> +2 / +1</label>
                      <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={allocMode==='all_three'} onChange={() => setAllocMode('all_three')} /> +1 to all three</label>
                    </div>

                    {allocMode === 'two_one' ? (
                      <div className="form-row">
                        <div className="form-group">
                          <label>+2 Ability</label>
                          <select value={plusTwoAbility} onChange={e => setPlusTwoAbility(e.target.value)}>
                            {eligible.map(a => <option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>+1 Ability</label>
                          <select value={plusOneAbility} onChange={e => setPlusOneAbility(e.target.value)}>
                            {eligible.map(a => <option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:8}}>
                        +1 to each of: {eligible.map(a => ABILITY_LABELS[a]).join(', ')}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" style={{flex:2}} disabled={!bg} onClick={handleConfirmPick}>Confirm</button>
            </div>
          </>
        )}
      </div>
    </div>
    {step === 'feat_choice' && pendingFeat && (
      <FeatChoiceModal feat={pendingFeat} onConfirm={(choiceData) => finalize(choiceData)} onCancel={() => setStep('pick')} />
    )}
    </>
  );
}
