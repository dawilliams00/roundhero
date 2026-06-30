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
//
// onAdd is optional - omit it (e.g. opened as a pure "preview my level-up options"
// browser from the character editor) to hide the Add button entirely and get a
// read-only view. initialClassFilter/initialLevel seed the dropdowns so a caller that
// already knows "this character, this class, currently at level N" doesn't make the
// player re-select them - the level dropdown then lets the player move freely between
// levels to see what a different level would grant without committing to anything,
// since players like to check this before deciding whether to level up at all.
//
// lockedClass/lockedSubclass hide the class/subclass selectors entirely and pin the
// view to exactly that class+subclass - the editor's per-row Preview button uses this so
// browsing options doesn't drift into "what if I were some other class entirely", which
// isn't a real option for that row. maxLevel caps the Level dropdown at the highest level
// that class could actually reach given the character's other classes' levels already
// committed (total character level can't exceed 20) - no point offering to preview a
// level this multiclass build could never legally reach.
export default function ClassFeatureBrowserModal({ onAdd, onClose, initialClassFilter, initialLevel, lockedClass, lockedSubclass, maxLevel = 20 }) {
  const { character } = useCharacter();
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(lockedClass || initialClassFilter || '');
  const [subclassFilter, setSubclassFilter] = useState(lockedSubclass || '');
  const [levelFilter, setLevelFilter] = useState(initialLevel || '');

  useEffect(() => {
    api.get('/content/class-features').then(r => {
      setFeatures(r.data);
      if (lockedClass || initialClassFilter) return;
      // Default the class filter to the character's own class(es) if recognized -
      // parseClassLevels already handles PDF-decorated strings like "Wizard 13" or
      // multiclass "Paladin 6 / Sorcerer 6".
      const own = parseClassLevels(character?.class_name);
      const names = new Set(r.data.map(f => f.class_name));
      const match = own.find(p => names.has(p.className));
      if (match) setClassFilter(match.className);
    }).finally(() => setLoading(false));
  }, []);

  const classNames = useMemo(() => [...new Set(features.map(f => f.class_name))].sort(), [features]);
  const subclassNames = useMemo(() => {
    if (!classFilter) return [];
    return [...new Set(features.filter(f => f.class_name === classFilter && f.subclass_name).map(f => f.subclass_name))].sort();
  }, [features, classFilter]);

  // "At level N" means cumulative (everything gained at or below that level) - matches
  // how a player thinks about "what do I have if I'm level N", not just what's newly
  // granted exactly at N. A locked subclass still shows base-class (subclass_name===null)
  // features alongside it - "no subclass chosen yet" shows base-class features only.
  const filtered = features.filter(f => {
    if (classFilter && f.class_name !== classFilter) return false;
    if (lockedClass) {
      if (f.subclass_name && f.subclass_name !== lockedSubclass) return false;
    } else if (subclassFilter && f.subclass_name !== subclassFilter) {
      return false;
    }
    if (levelFilter && f.level > parseInt(levelFilter)) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:960,maxHeight:'85vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <h2>{onAdd ? 'Browse Class Features' : 'Preview Class Features'}</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>
          {onAdd ? 'Search class & subclass features and add one straight to this character.' : 'Move the Level dropdown to see what a different level grants, without committing to anything.'}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          {lockedClass ? (
            <div style={{flex:1,fontSize:13,color:'var(--text-primary)',fontWeight:600,padding:'7px 0'}}>
              {lockedClass}{lockedSubclass ? ` · ${lockedSubclass}` : ''}
            </div>
          ) : (
            <>
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
            </>
          )}
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{flex:1}}>
            <option value="">All levels</option>
            {Array.from({length:maxLevel}, (_,i) => i+1).map(l => <option key={l} value={l}>At level {l}</option>)}
          </select>
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
              {onAdd && <button className="btn btn-primary btn-sm" onClick={() => { onAdd(f); onClose(); }}>Add</button>}
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
