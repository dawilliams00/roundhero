import React from 'react';
export default function AbilityDetailModal({ ability, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{ability.name}</h2>
        {ability.source && <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>{ability.source}</div>}
        <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{ability.description}</p>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
