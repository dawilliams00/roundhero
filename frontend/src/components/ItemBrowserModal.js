import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function ItemBrowserModal({ existingItems, onAdd, onClose }) {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [viewing, setViewing]   = useState(null);

  useEffect(() => {
    api.get('/content/items').then(r => setAllItems(r.data)).finally(() => setLoading(false));
  }, []);

  const existingNames = new Set((existingItems || []).map(it => it.name));
  const items = allItems.filter(it => !search || it.name.toLowerCase().includes(search.toLowerCase()));

  const addItem = (master) => {
    onAdd({
      name: master.name,
      quantity: 1,
      weight: master.weight || 0,
      rarity: master.rarity || 'Common',
      equipped: false,
      attunement: !!master.attunement,
      attuned: false,
      description: master.description || '',
      charges: master.charges ? { ...master.charges } : null,
      granted_spells: (master.granted_spells || []).map(s => ({ ...s })),
    });
  };

  if (viewing) {
    const isAdded = existingNames.has(viewing.name);
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{viewing.name}</h2>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {viewing.rarity && <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.rarity}</span>}
              {viewing.type && <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.type}</span>}
              {viewing.weight ? <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.weight} lb</span> : null}
              {viewing.attunement && <span style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>Requires Attunement</span>}
            </div>
          </div>
          <div className="modal-body">
            {viewing.charges && (
              <div style={{marginBottom:12,padding:'8px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
                <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>Charges</div>
                <div style={{color:'var(--warning)',fontWeight:700,fontSize:16}}>{viewing.charges.max}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>recharges {viewing.charges.recharge?.replace('_',' ')}</div>
              </div>
            )}
            {viewing.description && (
              <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:13,marginBottom:12}}>{viewing.description}</p>
            )}
            {viewing.granted_spells?.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Granted Spells</div>
                {viewing.granted_spells.map((s,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-secondary)',padding:'2px 0'}}>
                    <span>{s.name}{s.cast_level ? ` (as level ${s.cast_level})` : ''}</span>
                    <span style={{color:'var(--text-dim)'}}>{s.charge_cost || 0} chg</span>
                  </div>
                ))}
              </div>
            )}
            {viewing.buffs?.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Bonuses</div>
                {viewing.buffs.map((b,i) => (
                  <div key={i} style={{fontSize:12,color:'var(--text-secondary)'}}>{b.stat?.replace(/_/g,' ')}: +{b.value}</div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setViewing(null)}>Back</button>
            <button className={isAdded ? 'btn btn-secondary' : 'btn btn-primary'} disabled={isAdded} onClick={() => { addItem(viewing); setViewing(null); }}>
              {isAdded ? 'Added' : 'Add to Inventory'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Add Magic Item</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Click an item to see its details before adding.</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..." style={{marginBottom:12}} autoFocus />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading items...</div>
          ) : items.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No items found.</div>
          ) : items.map(it => {
            const isAdded = existingNames.has(it.name);
            return (
              <div key={it.name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(it)}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>{it.rarity} {it.type ? `· ${it.type}` : ''} {it.charges ? `· ${it.charges.max} charges` : ''}</div>
                </div>
                <button className={isAdded ? 'btn btn-secondary' : 'btn btn-primary'} disabled={isAdded} onClick={() => addItem(it)} style={{fontSize:11,padding:'4px 10px'}}>
                  {isAdded ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
