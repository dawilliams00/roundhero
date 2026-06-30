import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { calcSaves, ABILITY_KEYS, ABILITY_LABELS, rollD20, HASTED_EFFECT, featBuffItems, raceBuffItems } from '../utils/dnd';
import D20Icon from './D20Icon';

export default function SavesModal({ onClose }) {
  const { character } = useCharacter();
  const [lastRoll, setLastRoll] = useState(null);
  if (!character) return null;
  const savedProfs = character.tracker_data?.save_proficiencies;
  const items = [...(character.tracker_data?.inventory?.items || []), ...featBuffItems(character.tracker_data?.features), ...raceBuffItems(character.race)];
  const saves = calcSaves(character.ability_scores, character.class_name, character.level, savedProfs, items);
  const isHasted = (character.tracker_data?.active_effects || []).includes(HASTED_EFFECT);

  const roll = (label, bonus) => {
    const d = rollD20();
    setLastRoll({ label, d, bonus, total: d + bonus });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:320}}>
        <div className="modal-sticky-header">
          <h2>Saving Throws</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {lastRoll && (
          <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:'8px 10px',marginBottom:10,textAlign:'center'}}>
            <span style={{color:'var(--text-secondary)',fontSize:12}}>{lastRoll.label}: </span>
            <span style={{color: lastRoll.d===20 ? 'var(--success)' : lastRoll.d===1 ? 'var(--danger)' : 'var(--text-primary)',fontWeight:600}}>
              <D20Icon size={15} color={lastRoll.d===20 ? 'var(--success)' : lastRoll.d===1 ? 'var(--danger)' : 'var(--accent-light)'} style={{marginRight:3}} />{lastRoll.d}
            </span>
            <span style={{color:'var(--text-dim)'}}> {lastRoll.bonus>=0?'+':''}{lastRoll.bonus} = </span>
            <span style={{color:'var(--accent-light)',fontWeight:700,fontSize:16}}>{lastRoll.total}</span>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {ABILITY_KEYS.map(ab => {
            const { bonus, proficient } = saves[ab];
            return (
              <div key={ab} onClick={() => roll(ABILITY_LABELS[ab], bonus)} title="Click to roll d20 + bonus"
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',border:`1px solid ${proficient ? 'var(--accent)' : 'var(--border)'}`,cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {proficient && <div style={{width:8,height:8,borderRadius:'50%',background:'var(--accent)'}}/>}
                  {!proficient && <div style={{width:8,height:8,borderRadius:'50%',border:'1px solid var(--border)'}}/>}
                  <span style={{color:'var(--text-primary)',fontWeight:500}}>{ABILITY_LABELS[ab]}</span>
                  {ab === 'DEX' && isHasted && <span style={{color:'var(--success)',fontSize:10,fontWeight:700,border:'1px solid var(--success)',borderRadius:8,padding:'0 5px'}} title="Hasted grants advantage on Dexterity saving throws">ADV</span>}
                </div>
                <span style={{color: proficient ? 'var(--accent-light)' : 'var(--text-primary)',fontWeight:700,fontSize:16}}>
                  {bonus >= 0 ? `+${bonus}` : bonus}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:11,color:'var(--text-dim)',marginTop:8}}>Click a save to roll d20 + bonus</div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
