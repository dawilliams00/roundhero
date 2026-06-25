import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { calcSkills } from '../utils/dnd';

export default function SkillsModal({ onClose }) {
  const { character }   = useCharacter();
  const [search, setSearch] = useState('');
  if (!character) return null;
  const skills = calcSkills(character.ability_scores, [], [], character.level)
    .filter(s => s.skill.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.bonus - a.bonus);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:340}}>
        <h2>Skills</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills..." style={{width:'100%',marginBottom:12}} autoFocus />
        <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:360,overflowY:'auto'}}>
          {skills.map(({ skill, ability, bonus, proficient, expertise }) => (
            <div key={skill} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:8,height:8,borderRadius:'50%',background: expertise ? 'var(--warning)' : proficient ? 'var(--accent)' : 'var(--border)',border: proficient||expertise ? 'none' : '1px solid var(--border)'}}/>
                <span style={{color:'var(--text-primary)',fontSize:13}}>{skill}</span>
                <span style={{color:'var(--text-dim)',fontSize:11}}>({ability})</span>
              </div>
              <span style={{color:'var(--accent-light)',fontWeight:600}}>{bonus >= 0 ? `+${bonus}` : bonus}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:'var(--text-dim)',marginTop:8}}>🟣 Proficient · 🟡 Expertise (add your proficiencies in Tracker)</div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:12}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
