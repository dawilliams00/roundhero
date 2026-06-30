import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import LevelUpFlowModal from './LevelUpFlowModal';
import ClassFeatureBrowserModal from './ClassFeatureBrowserModal';
import { ABILITY_KEYS, ABILITY_LABELS, SAVE_PROFS, SKILL_MAP, suspectedAbilityContamination, featBuffItems, parseClassLevels, raceBuffItems, computeItemBonuses, RACE_ABILITY_BONUSES, modifier, unarmoredAC, cappedModifier } from '../utils/dnd';

// Full base-stat editor - identity, ability scores, and save/skill proficiencies, on top
// of the original v1 level-up-only framework. This is the one place all of the
// feat/item/lineage buff work (which all reads ability_scores/save_proficiencies/
// skill_proficiencies as its starting point) can actually be corrected by hand, since
// none of those three were ever directly editable anywhere else - ability scores have a
// header click-to-edit box per-stat, but save/skill proficiencies had no UI at all and
// manually-created characters never got skill_proficiencies populated in the first place.
export default function CharacterEditorModal({ onClose }) {
  const { character, setCharacter, updateCharacter, saveTrackerData, rollbackLevelUp } = useCharacter();
  const [levelingUpClass, setLevelingUpClass] = useState(null);
  const [previewing, setPreviewing] = useState(null); // { class_name, subclass, maxLevel } | null
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [settingSubclassFor, setSettingSubclassFor] = useState(null);

  const td = character?.tracker_data || {};
  const [identity, setIdentity] = useState(character ? {
    name: character.name || '', race: character.race || '',
  } : null);
  // The structured Class 1/Class 2 rows are now the only way to edit class/subclass/level
  // - no more free-text fallback view or a "set this up" gate. Bootstraps a best-effort
  // guess from the existing (possibly decorated/multiclass) class_name the moment the
  // class list has loaded, but never auto-persists it - nothing is written to the server
  // until the player actually interacts with a row (picks a class, clicks Level Up,
  // etc.), so opening this modal can never silently write a guess he never confirmed.
  const [classesDraft, setClassesDraft] = useState(character && td.classes ? td.classes.map(c => ({...c})) : null);
  const [classSubOptions, setClassSubOptions] = useState({});
  const [scores, setScores] = useState(character ? { ...character.ability_scores } : null);
  const [abMisc, setAbMisc] = useState(character ? { ...( td.ability_score_misc || {}) } : null);
  const [acMisc, setAcMisc] = useState(td.ac_misc || 0);
  // Falls back to the class's RAW default saves when the character has no explicit
  // save_proficiencies yet (true for every manually-created character before this editor
  // existed) so the checkboxes don't just look empty for someone who's always had them.
  const [saveProfs, setSaveProfs] = useState(character ? (
    (td.save_proficiencies && td.save_proficiencies.length) ? [...td.save_proficiencies] : [...(SAVE_PROFS[character.class_name] || [])]
  ) : null);
  const [skillProfs, setSkillProfs] = useState(character ? [...(td.skill_proficiencies || [])] : null);
  const [skillExpertise, setSkillExpertise] = useState(character ? [...(td.skill_expertise || [])] : null);

  // Flags an ability whose current input value exactly matches some inventory item's
  // Set-To buff value - see suspectedAbilityContamination in dnd.js for why this can't be
  // auto-fixed, only flagged. Recomputed live off `scores` (not the original character
  // ability_scores) so the warning updates/clears as the player edits the number here.
  const buffItems = character ? [...(td.inventory?.items || []), ...featBuffItems(td.features)] : [];
  // scores' values are raw input strings once edited (controlled <input> onChange), so
  // normalize to ints here - otherwise "29" !== 29 would silently break the match the
  // moment the player touches any ability field, not just the contaminated one.
  const normalizedScores = character ? Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(scores[k]) || 10])) : {};
  const contamination = character ? suspectedAbilityContamination(normalizedScores, buffItems) : {};

  // Class dropdown is sourced from the engine's known class list (same /content/classes
  // endpoint CharacterSetup.js already uses) so a manually-created character can't drift
  // into a typo'd or unrecognized name.
  const [classList, setClassList] = useState([]);
  // Race dropdown is the same flat, already-decorated list (e.g. "Dwarf (Hill)") manual
  // character creation already uses - a custom/homebrew race falls back to free text.
  const [raceList, setRaceList] = useState([]);
  const [raceMode, setRaceMode] = useState('custom');

  // Intentionally runs once on mount only - this modal remounts fresh every time it's
  // opened (SettingsModal renders it behind `showEditor &&`), so `character` here is
  // never stale, and re-running this on every keystroke elsewhere would be wasteful.
  useEffect(() => {
    api.get('/content/classes').then(r => setClassList(r.data || []));
    api.get('/content/races').then(r => {
      const list = r.data || [];
      setRaceList(list);
      if (character && list.includes(character.race)) setRaceMode('known');
    });
  }, []);

  // Bootstraps the structured Class 1/Class 2 rows from the character's existing
  // (possibly decorated/multiclass) class_name the first time the class list has loaded -
  // only fills in a class_name where it's an exact, confirmed match, so a guess is never
  // silently wrong; an unrecognized part is left blank for the player to pick themselves.
  // Guarded on td.classes being absent so this never overwrites already-confirmed data.
  useEffect(() => {
    if (!classList.length || td.classes || classesDraft) return;
    const parsed = parseClassLevels(character.class_name);
    const guesses = parsed.length
      ? parsed.map(p => ({ class_name: classList.some(c => c.name === p.className) ? p.className : '', level: p.level, subclass: '' }))
      : [{ class_name: classList.some(c => c.name === character.class_name) ? character.class_name : '', level: character.level || 1, subclass: character.subclass || '' }];
    setClassesDraft(guesses);
  }, [classList.length]);

  // One subclass-options fetch per distinct class name across all structured class rows.
  const classDraftNamesKey = classesDraft ? classesDraft.map(c => c.class_name).filter(Boolean).join('|') : '';
  useEffect(() => {
    if (!classDraftNamesKey) return;
    classDraftNamesKey.split('|').forEach(name => {
      api.get(`/content/classes/${encodeURIComponent(name)}/subclasses`).then(r => setClassSubOptions(prev => ({ ...prev, [name]: r.data || [] })));
    });
  }, [classDraftNamesKey]);

  if (!character) return null;

  // A level-up, subclass pick, or rollback can all change level/class_name/ability_scores
  // (and now tracker_data.classes) on `character` out from under this modal's own local
  // draft state, which was only ever seeded once at mount - every action that touches the
  // server resyncs through this one place afterward instead of three slightly different
  // copies of the same re-sync logic drifting apart.
  const syncDraftFromCharacter = (c) => {
    setClassesDraft(c.tracker_data.classes ? c.tracker_data.classes.map(x => ({ ...x })) : null);
    setScores({ ...c.ability_scores });
  };

  // The Classes section saves itself immediately on every change - it is NOT part of the
  // Identity/Ability Scores/Proficiencies draft form below, and Cancel does not (and
  // cannot) undo it. This is a deliberate fix: editing one row then clicking a DIFFERENT
  // row's Level Up/Subclass action used to force-commit every row's draft state as a side
  // effect (since those actions needed the server in sync first), so Cancel afterward
  // looked like it silently failed to revert anything. Making every edit here commit
  // right away removes the false "this is still just a draft" impression entirely - same
  // self-saving model the Companion tab's fields already use.
  // Only entries with a class_name chosen are ever persisted - a freshly added blank row
  // stays purely local until the player actually picks something, so "+ Add" never
  // round-trips through a save that doesn't know about it yet and makes it vanish.
  const saveClasses = async (newClasses) => {
    setClassesDraft(newClasses);
    const toPersist = newClasses.filter(c => c.class_name);
    if (!toPersist.length) return;
    // The Character model's own class_name/subclass/level columns (used everywhere else
    // in the app - header, character list) are a DISPLAY derivation of tracker_data.classes,
    // not a separate source of truth - this keeps them in sync on every class edit so they
    // never go stale relative to the real structured data, the same single-vs-decorated-
    // multiclass convention the backend's classes_to_display_name() uses.
    const r = await api.put(`/characters/${character.id}`, {
      class_name: toPersist.length === 1 ? toPersist[0].class_name : toPersist.map(c => `${c.class_name} ${c.level}`).join(' / '),
      subclass: toPersist.length === 1 ? (toPersist[0].subclass || '') : character.subclass,
      level: toPersist.reduce((sum, c) => sum + (parseInt(c.level) || 0), 0),
      tracker_data: { ...character.tracker_data, classes: toPersist },
    });
    setCharacter(r.data);
  };
  const addClassRow = () => setClassesDraft(d => [...d, { class_name: '', level: 1, subclass: '' }]);
  const removeClassRow = (idx) => saveClasses(classesDraft.filter((_, i) => i !== idx));
  const updateClassRow = (idx, patch) => saveClasses(classesDraft.map((c, i) => i === idx ? { ...c, ...patch } : c));
  // Level is a number input the player may type multiple digits into - committing on
  // every keystroke risks the exact race SettingsModal's homebrew fields once hit (a
  // later, shorter keystroke's save landing after an earlier one's and "eating" part of
  // what was typed), so this updates local state only and commits on blur instead.
  const updateClassRowLocal = (idx, patch) => setClassesDraft(d => d.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const commitClasses = () => saveClasses(classesDraft);

  // Picking a subclass here calls the same endpoint LevelUpFlowModal's choose_subclass
  // step does (not just a draft field saved later) - it auto-grants that subclass's
  // class_features.json entries up to the class's current level immediately, so this row
  // and the level-up flow's own subclass prompt can never produce an inconsistent "subclass
  // set but its features never granted" state depending on which path picked it.
  const setRowSubclass = async (idx, subclassName) => {
    const cls = classesDraft[idx];
    setSettingSubclassFor(cls.class_name);
    try {
      await commitClasses(); // flush any pending edit (e.g. an unblurred Level change) first
      const r = await api.post(`/characters/${character.id}/classes/subclass`, { class_name: cls.class_name, subclass_name: subclassName });
      setCharacter(r.data);
      setClassesDraft((r.data.tracker_data.classes || []).map(c => ({ ...c })));
    } finally {
      setSettingSubclassFor(null);
    }
  };

  const startLevelUpForRow = async (className) => {
    await commitClasses(); // flush any pending edit first - see saveClasses above
    setLevelingUpClass(className);
  };

  // Total character level can't exceed 20 - used both to cap the Preview button's level
  // dropdown per row (no point previewing a level this multiclass build could never
  // legally reach) and to disable adding yet another class once there's no room left.
  const totalCharLevel = classesDraft ? classesDraft.reduce((sum, c) => sum + (parseInt(c.level) || 0), 0) : 0;

  const toggleSave = (ab) => setSaveProfs(p => p.includes(ab) ? p.filter(x => x !== ab) : [...p, ab]);
  const toggleSkillProf = (skill) => setSkillProfs(p => {
    if (p.includes(skill)) {
      setSkillExpertise(e => e.filter(x => x !== skill));
      return p.filter(x => x !== skill);
    }
    return [...p, skill];
  });
  const toggleSkillExpertise = (skill) => setSkillExpertise(e => {
    if (e.includes(skill)) return e.filter(x => x !== skill);
    setSkillProfs(p => p.includes(skill) ? p : [...p, skill]);
    return [...e, skill];
  });

  // Just Name/Race/Ability Scores/Proficiencies now - Classes saves itself immediately
  // on every change (see saveClasses above), so there's nothing class-related left for
  // Cancel/Save Changes to apply or discard.
  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCharacter(character.id, {
        name: identity.name.trim() || character.name,
        race: identity.race.trim(),
        ability_scores: Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(scores[k]) || 10])),
      });
      await saveTrackerData({
        ...td,
        save_proficiencies: saveProfs,
        skill_proficiencies: skillProfs,
        skill_expertise: skillExpertise,
        ability_score_misc: Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(abMisc[k]) || 0])),
        ac_misc: parseInt(acMisc) || 0,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <h2>Edit Character</h2>

        <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Identity</div>
        <div className="form-row">
          <div className="form-group"><label>Name</label><input value={identity.name} onChange={e=>setIdentity(f=>({...f,name:e.target.value}))} /></div>
          <div className="form-group">
            <label>Race</label>
            {raceMode === 'known' ? (
              <select value={identity.race} onChange={e=>setIdentity(f=>({...f,race:e.target.value}))}>
                {!raceList.includes(identity.race) && <option value={identity.race}>{identity.race}</option>}
                {raceList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input value={identity.race} onChange={e=>setIdentity(f=>({...f,race:e.target.value}))} placeholder="e.g. Dwarf (Hill), or a homebrew race" />
            )}
            <div style={{marginTop:4}}>
              <button type="button" className="btn-link" style={{fontSize:11,color:'var(--text-dim)',background:'none',border:'none',padding:0,cursor:'pointer',textDecoration:'underline'}}
                onClick={() => setRaceMode(m => m === 'known' ? 'custom' : 'known')}>
                {raceMode === 'known' ? 'Use free text instead (homebrew)' : 'Pick from list instead'}
              </button>
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8,marginTop:8}}>
          <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1}}>
            {classesDraft && classesDraft.length > 1 ? 'Classes (Multiclass)' : 'Class'}
          </div>
          <div style={{fontSize:10,color:'var(--text-dim)'}}>saves automatically as you edit - not part of Cancel/Save Changes below</div>
        </div>
        {!classesDraft ? (
          <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:16}}>Loading...</div>
        ) : (
          <>
            {classesDraft.map((c, i) => {
              const maxPreviewLevel = Math.min(20, (parseInt(c.level) || 1) + (20 - totalCharLevel));
              return (
                <div key={i} className="form-row" style={{alignItems:'flex-end',background:'var(--bg-primary)',padding:10,borderRadius:'var(--radius-sm)',marginBottom:8,flexWrap:'wrap'}}>
                  <div className="form-group">
                    <label>Class {classesDraft.length > 1 ? i + 1 : ''}</label>
                    <select value={c.class_name} onChange={e => updateClassRow(i, { class_name: e.target.value, subclass: '' })}>
                      <option value="">Select...</option>
                      {classList.map(cl => <option key={cl.name} value={cl.name}>{cl.name} (d{cl.hit_die})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{maxWidth:90}}>
                    <label>Level</label>
                    <input type="number" min={1} max={20} value={c.level} onChange={e => updateClassRowLocal(i, { level: parseInt(e.target.value) || 1 })} onBlur={commitClasses} />
                  </div>
                  <div className="form-group">
                    <label>Subclass</label>
                    {(classSubOptions[c.class_name] || []).length > 0 ? (
                      <select value={c.subclass || ''} disabled={settingSubclassFor === c.class_name} onChange={e => setRowSubclass(i, e.target.value)}>
                        <option value="">None / Not chosen</option>
                        {!classSubOptions[c.class_name].includes(c.subclass) && c.subclass && <option value={c.subclass}>{c.subclass} (custom)</option>}
                        {classSubOptions[c.class_name].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <div style={{fontSize:11,color:'var(--text-dim)',padding:'7px 0'}}>{c.subclass || 'None yet'}</div>
                    )}
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{marginBottom:12}} disabled={!c.class_name || c.level >= 20} onClick={() => startLevelUpForRow(c.class_name)}>
                    Level Up {c.class_name || `Class ${i + 1}`}
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{marginBottom:12}} disabled={!c.class_name} title="Browse this class's features at any level, without committing to anything"
                    onClick={() => setPreviewing({ class_name: c.class_name, subclass: c.subclass || '', maxLevel: maxPreviewLevel })}>
                    📖 Preview
                  </button>
                  {classesDraft.length > 1 && (
                    <button className="btn btn-secondary btn-sm" style={{marginBottom:12}} onClick={() => removeClassRow(i)}>Remove</button>
                  )}
                </div>
              );
            })}
            <div style={{marginBottom:16}}>
              <button className="btn btn-secondary btn-sm" disabled={totalCharLevel >= 20} onClick={addClassRow}>+ Add {classesDraft.length === 1 ? 'a Second Class (Multiclass)' : 'Another Class'}</button>
            </div>
          </>
        )}
        {(td._level_up_snapshots?.length > 0 || td._level_up_snapshot) && (
          <div style={{marginBottom:16}}>
            <button className="btn btn-secondary" disabled={rollingBack} onClick={async () => {
              setRollingBack(true);
              try {
                syncDraftFromCharacter(await rollbackLevelUp());
              } finally { setRollingBack(false); }
            }}>
              {/* Pops one level-up at a time off the stack - clicking this repeatedly after
                  multiple level-ups steps back through each one in order, not just the most
                  recent. */}
              {rollingBack ? 'Rolling back...' : `↺ Roll Back to Level ${td._level_up_snapshots?.length > 0 ? td._level_up_snapshots[td._level_up_snapshots.length - 1].level : td._level_up_snapshot.level}`}
            </button>
          </div>
        )}

        <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Ability Scores</div>
        <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:10,lineHeight:1.5}}>
          Enter the <b>base score</b> (point buy / rolled + ASIs, before any race or item bonuses). Race and item bonuses are shown below the input for reference — they apply live on top of whatever you enter here.
        </div>
        {(() => {
          // Compute per-ability breakdowns for display - race and items/feats each separately
          // so the player can see exactly what's stacking on their base score.
          const raceBonuses = Object.fromEntries(ABILITY_KEYS.map(k => [k, 0]));
          (RACE_ABILITY_BONUSES[character.race] || []).forEach(b => { raceBonuses[b.stat] = (raceBonuses[b.stat] || 0) + b.value; });
          const { abilityAdds: itemFeatAdds, abilityOverrides: itemFeatOverrides } = computeItemBonuses(buffItems);
          return (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:16}}>
              {ABILITY_KEYS.map(k => {
                const base = parseInt(scores[k]) || 10;
                const raceBonus = raceBonuses[k] || 0;
                const itemAdd = itemFeatAdds[k] || 0;
                const miscVal = parseInt(abMisc[k]) || 0;
                const setOverride = itemFeatOverrides[k] ?? null;
                let total = base + raceBonus + itemAdd + miscVal;
                if (setOverride !== null) total = Math.max(total, setOverride);
                const mod = modifier(total);
                const isContaminated = !!contamination[k];
                return (
                  <div key={k} style={{background:'var(--bg-primary)',borderRadius:'var(--radius-md)',padding:10,border:`1px solid ${isContaminated ? 'var(--warning)' : 'var(--border)'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
                      <span style={{fontSize:11,color:'var(--text-dim)',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>{k}</span>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:22,fontWeight:700,color:'var(--accent-light)',lineHeight:1}}>{total}</div>
                        <div style={{fontSize:11,color:'var(--text-secondary)'}}>{mod >= 0 ? '+' : ''}{mod}</div>
                      </div>
                    </div>
                    <div style={{borderTop:'1px solid var(--border)',paddingTop:8,display:'flex',flexDirection:'column',gap:4}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:11,color:'var(--text-secondary)'}}>Base</span>
                        <input type="number" min={1} max={30} value={scores[k] ?? 10}
                          onChange={e => setScores(s => ({...s,[k]:e.target.value}))}
                          style={{width:48,textAlign:'center',padding:'2px 4px',fontSize:12,border:`1px solid ${isContaminated ? 'var(--warning)' : 'var(--border)'}`,borderRadius:'var(--radius-sm)',background:'var(--bg-card)',color:'var(--text-primary)'}} />
                      </div>
                      {raceBonus !== 0 && (
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:10,color:'var(--text-dim)'}}>{character.race}</span>
                          <span style={{fontSize:11,color: raceBonus > 0 ? 'var(--success)' : 'var(--danger)'}}>{raceBonus > 0 ? '+' : ''}{raceBonus}</span>
                        </div>
                      )}
                      {itemAdd !== 0 && (
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:10,color:'var(--text-dim)'}}>Items / Feats</span>
                          <span style={{fontSize:11,color:'var(--success)'}}>+{itemAdd}</span>
                        </div>
                      )}
                      {setOverride !== null && (
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:10,color:'var(--text-dim)'}}>Set override</span>
                          <span style={{fontSize:11,color:'var(--accent-light)'}}>{setOverride}</span>
                        </div>
                      )}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:10,color:'var(--text-dim)'}}>Misc</span>
                        <input type="number" value={abMisc[k] ?? 0}
                          onChange={e => setAbMisc(m => ({...m,[k]:e.target.value}))}
                          style={{width:48,textAlign:'center',padding:'2px 4px',fontSize:12,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-card)',color:'var(--text-primary)'}} />
                      </div>
                    </div>
                    {isContaminated && (
                      <div style={{fontSize:10,color:'var(--warning)',marginTop:6,lineHeight:1.3}}>
                        ⚠ Base matches "{contamination[k]}"'s Set-To — likely includes that item's bonus. Lower to your true unmodified score.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8,marginTop:8}}>Armor Class</div>
        {(() => {
          const normScores = Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(scores[k]) || 10]));
          const normMisc = Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(abMisc[k]) || 0]));
          const { abilityAdds, abilityOverrides } = computeItemBonuses(buffItems);
          const effScores = Object.fromEntries(ABILITY_KEYS.map(k => {
            let v = normScores[k] + (normMisc[k] || 0) + (abilityAdds[k] || 0);
            if (abilityOverrides[k] != null) v = Math.max(v, abilityOverrides[k]);
            return [k, v];
          }));
          const { formula: unarmoredFormula, ac: unarmoredBase } = unarmoredAC(character.class_name, effScores, td.features);
          const { acOverrideRaw, ac_base: itemAddAc } = computeItemBonuses(buffItems);
          const dexMod = modifier(effScores.DEX || 10);
          const resolvedOverride = acOverrideRaw !== null
            ? acOverrideRaw.value + (acOverrideRaw.ability ? cappedModifier(effScores[acOverrideRaw.ability] ?? 10, acOverrideRaw.cap) : 0)
            : null;
          const baseAcDisplay = resolvedOverride != null ? resolvedOverride : unarmoredBase;
          const totalAc = baseAcDisplay + (itemAddAc || 0) + (parseInt(acMisc) || 0);
          const Row = ({label, value, editable, onChange, dim}) => (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:12,color: dim ? 'var(--text-dim)' : 'var(--text-secondary)'}}>{label}</span>
              {editable
                ? <input type="number" value={value} onChange={onChange} style={{width:56,textAlign:'center',padding:'2px 4px',fontSize:12,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-card)',color:'var(--text-primary)'}} />
                : <span style={{fontSize:12,fontWeight: !dim ? 600 : 400,color: dim ? 'var(--text-dim)' : 'var(--text-primary)'}}>{value}</span>}
            </div>
          );
          return (
            <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-md)',padding:12,marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
                <span style={{fontSize:11,color:'var(--text-dim)',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>AC</span>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:26,fontWeight:700,color:'var(--accent-light)',lineHeight:1}}>{totalAc}</div>
                </div>
              </div>
              {resolvedOverride != null
                ? <Row label={`Armor override${acOverrideRaw.ability ? ` (${acOverrideRaw.value} + ${acOverrideRaw.ability}${acOverrideRaw.cap != null ? `, max +${acOverrideRaw.cap}` : ''})` : ` (flat ${acOverrideRaw.value})`}`} value={resolvedOverride} dim />
                : <Row label={`Unarmored (${unarmoredFormula})`} value={unarmoredBase} dim />}
              {(itemAddAc||0) !== 0 && <Row label="Shield / Items" value={`+${itemAddAc}`} dim />}
              <Row label="Misc (spells, natural armor…)" value={acMisc} editable onChange={e => setAcMisc(e.target.value)} />
              <div style={{fontSize:10,color:'var(--text-dim)',marginTop:6}}>
                Use the "Set Base AC To" item modifier on armor items to model equipped armor. Misc covers anything else that doesn't come from an item — Mage Armor (13+DEX), Natural Armor, Barkskin, Shield of Faith, etc.
              </div>
            </div>
          );
        })()}

        <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8,marginTop:8}}>Saving Throw Proficiencies</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:16}}>
          {ABILITY_KEYS.map(ab => (
            <label key={ab} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer'}}>
              <input type="checkbox" checked={saveProfs.includes(ab)} onChange={()=>toggleSave(ab)} />
              <span style={{fontSize:13}}>{ABILITY_LABELS[ab]}</span>
            </label>
          ))}
        </div>

        <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Skill Proficiencies</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))',gap:6,marginBottom:8}}>
          {Object.keys(SKILL_MAP).map(skill => (
            <div key={skill} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'4px 8px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
              <span style={{fontSize:12,color:'var(--text-primary)'}}>{skill}</span>
              <div style={{display:'flex',gap:8}}>
                <label style={{display:'flex',alignItems:'center',gap:3,cursor:'pointer'}} title="Proficient">
                  <input type="checkbox" checked={skillProfs.includes(skill)} onChange={()=>toggleSkillProf(skill)} />
                  <span style={{fontSize:10,color:'var(--text-dim)'}}>Prof</span>
                </label>
                <label style={{display:'flex',alignItems:'center',gap:3,cursor:'pointer'}} title="Expertise (double proficiency bonus)">
                  <input type="checkbox" checked={skillExpertise.includes(skill)} onChange={()=>toggleSkillExpertise(skill)} />
                  <span style={{fontSize:10,color:'var(--text-dim)'}}>Exp</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {error && <div style={{color:'var(--danger)',fontSize:12,marginTop:8}}>{error}</div>}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={saving} onClick={saveAll}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
      {levelingUpClass && (
        <LevelUpFlowModal initialLevelingClass={levelingUpClass} onClose={() => { setLevelingUpClass(null); syncDraftFromCharacter(character); }} />
      )}
      {previewing && (
        <ClassFeatureBrowserModal
          lockedClass={previewing.class_name}
          lockedSubclass={previewing.subclass}
          maxLevel={previewing.maxLevel}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
