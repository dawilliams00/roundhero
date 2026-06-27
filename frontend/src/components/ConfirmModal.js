import React from 'react';

// Drop-in replacement for window.confirm() - same visual language as every other
// popup in the app instead of the browser's native dialog.
export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{maxWidth:340}} onClick={e => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        <p style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{message}</p>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} style={{flex:1}} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
