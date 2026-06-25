import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { modifier, modStr, calcSaves, calcSkills, hpColor, profBonus, ABILITY_KEYS } from '../utils/dnd';
import SavesModal from './SavesModal';
import SkillsModal from './SkillsModal';

export default function CharacterHeader({ onBack }) {
  const { character, updateCharacter } = useCharacter();
  const [showSaves, setShowSaves]     = useState(false);
  const [showSkills, setShowSkills]   = useState(false);

  if (!character) return null;

  const { name, class_name, race, level, ability_scores: ab, tracker_data: td } = character;
  const hp    = td?.hp     || { current: 0, max: 0, temp: 0 };
  const slots = td?.spell_slots || {};
  const prof  = profBonus(level);
  const con   = modifier(ab?.CON || 10);
  const maxHp = hp.max || (level * (({ Barbarian:12,Fighter:10,Paladin:10,Ranger:10,Monk:8,Rogue:8,Bard:8,Cleric:8,Druid:8,Warlock:8,Sorcerer:6,Wizard:6 }[class_name] || 8) / 2 + 1 + con));

  const adjustHp = async delta => {
    const cur = hp.current || 0;
    const newHp = Math.max(0, Math.min(maxHp, cur + delta));
    const newTd = { ...td, hp: { ...hp, current: newHp, max: maxHp } };
    await updateCharacter(character.id, { tracker_data: newTd });
  };

  const hpPct = maxHp > 0 ? (hp.current || 0) / maxHp : 0;
  const hpCol = hpColor(hp.current || 0, maxHp);

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
          </div>
        </div>

        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <button onClick={() => adjustHp(-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:24,height:24,fontWeight:700,fontSize:14}}>−</button>
            <div style={{textAlign:'center',minWidth:60}}>
              <div style={{color:hpCol,fontWeight:700,fontSize:22,lineHeight:1}}>{hp.current ?? maxHp}<span style={{color:'var(--text-dim)',fontSize:13}}>/{maxHp}</span></div>
              <div style={{color:'var(--text-dim)',fontSize:10,marginTop:1}}>HP</div>
              <div style={{width:60,height:3,background:'var(--border)',borderRadius:2,marginTop:2}}>
                <div style={{width:`${hpPct*100}%`,height:'100%',background:hpCol,borderRadius:2,transition:'width 0.3s'}}/>
              </div>
            </div>
            <button onClick={() => adjustHp(1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:24,height:24,fontWeight:700,fontSize:14}}>+</button>
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
      </div>

      {showSaves  && <SavesModal  onClose={() => setShowSaves(false)}  />}
      {showSkills && <SkillsModal onClose={() => setShowSkills(false)} />}
    </>
  );
}
