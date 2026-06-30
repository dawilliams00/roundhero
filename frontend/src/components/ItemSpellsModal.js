import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { schoolColor, slotBadgeTextColor } from '../utils/dnd';
import SpellDetailModal from './SpellDetailModal';

export default function ItemSpellsModal({ item, onCast, onClose }) {
  const [spellDb, setSpellDb] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    api.get('/content/spells')
      .then(r => setSpellDb(Object.fromEntries(r.data.map(s => [s.name.toLowerCase(), s]))))
      .finally(() => setLoading(false));
  }, []);

  const charges = item.charges || { current: 0, max: 0 };

  const resolveSpell = (granted) => {
    const master = spellDb[granted.name.toLowerCase()];
    if (master) {
      const lvl = granted.cast_level ?? master.level_int;
      // base_level_int keeps the spell's true base level so damage scaling (which cares
      // how far above the BASE level this was cast) still works after the display level
      // gets overridden to the item's fixed cast_level.
      return { ...master, level_int: lvl, level: String(lvl), base_level_int: master.level_int };
    }
    return {
      name: granted.name, level_int: granted.level_int || 0, level: String(granted.level_int || 0),
      school: '', ritual: false, concentration: false, casting_time: '', range: '', components: '',
      duration: '', description: `Granted by ${item.name}. (Not found in spell database — details unavailable.)`,
    };
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:420,maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <div className="modal-sticky-header">
          <h2>{item.name}</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>{charges.current}/{charges.max} charges</div>
        {loading ? (
          <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading spells...</div>
        ) : (
          <div style={{flex:1,overflowY:'auto'}}>
            {(item.granted_spells || []).map((g, i) => {
              const spell = resolveSpell(g);
              return (
                <div key={i} onClick={() => setViewing({ spell, chargeCost: g.charge_cost || 1, noLethargy: !!g.no_lethargy })} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                  <div style={{background: spell.level_int===0 ? 'var(--text-dim)' : `var(--slot-${spell.level_int})`,color: spell.level_int===0 ? '#fff' : slotBadgeTextColor(spell.level_int),borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600,minWidth:24,textAlign:'center'}}>
                    {spell.level_int===0?'C':spell.level_int}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color: schoolColor(spell.school),fontWeight:500,fontSize:13}}>{spell.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:11}}>{spell.school}</div>
                  </div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>{g.charge_cost || 1} chg</div>
                </div>
              );
            })}
          </div>
        )}
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>

      {viewing && (
        <SpellDetailModal
          spell={viewing.spell}
          chargeMode={{
            itemName: item.name,
            chargesCurrent: charges.current,
            chargesMax: charges.max,
            chargeCost: viewing.chargeCost,
            noLethargy: viewing.noLethargy,
            onCast: () => onCast(viewing.chargeCost),
          }}
          onClose={() => setViewing(null)}
          onCastSuccess={onClose}
        />
      )}
    </div>
  );
}
