import React, { useState } from 'react';
import InfoModal from './InfoModal';

// Pragmatic v1 editor, same approach as MonsterEditModal - a spell has plenty of
// structured fields (damage_dice, higher_level, save_type_abbr, etc.) but building a
// purpose-built form for all of them wasn't worth it for a first pass; everything past
// the name is a raw JSON textarea. Same shape SpellDetailModal already renders, so
// anything valid here (e.g. filling in a missing higher_level) displays correctly.
// mode: "canonEdit" (admin-edit a canon entry via override), "customEdit" (edit an
// existing homebrew/duplicate row), or "duplicate" (clone a canon entry under a new name).
export default function SpellEditModal({ spell, mode, onSave, onDelete, onClose }) {
  const { _custom_id, _source, _override_id, name, ...rest } = spell;
  const [editName, setEditName] = useState(mode === 'duplicate' ? `${name} (Homebrew)` : name);
  const [json, setJson] = useState(JSON.stringify(rest, null, 2));
  const [error, setError] = useState(null);

  const submit = () => {
    if (!editName.trim()) return;
    try {
      const parsed = JSON.parse(json);
      onSave({ ...parsed, name: editName.trim() });
    } catch (e) {
      setError(`That's not valid JSON: ${e.message}`);
    }
  };

  const title = mode === 'duplicate' ? 'Duplicate Spell' : mode === 'canonEdit' ? 'Admin Edit Canon Spell' : 'Edit Homebrew Spell';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          {mode === 'canonEdit' && (
            <div style={{color:'var(--text-dim)',fontSize:11}}>Corrects this entry for everyone - the static spell database on disk never changes, characters who already own it pick up the fix wherever they read this spell's data fresh.</div>
          )}
          {mode === 'duplicate' && (
            <div style={{color:'var(--text-dim)',fontSize:11}}>Copies {name}'s full data under a new name. The copy is yours to edit; the original stays as canon.</div>
          )}
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Spell Data (JSON)</label>
            <textarea
              value={json}
              onChange={e => setJson(e.target.value)}
              rows={16}
              style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:12}}
            />
            <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
              Same fields shown in the spell's detail view - description, higher_level ("At Higher Levels" text), damage_dice, damage_type, save_type_abbr, school, level_int, casting_time, range, components, duration, concentration, ritual, classes, etc.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {mode === 'customEdit' && onDelete && <button className="btn btn-danger" onClick={onDelete}>Delete</button>}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>{mode === 'duplicate' ? 'Duplicate' : 'Save'}</button>
        </div>
      </div>
      {error && <InfoModal title="Couldn't Save" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
