import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER } from '../utils/dnd';

const COST_TYPES = ['action','bonus_action','reaction','feature','passive','free'];
const REST_TYPES = ['long','short','none'];

export default function CustomAbilityModal({ onClose }) {
  const { character, updateCharacter } = useCharacter();
  const [form, setForm] = useState({ name:'', section:'Action', cost_type:'feature', source:'Custom', tracker_key:'', max_uses:1, rest_type:'long', description:'' });
  const [saving, setSaving] = useState(false);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async () => {
    if (!form.name) return;
    setSaving(true);
    const key = form.tracker_key || form.name;
    const newAbility = { name:form.name, source:form.source, source_type:'custom', cost_type:form.cost_type, tracker_key:key, description:form.description };
    const newAe = { ...character.ae_data };
    if (!newAe[form.section]) newAe[form.section] = [];
    newAe[form.section] = [...newAe[form.section], newAbility];
    const newTd = { ...character.tracker_data };
    if (form.max_uses > 0) {
      newTd.features = { ...newTd.features, [key]: { current: parseInt(form.max_uses), max: parseInt(form.max_uses), rest_type: form.rest_type, action: form.section, description: form.description } };
    }
    await updateCharacter(character.id, { ae_data: newAe, tracker_data: newTd });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add Custom Ability</h2>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e => set('name',e.target.value)} placeholder="Ability name" autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Section</label><select value={form.section} onChange={e => set('section',e.target.value)}>{SECTION_ORDER.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label>Source</label><input value={form.source} onChange={e => set('source',e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Uses (0=unlimited)</label><input type="number" min={0} value={form.max_uses} onChange={e => set('max_uses',e.target.value)} /></div>
          <div className="form-group"><label>Resets on</label><select value={form.rest_type} onChange={e => set('rest_type',e.target.value)}>{REST_TYPES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description',e.target.value)} rows={3} style={{width:'100%',resize:'vertical'}} /></div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name||saving} onClick={submit}>{saving?'Saving...':'Add Ability'}</button>
        </div>
      </div>
    </div>
  );
}
