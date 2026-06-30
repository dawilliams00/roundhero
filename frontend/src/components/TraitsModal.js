import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';

const CATEGORIES = [
  { key: 'resistances',     label: 'Resistances' },
  { key: 'immunities',      label: 'Immunities' },
  { key: 'vulnerabilities', label: 'Vulnerabilities' },
  { key: 'advantages',      label: 'Advantages' },
  { key: 'disadvantages',   label: 'Disadvantages' },
  { key: 'senses',          label: 'Senses' },
];

const DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
const CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
const ADV_DISADV = ['Saves vs being Charmed','Saves vs being Frightened','Saves vs Poison','Saves vs Disease','Saves vs being Paralyzed','Saves vs being Put to Sleep','Saves vs Magic','Perception checks','Stealth checks','Death saving throws'];
// Common sense ranges - same "type or pick from a common list, or add a custom one"
// pattern every other trait category already uses. Magical immunity to being put to
// sleep (e.g. an Elf/Shadar-kai's Fey Ancestry) isn't a sense - that's "Saves vs being
// Put to Sleep" under Advantages, or "Magical Sleep" under Immunities if it's a flat
// immunity rather than just advantage on the save; both already exist above.
const SENSES = ['Darkvision 60 ft.','Darkvision 120 ft.','Blindsight 10 ft.','Blindsight 30 ft.','Tremorsense 10 ft.','Tremorsense 30 ft.','Truesight 30 ft.','Truesight 60 ft.'];

const COMMON_OPTIONS = {
  resistances: DAMAGE_TYPES,
  immunities: [...DAMAGE_TYPES, ...CONDITIONS],
  vulnerabilities: DAMAGE_TYPES,
  advantages: ADV_DISADV,
  disadvantages: ADV_DISADV,
  senses: SENSES,
};

const itemName = t => (typeof t === 'string' ? t : t?.name) || '';
const itemDesc = t => (typeof t === 'string' ? '' : t?.description) || '';

export default function TraitsModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const [pickerCat, setPickerCat] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  const [search, setSearch] = useState('');
  const [customForm, setCustomForm] = useState({ name: '', description: '', category: '' });

  if (!character) return null;

  const td = character.tracker_data || {};
  const traits = td.traits || { resistances: [], immunities: [], vulnerabilities: [], advantages: [], disadvantages: [], senses: [] };

  const saveTraits = (newTraits) => saveTrackerData({ ...td, traits: newTraits });

  const addItem = (cat, item) => {
    const list = traits[cat] || [];
    if (list.some(v => itemName(v).toLowerCase() === itemName(item).toLowerCase())) return;
    saveTraits({ ...traits, [cat]: [...list, item] });
  };

  const removeItem = (cat, val) => {
    saveTraits({ ...traits, [cat]: (traits[cat]||[]).filter(v => itemName(v) !== itemName(val)) });
  };

  const openPicker = (cat) => { setPickerCat(cat); setCustomMode(false); setSearch(''); };
  const closePicker = () => { setPickerCat(null); setCustomMode(false); };

  const openCustomForm = () => {
    setCustomForm({ name: '', description: '', category: pickerCat });
    setCustomMode(true);
  };

  const submitCustom = () => {
    if (!customForm.name.trim()) return;
    addItem(customForm.category, { name: customForm.name.trim(), description: customForm.description.trim() });
    closePicker();
  };

  const options = pickerCat ? (COMMON_OPTIONS[pickerCat] || []).filter(o => (traits[pickerCat]||[]).every(v => itemName(v) !== o) && o.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
        {!pickerCat ? (
          <>
            <div className="modal-sticky-header">
              <h2>Traits</h2>
              <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
            </div>
            {CATEGORIES.map(({key,label}) => (
              <div key={key} style={{marginBottom:14}}>
                <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{label}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
                  {(traits[key]||[]).map((v,i) => (
                    <div key={itemName(v)+i} onClick={() => removeItem(key,v)} title={itemDesc(v) ? `${itemDesc(v)} (click to remove)` : 'Click to remove'}
                      style={{cursor:'pointer',background:'rgba(230,57,70,0.1)',border:'1px solid var(--border-light)',color:'var(--text-primary)',borderRadius:12,padding:'3px 10px',fontSize:12}}>
                      {itemName(v)} ×
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => openPicker(key)}>+ Add</button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
          </>
        ) : !customMode ? (
          <>
            <div className="modal-sticky-header">
              <h2>Add {CATEGORIES.find(c=>c.key===pickerCat)?.label}</h2>
              <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:'100%',marginBottom:12}} autoFocus />
            <div style={{maxHeight:280,overflowY:'auto',marginBottom:12}}>
              {options.length === 0 ? (
                <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:16}}>No matches — add a custom one below.</div>
              ) : options.map(o => (
                <div key={o} onClick={() => { addItem(pickerCat, o); closePicker(); }}
                  style={{padding:'8px 10px',borderRadius:'var(--radius-sm)',cursor:'pointer',fontSize:13,color:'var(--text-primary)'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {o}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={closePicker}>Cancel</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={openCustomForm}>+ Add Custom</button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-sticky-header">
              <h2>Add Custom Trait</h2>
              <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input value={customForm.name} onChange={e => setCustomForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Sunlight Sensitivity" autoFocus />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={customForm.category} onChange={e => setCustomForm(f=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>What it does (optional)</label>
              <textarea value={customForm.description} onChange={e => setCustomForm(f=>({...f,description:e.target.value}))} rows={3} style={{width:'100%',resize:'vertical'}} />
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={() => setCustomMode(false)}>Back</button>
              <button className="btn btn-primary" style={{flex:1}} disabled={!customForm.name.trim()} onClick={submitCustom}>Add</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
