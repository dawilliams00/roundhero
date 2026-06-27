import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { modifier, modStr, hpColor, profBonus, ABILITY_KEYS } from '../utils/dnd';
import SavesModal from './SavesModal';
import SkillsModal from './SkillsModal';
import TraitsModal from './TraitsModal';
import HPModal from './HPModal';
import RestModal from './RestModal';
import RestSummaryModal from './RestSummaryModal';

function EditableStat({ label, value, onSave, color }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const commit = () => {
    setEditing(false);
    const n = parseInt(val);
    if (!isNaN(n) && n !== value) onSave(n);
    else setVal(value);
  };

  return (
    <div className="stat-box">
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
        <div onClick={() => { setVal(value); setEditing(true); }} className="stat-value" style={{cursor:'pointer',color: color || 'var(--accent-light)'}}>
          {value >= 0 && label==='INIT' ? `+${value}` : value}
        </div>
      )}
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PMStat({ label, value, color, onAdjust, onClick }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      <button onClick={() => onAdjust(-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:13,flexShrink:0}}>−</button>
      <div className="stat-box" onClick={onClick} style={{cursor: onClick ? 'pointer' : 'default'}}>
        <div className="stat-value" style={{color}}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      <button onClick={() => onAdjust(1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:13,flexShrink:0}}>+</button>
    </div>
  );
}

function AbilityBox({ abbr, score }) {
  return (
    <div className="stat-box" style={{minWidth:38}}>
      <div className="stat-label" style={{marginTop:0,marginBottom:2}}>{abbr}</div>
      <div className="stat-value">{score}</div>
      <div className="stat-sub">{modStr(score)}</div>
    </div>
  );
}

const COIN_TYPES = [
  { key: 'pp', abbr: 'PP', color: '#E0E0E8' },
  { key: 'gp', abbr: 'GP', color: '#E5B80B' },
  { key: 'ep', abbr: 'EP', color: '#C9D67D' },
  { key: 'sp', abbr: 'SP', color: '#B8C2CC' },
  { key: 'cp', abbr: 'CP', color: '#C58444' },
];

function CoinInput({ coin, value, onCommit }) {
  const [val, setVal] = useState(value);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{color: coin.color, fontWeight:700, fontSize:11, minWidth:20}}>{coin.abbr}</span>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onFocus={() => setVal(value)}
        onBlur={() => { const n = parseInt(val)||0; setVal(n); if (n !== value) onCommit(n); }}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        style={{width:80,textAlign:'right',padding:'2px 8px',fontSize:13,fontWeight:600,border:`1px solid ${coin.color}`,borderRadius:'var(--radius-sm)',background:'var(--bg-card)',color: coin.color}}
      />
    </div>
  );
}

function CurrencyBox({ currency, onCommit }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      {COIN_TYPES.map(coin => (
        <CoinInput key={coin.key} coin={coin} value={currency[coin.key] || 0} onCommit={v => onCommit(coin.key, v)} />
      ))}
    </div>
  );
}

export default function CharacterHeader({ onBack }) {
  const { character, saveTrackerData, doRest } = useCharacter();
  const [showSaves, setShowSaves]   = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [showHP, setShowHP]         = useState(false);
  const [showRest, setShowRest]     = useState(false);
  const [restSummary, setRestSummary] = useState(null);

  if (!character) return null;

  const { name, class_name, race, level, ability_scores: ab, tracker_data: td } = character;
  const dexMod = modifier(ab?.DEX || 10);
  const hp     = td?.hp || { current: null, max: null, temp: 0 };
  const slots  = td?.spell_slots || {};
  const inventory = td?.inventory || { currency: {}, items: [] };
  const currency  = inventory.currency || {};
  const invItems  = inventory.items || [];
  const attunedCount = invItems.filter(it => it.attunement && it.attuned).length;
  const attunableCount = invItems.filter(it => it.attunement).length;
  const hd = td?.hit_dice;
  const prof   = profBonus(level);
  const con    = modifier(ab?.CON || 10);
  const calcMaxHp = hp.max || (level * (({ Barbarian:12,Fighter:10,Paladin:10,Ranger:10,Monk:8,Rogue:8,Bard:8,Cleric:8,Druid:8,Warlock:8,Sorcerer:6,Wizard:6 }[class_name] || 8) / 2 + 1 + con));
  const maxHp  = (hp.max_override > 0) ? hp.max_override : calcMaxHp;
  const curHp  = hp.current ?? maxHp;
  const tempHp = hp.temp || 0;
  const ac     = td?.ac ?? (10 + dexMod);
  const init   = td?.initiative ?? dexMod;
  const insp   = !!td?.inspiration;
  const traits = td?.traits || { resistances: [], immunities: [], vulnerabilities: [], advantages: [], disadvantages: [] };
  const traitName = t => (typeof t === 'string' ? t : t?.name) || '';
  const traitChips = [
    ...(traits.resistances||[]).map(t => ({t: traitName(t), d: t?.description, c:'var(--text-dim)'})),
    ...(traits.immunities||[]).map(t => ({t: traitName(t), d: t?.description, c:'var(--success)'})),
    ...(traits.vulnerabilities||[]).map(t => ({t: traitName(t), d: t?.description, c:'var(--danger)'})),
    ...(traits.advantages||[]).map(t => ({t: traitName(t), d: t?.description, c:'var(--accent-light)'})),
    ...(traits.disadvantages||[]).map(t => ({t: traitName(t), d: t?.description, c:'var(--warning)'})),
  ];

  const adjustHp = async delta => {
    const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
    await saveTrackerData({ ...td, hp: { ...hp, current: newHp, max: calcMaxHp } });
  };

  const adjustTempHp = async delta => {
    const newTemp = Math.max(0, tempHp + delta);
    await saveTrackerData({ ...td, hp: { ...hp, temp: newTemp } });
  };

  const setAc     = (v) => saveTrackerData({ ...td, ac: v });
  const setInit   = (v) => saveTrackerData({ ...td, initiative: v });
  const toggleInspiration = () => saveTrackerData({ ...td, inspiration: !insp });
  const setCurrencyCoin = (k, v) => saveTrackerData({ ...td, inventory: { ...inventory, currency: { ...currency, [k]: v } } });

  const hpCol = hpColor(curHp, maxHp);

  const slotLevels = Object.entries(slots).filter(([,s]) => s.max > 0);

  return (
    <>
      <div style={{background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',padding:'8px 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <button onClick={onBack} style={{background:'none',color:'var(--text-dim)',fontSize:18,padding:'0 4px'}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Cinzel',serif",color:'var(--accent-light)',fontSize:16,lineHeight:1.2}}>{name}</div>
            <div style={{color:'var(--text-dim)',fontSize:11}}>L{level} {race} {class_name}</div>
          </div>
        </div>

        <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
          <PMStat label="HP" value={`${curHp}/${maxHp}`} color={hpCol} onAdjust={adjustHp} onClick={() => setShowHP(true)} />
          {tempHp > 0 && <PMStat label="Temp HP" value={tempHp} color={hpCol} onAdjust={adjustTempHp} />}

          <EditableStat label="AC" value={ac} onSave={setAc} />
          <EditableStat label="INIT" value={init} onSave={setInit} />
          <div className="stat-box">
            <div className="stat-value">+{prof}</div>
            <div className="stat-label">Prof</div>
          </div>
          <div onClick={toggleInspiration} className="stat-box" style={{cursor:'pointer'}}>
            <div style={{fontSize:18,lineHeight:1,filter: insp ? 'none' : 'grayscale(1) opacity(0.4)'}}>⭐</div>
            <div className="stat-label">Insp</div>
          </div>

          {hd && hd.total > 0 && (
            <div className="stat-box">
              <div className="stat-value" style={{fontSize:14}}>{hd.current}/{hd.total}</div>
              <div className="stat-label">d{hd.die_size} HD</div>
            </div>
          )}

          {attunableCount > 0 && (
            <div className="stat-box">
              <div className="stat-value" style={{color: attunedCount > 3 ? 'var(--danger)' : 'var(--accent-light)'}}>{attunedCount}/3</div>
              <div className="stat-label">Attune</div>
            </div>
          )}

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

          <div style={{display:'flex',gap:6}}>
            {ABILITY_KEYS.map(k => (
              <AbilityBox key={k} abbr={k} score={ab?.[k]||10} />
            ))}
          </div>

          <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
            <CurrencyBox currency={currency} onCommit={setCurrencyCoin} />
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSaves(true)}>SAVES</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSkills(true)}>SKILLS</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTraits(true)}>TRAITS</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRest(true)}>🌙 REST</button>
            </div>
          </div>
        </div>

        {traitChips.length > 0 && (
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
            {traitChips.map(({t,d,c}, i) => (
              <div key={t+i} title={d || undefined} style={{border:`1px solid ${c}`,color:c,borderRadius:10,padding:'1px 7px',fontSize:10}}>{t}</div>
            ))}
          </div>
        )}
      </div>

      {showSaves  && <SavesModal  onClose={() => setShowSaves(false)}  />}
      {showSkills && <SkillsModal onClose={() => setShowSkills(false)} />}
      {showTraits && <TraitsModal onClose={() => setShowTraits(false)} />}
      {showHP     && <HPModal     onClose={() => setShowHP(false)}     />}
      {showRest   && (
        <RestModal onClose={() => setShowRest(false)} onRest={async (type) => {
          const result = await doRest(type);
          setShowRest(false);
          setRestSummary({ summary: result.summary, restType: type });
        }} />
      )}
      {restSummary && (
        <RestSummaryModal summary={restSummary.summary} restType={restSummary.restType} onClose={() => setRestSummary(null)} />
      )}
    </>
  );
}
