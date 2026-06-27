import React, { useState } from 'react';

const RARITIES = ['Common','Uncommon','Rare','Very Rare','Legendary','Artifact'];
const RECHARGES = ['none','dawn','dusk','short_rest','long_rest'];
const WEAPON_CATEGORIES = ['Simple','Martial'];
const WEAPON_RANGES = ['Melee','Ranged'];
const DAMAGE_TYPES = ['Slashing','Piercing','Bludgeoning'];
const WEAPON_PROPERTIES = ['Ammunition','Finesse','Heavy','Light','Loading','Monk','Reach','Special','Thrown','Two-Handed','Versatile'];

export default function AddItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => item ? {
    ...item,
    has_charges: !!item.charges,
    charges_current: item.charges?.current ?? 0,
    charges_max: item.charges?.max ?? 0,
    recharge: item.charges?.recharge || 'none',
    granted_spells: item.granted_spells || [],
    is_weapon: !!item.is_weapon,
    weapon_category: item.weapon_category || 'Simple',
    weapon_range: item.weapon_range || 'Melee',
    damage_dice: item.damage_dice || '',
    damage_type: item.damage_type || 'Slashing',
    properties: item.properties || [],
    range_normal: item.range?.normal ?? '',
    range_long: item.range?.long ?? '',
    two_handed_damage_dice: item.two_handed_damage?.damage_dice || '',
    two_handed_damage_type: item.two_handed_damage?.damage_type || '',
    proficient: item.proficient ?? true,
    two_handed: !!item.two_handed,
  } : {
    name: '', quantity: 1, weight: 0, rarity: 'Common',
    equipped: false, attunement: false, attuned: false,
    has_charges: false, charges_current: 0, charges_max: 0, recharge: 'none',
    description: '', granted_spells: [],
    is_weapon: false, weapon_category: 'Simple', weapon_range: 'Melee',
    damage_dice: '', damage_type: 'Slashing', properties: [],
    range_normal: '', range_long: '', two_handed_damage_dice: '', two_handed_damage_type: '',
    proficient: true, two_handed: false,
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const toggleProperty = (p) => setForm(f => ({...f, properties: f.properties.includes(p) ? f.properties.filter(x=>x!==p) : [...f.properties, p]}));

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
      buffs: form.buffs || [],
      // Weapon fields - always include is_weapon explicitly (even false) so
      // un-checking it on an edit actually clears weapon-ness rather than
      // leaving stale fields from before.
      is_weapon: !!form.is_weapon,
      ...(form.is_weapon ? {
        weapon_category: form.weapon_category,
        weapon_range: form.weapon_range,
        damage_dice: form.damage_dice,
        damage_type: form.damage_type,
        properties: form.properties || [],
        range: (form.range_normal || form.range_long) ? { normal: parseInt(form.range_normal)||0, ...(form.range_long ? { long: parseInt(form.range_long) } : {}) } : null,
        two_handed_damage: (form.properties||[]).includes('Versatile') && form.two_handed_damage_dice
          ? { damage_dice: form.two_handed_damage_dice, damage_type: form.two_handed_damage_type || form.damage_type }
          : null,
        proficient: !!form.proficient,
        two_handed: !!form.two_handed,
      } : {}),
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
        <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><input type="checkbox" checked={form.is_weapon} onChange={e=>set('is_weapon',e.target.checked)} /> Is this a weapon?</label>
        {form.is_weapon && (
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:8}}>
            <div className="form-row">
              <div className="form-group"><label>Category</label><select value={form.weapon_category} onChange={e=>set('weapon_category',e.target.value)}>{WEAPON_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label>Range</label><select value={form.weapon_range} onChange={e=>set('weapon_range',e.target.value)}>{WEAPON_RANGES.map(r=><option key={r}>{r}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Damage Dice</label><input value={form.damage_dice} onChange={e=>set('damage_dice',e.target.value)} placeholder="e.g. 1d8" /></div>
              <div className="form-group"><label>Damage Type</label><select value={form.damage_type} onChange={e=>set('damage_type',e.target.value)}>{DAMAGE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Range (normal ft)</label><input type="number" min={0} value={form.range_normal} onChange={e=>set('range_normal',e.target.value)} /></div>
              <div className="form-group"><label>Range (long ft)</label><input type="number" min={0} value={form.range_long} onChange={e=>set('range_long',e.target.value)} /></div>
            </div>
            <label style={{display:'block',fontSize:12,color:'var(--text-dim)',marginBottom:4}}>Properties</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
              {WEAPON_PROPERTIES.map(p => (
                <label key={p} style={{display:'flex',alignItems:'center',gap:4,fontSize:12}}>
                  <input type="checkbox" checked={form.properties.includes(p)} onChange={()=>toggleProperty(p)} /> {p}
                </label>
              ))}
            </div>
            {form.properties.includes('Versatile') && (
              <div className="form-row">
                <div className="form-group"><label>Two-Handed Damage Dice</label><input value={form.two_handed_damage_dice} onChange={e=>set('two_handed_damage_dice',e.target.value)} placeholder="e.g. 1d10" /></div>
                <div className="form-group"><label>Two-Handed Damage Type</label><select value={form.two_handed_damage_type} onChange={e=>set('two_handed_damage_type',e.target.value)}><option value="">(same as above)</option>{DAMAGE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
            )}
            <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.proficient} onChange={e=>set('proficient',e.target.checked)} /> Proficient</label>
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
