import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';

export default function TrackerTab() {
  const { character, saveTrackerData, addActiveEffect, removeActiveEffect } = useCharacter();
  const [editHP, setEditHP] = useState(false);
  const [hpInput, setHpInput] = useState('');
  const [newEffect, setNewEffect] = useState('');

  if (!character) return null;
  const td       = character.tracker_data || {};
  const features = td.features   || {};
  const charges  = td.item_charges || {};
  const conds    = td.conditions || [];
  const effects  = td.active_effects || [];

  const handleAddEffect = () => {
    if (!newEffect.trim()) return;
    addActiveEffect(newEffect.trim());
    setNewEffect('');
  };

  const adjustFeature = async (name, delta) => {
    const feat = features[name];
    if (!feat) return;
    const newCur = Math.max(0, Math.min(feat.max||99, (feat.current||0) + delta));
    await saveTrackerData({ ...td, features: { ...features, [name]: { ...feat, current: newCur } } });
  };

  const adjustCharge = async (name, delta) => {
    const ch = charges[name];
    if (!ch) return;
    const newCur = Math.max(0, Math.min(ch.max||99, (ch.current||0) + delta));
    await saveTrackerData({ ...td, item_charges: { ...charges, [name]: { ...ch, current: newCur } } });
  };

  const featList  = Object.entries(features).filter(([,v]) => v.max > 0);
  const infoList  = Object.entries(features).filter(([,v]) => v.max === 0);
  const chargeList = Object.entries(charges);
  const hd = td.hit_dice;

  return (
    <div style={{flex:1,overflowY:'auto',padding:12}}>
      {hd && hd.total > 0 && (
        <div className="card" style={{marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>Hit Dice</div>
          <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:15}}>{hd.current}/{hd.total} <span style={{color:'var(--text-dim)',fontWeight:400,fontSize:12}}>(d{hd.die_size})</span></div>
        </div>
      )}

      {featList.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Features & Abilities</div>
          {featList.map(([name, feat]) => (
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{feat.rest_type} rest · {feat.action}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={() => adjustFeature(name,-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>−</button>
                <span style={{color: feat.current>0 ? 'var(--success)' : 'var(--danger)',fontWeight:700,fontSize:15,minWidth:36,textAlign:'center'}}>{feat.current}/{feat.max}</span>
                <button onClick={() => adjustFeature(name,1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {chargeList.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Item Charges</div>
          {chargeList.map(([name, ch]) => (
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{ch.rest_type || 'manual'}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={() => adjustCharge(name,-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>−</button>
                <span style={{color:'var(--warning)',fontWeight:700,fontSize:15,minWidth:36,textAlign:'center'}}>{ch.current}/{ch.max}</span>
                <button onClick={() => adjustCharge(name,1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {infoList.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Passive Features</div>
          {infoList.map(([name, feat]) => (
            <div key={name} style={{padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{color:'var(--text-primary)',fontSize:13,fontWeight:500}}>{name}</div>
              {feat.description && <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2,lineHeight:1.5}}>{feat.description.substring(0,120)}{feat.description.length>120?'…':''}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{marginBottom:12}}>
        <div style={{color:'var(--accent-light)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Active Effects</div>
        {effects.length > 0 && (
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            {effects.map(e => (
              <div key={e} onClick={() => removeActiveEffect(e)} style={{cursor:'pointer',background:'rgba(124,77,255,0.15)',border:'1px solid var(--accent-light)',color:'var(--accent-light)',borderRadius:12,padding:'3px 10px',fontSize:12}}>
                {e} ×
              </div>
            ))}
          </div>
        )}
        <div style={{display:'flex',gap:6}}>
          <input value={newEffect} onChange={e=>setNewEffect(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddEffect()} placeholder="e.g. Hasted, Bardic Inspiration..." style={{flex:1}} />
          <button className="btn btn-secondary btn-sm" onClick={handleAddEffect}>Add</button>
        </div>
      </div>

      {conds.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--danger)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Active Conditions</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {conds.map(c => <div key={c} style={{background:'rgba(230,57,70,0.15)',border:'1px solid var(--danger)',color:'var(--danger)',borderRadius:12,padding:'3px 10px',fontSize:12}}>{c}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
