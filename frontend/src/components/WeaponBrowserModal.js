import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function WeaponBrowserModal({ onAdd, onClose }) {
  const [allWeapons, setAllWeapons] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [viewing, setViewing]   = useState(null);

  useEffect(() => {
    api.get('/content/equipment').then(r => {
      setAllWeapons((r.data || []).filter(it => it.equipment_category === 'Weapon'));
    }).finally(() => setLoading(false));
  }, []);

  const weapons = allWeapons.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()));

  // Unlike magic items, owning two of the same mundane weapon (two shortswords for
  // two-weapon fighting, a handful of daggers) is normal - never disable "Add".
  const addWeapon = (master) => {
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
  };

  if (viewing) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{viewing.name}</h2>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.weapon_category} · {viewing.weapon_range}</span>
              {viewing.weight ? <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{viewing.weight} lb</span> : null}
            </div>
          </div>
          <div className="modal-body">
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
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setViewing(null)}>Back</button>
            <button className="btn btn-primary" onClick={() => { addWeapon(viewing); setViewing(null); }}>Add to Inventory</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <h2>Add Weapon</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>Click a weapon to see its details before adding.</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search weapons..." style={{marginBottom:12}} autoFocus />
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading weapons...</div>
          ) : weapons.length === 0 ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>No weapons found.</div>
          ) : weapons.map(w => (
            <div key={w.name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(w)}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{w.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{w.weapon_category} · {w.weapon_range} · {w.damage?.damage_dice} {w.damage?.damage_type}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => addWeapon(w)} style={{fontSize:11,padding:'4px 10px'}}>Add</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
