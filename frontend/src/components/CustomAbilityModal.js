import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { SECTION_ORDER } from '../utils/dnd';

const REST_TYPES = ['long','short','none'];
const SECTION_COST_TYPE = { 'Action':'action', 'Bonus Action':'bonus_action', 'Reaction':'reaction', 'Free Action':'free_action', 'Passive':'passive' };

// editingFeat (optional): when set, this edits an existing shared library entry instead
// of creating a new one - submit only PUTs the library row, it does NOT touch the current
// character's ae_data/features (editing the library shouldn't silently re-attach/change
// this character's own copy, same separation MonsterEditModal.js already uses for monsters).
export default function CustomAbilityModal({ onClose, editingFeat, onDelete }) {
  const { character, updateCharacter } = useCharacter();
  const [form, setForm] = useState(editingFeat ? {
    name: editingFeat.name, section: editingFeat.section, source: editingFeat.source || 'Custom',
    tracker_key: '', max_uses: editingFeat.max_uses || 0, rest_type: editingFeat.rest_type || 'long',
    description: editingFeat.description || '', isSpell: !!editingFeat.isSpell, isTuck: !!editingFeat.isTuck,
  } : { name:'', section:'Action', source:'Custom', tracker_key:'', max_uses:1, rest_type:'long', description:'', isSpell:false, isTuck:false });
  const [saving, setSaving] = useState(false);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async () => {
    if (!form.name) return;
    setSaving(true);
    const costType = form.isSpell ? 'cast_spell' : SECTION_COST_TYPE[form.section];
    const payload = {
      name: form.name, section: form.section, cost_type: costType, source: form.source,
      description: form.description, max_uses: parseInt(form.max_uses) || 0,
      rest_type: form.rest_type, isSpell: form.isSpell, isTuck: form.isTuck,
    };
    if (editingFeat) {
      await api.put(`/content/feats/${editingFeat._custom_id}`, payload);
      setSaving(false);
      onClose();
      return;
    }
    const key = form.tracker_key || form.name;
    const newAbility = { name:form.name, source:form.source, source_type:'custom', cost_type:costType, tracker_key:key, description:form.description };
    const newAe = { ...character.ae_data };
    if (!newAe[form.section]) newAe[form.section] = [];
    newAe[form.section] = [...newAe[form.section], newAbility];
    const newTd = { ...character.tracker_data };
    if (form.max_uses > 0 || form.isTuck) {
      newTd.features = {
        ...newTd.features,
        [key]: {
          current: parseInt(form.max_uses) || 0, max: parseInt(form.max_uses) || 0,
          rest_type: form.rest_type, action: form.section, description: form.description,
          ...(form.isTuck ? { spell_picker: true, tucked_spell: '', tucked_level: '' } : {}),
        },
      };
    }
    try {
      await api.post('/content/feats', payload);
    } catch {
      // Non-fatal - the character still gets the ability even if the library save failed.
    }
    await updateCharacter(character.id, { ae_data: newAe, tracker_data: newTd });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{editingFeat ? 'Edit Custom Feat' : 'Add Custom Ability'}</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>
          {editingFeat ? 'Updates the shared library entry - anyone searching for this feat will see your changes. Characters who already added it keep their own copy as-is.' : 'Saved to your feat library too — searchable to add to any future character.'}
        </div>
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

        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}}>
          <input type="checkbox" checked={form.isSpell} onChange={e => set('isSpell', e.target.checked)} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>This is a spell-like ability (shows as a "Cast" button, filtered to spells castable in this section)</span>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.isTuck} onChange={e => set('isTuck', e.target.checked)} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>🃏 Tuck &amp; release a spell (pick a known spell now, cast it later without a slot — e.g. Cartomancer)</span>
        </label>

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          {editingFeat && onDelete && (
            <button className="btn btn-secondary" style={{flex:1,color:'var(--danger)'}} onClick={onDelete}>Delete</button>
          )}
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name||saving} onClick={submit}>{saving?'Saving...':editingFeat?'Save Changes':'Add Ability'}</button>
        </div>
      </div>
    </div>
  );
}
