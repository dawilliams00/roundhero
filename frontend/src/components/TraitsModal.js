import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';

const CATEGORIES = [
  { key: 'resistances',    label: 'Resistances' },
  { key: 'immunities',     label: 'Immunities' },
  { key: 'vulnerabilities', label: 'Vulnerabilities' },
  { key: 'advantages',     label: 'Advantages' },
];

export default function TraitsModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const [inputs, setInputs] = useState({});
  if (!character) return null;

  const td = character.tracker_data || {};
  const traits = td.traits || { resistances: [], immunities: [], vulnerabilities: [], advantages: [] };

  const addItem = (cat) => {
    const val = (inputs[cat] || '').trim();
    if (!val) return;
    const list = traits[cat] || [];
    if (list.includes(val)) { setInputs(p => ({...p,[cat]:''})); return; }
    const newTraits = { ...traits, [cat]: [...list, val] };
    saveTrackerData({ ...td, traits: newTraits });
    setInputs(p => ({...p,[cat]:''}));
  };

  const removeItem = (cat, val) => {
    const newTraits = { ...traits, [cat]: (traits[cat]||[]).filter(v => v !== val) };
    saveTrackerData({ ...td, traits: newTraits });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <h2>Traits</h2>
        {CATEGORIES.map(({key,label}) => (
          <div key={key} style={{marginBottom:14}}>
            <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{label}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
              {(traits[key]||[]).map(v => (
                <div key={v} onClick={() => removeItem(key,v)} style={{cursor:'pointer',background:'rgba(230,57,70,0.1)',border:'1px solid var(--border-light)',color:'var(--text-primary)',borderRadius:12,padding:'3px 10px',fontSize:12}}>
                  {v} ×
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <input
                value={inputs[key]||''}
                onChange={e => setInputs(p=>({...p,[key]:e.target.value}))}
                onKeyDown={e => e.key === 'Enter' && addItem(key)}
                placeholder={`Add ${label.toLowerCase()}...`}
                style={{flex:1}}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => addItem(key)}>Add</button>
            </div>
          </div>
        ))}
        <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
