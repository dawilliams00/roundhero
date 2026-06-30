import React, { useState } from 'react';
import api from '../utils/api';

const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];

export default function CustomSpellModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    name: '', level_int: 0, school: 'Evocation', ritual: false, concentration: false,
    casting_time: '1 action', range: '', components: '', duration: '', description: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async () => {
    if (!form.name || saving) return;
    setSaving(true);
    const payload = {
      ...form,
      level: String(form.level_int),
      level_int: parseInt(form.level_int),
      classes: [],
      source: 'Custom',
    };
    try {
      // Saved to the shared spell database (not just this character) so it's available
      // to add to any of this user's characters/lists going forward.
      const r = await api.post('/content/spells', payload);
      onAdd(r.data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <h2>Add Custom Spell</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>Saved to your spell library — available to add to any of your characters.</div>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e => set('name',e.target.value)} placeholder="Spell name" autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Level (0=cantrip)</label><input type="number" min={0} max={9} value={form.level_int} onChange={e => set('level_int',e.target.value)} /></div>
          <div className="form-group"><label>School</label><select value={form.school} onChange={e => set('school',e.target.value)}>{SCHOOLS.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Casting Time</label><input value={form.casting_time} onChange={e => set('casting_time',e.target.value)} /></div>
          <div className="form-group"><label>Range</label><input value={form.range} onChange={e => set('range',e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Components</label><input value={form.components} onChange={e => set('components',e.target.value)} placeholder="V S M" /></div>
          <div className="form-group"><label>Duration</label><input value={form.duration} onChange={e => set('duration',e.target.value)} /></div>
        </div>
        <div className="form-row">
          <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.ritual} onChange={e => set('ritual',e.target.checked)} /> Ritual</label>
          <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.concentration} onChange={e => set('concentration',e.target.checked)} /> Concentration</label>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description',e.target.value)} rows={3} style={{width:'100%',resize:'vertical'}} /></div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name||saving} onClick={submit}>{saving ? 'Saving...' : 'Add Spell'}</button>
        </div>
      </div>
    </div>
  );
}
