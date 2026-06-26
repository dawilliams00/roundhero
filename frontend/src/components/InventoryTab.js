import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import AddItemModal from './AddItemModal';

const CURRENCIES = ['cp','sp','ep','gp','pp'];

export default function InventoryTab() {
  const { character, saveTrackerData } = useCharacter();
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState(null);

  if (!character) return null;
  const td  = character.tracker_data || {};
  const inv = td.inventory || { currency: { cp:0,sp:0,ep:0,gp:0,pp:0 }, items: [] };
  const items = inv.items || [];

  const save = (newInv) => saveTrackerData({ ...td, inventory: newInv });

  const addItem = (item) => save({ ...inv, items: [...items, item] });
  const updateItem = (idx, item) => save({ ...inv, items: items.map((it,i) => i===idx ? item : it) });
  const removeItem = (idx) => save({ ...inv, items: items.filter((_,i) => i!==idx) });
  const setCurrency = (k, v) => save({ ...inv, currency: { ...inv.currency, [k]: parseInt(v)||0 } });

  const useCharge = (idx, delta) => {
    const item = items[idx];
    if (!item.charges) return;
    const cur = Math.max(0, Math.min(item.charges.max, (item.charges.current||0) + delta));
    updateItem(idx, { ...item, charges: { ...item.charges, current: cur } });
  };

  const totalWeight = items.reduce((sum,it) => sum + (it.weight||0) * (it.quantity||1), 0);

  return (
    <div style={{flex:1,overflowY:'auto',padding:12}}>
      <div className="card" style={{marginBottom:12}}>
        <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Currency</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {CURRENCIES.map(c => (
            <div key={c} style={{textAlign:'center'}}>
              <input
                type="number" min={0} value={inv.currency?.[c] ?? 0}
                onChange={e => setCurrency(c, e.target.value)}
                style={{width:56,textAlign:'center'}}
              />
              <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',marginTop:2}}>{c}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{display:'flex',alignItems:'center',marginBottom:10}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,flex:1}}>
            Items <span style={{color:'var(--text-dim)',fontWeight:400}}>· {totalWeight.toFixed(1)} lb</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add Item</button>
        </div>

        {items.length === 0 ? (
          <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:16}}>No items yet.</div>
        ) : items.map((item, i) => (
          <div key={i} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={() => setEditing(i)}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{item.name}</span>
                  {item.quantity > 1 && <span style={{color:'var(--text-dim)',fontSize:11}}>×{item.quantity}</span>}
                  {item.equipped && <span style={{fontSize:10,color:'var(--success)',border:'1px solid var(--success)',borderRadius:8,padding:'0 6px'}}>Equipped</span>}
                  {item.attunement && <span style={{fontSize:10,color: item.attuned ? 'var(--accent-light)':'var(--text-dim)',border:`1px solid ${item.attuned?'var(--accent-light)':'var(--border-light)'}`,borderRadius:8,padding:'0 6px'}}>{item.attuned?'Attuned':'Attunement'}</span>}
                </div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{item.rarity} {item.weight ? `· ${item.weight} lb` : ''}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => removeItem(i)}>×</button>
            </div>
            {item.charges && (
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6}}>
                <button onClick={() => useCharge(i,-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>−</button>
                <span style={{color:'var(--warning)',fontWeight:700,fontSize:14,minWidth:36,textAlign:'center'}}>{item.charges.current}/{item.charges.max}</span>
                <button onClick={() => useCharge(i,1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>+</button>
                <span style={{color:'var(--text-dim)',fontSize:10}}>charges · recharges {item.charges.recharge.replace('_',' ')}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && <AddItemModal onSave={addItem} onClose={() => setAdding(false)} />}
      {editing !== null && (
        <AddItemModal item={items[editing]} onSave={(it) => updateItem(editing, it)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
