import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import InfoModal from './InfoModal';
import { ABILITY_KEYS, ABILITY_LABELS, SAVE_PROFS, SKILL_MAP, suspectedAbilityContamination, featBuffItems } from '../utils/dnd';

// Full base-stat editor - identity, ability scores, and save/skill proficiencies, on top
// of the original v1 level-up-only framework. This is the one place all of the
// feat/item/lineage buff work (which all reads ability_scores/save_proficiencies/
// skill_proficiencies as its starting point) can actually be corrected by hand, since
// none of those three were ever directly editable anywhere else - ability scores have a
// header click-to-edit box per-stat, but save/skill proficiencies had no UI at all and
// manually-created characters never got skill_proficiencies populated in the first place.
export default function CharacterEditorModal({ onClose }) {
  const { character, setCharacter, updateCharacter, saveTrackerData } = useCharacter();
  const [leveling, setLeveling] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const td = character?.tracker_data || {};
  const [identity, setIdentity] = useState(character ? {
    name: character.name || '', race: character.race || '',
    class_name: character.class_name || '', subclass: character.subclass || '',
    level: character.level || 1,
  } : null);
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

  if (!character) return null;

  const levelUp = async () => {
    setLeveling(true);
    setError(null);
    try {
      const r = await api.post(`/characters/${character.id}/level_up`);
      setCharacter(r.data);
      setSummary(r.data.level_up_summary);
      setIdentity(f => ({ ...f, level: r.data.level }));
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not level up.');
    } finally {
      setLeveling(false);
    }
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
      await updateCharacter(character.id, {
        name: identity.name.trim() || character.name,
        race: identity.race.trim(),
        class_name: identity.class_name.trim(),
        subclass: identity.subclass.trim(),
        level: parseInt(identity.level) || character.level,
        ability_scores: Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(scores[k]) || 10])),
      });
      await saveTrackerData({
        ...td,
        save_proficiencies: saveProfs,
        skill_proficiencies: skillProfs,
        skill_expertise: skillExpertise,
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
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <button className="btn btn-secondary" disabled={leveling || character.level >= 20} onClick={levelUp}>
            {leveling ? 'Leveling up...' : `Level Up to ${character.level + 1} (engine)`}
          </button>
          <span style={{color:'var(--text-dim)',fontSize:11}}>Recomputes HP/slots/features. PDF-imported or multiclass characters should edit Level above by hand instead.</span>
        </div>

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
      {summary && (
        <InfoModal
          title={`Welcome to Level ${summary.new_level}!`}
          message={`HP max increased by ${summary.hp_gained}. New features and spell slots (if any) for this level have been added — check the Feats/Attunement and Spells tabs.`}
          onClose={() => setSummary(null)}
        />
      )}
    </div>
  );
}
