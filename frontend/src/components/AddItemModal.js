import React, { useState } from 'react';

const RARITIES = ['Common','Uncommon','Rare','Very Rare','Legendary','Artifact'];
const RECHARGES = ['none','dawn','dusk','short_rest','long_rest'];

export default function AddItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => item ? {
    ...item,
    has_charges: !!item.charges,
    charges_current: item.charges?.current ?? 0,
    charges_max: item.charges?.max ?? 0,
    recharge: item.charges?.recharge || 'none',
    granted_spells: item.granted_spells || [],
  } : {
    name: '', quantity: 1, weight: 0, rarity: 'Common',
    equipped: false, attunement: false, attuned: false,
    has_charges: false, charges_current: 0, charges_max: 0, recharge: 'none',
    description: '', granted_spells: [],
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const addSpellRow = () => set('granted_spells', [...form.granted_spells, { name: '', level_int: 0, charge_cost: 1 }]);
  const updateSpellRow = (i, key, val) => {
    const next = form.granted_spells.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
    set('granted_spells', next);
  };
  const removeSpellRow = (i) => set('granted_spells', form.granted_spells.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!form.name) return;
    const out = {
      name: form.name,
      quantity: parseInt(form.quantity) || 1,
      weight: parseFloat(form.weight) || 0,
      rarity: form.rarity,
      equipped: !!form.equipped,
      attunement: !!form.attunement,
      attuned: !!form.attuned,
      description: form.description,
      charges: form.has_charges ? { current: parseInt(form.charges_current)||0, max: parseInt(form.charges_max)||0, recharge: form.recharge } : null,
      granted_spells: form.granted_spells.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), level_int: parseInt(s.level_int)||0, charge_cost: parseInt(s.charge_cost)||1 })),
    };
    onSave(out);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{item ? 'Edit Item' : 'Add Item'}</h2>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Item name" autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Quantity</label><input type="number" min={1} value={form.quantity} onChange={e=>set('quantity',e.target.value)} /></div>
          <div className="form-group"><label>Weight (lb)</label><input type="number" min={0} step={0.1} value={form.weight} onChange={e=>set('weight',e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Rarity</label><select value={form.rarity} onChange={e=>set('rarity',e.target.value)}>{RARITIES.map(r=><option key={r}>{r}</option>)}</select></div>
        <div className="form-row">
          <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.equipped} onChange={e=>set('equipped',e.target.checked)} /> Equipped</label>
          <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.attunement} onChange={e=>set('attunement',e.target.checked)} /> Requires Attunement</label>
        </div>
        {form.attunement && (
          <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><input type="checkbox" checked={form.attuned} onChange={e=>set('attuned',e.target.checked)} /> Currently Attuned</label>
        )}
        <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><input type="checkbox" checked={form.has_charges} onChange={e=>set('has_charges',e.target.checked)} /> Has Charges</label>
        {form.has_charges && (
          <div className="form-row">
            <div className="form-group"><label>Max Charges</label><input type="number" min={0} value={form.charges_max} onChange={e=>{set('charges_max',e.target.value); set('charges_current',e.target.value);}} /></div>
            <div className="form-group"><label>Recharges On</label><select value={form.recharge} onChange={e=>set('recharge',e.target.value)}>{RECHARGES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select></div>
          </div>
        )}
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} style={{width:'100%',resize:'vertical'}} /></div>

        <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,margin:'12px 0 6px'}}>Granted Spells</div>
        {form.granted_spells.map((s, i) => (
          <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
            <input value={s.name} onChange={e=>updateSpellRow(i,'name',e.target.value)} placeholder="Spell name" style={{flex:1}} />
            <input type="number" min={1} value={s.charge_cost} onChange={e=>updateSpellRow(i,'charge_cost',e.target.value)} title="Charge cost" style={{width:56}} />
            <button className="btn btn-secondary btn-sm" onClick={()=>removeSpellRow(i)}>×</button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={addSpellRow}>+ Add Granted Spell</button>

        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name} onClick={submit}>{item ? 'Save' : 'Add Item'}</button>
        </div>
      </div>
    </div>
  );
}
