import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import AddItemModal from './AddItemModal';
import ItemSpellsModal from './ItemSpellsModal';
import ItemBrowserModal from './ItemBrowserModal';
import WeaponBrowserModal from './WeaponBrowserModal';
import ItemDetailModal from './ItemDetailModal';
import RechargeItemModal from './RechargeItemModal';
import InfoModal from './InfoModal';

const RARITY_ORDER = ['Common','Uncommon','Rare','Very Rare','Legendary','Artifact'];
const SORT_OPTIONS = [
  { value: 'default',  label: 'Sort: Default' },
  { value: 'name',     label: 'Sort: Name (A-Z)' },
  { value: 'weight',   label: 'Sort: Weight (heaviest)' },
  { value: 'rarity',   label: 'Sort: Rarity' },
  { value: 'equipped', label: 'Sort: Equipped first' },
];

export default function InventoryTab() {
  const { character, saveTrackerData } = useCharacter();
  const [adding, setAdding]   = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browsingWeapons, setBrowsingWeapons] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewingSpells, setViewingSpells] = useState(null);
  const [recharging, setRecharging] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const [infoMessage, setInfoMessage] = useState(null);

  if (!character) return null;
  const td  = character.tracker_data || {};
  const inv = td.inventory || { currency: { cp:0,sp:0,ep:0,gp:0,pp:0 }, items: [] };
  const items = inv.items || [];

  const save = (newInv) => saveTrackerData({ ...td, inventory: newInv });

  const addItem = (item) => save({ ...inv, items: [...items, item] });
  const updateItem = (idx, item) => save({ ...inv, items: items.map((it,i) => i===idx ? item : it) });
  const removeItem = (idx) => save({ ...inv, items: items.filter((_,i) => i!==idx) });

  // Manual reordering - only meaningful in "Default" sort, since moving an item up/down
  // while a sort is active would just get overridden by the sort on the next render.
  const moveItem = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[j]] = [newItems[j], newItems[idx]];
    save({ ...inv, items: newItems });
  };

  // Items are copied from the master DB at add-time, so a later fix to the reference
  // data (description, charges, buffs) doesn't reach characters who already have the
  // item without this - pulls in the static fields, leaves quantity/equipped/attuned/
  // current-charges alone.
  const refreshItem = async (idx) => {
    const item = items[idx];
    const r = await api.get('/content/items');
    const master = r.data.find(it => it.name.toLowerCase() === item.name.toLowerCase());
    if (!master) {
      setInfoMessage(`No matching item named "${item.name}" found in the database.`);
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
    setInfoMessage(`${item.name} refreshed from the database.`);
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

  // Sort a (item, original-index) pairing rather than the items array itself, so every
  // row's edit/remove/view callback still points at the right item in the unsorted
  // tracker_data array regardless of display order.
  const sortedItems = items.map((it, i) => ({ it, idx: i })).sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.it.name.localeCompare(b.it.name);
      case 'weight': return (b.it.weight||0) - (a.it.weight||0);
      case 'rarity': return RARITY_ORDER.indexOf(b.it.rarity) - RARITY_ORDER.indexOf(a.it.rarity);
      case 'equipped': return (b.it.equipped?1:0) - (a.it.equipped?1:0);
      default: return 0;
    }
  });

  return (
    <div style={{flex:1,overflowY:'auto',padding:12}}>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',marginBottom:10}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,flex:1}}>
            Inventory <span style={{color:'var(--text-dim)',fontWeight:400}}>· {totalWeight.toFixed(1)} lb</span>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{fontSize:11,padding:'2px 4px',marginRight:8}}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setBrowsing(true)}>Add from DB</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setBrowsingWeapons(true)}>Add Weapon</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add Custom</button>
        </div>

        {items.length === 0 ? (
          <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:16}}>No items yet.</div>
        ) : sortedItems.map(({it: item, idx: i}) => (
          <div key={i} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {sortBy === 'default' && (
                <div style={{display:'flex',flexDirection:'column',flexShrink:0}}>
                  <button onClick={() => moveItem(i,-1)} disabled={i===0} title="Move up" style={{fontSize:9,lineHeight:1,padding:'1px 4px',background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:2,opacity:i===0?0.3:1}}>▲</button>
                  <button onClick={() => moveItem(i,1)} disabled={i===items.length-1} title="Move down" style={{fontSize:9,lineHeight:1,padding:'1px 4px',background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:2,opacity:i===items.length-1?0.3:1}}>▼</button>
                </div>
              )}
              <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(i)}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{item.name}</span>
                  {item.granted_spells?.length > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setViewingSpells(i); }}>✨ Spells</button>
                  )}
                  {item.quantity > 1 && <span style={{color:'var(--text-dim)',fontSize:11}}>×{item.quantity}</span>}
                  {item.equipped && <span style={{fontSize:10,color:'var(--success)',border:'1px solid var(--success)',borderRadius:8,padding:'0 6px'}}>Equipped</span>}
                  {item.attunement && <span style={{fontSize:10,color: item.attuned ? 'var(--accent-light)':'var(--text-dim)',border:`1px solid ${item.attuned?'var(--accent-light)':'var(--border-light)'}`,borderRadius:8,padding:'0 6px'}}>{item.attuned?'Attuned':'Attunement'}</span>}
                  {item.is_weapon && <span style={{fontSize:10,color:'var(--warning)',border:'1px solid var(--warning)',borderRadius:8,padding:'0 6px'}}>{item.damage_dice} {item.damage_type}</span>}
                </div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{item.rarity} {item.weight ? `· ${item.weight} lb` : ''}</div>
              </div>
              <label onClick={e => e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color: item.equipped ? 'var(--success)' : 'var(--text-dim)',cursor:'pointer'}}>
                <input type="checkbox" checked={!!item.equipped} onChange={() => updateItem(i, { ...item, equipped: !item.equipped })} />
                Equipped
              </label>
              {item.is_weapon && (
                <label onClick={e => e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-dim)',cursor:'pointer'}} title="Whether you're proficient with this weapon - affects the attack roll">
                  <input type="checkbox" checked={!!item.proficient} onChange={() => updateItem(i, { ...item, proficient: !item.proficient })} />
                  Proficient
                </label>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => removeItem(i)}>×</button>
            </div>
            {item.charges && (
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6}}>
                <button onClick={() => useCharge(i,-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>−</button>
                <span style={{color:'var(--warning)',fontWeight:700,fontSize:14,minWidth:36,textAlign:'center'}}>{item.charges.current}/{item.charges.max}</span>
                <button onClick={() => useCharge(i,1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>+</button>
                <span style={{color:'var(--text-dim)',fontSize:10}}>charges · recharges {item.charges.recharge.replace('_',' ')}</span>
                {item.charges.recharge_amount && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setRecharging(i)} title={`Roll ${item.charges.recharge_amount} to recharge`}>⚡ Recharge</button>
                )}
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
      {recharging !== null && (
        <RechargeItemModal
          item={items[recharging]}
          onApply={(newCurrent) => updateItem(recharging, { ...items[recharging], charges: { ...items[recharging].charges, current: newCurrent } })}
          onClose={() => setRecharging(null)}
        />
      )}
      {infoMessage && <InfoModal message={infoMessage} onClose={() => setInfoMessage(null)} />}
    </div>
  );
}
