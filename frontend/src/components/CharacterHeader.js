import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { modifier, modStr, hpColor, profBonus, ABILITY_KEYS } from '../utils/dnd';
import SavesModal from './SavesModal';
import SkillsModal from './SkillsModal';
import TraitsModal from './TraitsModal';
import HPModal from './HPModal';

function EditableStat({ label, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const commit = () => {
    setEditing(false);
    const n = parseInt(val);
    if (!isNaN(n) && n !== value) onSave(n);
    else setVal(value);
  };

  return (
    <div style={{textAlign:'center',minWidth:36}}>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          style={{width:36,textAlign:'center',fontWeight:700,fontSize:16,padding:'1px 2px'}}
        />
      ) : (
        <div onClick={() => { setVal(value); setEditing(true); }} style={{color:'var(--accent-light)',fontWeight:700,fontSize:16,cursor:'pointer'}}>
          {value >= 0 && label==='INIT' ? `+${value}` : value}
        </div>
      )}
      <div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase'}}>{label}</div>
    </div>
  );
}

export default function CharacterHeader({ onBack }) {
  const { character, updateCharacter, saveTrackerData } = useCharacter();
  const [showSaves, setShowSaves]   = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [showHP, setShowHP]         = useState(false);

  if (!character) return null;

  const { name, class_name, race, level, ability_scores: ab, tracker_data: td } = character;
  const dexMod = modifier(ab?.DEX || 10);
  const hp     = td?.hp || { current: null, max: null, temp: 0 };
  const slots  = td?.spell_slots || {};
  const prof   = profBonus(level);
  const con    = modifier(ab?.CON || 10);
  const calcMaxHp = hp.max || (level * (({ Barbarian:12,Fighter:10,Paladin:10,Ranger:10,Monk:8,Rogue:8,Bard:8,Cleric:8,Druid:8,Warlock:8,Sorcerer:6,Wizard:6 }[class_name] || 8) / 2 + 1 + con));
  const maxHp  = (hp.max_override > 0) ? hp.max_override : calcMaxHp;
  const curHp  = hp.current ?? maxHp;
  const ac     = td?.ac ?? (10 + dexMod);
  const init   = td?.initiative ?? dexMod;
  const insp   = !!td?.inspiration;
  const traits = td?.traits || { resistances: [], immunities: [], vulnerabilities: [], advantages: [] };
  const traitChips = [
    ...(traits.resistances||[]).map(t => ({t,c:'var(--text-dim)'})),
    ...(traits.immunities||[]).map(t => ({t,c:'var(--success)'})),
    ...(traits.vulnerabilities||[]).map(t => ({t,c:'var(--danger)'})),
    ...(traits.advantages||[]).map(t => ({t,c:'var(--accent-light)'})),
  ];

  const adjustHp = async delta => {
    const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
    await saveTrackerData({ ...td, hp: { ...hp, current: newHp, max: calcMaxHp } });
  };

  const setAc     = (v) => saveTrackerData({ ...td, ac: v });
  const setInit   = (v) => saveTrackerData({ ...td, initiative: v });
  const setTempHp = (v) => saveTrackerData({ ...td, hp: { ...hp, temp: Math.max(0, v) } });
  const toggleInspiration = () => saveTrackerData({ ...td, inspiration: !insp });

  const hpPct = maxHp > 0 ? curHp / maxHp : 0;
  const hpCol = hpColor(curHp, maxHp);

  const slotLevels = Object.entries(slots).filter(([,s]) => s.max > 0);

  return (
    <>
      <div style={{background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',padding:'8px 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <button onClick={onBack} style={{background:'none',color:'var(--text-dim)',fontSize:18,padding:'0 4px'}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Cinzel',serif",color:'var(--accent-light)',fontSize:16,lineHeight:1.2}}>{name}</div>
            <div style={{color:'var(--text-dim)',fontSize:11}}>L{level} {race} {class_name} · Prof +{prof}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSaves(true)}>SAVES</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSkills(true)}>SKILLS</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTraits(true)}>TRAITS</button>
          </div>
        </div>

        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <button onClick={() => adjustHp(-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:24,height:24,fontWeight:700,fontSize:14}}>−</button>
            <div onClick={() => setShowHP(true)} style={{textAlign:'center',minWidth:60,cursor:'pointer'}}>
              <div style={{color:hpCol,fontWeight:700,fontSize:22,lineHeight:1}}>{curHp}<span style={{color:'var(--text-dim)',fontSize:13}}>/{maxHp}</span></div>
              <div style={{color:'var(--text-dim)',fontSize:10,marginTop:1}}>HP</div>
              <div style={{width:60,height:3,background:'var(--border)',borderRadius:2,marginTop:2}}>
                <div style={{width:`${hpPct*100}%`,height:'100%',background:hpCol,borderRadius:2,transition:'width 0.3s'}}/>
              </div>
            </div>
            <button onClick={() => adjustHp(1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:24,height:24,fontWeight:700,fontSize:14}}>+</button>
          </div>

          <EditableStat label="Temp HP" value={hp.temp||0} onSave={setTempHp} />
          <EditableStat label="AC" value={ac} onSave={setAc} />
          <EditableStat label="INIT" value={init} onSave={setInit} />
          <div style={{textAlign:'center',minWidth:36}}>
            <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:16}}>+{prof}</div>
            <div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase'}}>Prof</div>
          </div>
          <div onClick={toggleInspiration} style={{textAlign:'center',minWidth:36,cursor:'pointer'}}>
            <div style={{fontSize:18,lineHeight:1,filter: insp ? 'none' : 'grayscale(1) opacity(0.4)'}}>⭐</div>
            <div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase'}}>Insp</div>
          </div>

          <div style={{display:'flex',gap:8}}>
            {ABILITY_KEYS.map(k => (
              <div key={k} style={{textAlign:'center',minWidth:28}}>
                <div style={{color:'var(--accent-light)',fontWeight:600,fontSize:13}}>{modStr(ab?.[k]||10)}</div>
                <div style={{color:'var(--text-dim)',fontSize:9,textTransform:'uppercase'}}>{k}</div>
              </div>
            ))}
          </div>

          {slotLevels.length > 0 && (
            <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
              {slotLevels.map(([lvl, slot]) => (
                <div key={lvl} style={{display:'flex',gap:2,alignItems:'center'}}>
                  <span style={{color:'var(--text-dim)',fontSize:9}}>L{lvl}</span>
                  {Array.from({length: slot.max}).map((_, i) => (
                    <div key={i} style={{width:8,height:8,borderRadius:'50%',
                      background: i < slot.current ? `var(--slot-${lvl})` : 'var(--border)',
                      border: `1px solid var(--slot-${lvl})`}}/>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {traitChips.length > 0 && (
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
            {traitChips.map(({t,c}) => (
              <div key={t} style={{border:`1px solid ${c}`,color:c,borderRadius:10,padding:'1px 7px',fontSize:10}}>{t}</div>
            ))}
          </div>
        )}
      </div>

      {showSaves  && <SavesModal  onClose={() => setShowSaves(false)}  />}
      {showSkills && <SkillsModal onClose={() => setShowSkills(false)} />}
      {showTraits && <TraitsModal onClose={() => setShowTraits(false)} />}
      {showHP     && <HPModal     onClose={() => setShowHP(false)}     />}
    </>
  );
}
