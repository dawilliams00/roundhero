import React, { useState, useEffect } from 'react';
import api from '../utils/api';

// Search/import side of the shared homebrew-ruleset library - one player types out a
// homebrew exhaustion table, everyone else at the table can find and import it here
// instead of retyping it. rulesetType filters to one kind (currently only "exhaustion").
export default function RulesetBrowserModal({ rulesetType, onImport, onClose }) {
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/content/rulesets', { params: { ruleset_type: rulesetType } })
      .then(r => setRulesets(r.data))
      .finally(() => setLoading(false));
  }, [rulesetType]);

  const filtered = rulesets.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <div className="modal-sticky-header">
          <h2>Browse Homebrew Rulesets</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Rulesets anyone at the table has typed out and saved — import one instead of retyping it.</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search rulesets..." style={{marginBottom:12}} autoFocus />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No homebrew rulesets saved yet.</div>
          ) : filtered.map((r,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{r.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2,lineHeight:1.5}}>{(r.description||'').substring(0,100)}{(r.description||'').length>100?'…':''}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { onImport(r); onClose(); }}>Import</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
