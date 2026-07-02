import React, { useState } from 'react';

// "How do you want to do this?!" - the table ritual when a player lands a killing blow.
// Shows only that the target fell (never HP); the narration is optional flavor. If an
// onNarrate handler is given, the typed description is sent to the encounter as a note so
// the DM/table has a record - failures are swallowed, it's a celebration not a workflow.
export default function KillPromptModal({ targetName, onNarrate, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (onNarrate && t) {
      setSending(true);
      try { await onNarrate(t); } catch (e) { /* flavor only - never block the close */ }
      setSending(false);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" style={{zIndex:60}}>
      <div className="modal" style={{maxWidth:460,textAlign:'center'}} onClick={e => e.stopPropagation()}>
        <div style={{fontSize:40,lineHeight:1,marginBottom:8}}>⚔️</div>
        <h2 style={{color:'var(--accent-light)',marginBottom:6}}>How do you want to do this?!</h2>
        <div style={{color:'var(--text-secondary)',fontSize:14,marginBottom:14}}>
          <b>{targetName || 'Your enemy'}</b> has fallen.
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe the killing blow… (optional — the DM will see it)"
          autoFocus
          style={{width:'100%',minHeight:80,resize:'vertical',marginBottom:12}}
        />
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" style={{flex:1}} disabled={sending} onClick={onClose}>Skip</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : text.trim() ? 'Describe the Kill' : 'Nice.'}
          </button>
        </div>
      </div>
    </div>
  );
}
