import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { ABILITY_KEYS, ABILITY_LABELS, modifier, rollDie, spellLevelUpNote, featBuffItems, raceBuffItems, formatItemBuff } from '../utils/dnd';

// Drives the full multi-step level-up flow for ANY character (single-class manually-
// created, or multiclass/PDF-imported once classes are confirmed) - POST /level_up is
// the single source of truth for "what's needed next" (needs_class_confirmation /
// needs_leveling_class_choice / a normal success with needs_subclass+asi_level flags),
// so this component is mostly just a state machine reacting to that one endpoint's
// responses rather than trying to predict the right flow client-side.
// mode='level_up' (default) drives the full level-up flow via POST /level_up. mode=
// 'confirm_classes' is for a proactive prompt (e.g. a banner on a freshly-imported
// character) that only needs to save tracker_data.classes, with no level-up side effect.
// initialLevelingClass skips the choose_leveling_class step entirely - used when the
// caller already knows which class is leveling (e.g. a per-class "Level Up" button in
// the editor's structured Class 1/Class 2 rows), since the backend never needs to ask
// when leveling_class is already provided on the very first attempt.
export default function LevelUpFlowModal({ onClose, mode = 'level_up', initialLevelingClass }) {
  const { character, setCharacter, saveTrackerData, rollbackLevelUp, updateCharacter } = useCharacter();
  const [step, setStep] = useState('loading'); // loading | confirm_classes | choose_leveling_class | choose_subclass | choose_hp | choose_asi | done | error
  const [rolledHp, setRolledHp] = useState(null);
  const [manualHp, setManualHp] = useState('');
  const [error, setError] = useState(null);
  const [classList, setClassList] = useState([]);
  const [draftClasses, setDraftClasses] = useState([]);
  const [classChoices, setClassChoices] = useState([]);
  const [pickedClass, setPickedClass] = useState('');
  const [subclassQueue, setSubclassQueue] = useState([]); // class_names still needing a subclass
  const [subclassOptions, setSubclassOptions] = useState([]);
  const [pickedSubclass, setPickedSubclass] = useState('');
  const [needsAsi, setNeedsAsi] = useState(false);
  const [asiChoice, setAsiChoice] = useState('two'); // 'two' = +1/+1, 'one' = +2, 'feat' = pick a feat instead
  const [asiAbilities, setAsiAbilities] = useState(['STR', 'DEX']);
  const [summary, setSummary] = useState(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [feats, setFeats] = useState([]);
  const [featsLoading, setFeatsLoading] = useState(false);
  const [featSearch, setFeatSearch] = useState('');
  const [pickedFeat, setPickedFeat] = useState(null);
  const [featError, setFeatError] = useState(null);

  useEffect(() => {
    api.get('/content/classes').then(r => setClassList(r.data || []));
  }, []);

  // Lazily loads the feat library the first time the ASI step is reached - no point
  // fetching it for level-ups that never grant an ASI at all.
  useEffect(() => {
    if (step !== 'choose_asi' || feats.length || featsLoading) return;
    setFeatsLoading(true);
    api.get('/content/feats').then(r => setFeats(r.data || [])).finally(() => setFeatsLoading(false));
  }, [step]);

  // Whatever comes after HP is settled - same destination the choose_hp step's
  // "Continue"/"Apply" button lands on once it's done adjusting HP.
  const proceedPastHp = (info) => {
    const needSub = info.needs_subclass || [];
    if (needSub.length) {
      setSubclassQueue(needSub);
      startSubclassStep(needSub[0]);
    } else if (info.asi_level) {
      setNeedsAsi(true);
      setStep('choose_asi');
    } else {
      setStep('done');
    }
  };

  const attempt = async (leveling_class) => {
    setStep('loading');
    setError(null);
    try {
      // suppressGlobalError: needs_class_confirmation/needs_leveling_class_choice are
      // expected, recoverable 400s this component handles itself in the catch block below
      // - without this, the global axios interceptor pops its own blocking "Something
      // didn't save" alert first, which is exactly the confusing error a real player hit.
      const r = await api.post(`/characters/${character.id}/level_up`, leveling_class ? { leveling_class } : {}, { suppressGlobalError: true });
      setCharacter(r.data);
      const info = r.data.level_up_summary;
      setSummary(info);
      // The backend always applies the Fixed/average HP gain - calc_mode==='rolled' means
      // the player wants the option to roll (or enter what they rolled in person) instead,
      // adjusting the already-applied average up or down to match before moving on.
      if (r.data.tracker_data?.hp?.calc_mode === 'rolled' && info.hp_gained > 0) {
        setRolledHp(null);
        setManualHp('');
        setStep('choose_hp');
      } else {
        proceedPastHp(info);
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.error === 'needs_class_confirmation') {
        setDraftClasses(data.inferred_classes && data.inferred_classes.length ? data.inferred_classes : [{ class_name: '', level: character.level || 1 }]);
        setStep('confirm_classes');
      } else if (data?.error === 'needs_leveling_class_choice') {
        setClassChoices(data.classes || []);
        setPickedClass(data.classes?.[0]?.class_name || '');
        setStep('choose_leveling_class');
      } else {
        setError(data?.error || 'Could not level up.');
        setStep('error');
      }
    }
  };

  const checkClassStatus = async () => {
    setStep('loading');
    try {
      const r = await api.get(`/characters/${character.id}/class_status`, { suppressGlobalError: true });
      setDraftClasses(r.data.inferred_classes && r.data.inferred_classes.length ? r.data.inferred_classes : [{ class_name: '', level: character.level || 1 }]);
      setStep('confirm_classes');
    } catch {
      setError('Could not check class status.');
      setStep('error');
    }
  };

  // Intentionally fires once on mount only - attempt()/checkClassStatus are recreated
  // every render (they close over `character`/`saveTrackerData`), but this should only
  // auto-fire once when the modal opens, not on every subsequent render.
  useEffect(() => { if (mode === 'confirm_classes') checkClassStatus(); else attempt(initialLevelingClass); }, []);

  const startSubclassStep = (className) => {
    api.get(`/content/classes/${encodeURIComponent(className)}/subclasses`).then(r => setSubclassOptions(r.data || []));
    setPickedSubclass('');
    setStep('choose_subclass');
  };

  const confirmClasses = async () => {
    const cleaned = draftClasses.filter(c => c.class_name && c.level > 0);
    if (!cleaned.length) return;
    await saveTrackerData({ ...character.tracker_data, classes: cleaned });
    if (mode === 'confirm_classes') {
      const r = await api.get(`/characters/${character.id}`);
      setCharacter(r.data);
      onClose();
    } else {
      attempt(cleaned.length === 1 ? cleaned[0].class_name : undefined);
    }
  };

  const submitSubclass = async () => {
    if (!pickedSubclass) return;
    const className = subclassQueue[0];
    await api.post(`/characters/${character.id}/classes/subclass`, { class_name: className, subclass_name: pickedSubclass });
    const r = await api.get(`/characters/${character.id}`);
    setCharacter(r.data);
    const rest = subclassQueue.slice(1);
    if (rest.length) {
      setSubclassQueue(rest);
      startSubclassStep(rest[0]);
    } else if (needsAsi) {
      setStep('choose_asi');
    } else {
      setStep('done');
    }
  };

  // hitDie: the leveling class's hit die size, for the "roll 1d{N}" button - multiclass
  // responses carry leveling_class directly; the single-class engine's response doesn't,
  // but for that path class_name never changes during a level-up, so it's a safe fallback.
  const hitDie = classList.find(c => c.name === (summary?.leveling_class || character.class_name))?.hit_die || 8;
  const conMod = modifier(character.ability_scores?.CON ?? 10);
  const rollHp = () => setRolledHp(rollDie(hitDie));
  const applyHpChoice = async (skip) => {
    let finalSummary = summary;
    if (!skip) {
      const rollResult = rolledHp ?? parseInt(manualHp);
      if (rollResult > 0) {
        const newGain = rollResult + conMod;
        const delta = newGain - summary.hp_gained;
        if (delta !== 0) {
          const hp = character.tracker_data.hp;
          await saveTrackerData({ ...character.tracker_data, hp: { ...hp, max: hp.max + delta, current: hp.current + delta } });
        }
        finalSummary = { ...summary, hp_gained: newGain };
        setSummary(finalSummary);
      }
    }
    proceedPastHp(finalSummary);
  };

  const submitAsi = async () => {
    const increases = asiChoice === 'one'
      ? { [asiAbilities[0]]: 2 }
      : { [asiAbilities[0]]: 1, [asiAbilities[1]]: 1 };
    const r = await api.post(`/characters/${character.id}/asi`, { increases });
    setCharacter(r.data);
    setStep('done');
  };

  // Same attach shape TrackerTab.js's addFeatFromLibrary uses (feature charges, tuck-&-
  // release/granted-spell tags, buffs) so a feat picked here behaves identically to one
  // added later via Browse Feats - this is just a more convenient entry point at the
  // exact moment the player has an ASI-or-feat choice to make.
  const submitFeat = async () => {
    if (!pickedFeat) return;
    setFeatError(null);
    const ae = character.ae_data || {};
    const td = character.tracker_data || {};
    const key = pickedFeat.name;
    const alreadyHas = Object.values(ae).some(arr => (arr || []).some(a => a.tracker_key === key));
    if (alreadyHas) {
      setFeatError(`"${pickedFeat.name}" is already on this character.`);
      return;
    }
    const newAbility = { name: pickedFeat.name, source: pickedFeat.source, source_type: 'custom', cost_type: pickedFeat.cost_type, tracker_key: key, description: pickedFeat.description };
    const newAe = { ...ae };
    if (!newAe[pickedFeat.section]) newAe[pickedFeat.section] = [];
    newAe[pickedFeat.section] = [...newAe[pickedFeat.section], newAbility];
    const newTd = { ...td };
    if (pickedFeat.max_uses > 0 || pickedFeat.isTuck || pickedFeat.grantsSpell || pickedFeat.buffs?.length > 0) {
      newTd.features = {
        ...newTd.features,
        [key]: {
          current: pickedFeat.max_uses || 0, max: pickedFeat.max_uses || 0,
          rest_type: pickedFeat.rest_type, action: pickedFeat.section, description: pickedFeat.description,
          ...(pickedFeat.isTuck ? { spell_picker: true, tucked_spell: '', tucked_level: '' } : {}),
          ...(pickedFeat.grantsSpell ? { granted_spell: pickedFeat.grantedSpellName, ability_override: pickedFeat.abilityOverride || null } : {}),
          ...(pickedFeat.buffs?.length ? { buffs: pickedFeat.buffs } : {}),
        },
      };
    }
    let newSd = null;
    if (pickedFeat.grantsSpell && pickedFeat.grantedSpellName) {
      try {
        const r = await api.get('/content/spells');
        const master = r.data.find(s => s.name.toLowerCase() === pickedFeat.grantedSpellName.toLowerCase());
        const sd = character.spell_data || {};
        const known = sd.known_spells || [];
        if (master && !known.some(s => s.name.toLowerCase() === master.name.toLowerCase())) {
          newSd = { ...sd, known_spells: [...known, { ...master, granted_by: pickedFeat.name, ability_override: pickedFeat.abilityOverride || null, free_use_feature: key }] };
        }
      } catch {
        // Non-fatal - the feature/charge still gets attached even if the spell lookup failed.
      }
    }
    await updateCharacter(character.id, { ae_data: newAe, tracker_data: newTd, ...(newSd ? { spell_data: newSd } : {}) });
    setStep('done');
  };

  const updateDraftClass = (idx, patch) => setDraftClasses(d => d.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeDraftClass = (idx) => setDraftClasses(d => d.filter((_, i) => i !== idx));

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        {step !== 'loading' && <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>}
        <h2>Level Up</h2>

        {step === 'loading' && <div style={{color:'var(--text-dim)',textAlign:'center',padding:20}}>Working...</div>}

        {step === 'error' && (
          <>
            <div style={{color:'var(--danger)',fontSize:13,marginBottom:12}}>{error}</div>
            <button className="btn btn-secondary" style={{width:'100%'}} onClick={onClose}>Close</button>
          </>
        )}

        {step === 'confirm_classes' && (
          <>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
              Couldn't confidently auto-detect this character's class(es) - confirm them once to enable level-up, subclass tracking, and ability score improvements.
            </div>
            {draftClasses.map((c, i) => (
              <div className="form-row" key={i} style={{alignItems:'flex-end'}}>
                <div className="form-group">
                  <label>Class</label>
                  <select value={c.class_name} onChange={e => updateDraftClass(i, { class_name: e.target.value })}>
                    <option value="">Select...</option>
                    {classList.map(cl => <option key={cl.name} value={cl.name}>{cl.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{maxWidth:90}}>
                  <label>Level</label>
                  <input type="number" min={1} max={20} value={c.level} onChange={e => updateDraftClass(i, { level: parseInt(e.target.value) || 1 })} />
                </div>
                {draftClasses.length > 1 && (
                  <button className="btn btn-secondary btn-sm" style={{marginBottom:12}} onClick={() => removeDraftClass(i)}>Remove</button>
                )}
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{marginBottom:12}} onClick={() => setDraftClasses(d => [...d, { class_name: '', level: 1 }])}>+ Add Class</button>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" style={{flex:2}} disabled={!draftClasses.some(c => c.class_name)} onClick={confirmClasses}>Confirm &amp; Continue</button>
            </div>
          </>
        )}

        {step === 'choose_leveling_class' && (
          <>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>Multiclass character - which class is gaining this level?</div>
            {classChoices.map(c => (
              <label key={c.class_name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',cursor:'pointer'}}>
                <input type="radio" checked={pickedClass === c.class_name} onChange={() => setPickedClass(c.class_name)} />
                <span>{c.class_name} (currently {c.level})</span>
              </label>
            ))}
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" style={{flex:2}} onClick={() => attempt(pickedClass)}>Continue</button>
            </div>
          </>
        )}

        {step === 'choose_hp' && (
          <>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
              Fixed/average HP gain for this level was +{summary?.hp_gained}. Your Hit Die is a d{hitDie} - roll it, or enter what you rolled in person, to use that instead.
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
              <button className="btn btn-secondary" onClick={rollHp}>🎲 Roll 1d{hitDie}</button>
              {rolledHp != null && (
                <span style={{color:'var(--accent-light)',fontSize:14,fontWeight:700}}>
                  {rolledHp} + {conMod>=0?'+':''}{conMod} CON = {rolledHp + conMod} total
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Or enter what you rolled in person (before CON modifier)</label>
              <input type="number" min={1} max={hitDie} value={manualHp} onChange={e => { setManualHp(e.target.value); setRolledHp(null); }} placeholder={`1-${hitDie}`} />
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={() => applyHpChoice(true)}>Keep Average (+{summary?.hp_gained})</button>
              <button className="btn btn-primary" style={{flex:1}} disabled={!(rolledHp > 0 || parseInt(manualHp) > 0)} onClick={() => applyHpChoice(false)}>Use This Roll</button>
            </div>
          </>
        )}

        {step === 'choose_subclass' && (
          <>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
              {subclassQueue[0]} has reached its subclass-choice level - pick one (this also retroactively grants its features up to your current level).
            </div>
            <div className="form-group">
              <label>Subclass</label>
              <select value={pickedSubclass} onChange={e => setPickedSubclass(e.target.value)}>
                <option value="">Select...</option>
                {subclassOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Skip for now</button>
              <button className="btn btn-primary" style={{flex:2}} disabled={!pickedSubclass} onClick={submitSubclass}>Confirm</button>
            </div>
          </>
        )}

        {step === 'choose_asi' && (() => {
          const filteredFeats = feats.filter(f => !featSearch || f.name.toLowerCase().includes(featSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
          <>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
              This level grants an Ability Score Improvement. Increase two abilities by 1, increase one ability by 2 (max 20), or take a Feat instead.
            </div>
            <div className="form-row" style={{marginBottom:8}}>
              <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={asiChoice==='two'} onChange={() => setAsiChoice('two')} /> +1 / +1</label>
              <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={asiChoice==='one'} onChange={() => setAsiChoice('one')} /> +2 to one</label>
              <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={asiChoice==='feat'} onChange={() => setAsiChoice('feat')} /> Take a Feat</label>
            </div>

            {asiChoice !== 'feat' && (
              <div className="form-row">
                <div className="form-group">
                  <label>{asiChoice === 'one' ? 'Ability' : 'Ability 1'}</label>
                  <select value={asiAbilities[0]} onChange={e => setAsiAbilities(a => [e.target.value, a[1]])}>
                    {ABILITY_KEYS.map(k => <option key={k} value={k}>{ABILITY_LABELS[k]}</option>)}
                  </select>
                </div>
                {asiChoice === 'two' && (
                  <div className="form-group">
                    <label>Ability 2</label>
                    <select value={asiAbilities[1]} onChange={e => setAsiAbilities(a => [a[0], e.target.value])}>
                      {ABILITY_KEYS.map(k => <option key={k} value={k}>{ABILITY_LABELS[k]}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {asiChoice === 'feat' && (
              <>
                <input value={featSearch} onChange={e => setFeatSearch(e.target.value)} placeholder="Search feats..." style={{marginBottom:8}} autoFocus />
                {featError && <div style={{color:'var(--danger)',fontSize:11,marginBottom:8}}>{featError}</div>}
                <div style={{maxHeight:260,overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',marginBottom:12}}>
                  {featsLoading ? (
                    <div style={{color:'var(--text-dim)',textAlign:'center',padding:16,fontSize:12}}>Loading feats...</div>
                  ) : filteredFeats.length === 0 ? (
                    <div style={{color:'var(--text-dim)',textAlign:'center',padding:16,fontSize:12}}>No matching feats.</div>
                  ) : filteredFeats.map((f,i) => (
                    <label key={i} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'8px 10px',borderBottom:'1px solid var(--border)',cursor:'pointer',background: pickedFeat?.name===f.name ? 'rgba(124,92,252,0.12)' : 'none'}}>
                      <input type="radio" style={{marginTop:3}} checked={pickedFeat?.name===f.name} onChange={() => { setPickedFeat(f); setFeatError(null); }} />
                      <div style={{flex:1}}>
                        <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{f.name}</div>
                        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:2}}>{f.source}{f.max_uses ? ` · ${f.max_uses}/${f.rest_type} rest` : ''}</div>
                        {f.description && <div style={{color:'var(--text-secondary)',fontSize:11,lineHeight:1.5}}>{f.description}</div>}
                        {f.buffs?.length > 0 && (
                          <div style={{marginTop:4}}>
                            {f.buffs.map((b,bi) => <div key={bi} style={{fontSize:10,color:'var(--accent-light)'}}>{formatItemBuff(b)}</div>)}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={() => setStep('done')}>Skip</button>
              {asiChoice === 'feat' ? (
                <button className="btn btn-primary" style={{flex:2}} disabled={!pickedFeat} onClick={submitFeat}>Take Feat</button>
              ) : (
                <button className="btn btn-primary" style={{flex:2}} disabled={asiChoice==='two' && asiAbilities[0]===asiAbilities[1]} onClick={submitAsi}>Apply</button>
              )}
            </div>
          </>
          );
        })()}

        {step === 'done' && (() => {
          const buffItems = [...(character?.tracker_data?.inventory?.items || []), ...featBuffItems(character?.tracker_data?.features), ...raceBuffItems(character?.race)];
          const newLevel = summary?.new_total_level ?? summary?.new_level;
          const spellNote = spellLevelUpNote(
            character?.class_name,
            summary?.leveling_class,
            newLevel,
            summary?.new_class_level,
            character?.ability_scores,
            buffItems,
          );
          return (
          <>
            <div style={{color:'var(--success)',fontSize:14,marginBottom:8,fontWeight:600}}>Welcome to level {newLevel}!</div>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom: spellNote ? 8 : 16}}>
              HP max increased by {summary?.hp_gained}. New features and spell slots (if any) have been added — check the Feats/Attunement and Spells tabs.
            </div>
            {spellNote && (
              <div style={{color:'var(--accent-light)',fontSize:12,marginBottom:16,padding:'8px 10px',background:'rgba(124,92,252,0.1)',borderRadius:'var(--radius-sm)',lineHeight:1.6}}>
                {spellNote}
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" style={{flex:1}} disabled={rollingBack} onClick={async () => { setRollingBack(true); try { await rollbackLevelUp(); } finally { setRollingBack(false); onClose(); } }}>
                {rollingBack ? 'Rolling back...' : "↺ Undo, I'll check first"}
              </button>
              <button className="btn btn-primary" style={{flex:1}} onClick={onClose}>Close</button>
            </div>
          </>
          );
        })()}
      </div>
    </div>
  );
}
