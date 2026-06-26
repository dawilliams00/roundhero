import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function ItemBrowserModal({ existingItems, onAdd, onClose }) {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Add Magic Item</h2>
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
                <div style={{flex:1}}>
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
