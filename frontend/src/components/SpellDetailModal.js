import React from 'react';

export default function SpellDetailModal({ spell, onRemove, onClose }) {
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
