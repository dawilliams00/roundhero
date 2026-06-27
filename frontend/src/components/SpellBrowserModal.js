import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { schoolColor, slotBadgeTextColor } from '../utils/dnd';
import SpellEditModal from './SpellEditModal';
import ConfirmModal from './ConfirmModal';

export default function SpellBrowserModal({ character, knownSpells, onAdd, onRemove, onClose }) {
  const [allSpells, setAllSpells] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [editTarget, setEditTarget] = useState(null); // { spell, mode }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadSpells = () => api.get('/content/spells', { params: { class_name: character.class_name } }).then(r => setAllSpells(r.data));

  useEffect(() => {
    loadSpells().finally(() => setLoading(false));
  }, [character.class_name]);

  const saveEdit = async (data) => {
    const { spell, mode } = editTarget;
    if (mode === 'canonEdit') {
      await api.put('/content/spells/override', { ...data, _canon_name: spell.name });
    } else if (mode === 'duplicate') {
      await api.post('/content/spells', data);
    } else if (mode === 'customEdit') {
      await api.put(`/content/spells/${spell._custom_id}`, data);
    }
    setEditTarget(null);
    await loadSpells();
  };

  const deleteCustom = async () => {
    await api.delete(`/content/spells/${confirmDelete._custom_id}`);
    setConfirmDelete(null);
    setEditTarget(null);
    await loadSpells();
  };

  const knownNames = new Set(knownSpells.map(s => s.name));
  const levels = [...new Set(allSpells.map(s => s.level_int))].sort((a, b) => a - b);
  const spells = allSpells.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'cantrip' ? s.level_int === 0 : s.level_int === parseInt(filter));
    return matchSearch && matchFilter;
  }).sort((a,b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Add Spells</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Click Remove to take a spell out of your known spells.</div>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search spells..." style={{flex:1,minWidth:120}} />
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{minWidth:80}}>
            <option value="all">All</option>
            <option value="cantrip">Cantrips</option>
            {levels.filter(l=>l>0).map(l=><option key={l} value={l}>Level {l}</option>)}
          </select>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading spells...</div>
          ) : spells.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No spells found.</div>
          ) : spells.map(spell => {
            const isKnown = knownNames.has(spell.name);
            return (
              <div key={spell.name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{background: spell.level_int===0 ? 'var(--text-dim)' : `var(--slot-${spell.level_int})`,color: spell.level_int===0 ? '#fff' : slotBadgeTextColor(spell.level_int),borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600,minWidth:24,textAlign:'center'}}>
                  {spell.level_int===0?'C':spell.level_int}
                </div>
                <div style={{flex:1}}>
                  <div style={{color: schoolColor(spell.school),fontWeight:500,fontSize:13}}>{spell.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>{spell.school} {spell.ritual?'· Ritual':''} {spell.concentration?'· Concentration':''}</div>
                </div>
                {spell._source === 'custom' ? (
                  <button className="btn btn-secondary" style={{fontSize:11,padding:'4px 8px'}} onClick={() => setEditTarget({ spell, mode: 'customEdit' })}>✏️</button>
                ) : (
                  <>
                    <button className="btn btn-secondary" style={{fontSize:11,padding:'4px 8px'}} title="Admin Edit" onClick={() => setEditTarget({ spell, mode: 'canonEdit' })}>✏️</button>
                    <button className="btn btn-secondary" style={{fontSize:11,padding:'4px 8px'}} title="Duplicate" onClick={() => setEditTarget({ spell, mode: 'duplicate' })}>📋</button>
                  </>
                )}
                <button
                  className={isKnown ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={() => isKnown ? onRemove(spell) : onAdd(spell)}
                  style={{fontSize:11,padding:'4px 10px'}}
                >
                  {isKnown ? 'Remove' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>

      {editTarget && (
        <SpellEditModal
          spell={editTarget.spell}
          mode={editTarget.mode}
          onSave={saveEdit}
          onDelete={editTarget.mode === 'customEdit' ? () => setConfirmDelete(editTarget.spell) : undefined}
          onClose={() => setEditTarget(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Homebrew Spell?"
          message={`Permanently delete "${confirmDelete.name}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={deleteCustom}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
