import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import CustomAbilityModal from './CustomAbilityModal';
import ConfirmModal from './ConfirmModal';

export default function FeatBrowserModal({ onAdd, onClose }) {
  const [feats, setFeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingFeat, setEditingFeat] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadFeats = () => api.get('/content/feats').then(r => setFeats(r.data));

  useEffect(() => { loadFeats().finally(() => setLoading(false)); }, []);

  const deleteFeat = async () => {
    await api.delete(`/content/feats/${confirmDelete._custom_id}`);
    await loadFeats();
    setConfirmDelete(null);
  };

  const filtered = feats.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Browse Feat Library</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Feats anyone has created with "+ Custom" — add one straight to this character.</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search feats..." style={{marginBottom:12}} autoFocus />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No feats in the library yet.</div>
          ) : filtered.map((f,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{f.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{f.section} · {f.source}{f.max_uses ? ` · ${f.max_uses}/${f.rest_type} rest` : ''}</div>
              </div>
              {f._source === 'custom' && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingFeat(f)}>✏️ Edit</button>
                  <button className="btn btn-secondary btn-sm" style={{color:'var(--danger)'}} onClick={() => setConfirmDelete(f)}>🗑️</button>
                </>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => { onAdd(f); onClose(); }}>Add</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>

      {editingFeat && (
        <CustomAbilityModal
          editingFeat={editingFeat}
          onDelete={() => { setConfirmDelete(editingFeat); setEditingFeat(null); }}
          onClose={() => { setEditingFeat(null); loadFeats(); }}
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
