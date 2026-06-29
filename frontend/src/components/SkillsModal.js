import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { calcSkills, rollD20, featBuffItems } from '../utils/dnd';
import D20Icon from './D20Icon';

export default function SkillsModal({ onClose }) {
  const { character }   = useCharacter();
  const [search, setSearch] = useState('');
  const [lastRoll, setLastRoll] = useState(null);
  if (!character) return null;
  const skillProfs = character.tracker_data?.skill_proficiencies || [];
  const items = [...(character.tracker_data?.inventory?.items || []), ...featBuffItems(character.tracker_data?.features)];
  const skills = calcSkills(character.ability_scores, skillProfs, [], character.level, items)
    .filter(s => s.skill.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.bonus - a.bonus);

  const roll = (skill, bonus) => {
    const d = rollD20();
    setLastRoll({ skill, d, bonus, total: d + bonus });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:340}}>
        <h2>Skills</h2>
        {lastRoll && (
          <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:'8px 10px',marginBottom:10,textAlign:'center'}}>
            <span style={{color:'var(--text-secondary)',fontSize:12}}>{lastRoll.skill}: </span>
            <span style={{color: lastRoll.d===20 ? 'var(--success)' : lastRoll.d===1 ? 'var(--danger)' : 'var(--text-primary)',fontWeight:600}}>
              <D20Icon size={15} color={lastRoll.d===20 ? 'var(--success)' : lastRoll.d===1 ? 'var(--danger)' : 'var(--accent-light)'} style={{marginRight:3}} />{lastRoll.d}
            </span>
            <span style={{color:'var(--text-dim)'}}> {lastRoll.bonus>=0?'+':''}{lastRoll.bonus} = </span>
            <span style={{color:'var(--accent-light)',fontWeight:700,fontSize:16}}>{lastRoll.total}</span>
          </div>
        )}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills..." style={{width:'100%',marginBottom:12}} autoFocus />
        <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:360,overflowY:'auto'}}>
          {skills.map(({ skill, ability, bonus, proficient, expertise }) => (
            <div key={skill} onClick={() => roll(skill, bonus)} title="Click to roll d20 + bonus" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:8,height:8,borderRadius:'50%',background: expertise ? 'var(--warning)' : proficient ? 'var(--accent)' : 'var(--border)',border: proficient||expertise ? 'none' : '1px solid var(--border)'}}/>
                <span style={{color:'var(--text-primary)',fontSize:13}}>{skill}</span>
                <span style={{color:'var(--text-dim)',fontSize:11}}>({ability})</span>
              </div>
              <span style={{color:'var(--accent-light)',fontWeight:600}}>{bonus >= 0 ? `+${bonus}` : bonus}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:'var(--text-dim)',marginTop:8}}>🟣 Proficient · 🟡 Expertise · Click a skill to roll</div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:12}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
