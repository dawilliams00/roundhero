import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { concentrationSlotCount, HASTED_EFFECT, LETHARGIC_CONDITION, HARDCODED_CONDITION_INFO } from '../utils/dnd';
import InfoModal from './InfoModal';

export default function ConcentrationModal({ onClose }) {
  const { character, dropConcentration, removeActiveEffect, addCondition } = useCharacter();
  const [infoMessage, setInfoMessage] = useState(null);
  if (!character) return null;
  const td = character.tracker_data || {};
  const items = td.inventory?.items || [];
  const slots = td.concentration?.slots || [];
  const maxSlots = concentrationSlotCount(items);

  const drop = async (idx) => {
    const dropped = await dropConcentration(idx);
    if (dropped && dropped.toLowerCase() === 'haste') {
      await removeActiveEffect(HASTED_EFFECT);
      await addCondition(LETHARGIC_CONDITION);
      setInfoMessage(`Haste ended - ${LETHARGIC_CONDITION} applied.\n\n${HARDCODED_CONDITION_INFO[LETHARGIC_CONDITION]}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:340}}>
        <h2>Concentration</h2>
        {[0, 1].map(idx => {
          const active = idx < maxSlots;
          const slot = slots[idx] || {};
          const spell = (slot.spell || '').trim();
          return (
            <div key={idx} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',marginBottom:8,background: active ? 'var(--bg-primary)' : 'var(--bg-hover)',borderRadius:'var(--radius-sm)',opacity: active ? 1 : 0.5}}>
              <div>
                <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Slot {idx + 1}</div>
                <div style={{color: active ? 'var(--text-primary)' : 'var(--text-dim)',fontWeight:600,fontSize:14}}>
                  {!active ? 'Locked' : spell ? `${spell}${slot.level ? ` (L${slot.level})` : ''}` : 'Empty'}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" disabled={!active || !spell} onClick={() => drop(idx)}>Drop</button>
            </div>
          );
        })}
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>
          Slots fill automatically when you cast a concentration spell through the app.
        </div>
        <button className="btn btn-primary" style={{width:'100%'}} onClick={onClose}>Close</button>
      </div>
      {infoMessage && <InfoModal title="Haste Ended" message={infoMessage} onClose={() => setInfoMessage(null)} />}
    </div>
  );
}
