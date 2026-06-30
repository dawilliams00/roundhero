import React, { useState } from 'react';

// Clones a canon monster's full stat block under a new name as homebrew - the
// original stays read-only/canon, the copy is independently editable afterward.
export default function DuplicateMonsterModal({ monster, onDuplicate, onClose }) {
  const [name, setName] = useState(`${monster.name} (Homebrew)`);

  const submit = () => {
    if (!name.trim()) return;
    const { _custom_id, _source, ...base } = monster;
    onDuplicate({ ...base, name: name.trim() });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:360}}>
        <div className="modal-sticky-header">
          <h2>Duplicate Creature</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{color:'var(--text-secondary)',fontSize:13,marginBottom:10}}>
          Copies {monster.name}'s full stat block under a new name. The copy is yours to edit; the original stays as-is.
        </p>
        <div className="form-group">
          <label>New Name</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} disabled={!name.trim()} onClick={submit}>Duplicate</button>
        </div>
      </div>
    </div>
  );
}
