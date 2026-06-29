import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useCharacter } from '../context/CharacterContext';
import { parseClassLevels } from '../utils/dnd';

// Searchable library of class/subclass features (backend/data/class_features.json,
// merged with any CustomContent content_type="class_feature" rows) - the class-level
// equivalent of FeatBrowserModal.js. Adding one writes into ae_data/features the same
// way addFeatFromLibrary already does for feats; there's no auto-grant-on-creation or
// auto-grant-on-level-up wiring here, by design - same "browse and add yourself" model
// every other shared library (feats/spells/monsters) already uses in this app.
export default function ClassFeatureBrowserModal({ onAdd, onClose }) {
  const { character } = useCharacter();
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [subclassFilter, setSubclassFilter] = useState('');

  useEffect(() => {
    api.get('/content/class-features').then(r => {
      setFeatures(r.data);
      // Default the class filter to the character's own class(es) if recognized -
      // parseClassLevels already handles PDF-decorated strings like "Wizard 13" or
      // multiclass "Paladin 6 / Sorcerer 6".
      const own = parseClassLevels(character?.class_name);
      const names = new Set(r.data.map(f => f.class_name));
      const match = own.find(p => names.has(p.className));
      if (match) setClassFilter(match.className);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classNames = useMemo(() => [...new Set(features.map(f => f.class_name))].sort(), [features]);
  const subclassNames = useMemo(() => {
    if (!classFilter) return [];
    return [...new Set(features.filter(f => f.class_name === classFilter && f.subclass_name).map(f => f.subclass_name))].sort();
  }, [features, classFilter]);

  const filtered = features.filter(f => {
    if (classFilter && f.class_name !== classFilter) return false;
    if (subclassFilter && f.subclass_name !== subclassFilter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480,maxHeight:'85vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Browse Class Features</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Search class & subclass features and add one straight to this character.</div>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSubclassFilter(''); }} style={{flex:1}}>
            <option value="">All classes</option>
            {classNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {subclassNames.length > 0 && (
            <select value={subclassFilter} onChange={e => setSubclassFilter(e.target.value)} style={{flex:1}}>
              <option value="">All subclasses</option>
              {subclassNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search feature names..." style={{marginBottom:12}} />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No matching features.</div>
          ) : filtered.map((f,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{f.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>L{f.level} {f.subclass_name ? `${f.subclass_name} · ` : ''}{f.class_name} · {f.source}</div>
                <div style={{color:'var(--text-secondary)',fontSize:11,marginTop:2}}>{f.description}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { onAdd(f); onClose(); }}>Add</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
