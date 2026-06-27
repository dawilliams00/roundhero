import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER, SECTION_COLORS, slotBadgeTextColor, concentrationSlotCount, HASTED_EFFECT, LETHARGIC_CONDITION } from '../utils/dnd';
import AbilityDetailModal from './AbilityDetailModal';
import CastSpellPickerModal from './CastSpellPickerModal';
import ItemSpellsModal from './ItemSpellsModal';
import ItemDetailModal from './ItemDetailModal';
import SpellTuckModal from './SpellTuckModal';
import WeaponAttackModal from './WeaponAttackModal';
import ConcentrationModal from './ConcentrationModal';
import SorceryPointsModal from './SorceryPointsModal';

const ITEM_BUCKET = { action: 'Action', bonus_action: 'Bonus Action', reaction: 'Reaction' };
const ITEM_COST_OPTIONS = [
  { value: '', label: 'No bucket' },
  { value: 'action', label: 'Action' },
  { value: 'bonus_action', label: 'Bonus' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'free_action', label: 'Free' },
];

export default function ActionEconomyTab() {
  const { character, useFeature, useSlot, restoreSlot, saveTrackerData, useItemCharge, turnUsed, setTurnUsed } = useCharacter();
  const [detail, setDetail]     = useState(null);
  const [castingSpell, setCastingSpell] = useState(false);
  const [castingBucket, setCastingBucket] = useState(null);
  const [viewingItemSpells, setViewingItemSpells] = useState(null);
  const [tuckTarget, setTuckTarget] = useState(null);
  const [attackingWeapon, setAttackingWeapon] = useState(null);
  const [showConcentration, setShowConcentration] = useState(false);
  const [viewingItemDetail, setViewingItemDetail] = useState(null);
  // Reminders (e.g. "don't forget Divine Smite", later Syric's Codex Surge Dice) are
  // dismissed per-turn only - they don't consume anything, just a "got it" ack that
  // resets on New Turn / re-entering combat, same lifecycle as the turn-bucket state.
  const [dismissedReminders, setDismissedReminders] = useState({});
  const [showSorceryPoints, setShowSorceryPoints] = useState(false);

  if (!character) return null;

  const ae       = character.ae_data || {};
  const td       = character.tracker_data || {};
  const features = td.features || {};
  const slots    = td.spell_slots || {};
  const items    = td.inventory?.items || [];
  const chargeItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.charges);
  const weaponItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.is_weapon);
  const inInitiative = !!td.in_initiative;
  const isHasted = (td.active_effects || []).includes(HASTED_EFFECT);
  const concSlots = td.concentration?.slots || [];
  const concMaxSlots = concentrationSlotCount(items);
  // Sorcery Points/Metamagic management (SorceryPointsModal) is also reachable from the
  // Feats/Attunement tab - surfaced here too since "anything with a use/rest/charge
  // belongs on the AE tab" is the standing rule for this tab now. Detected by substring
  // so it works whether the feature is the engine's exact name or a PDF-imported variant.
  const sorceryFeatureName = Object.keys(features).find(n => n.toLowerCase().includes('font of magic'));
  const knownMetamagic = td.metamagic_known || [];
  const maxAttacks = Object.keys(features).some(n => n.toLowerCase().includes('extra attack')) ? 2 : 1;

  const recordAttack = () => {
    setTurnUsed(p => {
      const used = (p.Attacks || 0) + 1;
      return { ...p, Attacks: used, ...(used >= maxAttacks ? { Action: true } : {}) };
    });
  };

  // Lethargic RAW lasts "until the end of your next turn" - this app has no real
  // round/turn counter to time that precisely against, so clicking New Turn (the
  // simplest stand-in for "a turn has passed") clears it. Simplified, but matches the
  // rest of this app's philosophy of tracking state rather than enforcing exact timing.
  const resetTurn = () => {
    setTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false, Haste: false, Attacks: 0 });
    setDismissedReminders({});
    const conditions = td.conditions || [];
    if (conditions.includes(LETHARGIC_CONDITION)) {
      saveTrackerData({ ...td, conditions: conditions.filter(c => c !== LETHARGIC_CONDITION) });
    }
  };

  // High-level resources that grant themselves the moment initiative is rolled if you're
  // sitting at 0 (Barbarian's Primal Champion, Monk's Perfect Self, etc. - and later
  // Syric's Codex Surge Dice) are flagged with refill_on_combat on the feature, set via
  // CustomAbilityModal/FeatureEditModal. Checked on entering combat, same trigger point
  // the rules describe ("when you roll initiative and have none left").
  const toggleInitiative = () => {
    const entering = !inInitiative;
    let newTd = { ...td, in_initiative: entering };
    if (entering) {
      setDismissedReminders({});
      const refreshed = {};
      let changed = false;
      for (const [name, f] of Object.entries(features)) {
        if (f.refill_on_combat && (f.max || 0) > 0 && (f.current || 0) <= 0) {
          refreshed[name] = { ...f, current: f.max };
          changed = true;
        }
      }
      if (changed) newTd = { ...newTd, features: { ...features, ...refreshed } };
    }
    saveTrackerData(newTd);
    if (inInitiative) resetTurn();
  };

  // The section an ability is rendered under IS the action-economy bucket for action/bonus_action/reaction/cast_spell types.
  const bucketForAbility = (ability, section) => {
    if (ability.cost_type === 'haste_action') return 'Haste';
    if (['Action','Bonus Action','Reaction'].includes(section)) return section;
    return null; // Free Action / Passive aren't turn-limited
  };

  const markBucket = (bucket) => {
    if (!inInitiative || !bucket) return;
    setTurnUsed(p => ({ ...p, [bucket]: true }));
  };

  const isBucketUsed = (bucket) => inInitiative && bucket && turnUsed[bucket];

  const handleUse = async (ability, section) => {
    if (ability.tracker_key) {
      try { await useFeature(ability.tracker_key); } catch {}
    }
    markBucket(bucketForAbility(ability, section));
  };

  // Marking the bucket consumed happens on a SUCCESSFUL cast (CastSpellPickerModal's
  // onCast, fired from SpellDetailModal's onCastSuccess) - not on opening the picker.
  // Clicking CAST and then closing the picker without actually casting anything used to
  // burn the Action/Bonus/Reaction bucket for nothing.
  const handleCastClick = (section) => {
    setCastingBucket(section);
    setCastingSpell(true);
  };

  const getUses = (ability) => {
    if (!ability.tracker_key) return null;
    const feat = features[ability.tracker_key];
    if (!feat) return null;
    const { current, max } = feat;
    if (max === 0) return null;
    return { current, max };
  };

  const setItemCostType = (idx, value) => {
    const newItems = items.map((it,i) => i===idx ? { ...it, cost_type: value || null } : it);
    saveTrackerData({ ...td, inventory: { ...td.inventory, items: newItems } });
  };

  const handleItemUse = async (idx, itemBucket) => {
    await useItemCharge(idx, -1);
    markBucket(itemBucket);
  };

  const slotLevels = Object.entries(slots).filter(([,s]) => (s.max||0) > 0);

  return (
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',gap:8,padding:'8px 12px',borderBottom:'1px solid var(--border)',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
        <button className="btn btn-sm" onClick={toggleInitiative} style={{background: inInitiative ? 'var(--danger)' : 'var(--success)',color: '#fff',fontWeight:600}}>
          {inInitiative ? 'Stop Initiative' : 'Start Initiative'}
        </button>
        <div style={{display:'flex',gap:4}}>
          {Array.from({ length: concMaxSlots }, (_, idx) => {
            const spell = (concSlots[idx]?.spell || '').trim();
            return (
              <div key={idx} onClick={() => setShowConcentration(true)} title="Concentration - click to manage"
                style={{fontSize:11,padding:'3px 8px',borderRadius:12,cursor:'pointer',fontWeight:600,
                  background: spell ? 'var(--success)' : 'var(--border)',
                  color: spell ? '#fff' : 'var(--text-dim)',
                  maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                CON{concMaxSlots > 1 ? ` ${idx+1}` : ''}: {spell ? spell : '--'}
              </div>
            );
          })}
        </div>
        {inInitiative && (
          <div style={{display:'flex',gap:4}}>
            {(isHasted ? ['Action','Bonus Action','Reaction','Haste'] : ['Action','Bonus Action','Reaction']).map(s => (
              <div key={s} style={{fontSize:11,padding:'3px 8px',borderRadius:12,
                background: turnUsed[s] ? 'var(--border)' : SECTION_COLORS[s],
                color: turnUsed[s] ? 'var(--text-dim)' : '#fff',
                textDecoration: turnUsed[s] ? 'line-through' : 'none',
                transition:'all 0.2s', cursor:'pointer',
              }} onClick={() => setTurnUsed(p => ({...p,[s]:!p[s]}))}>
                {s === 'Bonus Action' ? 'Bonus' : s}
              </div>
            ))}
          </div>
        )}
        <div style={{flex:1}}/>
        {inInitiative && <button className="btn btn-secondary btn-sm" onClick={resetTurn}>New Turn</button>}
      </div>

      {slotLevels.length > 0 && (
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',flexShrink:0}}>
          <span style={{color:'var(--text-dim)',fontSize:11,minWidth:40}}>Slots:</span>
          {slotLevels.map(([lvl, slot]) => (
            <div key={lvl} style={{display:'flex',alignItems:'center',gap:2}}>
              <button onClick={() => useSlot(parseInt(lvl))} disabled={slot.current<=0}
                style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:'12px 0 0 12px',
                  background: slot.current > 0 ? `var(--slot-${lvl})` : 'var(--border)',
                  color: slot.current > 0 ? slotBadgeTextColor(parseInt(lvl)) : 'var(--text-dim)',
                  border:'none',fontSize:12,fontWeight:500,opacity: slot.current<=0 ? 0.5 : 1}}>
                L{lvl} {slot.current}/{slot.max}
              </button>
              <button onClick={() => restoreSlot(parseInt(lvl))} disabled={slot.current>=slot.max} title="Restore 1 slot (undo accidental cast)"
                style={{padding:'3px 6px',borderRadius:'0 12px 12px 0',background:'var(--bg-hover)',color:'var(--text-dim)',border:'none',fontSize:12,opacity: slot.current>=slot.max ? 0.4 : 1}}>
                ↺
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',padding:'0 0 16px'}}>
        {inInitiative && Object.entries(features).filter(([name,f]) => f.reminder && !dismissedReminders[name]).length > 0 && (
          <div>
            <div style={{padding:'6px 12px',background:'var(--warning)',fontSize:11,fontWeight:600,color:'#000',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
              REMINDERS
            </div>
            {Object.entries(features).filter(([name,f]) => f.reminder && !dismissedReminders[name]).map(([name]) => (
              <div key={name} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',gap:8,background:'rgba(255,152,0,0.1)'}}>
                <div style={{flex:1}}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>📌 Don't forget: {name}</div>
                </div>
                <button className="btn btn-sm" onClick={() => setDismissedReminders(p => ({ ...p, [name]: true }))} style={{background:'var(--bg-hover)',color:'var(--text-dim)'}}>
                  Got it
                </button>
              </div>
            ))}
          </div>
        )}
        {weaponItems.length > 0 && (
          <div>
            <div style={{padding:'6px 12px',background:'#37474f',fontSize:11,fontWeight:600,color:'#fff',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
              WEAPONS
            </div>
            {/* Extra Attack (detected by feature name, same substring approach used
                elsewhere) raises maxAttacks to 2 - the Action bucket itself only marks
                used once all granted attacks for the turn are spent, so a Fighter/Paladin
                etc. actually gets two free swings before anything else sharing the Action
                bucket dims. attacksUsed is a turn-scoped count (turnUsed.Attacks), reset
                the same places Action/Bonus/Reaction already reset. */}
            {weaponItems.map(({it, idx}) => {
              const attacksUsed = turnUsed.Attacks || 0;
              const attacksExhausted = inInitiative && attacksUsed >= maxAttacks;
              return (
                <div key={idx} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',gap:8,opacity: attacksExhausted ? 0.5 : 1}}>
                  <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                    <button className="btn btn-sm" onClick={() => setAttackingWeapon(idx)} disabled={attacksExhausted} style={{background: attacksExhausted ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:56}}>
                      ATTACK
                    </button>
                  </div>
                  <div style={{flex:1,cursor:'pointer'}} onClick={() => setAttackingWeapon(idx)}>
                    <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:11}}>
                      {it.weapon_range} · {it.damage_dice} {it.damage_type}{(it.properties||[]).length ? ` · ${it.properties.join(', ')}` : ''}
                    </div>
                    {inInitiative && <div style={{color: attacksExhausted ? 'var(--text-dim)' : 'var(--text-secondary)',fontSize:10}}>Attack {Math.min(attacksUsed, maxAttacks)}/{maxAttacks} used this turn</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {chargeItems.length > 0 && (
          <div>
            <div style={{padding:'6px 12px',background:'#5d4037',fontSize:11,fontWeight:600,color:'#fff',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
              ITEMS
            </div>
            {chargeItems.map(({it, idx}) => {
              const itemBucket = ITEM_BUCKET[it.cost_type] || null;
              const bucketUsed = isBucketUsed(itemBucket);
              return (
                <div key={idx} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',gap:8,background: bucketUsed ? 'var(--bg-primary)' : 'transparent',opacity: bucketUsed ? 0.5 : 1}}>
                  <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                    {it.granted_spells?.length > 0 ? (
                      <button className="btn btn-sm" disabled={bucketUsed} style={{background:'var(--accent)',color:'#fff'}} onClick={() => setViewingItemSpells(idx)}>✨</button>
                    ) : (
                      <button className="btn btn-sm" disabled={it.charges.current<=0||bucketUsed} style={{background:'var(--danger)',color:'#fff'}} onClick={() => handleItemUse(idx, itemBucket)}>−</button>
                    )}
                  </div>
                  <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewingItemDetail(idx)}>
                    <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:11}}>recharges {it.charges.recharge?.replace('_',' ')}</div>
                    {bucketUsed && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                  </div>
                  <select value={it.cost_type || ''} onChange={e => setItemCostType(idx, e.target.value)} title="Action economy cost" style={{fontSize:11,padding:'2px 4px',width:78}}>
                    {ITEM_COST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div style={{color: it.charges.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{it.charges.current}/{it.charges.max}</div>
                  {!(it.granted_spells?.length > 0) && (
                    <button className="btn btn-sm" disabled={it.charges.current>=it.charges.max} style={{background:'var(--success)',color:'#fff'}} onClick={() => useItemCharge(idx,1)}>+</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {SECTION_ORDER.map(section => {
          // Defends against duplicate entries that can land in ae_data[section] (e.g. a
          // feat added twice via Browse Feats, or a PDF-imported descriptive feature and
          // a separately-added custom functional version sharing a name) - only the first
          // occurrence of a given tracker_key/name renders, so the player only ever sees one.
          const abilities = (ae[section] || []).filter((a, i, arr) =>
            arr.findIndex(b => (b.tracker_key || b.name) === (a.tracker_key || a.name)) === i
          );
          if (!abilities || abilities.length === 0) return null;
          return (
            <div key={section}>
              <div style={{padding:'6px 12px',background:SECTION_COLORS[section],fontSize:11,fontWeight:600,color:'#fff',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
                {section.toUpperCase()}
              </div>
              {section === 'Action' && isHasted && (() => {
                const bucketUsed = isBucketUsed('Haste');
                return (
                  <div style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',background: bucketUsed ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: bucketUsed ? 0.5 : 1,gap:8}}>
                    <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                      <button className="btn btn-sm" onClick={() => markBucket('Haste')} disabled={bucketUsed} style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                        USE
                      </button>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{color: bucketUsed ? 'var(--text-dim)' : 'var(--text-primary)',fontWeight:500,fontSize:13}}>Haste Action</div>
                      <div style={{color:'var(--text-dim)',fontSize:11}}>Haste · Attack, Dash, Disengage, Hide, or Use an Object only</div>
                      {bucketUsed && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                    </div>
                  </div>
                );
              })()}
              {abilities.map((ability, i) => {
                const uses = getUses(ability);
                const depleted = uses && uses.current <= 0;
                const isCastSpell = ability.cost_type === 'cast_spell';
                const isTuck = !isCastSpell && !!features[ability.tracker_key]?.spell_picker;
                const isSorcery = !isCastSpell && !isTuck && ability.tracker_key === sorceryFeatureName;
                const bucket = bucketForAbility(ability, section);
                const bucketUsed = isBucketUsed(bucket);
                const unavailable = (depleted && !isSorcery) || bucketUsed;
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',background: unavailable ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: unavailable ? 0.5 : 1,gap:8}}>
                    <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                      {isCastSpell && (
                        <button className="btn btn-sm" onClick={() => handleCastClick(section)} disabled={bucketUsed} style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                          CAST
                        </button>
                      )}
                      {isTuck && (
                        <button className="btn btn-sm" onClick={() => setTuckTarget({ ability, section })} disabled={bucketUsed} style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                          OPEN
                        </button>
                      )}
                      {isSorcery && (
                        <button className="btn btn-sm" onClick={() => setShowSorceryPoints(true)} style={{background:'var(--accent)',color:'#fff',minWidth:36}}>
                          🔮
                        </button>
                      )}
                      {!isCastSpell && !isTuck && !isSorcery && !depleted && (
                        <button className="btn btn-sm" onClick={() => handleUse(ability, section)} disabled={bucketUsed}
                          style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                          USE
                        </button>
                      )}
                    </div>
                    <div style={{flex:1,cursor:'pointer'}} onClick={() => { if (isTuck) setTuckTarget({ ability, section }); else if (isSorcery) setShowSorceryPoints(true); else setDetail(ability); }}>
                      <div style={{color: unavailable ? 'var(--text-dim)' : 'var(--text-primary)',fontWeight:500,fontSize:13,textDecoration: depleted && !isSorcery ? 'line-through' : 'none'}}>
                        {isTuck ? '🃏 ' : ''}{ability.name}
                      </div>
                      {ability.source && <div style={{color:'var(--text-dim)',fontSize:11}}>{ability.source}</div>}
                      {isTuck && features[ability.tracker_key]?.tucked_spell && (
                        <div style={{color:'var(--accent-light)',fontSize:11}}>Tucked: {features[ability.tracker_key].tucked_spell}</div>
                      )}
                      {isSorcery && knownMetamagic.length > 0 && (
                        <div style={{color:'var(--accent-light)',fontSize:11}}>Metamagic: {knownMetamagic.join(', ')}</div>
                      )}
                      {bucketUsed && !depleted && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                    </div>
                    {uses && <div style={{color: uses.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{uses.current}/{uses.max}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {detail    && <AbilityDetailModal ability={detail} onClose={() => setDetail(null)} />}
      {showSorceryPoints && sorceryFeatureName && (
        <SorceryPointsModal featureName={sorceryFeatureName} onClose={() => setShowSorceryPoints(false)} />
      )}
      {castingSpell && (
        <CastSpellPickerModal
          bucket={castingBucket}
          onCast={() => markBucket(bucketForAbility({ cost_type: 'cast_spell' }, castingBucket))}
          onClose={() => { setCastingSpell(false); setCastingBucket(null); }}
        />
      )}
      {viewingItemSpells !== null && (
        <ItemSpellsModal
          item={items[viewingItemSpells]}
          onCast={(chargeCost) => {
            useItemCharge(viewingItemSpells, -chargeCost);
            markBucket(ITEM_BUCKET[items[viewingItemSpells]?.cost_type] || null);
          }}
          onClose={() => setViewingItemSpells(null)}
        />
      )}
      {tuckTarget && (
        <SpellTuckModal
          ability={tuckTarget.ability}
          onUse={() => markBucket(bucketForAbility(tuckTarget.ability, tuckTarget.section))}
          onClose={() => setTuckTarget(null)}
        />
      )}
      {attackingWeapon !== null && (
        <WeaponAttackModal
          itemIndex={attackingWeapon}
          attacksUsed={turnUsed.Attacks || 0}
          maxAttacks={maxAttacks}
          onAttack={recordAttack}
          onClose={() => setAttackingWeapon(null)}
        />
      )}
      {showConcentration && <ConcentrationModal onClose={() => setShowConcentration(false)} />}
      {viewingItemDetail !== null && (
        <ItemDetailModal item={items[viewingItemDetail]} onClose={() => setViewingItemDetail(null)} />
      )}
    </div>
  );
}
