import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import MonsterDetailModal from './MonsterDetailModal';

const CR_ORDER = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];

export default function BestiaryTab() {
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [crFilter, setCrFilter] = useState('all');
  const [viewing, setViewing]   = useState(null);

  useEffect(() => {
    api.get('/content/monsters').then(r => setMonsters(r.data)).finally(() => setLoading(false));
  }, []);

  const types = useMemo(() => [...new Set(monsters.map(m => m.type))].sort(), [monsters]);
  const crs = useMemo(() => CR_ORDER.filter(cr => monsters.some(m => m.challenge_rating === cr)), [monsters]);

  const filtered = monsters.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    const matchCr = crFilter === 'all' || m.challenge_rating === crFilter;
    return matchSearch && matchType && matchCr;
  });

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:12,flexShrink:0}}>
        <div className="card">
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Bestiary · SRD Monsters</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search monsters..." style={{flex:1,minWidth:140}} />
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{minWidth:120}}>
              <option value="all">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={crFilter} onChange={e=>setCrFilter(e.target.value)} style={{minWidth:90}}>
              <option value="all">All CR</option>
              {crs.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'0 12px 12px'}}>
        <div className="card">
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading monsters...</div>
          ) : filtered.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No monsters found.</div>
          ) : filtered.map(m => (
            <div key={m.name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={() => setViewing(m)}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{m.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{m.size} {m.type} · {m.alignment}</div>
              </div>
              <div style={{color:'var(--accent-light)',fontSize:12,fontWeight:600,minWidth:50,textAlign:'right'}}>CR {m.challenge_rating}</div>
            </div>
          ))}
        </div>
      </div>

      {viewing && <MonsterDetailModal monster={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
