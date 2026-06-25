import React from 'react';
export default function RestModal({ onClose, onRest }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:320,textAlign:'center'}}>
        <h2>Take a Rest</h2>
        <p style={{color:'var(--text-secondary)',marginBottom:24,fontSize:13}}>Choose rest type. All matching features and slots will reset.</p>
        <div style={{display:'flex',gap:12}}>
          <button className="btn btn-secondary" style={{flex:1,padding:'12px'}} onClick={() => onRest('short')}>
            <div style={{fontSize:20,marginBottom:4}}>☕</div>
            <div style={{fontWeight:500}}>Short Rest</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>Spend hit dice</div>
          </button>
          <button className="btn btn-primary" style={{flex:1,padding:'12px'}} onClick={() => onRest('long')}>
            <div style={{fontSize:20,marginBottom:4}}>🌙</div>
            <div style={{fontWeight:500}}>Long Rest</div>
            <div style={{fontSize:11,marginTop:2}}>Full reset</div>
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" style={{marginTop:16}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
