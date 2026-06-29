import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import InfoModal from './InfoModal';
import { ABILITY_KEYS, ABILITY_LABELS, SAVE_PROFS, SKILL_MAP } from '../utils/dnd';

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
          <div className="form-group"><label>Class</label><input value={identity.class_name} onChange={e=>setIdentity(f=>({...f,class_name:e.target.value}))} placeholder="e.g. Wizard, or Wizard 10 / Fighter 3" /></div>
          <div className="form-group"><label>Subclass</label><input value={identity.subclass} onChange={e=>setIdentity(f=>({...f,subclass:e.target.value}))} /></div>
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
            <div className="form-group" key={k} style={{maxWidth:80}}>
              <label>{k}</label>
              <input type="number" min={1} max={30} value={scores[k] ?? 10} onChange={e=>setScores(s=>({...s,[k]:e.target.value}))} />
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
