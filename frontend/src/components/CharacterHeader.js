import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { modifier, modStr, hpColor, profBonus, ABILITY_KEYS, getSpellcastingBlocks, computeItemBonuses, effectiveAbilityScores, HASTED_EFFECT, HARDCODED_CONDITION_INFO, EXHAUSTION_RAW_TEXT } from '../utils/dnd';
import SavesModal from './SavesModal';
import SkillsModal from './SkillsModal';
import TraitsModal from './TraitsModal';
import HPModal from './HPModal';
import RestModal from './RestModal';
import RestSummaryModal from './RestSummaryModal';
import SettingsModal from './SettingsModal';
import ConditionsModal from './ConditionsModal';
import InfoModal from './InfoModal';

function EditableStat({ label, value, onSave, color, title }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const commit = () => {
    setEditing(false);
    const n = parseInt(val);
    if (!isNaN(n) && n !== value) onSave(n);
    else setVal(value);
  };

  return (
    <div className="stat-box" title={title}>
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

function PMStat({ label, value, color, onAdjust, onClick, title }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      <button onClick={() => onAdjust(-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:13,flexShrink:0}}>−</button>
      <div className="stat-box" onClick={onClick} title={title} style={{cursor: onClick ? 'pointer' : 'default'}}>
        <div className="stat-value" style={{color}}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      <button onClick={() => onAdjust(1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:13,flexShrink:0}}>+</button>
    </div>
  );
}

function SpellcastBox({ block }) {
  return (
    <div className="stat-box">
      <div className="stat-value" style={{fontSize:13}}>{block.attackMod>=0?'+':''}{block.attackMod} / DC{block.saveDC}</div>
      <div className="stat-label">{block.className}</div>
    </div>
  );
}

function AbilityBox({ abbr, score, baseScore }) {
  const boosted = baseScore != null && score !== baseScore;
  return (
    <div className="stat-box" style={{minWidth:38}} title={boosted ? `${baseScore} base, raised to ${score} by an equipped item` : undefined}>
      <div className="stat-label" style={{marginTop:0,marginBottom:2}}>{abbr}</div>
      <div className="stat-value" style={{color: boosted ? 'var(--accent-light)' : undefined}}>{score}</div>
      <div className="stat-sub">{modStr(score)}</div>
    </div>
  );
}

function EffectAdder({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [val, setVal]   = useState('');
  const submit = () => {
    if (val.trim()) onAdd(val.trim());
    setVal('');
    setOpen(false);
  };
  return (
    <div style={{position:'relative'}}>
      <div className="stat-box" onClick={() => setOpen(o => !o)} style={{cursor:'pointer'}}>
        <div className="stat-value" style={{color:'var(--accent-light)'}}>+</div>
        <div className="stat-label">Effect</div>
      </div>
      {open && (
        <div style={{position:'absolute',left:0,top:'100%',marginTop:6,background:'var(--bg-card)',border:'1px solid var(--accent-light)',borderRadius:'var(--radius-md)',padding:10,zIndex:30,width:200,boxShadow:'var(--shadow)'}} onClick={e=>e.stopPropagation()}>
          <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="e.g. Hasted" style={{width:'100%',marginBottom:6}} />
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={submit}>Add</button>
          </div>
        </div>
      )}
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

function CoinCalculator({ coin, value, onApply, onClose }) {
  const [digits, setDigits] = useState('');
  const [mode, setMode] = useState('add');
  const press = (d) => setDigits(prev => (prev + d).slice(0, 7));
  const n = parseInt(digits) || 0;
  const apply = () => {
    onApply(Math.max(0, value + (mode === 'add' ? n : -n)));
    onClose();
  };
  return (
    <div style={{position:'absolute',right:'100%',top:0,marginRight:8,background:'var(--bg-card)',border:`1px solid ${coin.color}`,borderRadius:'var(--radius-md)',padding:10,zIndex:30,width:150,boxShadow:'var(--shadow)'}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{color:coin.color,fontWeight:700,fontSize:12}}>{coin.abbr}: {value}</span>
        <span onClick={onClose} style={{cursor:'pointer',color:'var(--text-dim)',fontSize:14}}>✕</span>
      </div>
      <div style={{textAlign:'center',fontSize:18,fontWeight:700,color: mode==='add' ? 'var(--success)' : 'var(--danger)',marginBottom:6}}>{mode==='add'?'+':'−'}{digits || 0}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,marginBottom:6}}>
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => press(d)} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-primary)',borderRadius:4}}>{d}</button>
        ))}
        <button onClick={() => setDigits('')} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4}}>C</button>
        <button onClick={() => press('0')} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-primary)',borderRadius:4}}>0</button>
        <button onClick={() => setDigits(d => d.slice(0,-1))} style={{padding:'8px 0',background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4}}>⌫</button>
      </div>
      <div style={{display:'flex',gap:4,marginBottom:6}}>
        <button onClick={() => setMode('add')} style={{flex:1,padding:'6px 0',background: mode==='add' ? 'var(--success)' : 'var(--bg-hover)',color:'#fff',borderRadius:4,fontWeight:700}}>+</button>
        <button onClick={() => setMode('subtract')} style={{flex:1,padding:'6px 0',background: mode==='subtract' ? 'var(--danger)' : 'var(--bg-hover)',color:'#fff',borderRadius:4,fontWeight:700}}>−</button>
      </div>
      <button className="btn btn-primary btn-sm" style={{width:'100%'}} onClick={apply}>Apply</button>
    </div>
  );
}

function CoinInput({ coin, value, onCommit }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',gap:6}}>
      <span style={{color: coin.color, fontWeight:700, fontSize:11, minWidth:20}}>{coin.abbr}</span>
      <div onClick={() => setOpen(true)} style={{width:80,textAlign:'right',padding:'2px 8px',fontSize:13,fontWeight:600,border:`1px solid ${coin.color}`,borderRadius:'var(--radius-sm)',background:'var(--bg-card)',color: coin.color,cursor:'pointer'}}>
        {value}
      </div>
      {open && <CoinCalculator coin={coin} value={value} onApply={onCommit} onClose={() => setOpen(false)} />}
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
  const { character, saveTrackerData, doRest, addActiveEffect, removeActiveEffect, removeCondition } = useCharacter();
  const [showSaves, setShowSaves]   = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [showHP, setShowHP]         = useState(false);
  const [showRest, setShowRest]     = useState(false);
  const [restSummary, setRestSummary] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [viewingCondition, setViewingCondition] = useState(null);
  const [showExhaustionInfo, setShowExhaustionInfo] = useState(false);
  const [conditionInfo, setConditionInfo] = useState({});

  useEffect(() => {
    api.get('/content/conditions').then(r => {
      const map = { ...HARDCODED_CONDITION_INFO };
      (r.data || []).forEach(c => { map[c.name] = c.description; });
      setConditionInfo(map);
    }).catch(() => {});
  }, []);

  if (!character) return null;

  const { name, class_name, race, level, ability_scores: ab, tracker_data: td } = character;
  const hp     = td?.hp || { current: null, max: null, temp: 0 };
  const slots  = td?.spell_slots || {};
  const inventory = td?.inventory || { currency: {}, items: [] };
  const currency  = inventory.currency || {};
  const invItems  = inventory.items || [];
  const itemBonuses = computeItemBonuses(invItems);
  const effAb  = effectiveAbilityScores(ab, invItems);
  const dexMod = modifier(effAb.DEX || 10);
  const attunedCount = invItems.filter(it => it.attunement && it.attuned).length;
  const attunableCount = invItems.filter(it => it.attunement).length;
  const hasUnattunedEligible = invItems.some(it => it.attunement && !it.attuned);
  const attuneWarn = attunedCount > 3 || (attunedCount < 3 && hasUnattunedEligible);
  const hd = td?.hit_dice;
  const spellBlocks = getSpellcastingBlocks(class_name, ab, level, invItems);
  const prof   = profBonus(level);
  const con    = modifier(ab?.CON || 10);
  const calcMaxHp = hp.max || (level * (({ Barbarian:12,Fighter:10,Paladin:10,Ranger:10,Monk:8,Rogue:8,Bard:8,Cleric:8,Druid:8,Warlock:8,Sorcerer:6,Wizard:6 }[class_name] || 8) / 2 + 1 + con));
  const maxHp  = (hp.max_override > 0) ? hp.max_override : calcMaxHp;
  const curHp  = hp.current ?? maxHp;
  const tempHp = hp.temp || 0;
  const activeEffects = td?.active_effects || [];
  const isHasted = activeEffects.includes(HASTED_EFFECT);
  const hasteAcBonus = isHasted ? 2 : 0;
  const baseAc = td?.ac ?? (10 + dexMod);
  const ac     = baseAc + itemBonuses.ac_base + hasteAcBonus;
  const init   = td?.initiative ?? dexMod;
  const insp   = !!td?.inspiration;
  const exhaustion = td?.exhaustion || 0;
  const exhaustionRules = td?.settings?.exhaustion_rules || { mode: 'raw' };
  const exhaustionTitle = exhaustionRules.mode === 'homebrew'
    ? `${exhaustionRules.name || 'Homebrew exhaustion'}${exhaustionRules.description ? `: ${exhaustionRules.description}` : ''}`
    : 'RAW exhaustion (set in Settings)';
  // Exhaustion has its own stepper below, so don't double-count it if it's ever
  // also present as a legacy free-text condition string.
  const conditions = (td?.conditions || []).filter(c => c !== 'Exhaustion');
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

  // The AC stat box shows/edits the full total; back out the item and Haste bonuses so
  // the stored base (armor + dex) doesn't end up double-counting them on the next render.
  const setAc     = (v) => saveTrackerData({ ...td, ac: v - itemBonuses.ac_base - hasteAcBonus });
  const setInit   = (v) => saveTrackerData({ ...td, initiative: v });
  const toggleInspiration = () => saveTrackerData({ ...td, inspiration: !insp });
  const setCurrencyCoin = (k, v) => saveTrackerData({ ...td, inventory: { ...inventory, currency: { ...currency, [k]: v } } });

  const hpCol = hpColor(curHp, maxHp);

  const slotLevels = Object.entries(slots).filter(([,s]) => s.max > 0);

  return (
    <>
      <div style={{background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',padding:'8px 12px',flexShrink:0}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <button onClick={onBack} style={{background:'none',color:'var(--text-dim)',fontSize:18,padding:'0 4px'}}>←</button>
              <div>
                <div style={{fontFamily:"'Cinzel',serif",color:'var(--accent-light)',fontSize:16,lineHeight:1.2}}>{name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>L{level} {race} {class_name}</div>
              </div>
              <button className="btn-icon" title="Settings" onClick={() => setShowSettings(true)} style={{fontSize:14,padding:'4px 7px'}}>⚙️</button>
            </div>

            <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <PMStat label="HP" value={`${curHp}/${maxHp}`} color={hpCol} onAdjust={adjustHp} onClick={() => setShowHP(true)} />
                {spellBlocks.map(block => <SpellcastBox key={block.className} block={block} />)}
              </div>
              {tempHp > 0 && <PMStat label="Temp HP" value={tempHp} color={hpCol} onAdjust={adjustTempHp} />}

              <EditableStat label="AC" value={ac} onSave={setAc} title={(itemBonuses.ac_base || hasteAcBonus) ? `${baseAc} base${itemBonuses.ac_base ? ` + ${itemBonuses.ac_base} items` : ''}${hasteAcBonus ? ` + ${hasteAcBonus} Hasted` : ''}` : undefined} />
              <EditableStat label="INIT" value={init} onSave={setInit} />
              <div className="stat-box">
                <div className="stat-value">+{prof}</div>
                <div className="stat-label">Prof</div>
              </div>
              <div onClick={toggleInspiration} className="stat-box" style={{cursor:'pointer'}}>
                <div style={{fontSize:18,lineHeight:1,filter: insp ? 'none' : 'grayscale(1) opacity(0.4)'}}>⭐</div>
                <div className="stat-label">Insp</div>
              </div>

              {attunableCount > 0 && (
                <div className="stat-box">
                  <div className="stat-value" style={{color: attuneWarn ? 'var(--danger)' : 'var(--accent-light)'}}>{attunedCount}/3</div>
                  <div className="stat-label">Attune</div>
                </div>
              )}

              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <div style={{display:'flex',gap:6}}>
                  {ABILITY_KEYS.map(k => (
                    <AbilityBox key={k} abbr={k} score={effAb[k]||10} baseScore={ab?.[k]||10} />
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

            {traitChips.length > 0 && (
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
                {traitChips.map(({t,d,c}, i) => (
                  <div key={t+i} title={d || undefined} style={{border:`1px solid ${c}`,color:c,borderRadius:10,padding:'1px 7px',fontSize:10}}>{t}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{width:230,flexShrink:0,display:'flex',flexDirection:'column',gap:6,paddingTop:2}}>
            <PMStat
              label="Exhaustion"
              value={exhaustion}
              color={exhaustion >= 5 ? 'var(--danger)' : exhaustion >= 3 ? 'var(--warning)' : undefined}
              onAdjust={d => saveTrackerData({ ...td, exhaustion: Math.max(0, Math.min(6, exhaustion + d)) })}
              onClick={() => setShowExhaustionInfo(true)}
              title={exhaustionTitle}
            />
            <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
              {activeEffects.map(e => (
                <div key={e} onClick={() => removeActiveEffect(e)} title="Click to remove" style={{cursor:'pointer',background:'rgba(124,77,255,0.15)',border:'1px solid var(--accent-light)',color:'var(--accent-light)',borderRadius:12,padding:'3px 10px',fontSize:12}}>
                  {e} ×
                </div>
              ))}
              <EffectAdder onAdd={addActiveEffect} />
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
              {conditions.map(c => (
                <div key={c} style={{display:'flex',alignItems:'center',background:'rgba(230,57,70,0.15)',border:'1px solid var(--danger)',color:'var(--danger)',borderRadius:12,padding:'3px 4px 3px 10px',fontSize:12}}>
                  <span onClick={() => setViewingCondition(c)} style={{cursor:'pointer'}}>{c}</span>
                  <span onClick={() => removeCondition(c)} title="Remove" style={{cursor:'pointer',marginLeft:5,padding:'0 3px'}}>×</span>
                </div>
              ))}
              <div className="stat-box" onClick={() => setShowConditions(true)} style={{cursor:'pointer'}}>
                <div className="stat-value" style={{color: conditions.length > 0 ? 'var(--danger)' : 'var(--accent-light)'}}>{conditions.length}</div>
                <div className="stat-label">Conditions</div>
              </div>
            </div>
          </div>

          <div style={{display:'flex',gap:10,flexShrink:0}}>
            <CurrencyBox currency={currency} onCommit={setCurrencyCoin} />
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSaves(true)}>SAVES</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSkills(true)}>SKILLS</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTraits(true)}>TRAITS</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRest(true)}>🌙 REST</button>
              {hd && hd.total > 0 && (
                <div className="stat-box">
                  <div className="stat-value" style={{fontSize:14}}>{hd.current}/{hd.total}</div>
                  <div className="stat-label">d{hd.die_size} HD</div>
                </div>
              )}
            </div>
          </div>
        </div>
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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showConditions && <ConditionsModal onClose={() => setShowConditions(false)} />}
      {viewingCondition && (
        <InfoModal
          title={viewingCondition}
          message={conditionInfo[viewingCondition] || 'No description available.'}
          onClose={() => setViewingCondition(null)}
        />
      )}
      {showExhaustionInfo && (
        <InfoModal
          title={exhaustionRules.mode === 'homebrew' ? (exhaustionRules.name || 'Homebrew Exhaustion') : 'Exhaustion (RAW)'}
          message={exhaustionRules.mode === 'homebrew' ? (exhaustionRules.description || 'No description set yet - add one in Settings.') : EXHAUSTION_RAW_TEXT}
          onClose={() => setShowExhaustionInfo(false)}
        />
      )}
    </>
  );
}
