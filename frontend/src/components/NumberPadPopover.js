import React, { useState } from 'react';

// Shared relative-adjustment numeric keypad popover - same pattern as the header's
// currency calculator (CoinCalculator in CharacterHeader.js), extracted so HP editing
// can use it too. Always a relative +/- delta handed to onApply, never an absolute set -
// matches the currency popover's existing convention.
export default function NumberPadPopover({ label, value, color = 'var(--accent-light)', onApply, onClose, position = 'below' }) {
  const [digits, setDigits] = useState('');
  const [mode, setMode] = useState('add');
  const press = (d) => setDigits(prev => (prev + d).slice(0, 7));
  const n = parseInt(digits) || 0;
  const apply = () => {
    onApply(mode === 'add' ? n : -n);
    onClose();
  };
  const posStyle = position === 'below'
    ? { position: 'absolute', left: 0, top: '100%', marginTop: 6 }
    : { position: 'absolute', right: '100%', top: 0, marginRight: 8 };
  return (
    <div style={{...posStyle, background:'var(--bg-card)', border:`1px solid ${color}`, borderRadius:'var(--radius-md)', padding:10, zIndex:2900, width:150, boxShadow:'var(--shadow)'}} onClick={e => e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{color, fontWeight:700, fontSize:12}}>{label}: {value}</span>
        <span onClick={onClose} style={{cursor:'pointer',color:'var(--text-dim)',fontSize:14}}>✕</span>
      </div>
      <div style={{textAlign:'center',fontSize:18,fontWeight:700,color: mode==='add' ? 'var(--success)' : 'var(--danger)',marginBottom:6}}>{mode==='add'?'+':'−'}{digits || 0}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,marginBottom:6}}>
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => press(d)} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-primary)',borderRadius:4}}>{d}</button>
        ))}
        <button onClick={() => setDigits('')} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4}}>C</button>
        <button onClick={() => press('0')} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-primary)',borderRadius:4}}>0</button>
        <button onClick={() => setDigits(d => d.slice(0,-1))} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4}}>⌫</button>
      </div>
      <div style={{display:'flex',gap:4,marginBottom:6}}>
        <button onClick={() => setMode('add')} style={{flex:1,padding:'6px 0',background: mode==='add' ? 'var(--success)' : 'var(--bg-hover)',color:'#fff',borderRadius:4,fontWeight:700}}>+</button>
        <button onClick={() => setMode('subtract')} style={{flex:1,padding:'6px 0',background: mode==='subtract' ? 'var(--danger)' : 'var(--bg-hover)',color:'#fff',borderRadius:4,fontWeight:700}}>−</button>
      </div>
      <button className="btn btn-primary btn-sm" style={{width:'100%'}} onClick={apply}>Apply</button>
    </div>
  );
}
