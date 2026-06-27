import React, { useState } from 'react';
import { schoolColor } from '../utils/dnd';

export default function SpellListManagerModal({ knownSpells, spellLists, activeList, maxPrepared, onSave, onClose }) {
  const lists = spellLists || {};
  const [editing, setEditing] = useState(null); // name being created/edited, or null for browse view
  const [editName, setEditName] = useState('');
  const [editSelected, setEditSelected] = useState(new Set());

  const startNew = () => {
    setEditing('__new__');
    setEditName('');
    setEditSelected(new Set());
  };

  const startEdit = (name) => {
    setEditing(name);
    setEditName(name);
    setEditSelected(new Set(lists[name] || []));
  };

  const toggleSpell = (spellName) => {
    setEditSelected(prev => {
      const next = new Set(prev);
      if (next.has(spellName)) next.delete(spellName); else next.add(spellName);
      return next;
    });
  };

  const saveList = () => {
    if (!editName.trim()) return;
    const newLists = { ...lists };
    if (editing !== '__new__' && editing !== editName) delete newLists[editing];
    newLists[editName] = Array.from(editSelected);
    const newActive = editing === '__new__' ? editName : activeList;
    onSave(newLists, newActive);
    setEditing(null);
  };

  const deleteList = (name) => {
    const newLists = { ...lists };
    delete newLists[name];
    onSave(newLists, activeList === name ? null : activeList);
  };

  const setActiveList = (name) => onSave(lists, name);

  const byLevelThenName = (a,b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name);

  if (editing !== null) {
    const selectableSpells = knownSpells.filter(s => !s.ritual && !s.granted_by && s.level_int !== 0).sort(byLevelThenName);
    const alwaysAvailable  = knownSpells.filter(s => s.ritual || s.granted_by || s.level_int === 0).sort(byLevelThenName);
    const selectedCount = Array.from(editSelected).filter(n => selectableSpells.some(s => s.name === n)).length;
    const atCap = maxPrepared != null && selectedCount >= maxPrepared;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{maxWidth:420,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
          <h2>{editing === '__new__' ? 'New Spell List' : `Edit "${editing}"`}</h2>
          <div className="form-group"><label>List Name</label><input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="e.g. Balanced Outdoors" autoFocus /></div>
          <div style={{color:'var(--text-dim)',fontSize:11,margin:'8px 0'}}>
            Select spells to prepare{maxPrepared != null && ` (${selectedCount} / ${maxPrepared})`}:
          </div>
          <div style={{flex:1,overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:8}}>
            {selectableSpells.length === 0 ? (
              <div style={{color:'var(--text-dim)',fontSize:12,padding:8}}>No known spells yet — add some first.</div>
            ) : selectableSpells.map(s => {
              const checked = editSelected.has(s.name);
              const disabled = !checked && atCap;
              return (
                <label key={s.name} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 4px',cursor: disabled ? 'not-allowed' : 'pointer',opacity: disabled ? 0.4 : 1}}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleSpell(s.name)} />
                  <span style={{fontSize:13,color: schoolColor(s.school)}}>{s.name}</span>
                  <span style={{fontSize:11,color:'var(--text-dim)'}}>{s.level_int===0?'Cantrip':`Lv${s.level_int}`}</span>
                </label>
              );
            })}
          </div>
          {alwaysAvailable.length > 0 && (
            <>
              <div style={{color:'var(--text-dim)',fontSize:11,margin:'10px 0 4px'}}>Always available (cantrips, rituals &amp; granted spells — don't count against the cap):</div>
              <div style={{maxHeight:120,overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:8}}>
                {alwaysAvailable.map(s => (
                  <div key={s.name} style={{display:'flex',alignItems:'center',gap:8,padding:'4px'}}>
                    <span style={{fontSize:13,color:'var(--text-secondary)'}}>{s.name}</span>
                    <span style={{fontSize:10,color:'var(--text-dim)'}}>{s.level_int === 0 ? 'Cantrip' : s.ritual ? 'Ritual' : `Granted by ${s.granted_by}`}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button className="btn btn-secondary" style={{flex:1}} onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" style={{flex:2}} disabled={!editName.trim()} onClick={saveList}>Save List</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <h2>Spell Lists</h2>
        <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:10}}>Switch quickly between prepared-spell loadouts. Changes here save immediately.</div>
        <div
          onClick={() => setActiveList(null)}
          style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:'var(--radius-sm)',border:`1px solid ${activeList===null?'var(--accent)':'var(--border)'}`,marginBottom:6,cursor:'pointer'}}
        >
          <span style={{color:'var(--text-primary)',fontWeight:500}}>All Known Spells</span>
          {activeList===null && <span style={{color:'var(--accent-light)',fontSize:12}}>Active</span>}
        </div>
        {Object.keys(lists).map(name => (
          <div key={name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:'var(--radius-sm)',border:`1px solid ${activeList===name?'var(--accent)':'var(--border)'}`,marginBottom:6}}>
            <div onClick={() => setActiveList(name)} style={{flex:1,cursor:'pointer'}}>
              <div style={{color:'var(--text-primary)',fontWeight:500}}>{name}</div>
              <div style={{color:'var(--text-dim)',fontSize:11}}>{(lists[name]||[]).length} spells</div>
            </div>
            {activeList===name && <span style={{color:'var(--accent-light)',fontSize:12}}>Active</span>}
            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(name)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => deleteList(name)}>×</button>
          </div>
        ))}
        <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={startNew}>+ New List</button>
        <button className="btn btn-primary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
