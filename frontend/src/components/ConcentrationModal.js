import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { concentrationSlotCount, HASTED_EFFECT, LETHARGIC_CONDITION, HARDCODED_CONDITION_INFO } from '../utils/dnd';
import InfoModal from './InfoModal';

export default function ConcentrationModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const [infoMessage, setInfoMessage] = useState(null);
  if (!character) return null;
  const td = character.tracker_data || {};
  const items = td.inventory?.items || [];
  const slots = td.concentration?.slots || [];
  const maxSlots = concentrationSlotCount(items);

  // Build and save every change from one consistent snapshot of tracker_data in a single
  // call. Dropping, then separately removing the Hasted effect, then separately adding the
  // Lethargic condition (three sequential saveTrackerData-based calls) each spread the SAME
  // stale pre-click tracker_data, so the second/third call's save clobbered the first's
  // change - the slot looked like it never dropped, and Haste never actually went away.
  const drop = async (idx) => {
    const conc = td.concentration || {};
    const newSlots = [...(conc.slots || [{}, {}])];
    const dropped = (newSlots[idx]?.spell || '').trim();
    newSlots[idx] = { spell: '', level: '' };
    const wasHaste = dropped.toLowerCase() === 'haste';
    const activeEffects = td.active_effects || [];
    const conditions = td.conditions || [];
    await saveTrackerData({
      ...td,
      concentration: { ...conc, slots: newSlots },
      ...(wasHaste ? {
        active_effects: activeEffects.filter(e => e !== HASTED_EFFECT),
        conditions: conditions.includes(LETHARGIC_CONDITION) ? conditions : [...conditions, LETHARGIC_CONDITION],
      } : {}),
    });
    if (wasHaste) {
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
