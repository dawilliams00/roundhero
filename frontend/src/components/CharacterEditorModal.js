import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import LevelUpFlowModal from './LevelUpFlowModal';
import ClassFeatureBrowserModal from './ClassFeatureBrowserModal';
import { ABILITY_KEYS, ABILITY_LABELS, SAVE_PROFS, SKILL_MAP, suspectedAbilityContamination, featBuffItems } from '../utils/dnd';

// Full base-stat editor - identity, ability scores, and save/skill proficiencies, on top
// of the original v1 level-up-only framework. This is the one place all of the
// feat/item/lineage buff work (which all reads ability_scores/save_proficiencies/
// skill_proficiencies as its starting point) can actually be corrected by hand, since
// none of those three were ever directly editable anywhere else - ability scores have a
// header click-to-edit box per-stat, but save/skill proficiencies had no UI at all and
// manually-created characters never got skill_proficiencies populated in the first place.
export default function CharacterEditorModal({ onClose }) {
  const { character, setCharacter, updateCharacter, saveTrackerData, rollbackLevelUp } = useCharacter();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelingUpClass, setLevelingUpClass] = useState(null);
  const [previewing, setPreviewing] = useState(null); // { class_name, level } | null
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [settingSubclassFor, setSettingSubclassFor] = useState(null);

  const td = character?.tracker_data || {};
  const [identity, setIdentity] = useState(character ? {
    name: character.name || '', race: character.race || '',
    class_name: character.class_name || '', subclass: character.subclass || '',
    level: character.level || 1,
  } : null);
  // Once tracker_data.classes exists (confirmed via the level-up flow, or set up below),
  // this structured per-class list replaces the single free-text class_name/subclass/
  // level fields entirely - an explicit "Class 1 / Class 2" row each with its own
  // independent Level Up button, per the owner's explicit preference over a popup
  // radio-button chooser for which class is leveling.
  const [classesDraft, setClassesDraft] = useState(character && td.classes ? td.classes.map(c => ({...c})) : null);
  const [classSubOptions, setClassSubOptions] = useState({});
  const [scores, setScores] = useState(character ? { ...character.ability_scores } : null);
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

  // Class/Subclass start as dropdowns sourced from the engine's known class list (same
  // /content/classes(/<name>/subclasses) endpoints CharacterSetup.js already uses) so a
  // manually-created character can't drift into a typo'd or unrecognized name. A
  // PDF-imported or multiclass character's class_name (e.g. "Wizard 13" or "Paladin 6 /
  // Sorcerer 6") won't match any single known class, so this falls back to free text for
  // both fields automatically - and the player can flip back to free text manually too.
  const [classList, setClassList] = useState([]);
  const [subclassOptions, setSubclassOptions] = useState([]);
  const [classMode, setClassMode] = useState('custom');

  // Intentionally runs once on mount only - this modal remounts fresh every time it's
  // opened (SettingsModal renders it behind `showEditor &&`), so `character` here is
  // never stale, and re-running this on every keystroke elsewhere would be wasteful.
  useEffect(() => {
    api.get('/content/classes').then(r => {
      const list = r.data || [];
      setClassList(list);
      if (character && list.some(c => c.name === character.class_name)) setClassMode('known');
    });
  }, []);

  // Only fetches once class_name is an exact match in classList - guards against firing
  // this for a still-unmatched value sitting in the field right after flipping into
  // 'known' mode (e.g. a multiclass "Paladin 6 / Sorcerer 6" string, which would also
  // break the URL route since it contains a literal "/").
  useEffect(() => {
    if (classMode !== 'known' || !classList.some(c => c.name === identity?.class_name)) { setSubclassOptions([]); return; }
    api.get(`/content/classes/${encodeURIComponent(identity.class_name)}/subclasses`).then(r => setSubclassOptions(r.data || []));
  }, [classMode, identity?.class_name, classList]);

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
    setIdentity(f => ({ ...f, class_name: c.class_name, subclass: c.subclass || '', level: c.level }));
    setScores({ ...c.ability_scores });
    setClassesDraft(c.tracker_data.classes ? c.tracker_data.classes.map(x => ({ ...x })) : null);
  };

  // Bootstraps the structured Class 1/Class 2 view from whatever's currently in the
  // free-text fields - a single best-guess row from the existing Class/Level inputs,
  // ready to edit/confirm. Saved (and a second class added) the same way any other
  // structured-row edit is, via the outer Save Changes button.
  const setUpStructuredClasses = () => {
    const guessedName = classList.some(c => c.name === identity.class_name) ? identity.class_name : '';
    setClassesDraft([{ class_name: guessedName, level: parseInt(identity.level) || 1, subclass: identity.subclass || '' }]);
  };
  const addClassRow = () => setClassesDraft(d => [...d, { class_name: '', level: 1, subclass: '' }]);
  const removeClassRow = (idx) => setClassesDraft(d => d.filter((_, i) => i !== idx));
  const updateClassRow = (idx, patch) => setClassesDraft(d => d.map((c, i) => i === idx ? { ...c, ...patch } : c));

  // classesDraft is local/unsaved until "Save Changes" - but the per-row Level Up and
  // Subclass actions below hit the server immediately, which has no idea about a class
  // just added or edited in this draft. Both call this first so the server's
  // tracker_data.classes always matches what's on screen before acting on it.
  const persistClassesDraft = async () => {
    const cleaned = classesDraft.filter(c => c.class_name && c.level > 0);
    const r = await api.put(`/characters/${character.id}`, { tracker_data: { ...character.tracker_data, classes: cleaned } });
    setCharacter(r.data);
    setClassesDraft((r.data.tracker_data.classes || []).map(c => ({ ...c })));
    return r.data;
  };

  // Picking a subclass here calls the same endpoint LevelUpFlowModal's choose_subclass
  // step does (not just a draft field saved later) - it auto-grants that subclass's
  // class_features.json entries up to the class's current level immediately, so this row
  // and the level-up flow's own subclass prompt can never produce an inconsistent "subclass
  // set but its features never granted" state depending on which path picked it.
  const setRowSubclass = async (idx, subclassName) => {
    const cls = classesDraft[idx];
    setSettingSubclassFor(cls.class_name);
    try {
      await persistClassesDraft();
      const r = await api.post(`/characters/${character.id}/classes/subclass`, { class_name: cls.class_name, subclass_name: subclassName });
      setCharacter(r.data);
      setClassesDraft((r.data.tracker_data.classes || []).map(c => ({ ...c })));
    } finally {
      setSettingSubclassFor(null);
    }
  };

  const startLevelUpForRow = async (className) => {
    await persistClassesDraft();
    setLevelingUpClass(className);
  };

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

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      // Once classesDraft exists, it's the source of truth for class_name/subclass/level
      // (the free-text Identity fields aren't even shown in that mode) - class_name gets
      // the same single-vs-decorated-multiclass display convention the backend's
      // classes_to_display_name() uses, and `subclass` (the single-class display column)
      // is only meaningfully one value for an actual single-class character.
      const cleanedClasses = classesDraft ? classesDraft.filter(c => c.class_name && c.level > 0) : null;
      const classNameToSave = cleanedClasses
        ? (cleanedClasses.length === 1 ? cleanedClasses[0].class_name : cleanedClasses.map(c => `${c.class_name} ${c.level}`).join(' / '))
        : identity.class_name.trim();
      const levelToSave = cleanedClasses
        ? cleanedClasses.reduce((sum, c) => sum + (parseInt(c.level) || 0), 0)
        : (parseInt(identity.level) || character.level);
      const subclassToSave = cleanedClasses
        ? (cleanedClasses.length === 1 ? (cleanedClasses[0].subclass || '') : character.subclass)
        : identity.subclass.trim();

      await updateCharacter(character.id, {
        name: identity.name.trim() || character.name,
        race: identity.race.trim(),
        class_name: classNameToSave,
        subclass: subclassToSave,
        level: levelToSave,
        ability_scores: Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(scores[k]) || 10])),
      });
      await saveTrackerData({
        ...td,
        save_proficiencies: saveProfs,
        skill_proficiencies: skillProfs,
        skill_expertise: skillExpertise,
        ...(cleanedClasses ? { classes: cleanedClasses } : {}),
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
          <div className="form-group"><label>Race</label><input value={identity.race} onChange={e=>setIdentity(f=>({...f,race:e.target.value}))} /></div>
        </div>
        {classesDraft ? (
          <>
            <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8,marginTop:8}}>
              {classesDraft.length > 1 ? 'Classes (Multiclass)' : 'Class'}
            </div>
            {classesDraft.map((c, i) => (
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
                  <input type="number" min={1} max={20} value={c.level} onChange={e => updateClassRow(i, { level: parseInt(e.target.value) || 1 })} />
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
                  onClick={() => setPreviewing({ class_name: c.class_name, level: c.level })}>
                  📖 Preview
                </button>
                {classesDraft.length > 1 && (
                  <button className="btn btn-secondary btn-sm" style={{marginBottom:12}} onClick={() => removeClassRow(i)}>Remove</button>
                )}
              </div>
            ))}
            <div style={{marginBottom:16}}>
              <button className="btn btn-secondary btn-sm" onClick={addClassRow}>+ Add {classesDraft.length === 1 ? 'a Second Class (Multiclass)' : 'Another Class'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Class</label>
                {classMode === 'known' ? (
                  <select value={identity.class_name} onChange={e=>setIdentity(f=>({...f,class_name:e.target.value,subclass:''}))}>
                    {!classList.some(c => c.name === identity.class_name) && <option value={identity.class_name}>{identity.class_name}</option>}
                    {classList.map(c => <option key={c.name} value={c.name}>{c.name} (d{c.hit_die})</option>)}
                  </select>
                ) : (
                  <input value={identity.class_name} onChange={e=>setIdentity(f=>({...f,class_name:e.target.value}))} placeholder="e.g. Wizard, or Wizard 10 / Fighter 3" />
                )}
                <div style={{marginTop:4}}>
                  <button type="button" className="btn-link" style={{fontSize:11,color:'var(--text-dim)',background:'none',border:'none',padding:0,cursor:'pointer',textDecoration:'underline'}}
                    onClick={() => setClassMode(m => m === 'known' ? 'custom' : 'known')}>
                    {classMode === 'known' ? 'Use free text instead (multiclass/PDF)' : 'Pick from list instead'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Subclass</label>
                {classMode === 'known' && subclassOptions.length > 0 ? (
                  <select value={identity.subclass} onChange={e=>setIdentity(f=>({...f,subclass:e.target.value}))}>
                    <option value="">None / Not chosen</option>
                    {!subclassOptions.includes(identity.subclass) && identity.subclass && <option value={identity.subclass}>{identity.subclass} (custom)</option>}
                    {subclassOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input value={identity.subclass} onChange={e=>setIdentity(f=>({...f,subclass:e.target.value}))} />
                )}
              </div>
              <div className="form-group" style={{maxWidth:90}}><label>Level</label><input type="number" min={1} max={20} value={identity.level} onChange={e=>setIdentity(f=>({...f,level:e.target.value}))} /></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
              <button className="btn btn-secondary" disabled={character.level >= 20} onClick={() => setShowLevelUp(true)}>
                Level Up to {character.level + 1}
              </button>
              {classMode === 'known' && (
                <button className="btn btn-secondary btn-sm" title="Browse this class's features at any level, without committing to anything"
                  onClick={() => setPreviewing({ class_name: identity.class_name, level: parseInt(identity.level) || character.level })}>
                  📖 Preview
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={setUpStructuredClasses}>⚙ Set Up Structured Classes (per-class Level Up)</button>
              <span style={{color:'var(--text-dim)',fontSize:11}}>"Level Up" walks through class confirmation, subclass picks, and Ability Score Improvements as they come up. "Set Up Structured Classes" switches to explicit Class 1/Class 2 rows with their own Level Up buttons.</span>
            </div>
          </>
        )}
        {td._level_up_snapshot && (
          <div style={{marginBottom:16}}>
            <button className="btn btn-secondary" disabled={rollingBack} onClick={async () => {
              setRollingBack(true);
              try {
                syncDraftFromCharacter(await rollbackLevelUp());
              } finally { setRollingBack(false); }
            }}>
              {rollingBack ? 'Rolling back...' : `↺ Roll Back to Level ${td._level_up_snapshot.level}`}
            </button>
          </div>
        )}

        <div style={{fontSize:12,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Ability Scores</div>
        <div className="form-row" style={{flexWrap:'wrap'}}>
          {ABILITY_KEYS.map(k => (
            <div className="form-group" key={k} style={{maxWidth:120}}>
              <label>{k}{contamination[k] ? ' ⚠' : ''}</label>
              <input type="number" min={1} max={30} value={scores[k] ?? 10} onChange={e=>setScores(s=>({...s,[k]:e.target.value}))}
                style={contamination[k] ? {borderColor:'var(--warning)'} : undefined} />
              {contamination[k] && (
                <div style={{fontSize:10,color:'var(--warning)',marginTop:3,lineHeight:1.3}}>
                  Matches "{contamination[k]}"'s Set-To value - if this already includes that item's bonus, lower it to the true base.
                </div>
              )}
            </div>
          ))}
        </div>

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
      {showLevelUp && (
        <LevelUpFlowModal onClose={() => { setShowLevelUp(false); syncDraftFromCharacter(character); }} />
      )}
      {levelingUpClass && (
        <LevelUpFlowModal initialLevelingClass={levelingUpClass} onClose={() => { setLevelingUpClass(null); syncDraftFromCharacter(character); }} />
      )}
      {previewing && (
        <ClassFeatureBrowserModal
          initialClassFilter={previewing.class_name}
          initialLevel={previewing.level}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
