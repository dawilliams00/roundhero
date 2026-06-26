import React from 'react';
import { useCharacter } from '../context/CharacterContext';
import { calcSaves, ABILITY_KEYS, ABILITY_LABELS } from '../utils/dnd';

export default function SavesModal({ onClose }) {
  const { character } = useCharacter();
  if (!character) return null;
  const savedProfs = character.tracker_data?.save_proficiencies;
  const saves = calcSaves(character.ability_scores, character.class_name, character.level, savedProfs);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:320}}>
        <h2>Saving Throws</h2>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {ABILITY_KEYS.map(ab => {
            const { bonus, proficient } = saves[ab];
            return (
              <div key={ab} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',border:`1px solid ${proficient ? 'var(--accent)' : 'var(--border)'}`}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {proficient && <div style={{width:8,height:8,borderRadius:'50%',background:'var(--accent)'}}/>}
                  {!proficient && <div style={{width:8,height:8,borderRadius:'50%',border:'1px solid var(--border)'}}/>}
                  <span style={{color:'var(--text-primary)',fontWeight:500}}>{ABILITY_LABELS[ab]}</span>
                </div>
                <span style={{color: proficient ? 'var(--accent-light)' : 'var(--text-primary)',fontWeight:700,fontSize:16}}>
                  {bonus >= 0 ? `+${bonus}` : bonus}
                </span>
              </div>
            );
          })}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
