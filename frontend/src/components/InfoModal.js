import React from 'react';

// Drop-in replacement for window.alert() - same visual language as every other
// popup in the app instead of the browser's native dialog.
export default function InfoModal({ title, message, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:340}} onClick={e => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        <p style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{message}</p>
        <button className="btn btn-primary" style={{width:'100%',marginTop:8}} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
