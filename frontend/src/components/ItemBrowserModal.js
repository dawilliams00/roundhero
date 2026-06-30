import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatItemBuff } from '../utils/dnd';
import AddItemModal from './AddItemModal';
import InfoModal from './InfoModal';

// One unified browser for everything in the reference DB - magic items (potions,
// scrolls, staves, wands, etc.) and mundane weapons both show up in the same
// searchable list, since to a player adding gear they're all just "items".
export default function ItemBrowserModal({ existingItems, onAdd, onClose }) {
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [viewing, setViewing]   = useState(null);
  // mode: 'admin' edits the canon entry in place for everyone (an override row matched
  // by name - the static magic_items.json on disk is never touched), 'duplicate' clones
  // it into an independent homebrew copy, 'homebrew-edit' edits an existing duplicate.
  const [editingMaster, setEditingMaster] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const loadEntries = () => Promise.all([
    api.get('/content/items'),
    api.get('/content/equipment'),
  ]).then(([itemsRes, equipRes]) => {
    const items = (itemsRes.data || []).map(it => ({ ...it, _kind: 'item' }));
    const weapons = (equipRes.data || [])
      .filter(e => e.equipment_category === 'Weapon')
      .map(w => ({ ...w, _kind: 'weapon' }));
    setAllEntries([...items, ...weapons].sort((a, b) => a.name.localeCompare(b.name)));
  });

  useEffect(() => { loadEntries().finally(() => setLoading(false)); }, []);

  const saveMasterEdit = async (out) => {
    if (editingMaster.mode === 'admin') {
      await api.put('/content/items/override', { ...out, _canon_name: editingMaster.item.name });
      setInfoMessage(`"${out.name}" updated for everyone - already-owned copies can pick this up via the Inventory tab's 🔄 Refresh button.`);
    } else if (editingMaster.mode === 'duplicate') {
      await api.post('/content/items', out);
      setInfoMessage(`"${out.name}" added as a homebrew item - the original is untouched.`);
    } else {
      await api.put(`/content/items/${editingMaster.item._custom_id}`, out);
    }
    await loadEntries();
    setEditingMaster(null);
    setViewing(null);
  };

  const deleteHomebrewItem = async () => {
    await api.delete(`/content/items/${viewing._custom_id}`);
    await loadEntries();
    setViewing(null);
  };

  const revertOverride = async () => {
    await api.delete(`/content/items/override/${encodeURIComponent(viewing.name)}`);
    await loadEntries();
    setViewing(null);
  };

  const existingNames = new Set((existingItems || []).map(it => it.name));
  const entries = allEntries.filter(it => !search || it.name.toLowerCase().includes(search.toLowerCase()));

  const addEntry = (master) => {
    if (master._kind === 'weapon') {
      // Owning two of the same mundane weapon (two shortswords for two-weapon
      // fighting, a handful of daggers) is normal, unlike magic items.
      onAdd({
        is_weapon: true,
        name: master.name,
        weapon_category: master.weapon_category,
        weapon_range: master.weapon_range,
        damage_dice: master.damage?.damage_dice || '',
        damage_type: master.damage?.damage_type || '',
        properties: master.properties || [],
        range: master.range || null,
        two_handed_damage: master.two_handed_damage || null,
        weight: master.weight || 0,
        quantity: 1,
        rarity: 'Common',
        equipped: false,
        attunement: false,
        attuned: false,
        buffs: [],
        proficient: true,
        two_handed: false,
        description: '',
        charges: null,
        granted_spells: [],
        cost_type: null,
      });
    } else {
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
        buffs: (master.buffs || []).map(b => ({ ...b })),
      });
    }
  };

  if (viewing) {
    const isWeapon = viewing._kind === 'weapon';
    const isAdded = !isWeapon && existingNames.has(viewing.name);
    return (
      <div className="modal-overlay">
        <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
          <div className="modal-header">
            <h2>{viewing.name}</h2>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {isWeapon ? (
                <>
                  <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.weapon_category} · {viewing.weapon_range}</span>
                  {viewing.weight ? <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.weight} lb</span> : null}
                </>
              ) : (
                <>
                  {viewing.rarity && <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.rarity}</span>}
                  {viewing.type && <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.type}</span>}
                  {viewing.weight ? <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.weight} lb</span> : null}
                  {viewing.attunement && <span style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>Requires Attunement</span>}
                  {viewing._source === 'custom' && <span style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>Homebrew</span>}
                  {viewing._source === 'canon_override' && <span style={{fontSize:11,color:'var(--warning)',border:'1px solid var(--warning)',borderRadius:8,padding:'2px 8px'}}>Admin-edited</span>}
                </>
              )}
            </div>
          </div>
          <div className="modal-body">
            {isWeapon ? (
              <>
                <div style={{marginBottom:12,padding:'8px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
                  <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Damage</div>
                  <div style={{color:'var(--warning)',fontWeight:700,fontSize:16}}>{viewing.damage?.damage_dice} {viewing.damage?.damage_type}</div>
                  {viewing.two_handed_damage && (
                    <div style={{color:'var(--text-dim)',fontSize:12,marginTop:2}}>Two-handed: {viewing.two_handed_damage.damage_dice} {viewing.two_handed_damage.damage_type}</div>
                  )}
                  {viewing.range && (
                    <div style={{color:'var(--text-dim)',fontSize:12,marginTop:2}}>Range: {viewing.range.normal}{viewing.range.long ? `/${viewing.range.long}` : ''} ft</div>
                  )}
                </div>
                {viewing.properties?.length > 0 && (
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                    {viewing.properties.map(p => (
                      <span key={p} style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>{p}</span>
                    ))}
                  </div>
                )}
                {viewing.desc?.length > 0 && (
                  <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:13}}>{viewing.desc.join('\n\n')}</p>
                )}
              </>
            ) : (
              <>
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
                      <div key={i} style={{fontSize:12,color:'var(--text-secondary)'}}>{formatItemBuff(b)}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer" style={{flexWrap:'wrap'}}>
            <button className="btn btn-secondary" onClick={() => setViewing(null)}>Back</button>
            {!isWeapon && viewing._source === 'custom' && (
              <button className="btn btn-secondary" onClick={() => setEditingMaster({ mode: 'homebrew-edit', item: viewing })}>✏️ Edit</button>
            )}
            {!isWeapon && viewing._source === 'custom' && (
              <button className="btn btn-secondary" style={{color:'var(--danger)'}} onClick={deleteHomebrewItem}>🗑️ Delete</button>
            )}
            {!isWeapon && viewing._source !== 'custom' && (
              <button className="btn btn-secondary" onClick={() => setEditingMaster({ mode: 'admin', item: viewing })}>✏️ Admin Edit</button>
            )}
            {!isWeapon && viewing._source !== 'custom' && (
              <button className="btn btn-secondary" onClick={() => setEditingMaster({ mode: 'duplicate', item: viewing })}>📋 Duplicate</button>
            )}
            {!isWeapon && viewing._source === 'canon_override' && (
              <button className="btn btn-secondary" style={{color:'var(--warning)'}} onClick={revertOverride}>↺ Revert</button>
            )}
            <button className={isAdded ? 'btn btn-secondary' : 'btn btn-primary'} disabled={isAdded} onClick={() => { addEntry(viewing); setViewing(null); }}>
              {isAdded ? 'Added' : 'Add to Inventory'}
            </button>
          </div>
        </div>
        {editingMaster && (
          <AddItemModal
            item={editingMaster.mode === 'duplicate' ? { ...editingMaster.item, name: `${editingMaster.item.name} (Homebrew)` } : editingMaster.item}
            onSave={saveMasterEdit}
            onClose={() => setEditingMaster(null)}
          />
        )}
        {infoMessage && <InfoModal title="Item Library" message={infoMessage} onClose={() => setInfoMessage(null)} />}
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <h2>Add Item</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Click an item to see its details before adding.</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..." style={{marginBottom:12}} autoFocus />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading items...</div>
          ) : entries.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No items found.</div>
          ) : entries.map(it => {
            const isWeapon = it._kind === 'weapon';
            const isAdded = !isWeapon && existingNames.has(it.name);
            return (
              <div key={`${it._kind}_${it.name}`} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(it)}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>
                    {isWeapon
                      ? `${it.weapon_category} · ${it.weapon_range} · ${it.damage?.damage_dice} ${it.damage?.damage_type}`
                      : `${it.rarity} ${it.type ? `· ${it.type}` : ''} ${it.charges ? `· ${it.charges.max} charges` : ''}`}
                  </div>
                </div>
                <button className={isAdded ? 'btn btn-secondary' : 'btn btn-primary'} disabled={isAdded} onClick={() => addEntry(it)} style={{fontSize:11,padding:'4px 10px'}}>
                  {isAdded ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
      {infoMessage && <InfoModal title="Item Library" message={infoMessage} onClose={() => setInfoMessage(null)} />}
    </div>
  );
}
