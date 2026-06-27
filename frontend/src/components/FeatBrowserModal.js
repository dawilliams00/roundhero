import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function FeatBrowserModal({ onAdd, onClose }) {
  const [feats, setFeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/content/feats').then(r => setFeats(r.data)).finally(() => setLoading(false));
  }, []);

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
              <button className="btn btn-primary btn-sm" onClick={() => { onAdd(f); onClose(); }}>Add</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
