import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { METAMAGIC_OPTIONS, SORCERY_POINTS_TO_SLOT_COST, sorceryDisplayName } from '../utils/dnd';

// Font of Magic's Flexible Casting (convert sorcery points <-> a spell slot) plus a
// checklist of which Metamagic options this character knows - SpellDetailModal reads
// tracker_data.metamagic_known to offer applying one of them during a cast.
export default function SorceryPointsModal({ featureName, onClose }) {
  const { character, saveTrackerData, turnUsed, setTurnUsed } = useCharacter();
  const [tab, setTab] = useState('casting');
  const [message, setMessage] = useState(null);

  if (!character) return null;
  const td = character.tracker_data || {};
  const feature = td.features?.[featureName] || { current: 0, max: 0 };
  const points = feature.current || 0;
  const slots = td.spell_slots || {};
  const knownMetamagic = td.metamagic_known || [];

  // Both Flexible Casting moves are RAW a bonus action - mark that bucket consumed the
  // same way any other bonus-action ability would, when in initiative.
  const markBonusAction = () => {
    if (td.in_initiative) setTurnUsed(p => ({ ...p, 'Bonus Action': true }));
  };

  const createSlot = async (level) => {
    const cost = SORCERY_POINTS_TO_SLOT_COST[level];
    if (points < cost) { setMessage(`Not enough sorcery points - need ${cost}, have ${points}.`); return; }
    const slot = slots[String(level)] || { current: 0, max: 0 };
    await saveTrackerData({
      ...td,
      features: { ...td.features, [featureName]: { ...feature, current: points - cost } },
      spell_slots: { ...slots, [level]: { current: slot.current + 1, max: slot.max + 1 } },
    });
    markBonusAction();
    setMessage(`Created a level ${level} spell slot for ${cost} sorcery points. It vanishes on your next long rest if unused.`);
  };

  const convertSlotToPoints = async (level) => {
    const slot = slots[String(level)];
    if (!slot || slot.current <= 0) return;
    await saveTrackerData({
      ...td,
      features: { ...td.features, [featureName]: { ...feature, current: Math.min(feature.max, points + level) } },
      spell_slots: { ...slots, [level]: { ...slot, current: slot.current - 1 } },
    });
    markBonusAction();
    setMessage(`Converted a level ${level} slot into ${level} sorcery points.`);
  };

  const toggleKnown = (name) => {
    const next = knownMetamagic.includes(name) ? knownMetamagic.filter(n => n !== name) : [...knownMetamagic, name];
    saveTrackerData({ ...td, metamagic_known: next });
  };

  const availableSlotLevels = Object.entries(slots).filter(([,s]) => (s.current||0) > 0).map(([lvl]) => parseInt(lvl)).sort((a,b)=>a-b);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{sorceryDisplayName(featureName)}</h2>
          <div style={{color:'var(--accent-light)',fontSize:13,fontWeight:600}}>{points}/{feature.max} Sorcery Points</div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button className={tab==='casting' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('casting')}>Flexible Casting</button>
            <button className={tab==='metamagic' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('metamagic')}>Metamagic</button>
          </div>
        </div>
        <div className="modal-body">
          {tab === 'casting' ? (
            <>
              <div style={{marginBottom:16}}>
                <div style={{color:'var(--text-secondary)',fontSize:13,fontWeight:600,marginBottom:6}}>Create a Spell Slot (bonus action)</div>
                <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8}}>Spend points for a slot up to 5th level. Vanishes on your next long rest if unused.</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {Object.entries(SORCERY_POINTS_TO_SLOT_COST).map(([lvl, cost]) => (
                    <button key={lvl} className="btn btn-secondary btn-sm" disabled={points < cost} onClick={() => createSlot(parseInt(lvl))}>
                      L{lvl} ({cost} SP)
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{color:'var(--text-secondary)',fontSize:13,fontWeight:600,marginBottom:6}}>Convert a Spell Slot to Points (bonus action)</div>
                <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8}}>Gain sorcery points equal to the slot's level.</div>
                {availableSlotLevels.length === 0 ? (
                  <div style={{color:'var(--text-dim)',fontSize:12}}>No spell slots available to convert.</div>
                ) : (
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {availableSlotLevels.map(lvl => (
                      <button key={lvl} className="btn btn-secondary btn-sm" onClick={() => convertSlotToPoints(lvl)}>
                        L{lvl} slot → {lvl} SP
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>
                Mark which Metamagic options you know (2 at 3rd level, more from your subclass or feats). Once marked here, you can apply one of these from the Cast popup when you cast a spell.
              </div>
              {Object.entries(METAMAGIC_OPTIONS).map(([name, opt]) => (
                <label key={name} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                  <input type="checkbox" checked={knownMetamagic.includes(name)} onChange={() => toggleKnown(name)} style={{marginTop:3}} />
                  <div>
                    <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>
                      {name} <span style={{color:'var(--text-dim)',fontWeight:400,fontSize:11}}>({opt.cost === 'level' ? "SP = spell's level" : `${opt.cost} SP`})</span>
                    </div>
                    <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2}}>{opt.text}</div>
                  </div>
                </label>
              ))}
            </>
          )}
          {message && <div style={{color:'var(--success)',fontSize:12,marginTop:12,textAlign:'center'}}>{message}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" style={{width:'100%'}} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
