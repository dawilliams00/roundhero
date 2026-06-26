import React from 'react';
export default function AbilityDetailModal({ ability, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{ability.name}</h2>
          {ability.source && <div style={{color:'var(--text-dim)',fontSize:12}}>{ability.source}</div>}
        </div>
        <div className="modal-body">
          <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{ability.description}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
