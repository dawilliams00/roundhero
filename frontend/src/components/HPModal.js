import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import NumberPadPopover from './NumberPadPopover';

// Popover height is ~270-300px (label row + amount + 4 rows of digit buttons + mode
// toggle + Apply), which is far taller than any single field row in this modal - since
// it's position:absolute (shared with the header's currency calculator, which needs that),
// it doesn't push surrounding content down on its own. This spacer is inserted right after
// whichever field's popover is currently open so nothing below it (the next field, the
// summary line, Save & Close) ends up hidden underneath it.
const POPOVER_RESERVE = 300;

// Current HP, Max Override, and Temp HP all get the same click-the-value-to-open-a-digit-
// pad treatment, plus +/-1 buttons for quick single-point taps - same PMStat pattern the
// header itself uses. onApply takes a relative delta (not an absolute value) so the same
// function backs both the +/-1 buttons and the popover's Apply.
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

export default function HPModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const hp = td.hp || { current: 0, max: 0, temp: 0, max_override: null };

  const [current, setCurrent]   = useState(hp.current ?? 0);
  const [maxOverride, setMaxOverride] = useState(hp.max_override || 0);
  const [temp, setTemp]         = useState(hp.temp || 0);
  const [openCalc, setOpenCalc] = useState(null); // null | 'current' | 'max' | 'temp'

  const calculatedMax = hp.max ?? 0;
  const effectiveMax = maxOverride > 0 ? maxOverride : calculatedMax;

  // A negative delta (damage) drains Temp HP first, same rule the old separate "Take
  // Damage" button used - folding it into the calculator's subtract mode means that
  // button isn't needed anymore. A positive delta (heal) just caps at the effective max.
  const applyCurrentDelta = (delta) => {
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
  const applyMaxOverrideDelta = (delta) => setMaxOverride(v => Math.max(0, v + delta));
  const applyTempDelta = (delta) => setTemp(v => Math.max(0, v + delta));

  const save = async () => {
    await saveTrackerData({
      ...td,
      hp: { ...hp, current: Math.min(effectiveMax, current), temp, max_override: maxOverride > 0 ? maxOverride : null },
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <h2>D&D 5e HP Management</h2>

        <div style={{display:'flex',flexDirection:'column',gap:18,marginBottom:16}}>
          <HPRow label="Current HP" value={current} color="var(--accent-light)" onApply={applyCurrentDelta}
            open={openCalc==='current'} onOpen={() => setOpenCalc('current')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc==='current' && <div style={{height:POPOVER_RESERVE}}/>}

          <div style={{textAlign:'center'}}>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:4}}>Max HP (Calculated)</div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--text-secondary)'}}>{calculatedMax}</div>
          </div>

          <HPRow label="Max Override (Priority)" value={maxOverride} onApply={applyMaxOverrideDelta}
            open={openCalc==='max'} onOpen={() => setOpenCalc('max')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc==='max' && <div style={{height:POPOVER_RESERVE}}/>}

          <HPRow label="Temp HP (Buffer)" value={temp} onApply={applyTempDelta}
            open={openCalc==='temp'} onOpen={() => setOpenCalc('temp')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc==='temp' && <div style={{height:POPOVER_RESERVE}}/>}
        </div>

        <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:16}}>
          <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,marginBottom:4}}>D&amp;D 5e HP Rules</div>
          <div style={{color:'var(--text-dim)',fontSize:11,lineHeight:1.6}}>
            • Max Override replaces calculated Max HP when set (spells like Aid)<br/>
            • Click any value above to apply damage/healing - Temp HP absorbs Current HP damage first, doesn't increase your max<br/>
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
