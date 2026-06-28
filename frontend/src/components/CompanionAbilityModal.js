import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER } from '../utils/dnd';

const REST_TYPES = ['long', 'short', 'dawn', 'midnight', 'dusk', 'none'];

// Stripped-down sibling of CustomAbilityModal - a companion's abilities are hardcoded by
// the player (no spell-picker/granted-spell/shared-library machinery), so this only ever
// writes to tracker_data.companion.abilities, identified by array index rather than a
// tracker_key, since there's no separate features/ae_data split to keep in sync here.
export default function CompanionAbilityModal({ onClose, editingIndex }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const companion = td.companion || {};
  const abilities = companion.abilities || [];
  const editing = editingIndex != null ? abilities[editingIndex] : null;

  const [form, setForm] = useState(editing ? {
    name: editing.name || '', section: editing.section || 'Action',
    max_uses: editing.max ?? 0, rest_type: editing.rest_type || 'long',
    description: editing.description || '',
  } : { name: '', section: 'Action', max_uses: 0, rest_type: 'long', description: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) return;
    const maxUses = parseInt(form.max_uses) || 0;
    const prevCurrent = editing?.current ?? maxUses;
    const newAbility = {
      name: form.name.trim(), section: form.section,
      max: maxUses, current: Math.min(prevCurrent, maxUses),
      rest_type: form.rest_type, description: form.description,
    };
    const newAbilities = editingIndex != null
      ? abilities.map((a, i) => i === editingIndex ? newAbility : a)
      : [...abilities, newAbility];
    saveTrackerData({ ...td, companion: { ...companion, abilities: newAbilities } });
    onClose();
  };

  const remove = () => {
    saveTrackerData({ ...td, companion: { ...companion, abilities: abilities.filter((_, i) => i !== editingIndex) } });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{editing ? 'Edit Ability' : 'Add Companion Ability'}</h2>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Nightbound Shadowcast" autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Section</label><select value={form.section} onChange={e => set('section', e.target.value)}>{SECTION_ORDER.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label>Uses (0=unlimited)</label><input type="number" min={0} value={form.max_uses} onChange={e => set('max_uses', e.target.value)} /></div>
        </div>
        <div className="form-group">
          <label>Resets on</label>
          <select value={form.rest_type} onChange={e => set('rest_type', e.target.value)}>{REST_TYPES.map(r => <option key={r} value={r}>{r}</option>)}</select>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} /></div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          {editing && <button className="btn btn-secondary" style={{ flex: 1, color: 'var(--danger)' }} onClick={remove}>Delete</button>}
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!form.name.trim()} onClick={submit}>{editing ? 'Save Changes' : 'Add Ability'}</button>
        </div>
      </div>
    </div>
  );
}
