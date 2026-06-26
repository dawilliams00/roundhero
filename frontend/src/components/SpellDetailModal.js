import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';

export default function SpellDetailModal({ spell, onRemove, onClose, chargeMode }) {
  const { character, useSlot } = useCharacter();
  const [casting, setCasting] = useState(false);
  const [cast, setCast]       = useState(null);

  if (!character) return null;
  const slots = character.tracker_data?.spell_slots || {};
  const isCantrip = spell.level_int === 0;
  const availableLevels = Object.entries(slots)
    .filter(([lvl, s]) => parseInt(lvl) >= spell.level_int && (s.current || 0) > 0)
    .map(([lvl]) => parseInt(lvl))
    .sort((a,b) => a-b);
  const [castLevel, setCastLevel] = useState(availableLevels[0] || spell.level_int);

  const doCast = async () => {
    setCasting(true);
    try {
      if (chargeMode) {
        await chargeMode.onCast();
        setCast(`Cast using ${chargeMode.chargeCost} charge${chargeMode.chargeCost===1?'':'s'}!`);
      } else if (isCantrip) {
        setCast('Cast! (no slot used)');
      } else if (castLevel) {
        await useSlot(castLevel);
        setCast(`Cast at level ${castLevel}!`);
      }
    } finally { setCasting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{spell.name}</h2>
        <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
          {spell.level_int === 0 ? 'Cantrip' : `Level ${spell.level_int}`} · {spell.school}
          {spell.ritual ? ' · Ritual' : ''}{spell.concentration ? ' · Concentration' : ''}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
          <div><b>Casting Time:</b> {spell.casting_time}</div>
          <div><b>Range:</b> {spell.range}</div>
          <div><b>Components:</b> {spell.components}</div>
          <div><b>Duration:</b> {spell.duration}</div>
        </div>
        <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{spell.description}</p>

        <div style={{borderTop:'1px solid var(--border)',marginTop:12,paddingTop:12}}>
          {chargeMode ? (
            <>
              <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:8}}>
                {chargeMode.chargesCurrent}/{chargeMode.chargesMax} charges on {chargeMode.itemName}
              </div>
              {chargeMode.chargesCurrent < chargeMode.chargeCost ? (
                <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>Not enough charges remaining.</div>
              ) : (
                <button className="btn btn-primary" style={{width:'100%'}} disabled={casting} onClick={doCast}>
                  {casting ? 'Casting...' : `Cast — Use ${chargeMode.chargeCost} Charge${chargeMode.chargeCost===1?'':'s'}`}
                </button>
              )}
            </>
          ) : (
            <>
              {!isCantrip && availableLevels.length > 1 && (
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span style={{color:'var(--text-dim)',fontSize:12}}>Cast at level:</span>
                  <select value={castLevel} onChange={e => setCastLevel(parseInt(e.target.value))}>
                    {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
              {!isCantrip && availableLevels.length === 0 ? (
                <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>No spell slots available.</div>
              ) : (
                <button className="btn btn-primary" style={{width:'100%'}} disabled={casting} onClick={doCast}>
                  {casting ? 'Casting...' : isCantrip ? 'Cast (Cantrip)' : `Cast — Use Level ${castLevel} Slot`}
                </button>
              )}
            </>
          )}
          {cast && <div style={{color:'var(--success)',fontSize:12,marginTop:6,textAlign:'center'}}>{cast}</div>}
        </div>

        {onRemove && (
          <button className="btn btn-danger" style={{width:'100%',marginTop:12}} onClick={() => { onRemove(spell); onClose(); }}>
            Remove from Known Spells
          </button>
        )}
        <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
