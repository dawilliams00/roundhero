import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useCharacter } from '../context/CharacterContext';
import { formatItemBuff } from '../utils/dnd';
import CustomAbilityModal from './CustomAbilityModal';
import ConfirmModal from './ConfirmModal';

export default function FeatBrowserModal({ onAdd, onClose }) {
  const { character } = useCharacter();
  const contentEditions = character?.tracker_data?.settings?.content_editions || { '2014': true, '2024': true, expanded: true };
  const [feats, setFeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  // mode: 'admin' edits the canon entry in place for everyone (a feat_override row matched
  // by name - the static feats.json on disk is never touched), 'duplicate' clones it into
  // an independent homebrew copy, 'custom' edits an existing duplicate/custom feat.
  const [editingMode, setEditingMode] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadFeats = () => api.get('/content/feats').then(r => setFeats(r.data));

  useEffect(() => { loadFeats().finally(() => setLoading(false)); }, []);

  const deleteFeat = async () => {
    await api.delete(`/content/feats/${confirmDelete._custom_id}`);
    await loadFeats();
    setConfirmDelete(null);
    setViewing(null);
  };

  const revertOverride = async () => {
    await api.delete(`/content/feats/override/${encodeURIComponent(viewing.name)}`);
    await loadFeats();
    setViewing(null);
  };

  const filtered = feats.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    const edition = f.edition || '2014';
    return contentEditions[edition] !== false;
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (viewing) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{viewing.name}</h2>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.section} · {viewing.source}</span>
              {viewing._source === 'custom' && <span style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>Homebrew</span>}
              {viewing._source === 'canon_override' && <span style={{fontSize:11,color:'var(--warning)',border:'1px solid var(--warning)',borderRadius:8,padding:'2px 8px'}}>Admin-edited</span>}
            </div>
          </div>
          <div className="modal-body">
            {viewing.max_uses > 0 && (
              <div style={{marginBottom:12,padding:'8px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
                <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>Uses</div>
                <div style={{color:'var(--warning)',fontWeight:700,fontSize:16}}>{viewing.max_uses}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{viewing.rest_type} rest</div>
              </div>
            )}
            {viewing.description && (
              <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:13,marginBottom:12}}>{viewing.description}</p>
            )}
            {viewing.buffs?.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Modifiers</div>
                {viewing.buffs.map((b,i) => (
                  <div key={i} style={{fontSize:12,color:'var(--text-secondary)'}}>{formatItemBuff(b)}</div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer" style={{flexWrap:'wrap'}}>
            <button className="btn btn-secondary" onClick={() => setViewing(null)}>Back</button>
            {viewing._source === 'custom' && (
              <>
                <button className="btn btn-secondary" onClick={() => setEditingMode('custom')}>✏️ Edit</button>
                <button className="btn btn-secondary" style={{color:'var(--danger)'}} onClick={() => setConfirmDelete(viewing)}>🗑️ Delete</button>
              </>
            )}
            {viewing._source !== 'custom' && (
              <>
                <button className="btn btn-secondary" onClick={() => setEditingMode('admin')}>✏️ Admin Edit</button>
                <button className="btn btn-secondary" onClick={() => setEditingMode('duplicate')}>📋 Duplicate</button>
              </>
            )}
            {viewing._source === 'canon_override' && (
              <button className="btn btn-secondary" style={{color:'var(--warning)'}} onClick={revertOverride}>↺ Revert</button>
            )}
            <button className="btn btn-primary" onClick={() => { onAdd(viewing); onClose(); }}>Add</button>
          </div>
        </div>
        {editingMode && (
          <CustomAbilityModal
            editingFeat={viewing}
            editMode={editingMode}
            onDelete={editingMode === 'custom' ? () => { setConfirmDelete(viewing); setEditingMode(null); } : undefined}
            onClose={() => { setEditingMode(null); setViewing(null); loadFeats(); }}
          />
        )}
        {confirmDelete && (
          <ConfirmModal
            title="Delete Feat?"
            message={`Delete "${confirmDelete.name}" from the shared feat library? Characters that already added it keep their own copy. This can't be undone.`}
            confirmLabel="Delete"
            danger
            onConfirm={deleteFeat}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Browse Feat Library</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Click a feat to see its details, fix its wording/modifiers, or add it straight to this character.</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search feats..." style={{marginBottom:12}} autoFocus />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No feats in the library yet.</div>
          ) : filtered.map((f,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(f)}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{f.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{f.section} · {f.source}{f.max_uses ? ` · ${f.max_uses}/${f.rest_type} rest` : ''}{f.buffs?.length ? ` · ${f.buffs.length} modifier${f.buffs.length>1?'s':''}` : ''}</div>
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
