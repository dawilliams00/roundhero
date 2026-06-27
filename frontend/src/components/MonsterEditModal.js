import React, { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import InfoModal from './InfoModal';

// Pragmatic v1 editor for a homebrew (duplicated) monster - a full stat block has
// far more structured fields (actions, abilities, saves, skills...) than a
// purpose-built form can reasonably cover in one pass, so everything past the
// name is a raw JSON textarea. Same data shape the Bestiary already renders, so
// anything valid here displays correctly in MonsterDetailModal.
export default function MonsterEditModal({ monster, onSave, onDelete, onClose }) {
  const { _custom_id, _source, name, ...rest } = monster;
  const [editName, setEditName] = useState(name);
  const [json, setJson] = useState(JSON.stringify(rest, null, 2));
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = () => {
    if (!editName.trim()) return;
    try {
      const parsed = JSON.parse(json);
      onSave({ ...parsed, name: editName.trim() });
    } catch (e) {
      setError(`That's not valid JSON: ${e.message}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Homebrew Creature</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Stat Block (JSON)</label>
            <textarea
              value={json}
              onChange={e => setJson(e.target.value)}
              rows={16}
              style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:12}}
            />
            <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
              Same fields shown in the creature's detail view - armor_class, hit_points, speed, ability_scores, actions, etc.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save</button>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete Homebrew Creature?"
          message={`Permanently delete "${name}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {error && <InfoModal title="Couldn't Save" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
