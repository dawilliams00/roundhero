import React from 'react';
import { useCharacter } from '../context/CharacterContext';

export default function RestSummaryModal({ summary, restType, onClose }) {
  const { character } = useCharacter();
  const { features_reset = [], items_recharged = [], items_need_recharge = [], slots_restored, hit_dice_regained } = summary || {};
  // Same generic rest_reminder flag RestModal checks before a rest (see restReminderNames
  // there) - this is the "after" half, shown once the rest actually completes.
  const afterReminders = Object.entries(character?.tracker_data?.features || {})
    .filter(([, f]) => f?.rest_reminder?.[`after_${restType}`]).map(([name]) => name);
  const nothingChanged = features_reset.length === 0 && items_recharged.length === 0 && items_need_recharge.length === 0 && afterReminders.length === 0 && !slots_restored && !hit_dice_regained;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:360}} onClick={e => e.stopPropagation()}>
        <div className="modal-sticky-header">
          <h2>{restType === 'long' ? 'Long Rest Complete' : 'Short Rest Complete'}</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {afterReminders.length > 0 && (
          <div style={{marginBottom:12}}>
            {afterReminders.map(n => (
              <div key={n} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',marginBottom:6,background:'rgba(245,158,11,0.1)',border:'1px solid var(--warning)',borderRadius:'var(--radius-sm)'}}>
                <span style={{fontSize:14}}>📌</span>
                <span style={{color:'var(--text-primary)',fontSize:13}}>Don't forget: <b>{n}</b></span>
              </div>
            ))}
          </div>
        )}
        {nothingChanged ? (
          <p style={{color:'var(--text-secondary)',fontSize:13}}>Nothing needed to recharge — you were already topped up.</p>
        ) : (
          <>
            {slots_restored && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--accent-light)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>Spell Slots</div>
                <div style={{color:'var(--text-secondary)',fontSize:13}}>Restored</div>
              </div>
            )}
            {hit_dice_regained > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--accent-light)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>Hit Dice</div>
                <div style={{color:'var(--text-secondary)',fontSize:13}}>Regained {hit_dice_regained}</div>
              </div>
            )}
            {features_reset.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--accent-light)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Features Reset</div>
                {features_reset.map(f => <div key={f} style={{color:'var(--text-secondary)',fontSize:13}}>{f}</div>)}
              </div>
            )}
            {items_recharged.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--accent-light)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Items Recharged</div>
                {items_recharged.map(it => <div key={it} style={{color:'var(--text-secondary)',fontSize:13}}>✨ {it}</div>)}
              </div>
            )}
            {items_need_recharge.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--warning)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Don't Forget to Recharge</div>
                {items_need_recharge.map(it => <div key={it} style={{color:'var(--text-secondary)',fontSize:13}}>⚡ {it} — use its Recharge button in Inventory</div>)}
              </div>
            )}
          </>
        )}
        <button className="btn btn-primary" style={{width:'100%',marginTop:8}} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
