import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import NumberPadPopover from './NumberPadPopover';

function Stepper({ label, value, onChange, step = 1 }) {
  return (
    <div style={{textAlign:'center'}}>
      <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>{label}</div>
      <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
        <button onClick={() => onChange(value - step)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700}}>−</button>
        <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} style={{width:56,textAlign:'center'}} />
        <button onClick={() => onChange(value + step)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700}}>+</button>
      </div>
    </div>
  );
}

export default function HPModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const hp = td.hp || { current: 0, max: 0, temp: 0, max_override: null };

  const [current, setCurrent]   = useState(hp.current ?? 0);
  const [maxOverride, setMaxOverride] = useState(hp.max_override || 0);
  const [temp, setTemp]         = useState(hp.temp || 0);
  const [showHpCalc, setShowHpCalc] = useState(false);

  const calculatedMax = hp.max ?? 0;
  const effectiveMax = maxOverride > 0 ? maxOverride : calculatedMax;

  // A negative delta (damage) drains Temp HP first, same rule the old separate "Take
  // Damage" button used - folding it into the calculator's subtract mode means that
  // button isn't needed anymore. A positive delta (heal) just caps at the effective max.
  const applyHpDelta = (delta) => {
    if (delta < 0) {
      let dmg = -delta;
      const absorbed = Math.min(temp, dmg);
      setTemp(t => t - absorbed);
      dmg -= absorbed;
      setCurrent(c => Math.max(0, c - dmg));
    } else {
      setCurrent(c => Math.min(effectiveMax, c + delta));
    }
  };

  const save = async () => {
    await saveTrackerData({
      ...td,
      hp: { ...hp, current: Math.min(effectiveMax, current), temp, max_override: maxOverride > 0 ? maxOverride : null },
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480}} onClick={e => e.stopPropagation()}>
        <h2>D&D 5e HP Management</h2>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={{textAlign:'center',position:'relative'}}>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>Current HP</div>
            <div onClick={() => setShowHpCalc(true)} style={{cursor:'pointer',fontSize:22,fontWeight:700,color:'var(--accent-light)',padding:'3px 0'}}>
              {current}
            </div>
            {showHpCalc && (
              <NumberPadPopover
                label="Current HP" value={current} color="var(--accent-light)"
                onApply={applyHpDelta}
                onClose={() => setShowHpCalc(false)}
              />
            )}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>Max HP (Calculated)</div>
            <div style={{fontSize:18,fontWeight:700,color:'var(--text-secondary)',padding:'3px 0'}}>{calculatedMax}</div>
          </div>
          <Stepper label="Max Override (Priority)" value={maxOverride} onChange={v => setMaxOverride(Math.max(0, v))} />
          <Stepper label="Temp HP (Buffer)" value={temp} onChange={v => setTemp(Math.max(0, v))} />
        </div>

        <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:16}}>
          <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,marginBottom:4}}>D&amp;D 5e HP Rules</div>
          <div style={{color:'var(--text-dim)',fontSize:11,lineHeight:1.6}}>
            • Max Override replaces calculated Max HP when set (spells like Aid)<br/>
            • Click Current HP to apply damage/healing - Temp HP absorbs damage first, doesn't increase your max<br/>
            • Healing restores Current HP up to effective maximum<br/>
            • Long rest clears Temp HP and restores Current to max
          </div>
        </div>

        <div style={{color:'var(--text-secondary)',fontSize:13,textAlign:'center',marginBottom:12}}>
          Effective Max: <b style={{color:'var(--accent-light)'}}>{effectiveMax}</b> · Current: <b style={{color:'var(--accent-light)'}}>{current}</b>{temp>0 && <> + <b style={{color:'var(--accent-light)'}}>{temp}</b> temp</>}
        </div>

        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={save}>Save &amp; Close</button>
        </div>
      </div>
    </div>
  );
}
