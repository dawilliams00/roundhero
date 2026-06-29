import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import ModifiersEditor from './ModifiersEditor';

const REST_TYPES = ['long','short','dawn','midnight','dusk','none'];

// Lets a player directly fix up an existing tracker_data.features entry - mainly for
// PDF-imported characters whose sheet printed a feature name (e.g. "Font of Magic") with
// no real numbers behind it, where previously the only option was deleting it and
// recreating it from scratch via "+ Custom". Also the most common place to fix a feat
// that's worded wrong or missing a modifier (AC/saves/ability scores/etc, same editor
// items use) once it's already attached to a character - the shared-library admin-edit
// in FeatBrowserModal only fixes the LIBRARY entry, not a copy a character already has.
export default function FeatureEditModal({ name, feature, onClose }) {
  const { character, updateCharacter } = useCharacter();
  const [form, setForm] = useState({
    name, max: feature.max || 0, rest_type: feature.rest_type || 'long', description: feature.description || '',
    reminder: !!feature.reminder, refillOnCombat: !!feature.refill_on_combat, buffs: feature.buffs || [],
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async () => {
    const newName = form.name.trim();
    if (!newName) return;
    const td = character.tracker_data;
    const newMax = parseInt(form.max) || 0;
    // Preserve whatever was already spent, grant any newly-added capacity as available -
    // same "spent stays spent, gains become usable" rule the level-up merge uses, so
    // raising Font of Magic from an inert 0/0 to e.g. 6 starts it at 6/6, not 0/6.
    const oldMax = feature.max || 0;
    const spent = Math.max(0, oldMax - (feature.current ?? oldMax));
    const newCurrent = Math.max(0, newMax - spent);
    const updatedFeature = { ...feature, max: newMax, current: newCurrent, rest_type: form.rest_type, description: form.description };
    if (form.reminder) updatedFeature.reminder = true; else delete updatedFeature.reminder;
    if (form.refillOnCombat) updatedFeature.refill_on_combat = true; else delete updatedFeature.refill_on_combat;
    if (form.buffs?.length) updatedFeature.buffs = form.buffs; else delete updatedFeature.buffs;

    const newFeatures = { ...td.features };
    let newAe = character.ae_data;
    delete newFeatures[name];
    newFeatures[newName] = updatedFeature;
    if (newName !== name) {
      // Same tracker_key cascade removeFeature() already does for deletes - rename has to
      // update ae_data's references too, or the action economy row silently detaches.
      newAe = {};
      for (const [section, arr] of Object.entries(character.ae_data || {})) {
        newAe[section] = (arr||[]).map(a => a.tracker_key === name ? { ...a, tracker_key: newName, name: newName } : a);
      }
    }
    await updateCharacter(character.id, { tracker_data: { ...td, features: newFeatures }, ae_data: newAe });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Edit Feature</h2>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Uses (0 = unlimited/passive)</label><input type="number" min={0} value={form.max} onChange={e=>set('max',e.target.value)} /></div>
          <div className="form-group"><label>Resets on</label><select value={form.rest_type} onChange={e=>set('rest_type',e.target.value)}>{REST_TYPES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={4} style={{width:'100%',resize:'vertical'}} /></div>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.reminder} onChange={e=>set('reminder',e.target.checked)} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>📌 Remind me about this every turn in combat (Reminders banner on Action Economy tab)</span>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.refillOnCombat} onChange={e=>set('refillOnCombat',e.target.checked)} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>🛡️ Refills automatically on entering combat if it's at 0</span>
        </label>
        <ModifiersEditor
          buffs={form.buffs}
          onChange={(buffs) => set('buffs', buffs)}
          allowWeapon={false}
          activeWhileText="Always active once you have this feature (no equip step, unlike an item)."
        />
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name.trim()} onClick={submit}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
