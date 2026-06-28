import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import NumberPadPopover from './NumberPadPopover';

// Sibling of HPModal.js, scoped to tracker_data.companion.hp instead of the main
// character's hp - same digit-pad-for-Current/stepper-for-Max-and-Temp UX, minus the
// Calculated-vs-Override distinction (a companion has no class engine behind it, so its
// Max HP is just a plain hand-entered number, not something to override).
function Stepper({ label, value, onChange, step = 1 }) {
  return (
    <div style={{textAlign:'center'}}>
      <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>{label}</div>
      <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
        <button onClick={() => onChange(value - step)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700}}>−</button>
        <input type="number" className="no-spinner" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} style={{width:72,textAlign:'center'}} />
        <button onClick={() => onChange(value + step)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700}}>+</button>
      </div>
    </div>
  );
}

export default function CompanionHPModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const companion = td.companion || {};
  const hp = companion.hp || { current: 0, max: 0, temp: 0 };

  const [current, setCurrent] = useState(hp.current ?? 0);
  const [max, setMax]         = useState(hp.max ?? 0);
  const [temp, setTemp]       = useState(hp.temp || 0);
  const [showHpCalc, setShowHpCalc] = useState(false);

  // Same rule as the main character's HPModal: damage drains Temp HP first, healing caps
  // at Max - kept in sync with whatever Max is currently set to in this same modal session
  // (not the stale hp.max from before the modal opened), so raising Max and healing in the
  // same visit behaves correctly.
  const applyHpDelta = (delta) => {
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

  const save = async () => {
    await saveTrackerData({
      ...td,
      companion: { ...companion, hp: { current: Math.min(max, current), max, temp } },
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <h2>{companion.name || companion.tab_name || 'Companion'} HP</h2>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={{textAlign:'center',position:'relative'}}>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>Current HP</div>
            <div onClick={() => setShowHpCalc(true)} style={{cursor:'pointer',fontSize:22,fontWeight:700,color:'var(--accent-light)',padding:'3px 0'}}>
              {current}
            </div>
            <div style={{color:'var(--text-dim)',fontSize:10}}>Click to modify</div>
            {showHpCalc && (
              <NumberPadPopover
                label="Current HP" value={current} color="var(--accent-light)"
                onApply={applyHpDelta}
                onClose={() => setShowHpCalc(false)}
              />
            )}
          </div>
          <Stepper label="Temp HP (Buffer)" value={temp} onChange={v => setTemp(Math.max(0, v))} />
          <Stepper label="Max HP" value={max} onChange={v => setMax(Math.max(0, v))} />
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
