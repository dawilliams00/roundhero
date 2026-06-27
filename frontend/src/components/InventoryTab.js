import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import AddItemModal from './AddItemModal';
import ItemSpellsModal from './ItemSpellsModal';
import ItemBrowserModal from './ItemBrowserModal';
import WeaponBrowserModal from './WeaponBrowserModal';
import ItemDetailModal from './ItemDetailModal';

export default function InventoryTab() {
  const { character, saveTrackerData } = useCharacter();
  const [adding, setAdding]   = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browsingWeapons, setBrowsingWeapons] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewingSpells, setViewingSpells] = useState(null);

  if (!character) return null;
  const td  = character.tracker_data || {};
  const inv = td.inventory || { currency: { cp:0,sp:0,ep:0,gp:0,pp:0 }, items: [] };
  const items = inv.items || [];

  const save = (newInv) => saveTrackerData({ ...td, inventory: newInv });

  const addItem = (item) => save({ ...inv, items: [...items, item] });
  const updateItem = (idx, item) => save({ ...inv, items: items.map((it,i) => i===idx ? item : it) });
  const removeItem = (idx) => save({ ...inv, items: items.filter((_,i) => i!==idx) });

  // Items are copied from the master DB at add-time, so a later fix to the reference
  // data (description, charges, buffs) doesn't reach characters who already have the
  // item without this - pulls in the static fields, leaves quantity/equipped/attuned/
  // current-charges alone.
  const refreshItem = async (idx) => {
    const item = items[idx];
    const r = await api.get('/content/items');
    const master = r.data.find(it => it.name.toLowerCase() === item.name.toLowerCase());
    if (!master) {
      window.alert(`No matching item named "${item.name}" found in the database.`);
      return;
    }
    updateItem(idx, {
      ...item,
      description: master.description || item.description,
      weight: master.weight ?? item.weight,
      rarity: master.rarity || item.rarity,
      buffs: master.buffs ? master.buffs.map(b => ({...b})) : item.buffs,
      granted_spells: (master.granted_spells || []).map(s => ({...s})),
      charges: master.charges ? { ...master.charges, current: Math.min(item.charges?.current ?? master.charges.max, master.charges.max) } : item.charges,
    });
    window.alert(`${item.name} refreshed from the database.`);
  };

  const castItemSpell = (idx, chargeCost) => {
    const item = items[idx];
    if (!item.charges) return;
    const cur = Math.max(0, (item.charges.current||0) - chargeCost);
    updateItem(idx, { ...item, charges: { ...item.charges, current: cur } });
  };

  const useCharge = (idx, delta) => {
    const item = items[idx];
    if (!item.charges) return;
    const cur = Math.max(0, Math.min(item.charges.max, (item.charges.current||0) + delta));
    updateItem(idx, { ...item, charges: { ...item.charges, current: cur } });
  };

  const totalWeight = items.reduce((sum,it) => sum + (it.weight||0) * (it.quantity||1), 0);

  return (
    <div style={{flex:1,overflowY:'auto',padding:12}}>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',marginBottom:10}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,flex:1}}>
            Items <span style={{color:'var(--text-dim)',fontWeight:400}}>· {totalWeight.toFixed(1)} lb</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setBrowsing(true)}>Add from DB</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setBrowsingWeapons(true)}>Add Weapon</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add Custom</button>
        </div>

        {items.length === 0 ? (
          <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:16}}>No items yet.</div>
        ) : items.map((item, i) => (
          <div key={i} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(i)}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{item.name}</span>
                  {item.quantity > 1 && <span style={{color:'var(--text-dim)',fontSize:11}}>×{item.quantity}</span>}
                  {item.equipped && <span style={{fontSize:10,color:'var(--success)',border:'1px solid var(--success)',borderRadius:8,padding:'0 6px'}}>Equipped</span>}
                  {item.attunement && <span style={{fontSize:10,color: item.attuned ? 'var(--accent-light)':'var(--text-dim)',border:`1px solid ${item.attuned?'var(--accent-light)':'var(--border-light)'}`,borderRadius:8,padding:'0 6px'}}>{item.attuned?'Attuned':'Attunement'}</span>}
                  {item.is_weapon && <span style={{fontSize:10,color:'var(--warning)',border:'1px solid var(--warning)',borderRadius:8,padding:'0 6px'}}>{item.damage_dice} {item.damage_type}</span>}
                </div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{item.rarity} {item.weight ? `· ${item.weight} lb` : ''}</div>
              </div>
              {item.is_weapon && (
                <label onClick={e => e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-dim)',cursor:'pointer'}} title="Whether you're proficient with this weapon - affects the attack roll">
                  <input type="checkbox" checked={!!item.proficient} onChange={() => updateItem(i, { ...item, proficient: !item.proficient })} />
                  Proficient
                </label>
              )}
              {item.granted_spells?.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setViewingSpells(i)}>✨ Spells</button>
              )}
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
      {browsing && <ItemBrowserModal existingItems={items} onAdd={addItem} onClose={() => setBrowsing(false)} />}
      {browsingWeapons && <WeaponBrowserModal onAdd={addItem} onClose={() => setBrowsingWeapons(false)} />}
      {editing !== null && (
        <AddItemModal item={items[editing]} onSave={(it) => updateItem(editing, it)} onClose={() => setEditing(null)} />
      )}
      {viewing !== null && (
        <ItemDetailModal
          item={items[viewing]}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onRefresh={() => refreshItem(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
      {viewingSpells !== null && (
        <ItemSpellsModal
          item={items[viewingSpells]}
          onCast={(chargeCost) => castItemSpell(viewingSpells, chargeCost)}
          onClose={() => setViewingSpells(null)}
        />
      )}
    </div>
  );
}
