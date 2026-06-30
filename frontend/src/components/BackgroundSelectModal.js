import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { ABILITY_LABELS } from '../utils/dnd';
import { buildFeatAttachPatch, resolveFeatChoice } from '../utils/featChoices';
import FeatChoiceModal from './FeatChoiceModal';

// Two background systems now coexist in backend/data/backgrounds.json, tagged by
// `system`. 2024-style (15 entries) each grant three things in one choice: an ability
// score allocation (+2/+1 split, or +1 to all three, across 3 eligible abilities), a fixed
// set of skill proficiencies (no choice), and a specific Origin feat - fully auto-applied,
// same as before. 2014-style ("Legacy", 28 entries transcribed from the owner's source
// doc) has no ability bonuses and no feat grant at all (that's not how 2014 backgrounds
// work) - several also phrase their skill grant as a CHOICE ("Choose two from among
// Insight, Investigation, or Perception", "History, plus your choice of...") rather than a
// fixed pair, which can't be safely auto-applied without guessing wrong. So the 2014 path
// is deliberately reference-only: shows the full skill/tool/language/equipment/feature/
// characteristics data, sets character.background, and lets the player apply proficiencies
// themselves via the existing Skill Proficiencies checkboxes - same "track it, the player
// applies it" philosophy already used throughout this app.
//
// Some names collide across the two systems (Acolyte/Charlatan/Entertainer exist in both)
// since they're genuinely different background definitions, not duplicates - so selection
// is keyed by `${name}__${system}`, not name alone.
export default function BackgroundSelectModal({ onClose }) {
  const { character, setCharacter } = useCharacter();
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState('2024');
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

  const bgKey = (b) => `${b.name}__${b.system}`;
  const filteredBackgrounds = backgrounds.filter(b => (b.system || '2024') === system);
  const bg = backgrounds.find(b => bgKey(b) === picked);
  const isLegacy = bg?.system === '2014';
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
  // 2014 backgrounds set character.background only - no ability scores, no skills, no
  // feat (see the top-of-file note for why this is deliberately reference-only).
  const finalizeLegacy = async () => {
    setStep('saving');
    setError(null);
    try {
      const r2 = await api.put(`/characters/${character.id}`, { background: bg.name });
      setCharacter(r2.data);
      onClose();
    } catch {
      setError('Could not set background - try again.');
      setStep('pick');
    }
  };

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
        background: bg.name,
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
    if (isLegacy) { finalizeLegacy(); return; }
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
      <div className="modal" style={{maxWidth: isLegacy ? 560 : 420, maxHeight:'85vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        {step !== 'saving' && <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>}
        <h2>Choose a Background</h2>

        {step === 'saving' && <div style={{color:'var(--text-dim)',textAlign:'center',padding:20}}>Applying...</div>}

        {step === 'pick' && (
          <>
            {error && <div style={{color:'var(--danger)',fontSize:12,marginBottom:10}}>{error}</div>}
            {loading ? (
              <div style={{color:'var(--text-dim)',fontSize:12}}>Loading...</div>
            ) : (
              <div style={{flex:1, overflowY:'auto', minHeight:0}}>
                <div className="form-row" style={{marginBottom:8}}>
                  <label style={{display:'flex',alignItems:'center',gap:6}}>
                    <input type="radio" checked={system==='2024'} onChange={() => { setSystem('2024'); setPicked(''); }} /> 2024 (ability + feat)
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:6}}>
                    <input type="radio" checked={system==='2014'} onChange={() => { setSystem('2014'); setPicked(''); }} /> 2014 / Legacy (reference)
                  </label>
                </div>

                <div className="form-group">
                  <label>Background</label>
                  <select value={picked} onChange={e => setPicked(e.target.value)}>
                    <option value="">Select...</option>
                    {filteredBackgrounds.map(b => <option key={bgKey(b)} value={bgKey(b)}>{b.name}</option>)}
                  </select>
                </div>

                {bg && !isLegacy && (
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

                {bg && isLegacy && (
                  <div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.6}}>
                    <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8}}>{bg.source}</div>
                    {bg.description && <p style={{marginBottom:10}}>{bg.description}</p>}
                    <div style={{marginBottom:6}}><b>Skills:</b> {bg.skill_proficiencies || '—'}</div>
                    {bg.tool_proficiencies && <div style={{marginBottom:6}}><b>Tools:</b> {bg.tool_proficiencies}</div>}
                    {bg.languages && <div style={{marginBottom:6}}><b>Languages:</b> {bg.languages}</div>}
                    {bg.equipment && <div style={{marginBottom:6}}><b>Equipment:</b> {bg.equipment}</div>}
                    {bg.feature_name && (
                      <div style={{marginTop:10,padding:'8px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
                        <div style={{fontWeight:600,color:'var(--accent-light)',marginBottom:4}}>Feature: {bg.feature_name}</div>
                        {bg.feature_description}
                      </div>
                    )}
                    <div style={{color:'var(--text-dim)',fontSize:11,marginTop:10}}>
                      No ability bonuses or feat grant for 2014-style backgrounds (not how this edition works), and skill proficiencies
                      aren't auto-applied since several entries phrase them as a choice - check the matching boxes yourself via
                      Settings → Edit Character → Skill Proficiencies.
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{display:'flex',gap:8,marginTop:12,flexShrink:0}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" style={{flex:2}} disabled={!bg} onClick={handleConfirmPick}>{isLegacy ? 'Set Background' : 'Confirm'}</button>
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
