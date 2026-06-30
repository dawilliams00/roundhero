import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { modifier, modStr, hpColor, profBonus, ABILITY_KEYS, getSpellcastingBlocks, computeItemBonuses, effectiveAbilityScores, suspectedAbilityContamination, featBuffItems, raceBuffItems, HASTED_EFFECT, HARDCODED_CONDITION_INFO, EXHAUSTION_RAW_TEXT, unarmoredAC, cappedModifier } from '../utils/dnd';
import SavesModal from './SavesModal';
import SkillsModal from './SkillsModal';
import TraitsModal from './TraitsModal';
import HPModal from './HPModal';
import RestModal from './RestModal';
import RestSummaryModal from './RestSummaryModal';
import SettingsModal from './SettingsModal';
import ConditionsModal from './ConditionsModal';
import InfoModal from './InfoModal';
import NumberPadPopover from './NumberPadPopover';
import FeedbackModal from './FeedbackModal';

// Mechanical side-effects of active_effects that are easy to forget about mid-combat,
// shown as their own header chips instead of only ever appearing once in a cast popup -
// matches this app's general philosophy of putting state in the player's face rather
// than relying on memory. AC's own Haste bonus already shows on the AC stat box itself
// (see hasteAcBonus below), so it isn't duplicated here. Add future mechanically-modeled
// effects here rather than hardcoding a new one-off chip elsewhere.
const EFFECT_MECHANICAL_NOTES = {
  [HASTED_EFFECT]: [{ t: 'ADV on DEX saves', d: 'From Haste', type: 'advantage' }],
};

// Single-letter, color-coded prefix for trait chips so a long row of resistances/
// immunities/advantages/disadvantages reads at a glance instead of needing to read every
// chip's full text. Distinct colors per category, not just per-trait, so the player's eye
// can sort "what kind of thing is this" before reading the specific name.
const TRAIT_TYPE_STYLE = {
  advantage:     { letter: 'A', color: '#4caf50' }, // green
  disadvantage:  { letter: 'D', color: '#f44336' }, // red
  resistance:    { letter: 'R', color: '#ffc107' }, // yellow
  immune:        { letter: 'I', color: '#29b6f6' }, // bright blue
  vulnerability: { letter: 'V', color: '#ff7043' }, // orange
};

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
    <div className="stat-box" title={title} style={color ? {borderColor: color} : undefined}>
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
      <div className="stat-label" style={color ? {color} : undefined}>{label}</div>
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

// Clicking the box edits the RAW base score (e.g. fixing a PDF import that baked an
// equipped item's bonus directly into the imported value, like a Belt of Storm Giant
// Strength's +29 STR showing as the character's base score with no way to back it out -
// effectiveAbilityScores only ever takes the max of raw vs. equipped set-buffs, so it
// can't un-apply a buff that's already sitting in the raw number). Shows the effective
// (post-item) score normally; editing always edits the underlying base, never the
// boosted display value.
function AbilityBox({ abbr, score, baseScore, onSaveBase, color, suspectItem }) {
  const boosted = baseScore != null && score !== baseScore;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(baseScore);

  const commit = () => {
    setEditing(false);
    const n = parseInt(val);
    if (!isNaN(n) && n !== baseScore && onSaveBase) onSaveBase(n);
    else setVal(baseScore);
  };

  const title = suspectItem
    ? `Base score (${baseScore}) exactly matches "${suspectItem}"'s Set-To value - if this already includes that item's old bonus, lower it to your true base. Click to edit.`
    : (boosted ? `${baseScore} base, raised to ${score} by an equipped item - click to edit the base score` : 'Click to edit');

  return (
    <div className="stat-box" style={{minWidth:38, borderColor: suspectItem ? 'var(--warning)' : color}} title={title}>
      <div className="stat-label" style={{marginTop:0,marginBottom:2,color}}>{abbr}{suspectItem ? ' ⚠' : ''}</div>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          style={{width:30,textAlign:'center',fontWeight:700,fontSize:14,padding:'1px 2px'}}
        />
      ) : (
        <div onClick={() => { setVal(baseScore); setEditing(true); }} className="stat-value" style={{cursor: onSaveBase ? 'pointer' : undefined, color: boosted ? 'var(--accent-light)' : color}}>
          {score}
        </div>
      )}
      <div className="stat-sub">{modStr(score)}</div>
    </div>
  );
}

// One color per CATEGORY (not per individual ability - all six ability boxes share one
// color as a single category) so AC/INIT/PROF/SPEED/Abilities are each visually distinct
// at a glance, applied to the box outline and label text too, not just the number -
// purely cosmetic, no mechanical meaning.
const STAT_COLORS = { AC: '#4FC3F7', INIT: '#FFD54F', PROF: '#CE93D8', SPEED: '#81C784', ABILITY: '#FF8A65' };

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

function CoinInput({ coin, value, onCommit }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',gap:6}}>
      <span style={{color: coin.color, fontWeight:700, fontSize:11, minWidth:20}}>{coin.abbr}</span>
      <div onClick={() => setOpen(true)} style={{width:80,textAlign:'right',padding:'2px 8px',fontSize:13,fontWeight:600,border:`1px solid ${coin.color}`,borderRadius:'var(--radius-sm)',background:'var(--bg-card)',color: coin.color,cursor:'pointer'}}>
        {value}
      </div>
      {open && (
        <NumberPadPopover
          label={coin.abbr} value={value} color={coin.color} position="left"
          onApply={(delta) => onCommit(Math.max(0, value + delta))}
          onClose={() => setOpen(false)}
        />
      )}
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
  const { character, saveTrackerData, updateCharacter, doRest, addActiveEffect, removeActiveEffect, removeCondition } = useCharacter();
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
  const [showFeedback, setShowFeedback] = useState(false);

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
  // Feats with buffs (set via CustomAbilityModal's Modifiers editor, same as items) are
  // always-on - no equip/attune step - so they're folded into every AC/save/spell-mod
  // calculation as synthetic always-equipped "items" rather than duplicating the whole
  // aggregation a second time for feats specifically.
  const buffItems = [...invItems, ...featBuffItems(td?.features), ...raceBuffItems(character.race)];
  const itemBonuses = computeItemBonuses(buffItems);
  const effAbBase  = effectiveAbilityScores(ab, buffItems);
  // ability_score_misc: per-ability misc adjustments stored in tracker_data (spells like
  // Bull's Strength, manual corrections, anything not from a real item/race/feat buff).
  const abMisc = td?.ability_score_misc || {};
  const effAb = Object.fromEntries(ABILITY_KEYS.map(k => [k, effAbBase[k] + (abMisc[k] || 0)]));
  const abilityContamination = suspectedAbilityContamination(ab, buffItems);
  const dexMod = modifier(effAb.DEX || 10);
  const attunedCount = invItems.filter(it => it.attunement && it.attuned).length;
  const attunableCount = invItems.filter(it => it.attunement).length;
  const hasUnattunedEligible = invItems.some(it => it.attunement && !it.attuned);
  const attuneWarn = attunedCount > 3 || (attunedCount < 3 && hasUnattunedEligible);
  const hd = td?.hit_dice;
  const spellBlocks = getSpellcastingBlocks(class_name, ab, level, buffItems);
  const prof   = profBonus(level);
  const con    = modifier(ab?.CON || 10);
  const calcMaxHp = hp.max || (level * (({ Barbarian:12,Fighter:10,Paladin:10,Ranger:10,Monk:8,Rogue:8,Bard:8,Cleric:8,Druid:8,Warlock:8,Sorcerer:6,Wizard:6 }[class_name] || 8) / 2 + 1 + con));
  const maxHp  = (hp.max_override > 0) ? hp.max_override : calcMaxHp;
  const curHp  = hp.current ?? maxHp;
  const tempHp = hp.temp || 0;
  const activeEffects = td?.active_effects || [];
  const isHasted = activeEffects.includes(HASTED_EFFECT);
  const hasteAcBonus = isHasted ? 2 : 0;
  // Item AC override — either flat (heavy armor, Robe without DEX) or base+DEX (Robe of
  // the Archmagi: 15+DEX, Mage Armor: 13+DEX). acOverrideRaw carries the {value, addDex}
  // shape; acOverride is the resolved flat number after adding DEX when applicable.
  const acOverrideRaw = itemBonuses.acOverrideRaw;
  const armorOverride = acOverrideRaw !== null
    ? acOverrideRaw.value + (acOverrideRaw.ability ? cappedModifier(effAb[acOverrideRaw.ability] ?? 10, acOverrideRaw.cap) : 0)
    : null;
  const { ac: unarmoredBase } = unarmoredAC(class_name, effAb, td?.features);
  // Priority: equipped armor/robe override → manually stored td.ac → auto-computed unarmored.
  const baseAc = armorOverride != null ? armorOverride : (td?.ac != null ? td.ac : unarmoredBase);
  const acMisc = td?.ac_misc || 0;
  const ac     = baseAc + itemBonuses.ac_base + acMisc + hasteAcBonus;
  const init   = td?.initiative ?? dexMod;
  // Speed is stored as a free-form string from PDF import ("30 ft.") or a plain number
  // once edited here - parseInt handles either. Haste doubles it (RAW) the same way it
  // already adds +2 AC, so the box reflects the doubled value rather than needing the
  // player to do the math themselves mid-combat.
  const baseSpeed = parseInt(td?.speed) || 30;
  const speed = isHasted ? baseSpeed * 2 : baseSpeed;
  const setSpeed = (v) => saveTrackerData({ ...td, speed: isHasted ? Math.round(v / 2) : v });
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
  // The letter badge (A/D/R/I/V) already conveys the category, so strip a redundant
  // leading category word from the displayed chip text (player-typed text like
  // "Advantage vs Charm, Fear..." or auto-generated text like "Resist Fire") - covers
  // both how the player phrases free text and how this file generates its own chip text.
  const TRAIT_PREFIX_PATTERNS = {
    advantage:     /^adv(antage)?\s*(on|vs\.?|against|to)?\s*/i,
    disadvantage:  /^disadv(antage)?\s*(on|vs\.?|against|to)?\s*/i,
    resistance:    /^resist(ance)?\s*(to)?\s*/i,
    immune:        /^immun(e|ity)\s*(to)?:?\s*/i,
    vulnerability: /^vulnerab(le|ility)\s*(to)?\s*/i,
  };
  const stripTraitPrefix = (text, type) => {
    const pattern = TRAIT_PREFIX_PATTERNS[type];
    if (!pattern) return text;
    const stripped = text.replace(pattern, '').trim();
    return stripped || text; // never show a blank chip if the whole string was the prefix
  };
  // No source field exists for character-level traits (TraitsModal is plain free text),
  // so the hover tooltip shows the full original (pre-strip) text instead - lets the
  // player see the complete context after the visible label gets shortened above.
  const traitChips = [
    ...activeEffects.flatMap(e => EFFECT_MECHANICAL_NOTES[e] || []),
    ...(traits.resistances||[]).map(t => ({t: traitName(t), d: t?.description || traitName(t), type:'resistance'})),
    ...(traits.immunities||[]).map(t => ({t: traitName(t), d: t?.description || traitName(t), type:'immune'})),
    ...(traits.vulnerabilities||[]).map(t => ({t: traitName(t), d: t?.description || traitName(t), type:'vulnerability'})),
    ...(traits.advantages||[]).map(t => ({t: traitName(t), d: t?.description || traitName(t), type:'advantage'})),
    ...(traits.disadvantages||[]).map(t => ({t: traitName(t), d: t?.description || traitName(t), type:'disadvantage'})),
    // Item-granted advantage on saves (an advantage_save buff, e.g. a Cloak of
    // Protection-style homebrew) shows the same way Haste's hardcoded "ADV on DEX
    // saves" chip already does - just sourced from equipped items instead.
    ...itemBonuses.advantageSaves.map(a => ({
      t: `ADV on ${a.ability !== 'all' ? `${a.ability} ` : ''}saves`, d: `From: ${a.source}`, type: 'advantage',
    })),
    // Item-granted resistances/immunities/vulnerabilities (e.g. the Great Silver Sword's
    // psychic resistance + charmed immunity while held) - same chip styling as the
    // character-level trait fields above, just only active while the item actually is.
    ...itemBonuses.resistances.map(r => ({ t: r.type, d: `From: ${r.source}`, type: 'resistance' })),
    ...itemBonuses.immunities.map(r => ({ t: r.type, d: `From: ${r.source}`, type: 'immune' })),
    ...itemBonuses.vulnerabilities.map(r => ({ t: r.type, d: `From: ${r.source}`, type: 'vulnerability' })),
    ...itemBonuses.conditionImmunities.map(r => ({ t: r.condition, d: `From: ${r.source}`, type: 'immune' })),
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
  const setAc     = (v) => saveTrackerData({ ...td, ac: v - itemBonuses.ac_base - acMisc - hasteAcBonus });
  const setInit   = (v) => saveTrackerData({ ...td, initiative: v });
  const toggleInspiration = () => saveTrackerData({ ...td, inspiration: !insp });
  const setCurrencyCoin = (k, v) => saveTrackerData({ ...td, inventory: { ...inventory, currency: { ...currency, [k]: v } } });

  const hpCol = hpColor(curHp, maxHp);

  const slotLevels = Object.entries(slots).filter(([,s]) => s.max > 0);

  return (
    <>
      <div style={{background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',padding:'8px 12px',flexShrink:0}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <button onClick={onBack} style={{background:'none',color:'var(--text-dim)',fontSize:18,padding:'0 4px'}}>←</button>
              <div>
                <div style={{fontFamily:"'Cinzel',serif",color:'var(--accent-light)',fontSize:16,lineHeight:1.2}}>{name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>L{level} {race} {class_name}</div>
              </div>
              <button className="btn-icon" title="Settings" onClick={() => setShowSettings(true)} style={{fontSize:14,padding:'4px 7px'}}>⚙️</button>
              <button className="btn-icon" title="Send Feedback / Suggest a Feature" onClick={() => setShowFeedback(true)} style={{fontSize:14,padding:'4px 7px'}}>💬</button>
            </div>

            <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <PMStat label="HP" value={`${curHp}/${maxHp}`} color={hpCol} onAdjust={adjustHp} onClick={() => setShowHP(true)} />
                {spellBlocks.length > 0 && (
                  <div style={{display:'flex',gap:4}}>
                    {spellBlocks.map(block => <SpellcastBox key={block.className} block={block} />)}
                  </div>
                )}
              </div>
              {tempHp > 0 && <PMStat label="Temp HP" value={tempHp} color={hpCol} onAdjust={adjustTempHp} />}

              <EditableStat label="AC" value={ac} onSave={setAc} color={STAT_COLORS.AC} title={(armorOverride != null || itemBonuses.ac_base || acMisc || hasteAcBonus) ? `${baseAc} base${armorOverride != null ? ' (armor)' : ''}${itemBonuses.ac_base ? ` + ${itemBonuses.ac_base} items` : ''}${acMisc ? ` + ${acMisc} misc` : ''}${hasteAcBonus ? ` + ${hasteAcBonus} Hasted` : ''}${armorOverride != null ? ' — edit only when armor is unequipped' : ''}` : undefined} />
              <EditableStat label="INIT" value={init} onSave={setInit} color={STAT_COLORS.INIT} />
              <EditableStat label="SPEED" value={speed} onSave={setSpeed} color={STAT_COLORS.SPEED} title={isHasted ? `${baseSpeed} ft. base, doubled while Hasted` : undefined} />
              <div className="stat-box" style={{borderColor: STAT_COLORS.PROF}}>
                <div className="stat-value" style={{color: STAT_COLORS.PROF}}>+{prof}</div>
                <div className="stat-label" style={{color: STAT_COLORS.PROF}}>Prof</div>
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
                    <AbilityBox key={k} abbr={k} score={effAb[k]||10} baseScore={ab?.[k]||10} color={STAT_COLORS.ABILITY}
                      suspectItem={abilityContamination[k]}
                      onSaveBase={(n) => updateCharacter(character.id, { ability_scores: { ...ab, [k]: n } })} />
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
                {traitChips.map(({t,d,type}, i) => {
                  const style = TRAIT_TYPE_STYLE[type];
                  const c = style?.color || 'var(--text-dim)';
                  const label = stripTraitPrefix(t, type);
                  return (
                    <div key={t+i} title={d || undefined} style={{display:'flex',alignItems:'center',gap:4,border:`1px solid ${c}`,borderRadius:10,padding:'1px 7px 1px 5px',fontSize:10}}>
                      {style && (
                        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,borderRadius:'50%',background:c,color:'#000',fontWeight:800,fontSize:9,lineHeight:1}}>{style.letter}</span>
                      )}
                      <span style={{color:c}}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{flexShrink:0,display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-start',paddingTop:2}}>
            <PMStat
              label="Exhaustion"
              value={exhaustion}
              color={exhaustion >= 5 ? 'var(--danger)' : exhaustion >= 3 ? 'var(--warning)' : undefined}
              onAdjust={d => saveTrackerData({ ...td, exhaustion: Math.max(0, Math.min(6, exhaustion + d)) })}
              onClick={() => setShowExhaustionInfo(true)}
              title={exhaustionTitle}
            />
            <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:100}}>
              <EffectAdder onAdd={addActiveEffect} />
              {activeEffects.length > 0 && (
                <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                  {activeEffects.map(e => (
                    <div key={e} onClick={() => removeActiveEffect(e)} title="Click to remove" style={{cursor:'pointer',background:'rgba(124,77,255,0.15)',border:'1px solid var(--accent-light)',color:'var(--accent-light)',borderRadius:12,padding:'3px 10px',fontSize:12}}>
                      {e} ×
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:100}}>
              <div className="stat-box" onClick={() => setShowConditions(true)} style={{cursor:'pointer'}}>
                <div className="stat-value" style={{color: conditions.length > 0 ? 'var(--danger)' : 'var(--accent-light)'}}>{conditions.length}</div>
                <div className="stat-label">Conditions</div>
              </div>
              {conditions.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-start'}}>
                  {conditions.map(c => (
                    <div key={c} style={{display:'flex',alignItems:'center',background:'rgba(230,57,70,0.15)',border:'1px solid var(--danger)',color:'var(--danger)',borderRadius:12,padding:'3px 4px 3px 10px',fontSize:12}}>
                      <span onClick={() => setViewingCondition(c)} style={{cursor:'pointer'}}>{c}</span>
                      <span onClick={() => removeCondition(c)} title="Remove" style={{cursor:'pointer',marginLeft:5,padding:'0 3px'}}>×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{display:'flex',gap:10,flexShrink:0,marginLeft:'auto'}}>
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
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
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
