import React from 'react';
import { formatItemBuff } from '../utils/dnd';

export default function ItemDetailModal({ item, onEdit, onRefresh, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-header">
          <h2>{item.name}</h2>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {item.rarity && <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{item.rarity}</span>}
            {item.quantity > 1 && <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>×{item.quantity}</span>}
            {item.weight ? <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{item.weight} lb</span> : null}
            {item.equipped && <span style={{fontSize:11,color:'var(--success)',border:'1px solid var(--success)',borderRadius:8,padding:'2px 8px'}}>Equipped</span>}
            {item.attunement && <span style={{fontSize:11,color: item.attuned ? 'var(--accent-light)':'var(--text-dim)',border:`1px solid ${item.attuned?'var(--accent-light)':'var(--border-light)'}`,borderRadius:8,padding:'2px 8px'}}>{item.attuned?'Attuned':'Requires Attunement'}</span>}
          </div>
        </div>
        <div className="modal-body">
          {item.is_weapon && (
            <div style={{marginBottom:12,padding:'8px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>{item.weapon_category} · {item.weapon_range}</div>
              <div style={{color:'var(--warning)',fontWeight:700,fontSize:16}}>{item.damage_dice} {item.damage_type}</div>
              {item.two_handed_damage && (
                <div style={{color:'var(--text-dim)',fontSize:12,marginTop:2}}>Two-handed: {item.two_handed_damage.damage_dice} {item.two_handed_damage.damage_type}</div>
              )}
              {item.range && (
                <div style={{color:'var(--text-dim)',fontSize:12,marginTop:2}}>Range: {item.range.normal}{item.range.long ? `/${item.range.long}` : ''} ft</div>
              )}
              {item.properties?.length > 0 && (
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
                  {item.properties.map(p => (
                    <span key={p} style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>{p}</span>
                  ))}
                </div>
              )}
              <div style={{color: item.proficient ? 'var(--success)' : 'var(--text-dim)',fontSize:11,marginTop:6}}>{item.proficient ? 'Proficient' : 'Not proficient'}{item.two_handed ? ' · wielded two-handed' : ''}</div>
            </div>
          )}

          {item.charges && (
            <div style={{marginBottom:12,padding:'8px 10px',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>Charges</div>
              <div style={{color:'var(--warning)',fontWeight:700,fontSize:16}}>{item.charges.current}/{item.charges.max}</div>
              <div style={{color:'var(--text-dim)',fontSize:11}}>
                recharges {item.charges.recharge?.replace('_',' ')}
                {item.charges.recharge_amount && ` (+${item.charges.recharge_amount})`}
              </div>
            </div>
          )}

          {item.description && (
            <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:13,marginBottom:12}}>{item.description}</p>
          )}

          {item.granted_spells?.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Granted Spells</div>
              {item.granted_spells.map((s,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-secondary)',padding:'2px 0'}}>
                  <span>{s.name}{s.cast_level ? ` (as level ${s.cast_level})` : ''}</span>
                  <span style={{color:'var(--text-dim)'}}>{s.charge_cost || 0} chg</span>
                </div>
              ))}
            </div>
          )}

          {item.buffs?.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Bonuses</div>
              {item.buffs.map((b,i) => (
                <div key={i} style={{fontSize:12,color:'var(--text-secondary)'}}>{formatItemBuff(b)}</div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {onEdit && <button className="btn btn-secondary" onClick={onEdit}>Edit</button>}
          {onRefresh && <button className="btn btn-secondary" onClick={onRefresh} title="Pull latest description/charges/buffs from the database">🔄 Refresh</button>}
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
