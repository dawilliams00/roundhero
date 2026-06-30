import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import NumberPadPopover from './NumberPadPopover';

// Sibling of HPModal.js, scoped to tracker_data.companion.hp instead of the main
// character's hp - same digit-pad-for-every-field UX, minus the Calculated-vs-Override
// distinction (a companion has no class engine behind it, so its Max HP is just a plain
// hand-entered number, not something to override).
const POPOVER_RESERVE = 300;

function HPRow({ label, value, color = 'var(--text-primary)', onApply, open, onOpen, onCloseCalc }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
      <button onClick={() => onApply(-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700,flexShrink:0}}>−</button>
      <div style={{textAlign:'center',position:'relative',minWidth:90}}>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>{label}</div>
        <div onClick={onOpen} style={{cursor:'pointer',fontSize:20,fontWeight:700,color,padding:'3px 0'}}>{value}</div>
        <div style={{color:'var(--text-dim)',fontSize:10}}>Click to modify</div>
        {open && (
          <NumberPadPopover label={label} value={value} color={color} onApply={onApply} onClose={onCloseCalc} />
        )}
      </div>
      <button onClick={() => onApply(1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700,flexShrink:0}}>+</button>
    </div>
  );
}

export default function CompanionHPModal({ onClose, companionKey = 'companion' }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const companion = td[companionKey] || {};
  const hp = companion.hp || { current: 0, max: 0, temp: 0 };

  const [current, setCurrent] = useState(hp.current ?? 0);
  const [max, setMax]         = useState(hp.max ?? 0);
  const [temp, setTemp]       = useState(hp.temp || 0);
  const [openCalc, setOpenCalc] = useState(null); // null | 'current' | 'max' | 'temp'

  // Same rule as the main character's HPModal: damage drains Temp HP first, healing caps
  // at Max - kept in sync with whatever Max is currently set to in this same modal session
  // (not the stale hp.max from before the modal opened), so raising Max and healing in the
  // same visit behaves correctly.
  const applyCurrentDelta = (delta) => {
    if (delta < 0) {
      let dmg = -delta;
      const absorbed = Math.min(temp, dmg);
      setTemp(t => t - absorbed);
      dmg -= absorbed;
      setCurrent(c => Math.max(0, c - dmg));
    } else {
      setCurrent(c => Math.min(max, c + delta));
    }
  };
  const applyMaxDelta = (delta) => setMax(v => Math.max(0, v + delta));
  const applyTempDelta = (delta) => setTemp(v => Math.max(0, v + delta));

  const save = async () => {
    await saveTrackerData({
      ...td,
      [companionKey]: { ...companion, hp: { current: Math.min(max, current), max, temp } },
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <div className="modal-sticky-header">
          <h2>{companion.name || companion.tab_name || 'Companion'} HP</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:18,marginBottom:16}}>
          <HPRow label="Current HP" value={current} color="var(--accent-light)" onApply={applyCurrentDelta}
            open={openCalc==='current'} onOpen={() => setOpenCalc('current')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc==='current' && <div style={{height:POPOVER_RESERVE}}/>}

          <HPRow label="Max HP" value={max} onApply={applyMaxDelta}
            open={openCalc==='max'} onOpen={() => setOpenCalc('max')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc==='max' && <div style={{height:POPOVER_RESERVE}}/>}

          <HPRow label="Temp HP (Buffer)" value={temp} onApply={applyTempDelta}
            open={openCalc==='temp'} onOpen={() => setOpenCalc('temp')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc==='temp' && <div style={{height:POPOVER_RESERVE}}/>}
        </div>

        <div style={{color:'var(--text-secondary)',fontSize:13,textAlign:'center',marginBottom:12}}>
          Max: <b style={{color:'var(--accent-light)'}}>{max}</b> · Current: <b style={{color:'var(--accent-light)'}}>{current}</b>{temp>0 && <> + <b style={{color:'var(--accent-light)'}}>{temp}</b> temp</>}
        </div>

        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={save}>Save &amp; Close</button>
        </div>
      </div>
    </div>
  );
}
