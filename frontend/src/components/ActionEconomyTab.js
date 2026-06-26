import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER, SECTION_COLORS } from '../utils/dnd';
import AbilityDetailModal from './AbilityDetailModal';
import CustomAbilityModal from './CustomAbilityModal';
import CastSpellPickerModal from './CastSpellPickerModal';
import ItemSpellsModal from './ItemSpellsModal';
import SpellTuckModal from './SpellTuckModal';

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
  const [showCustom, setCustom] = useState(false);
  const [castingSpell, setCastingSpell] = useState(false);
  const [castingBucket, setCastingBucket] = useState(null);
  const [viewingItemSpells, setViewingItemSpells] = useState(null);
  const [tuckTarget, setTuckTarget] = useState(null);

  if (!character) return null;

  const ae       = character.ae_data || {};
  const td       = character.tracker_data || {};
  const features = td.features || {};
  const slots    = td.spell_slots || {};
  const items    = td.inventory?.items || [];
  const chargeItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.charges);
  const inInitiative = !!td.in_initiative;
  const isHasted = (td.active_effects || []).includes('Hasted');

  const resetTurn = () => setTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false, Haste: false });

  const toggleInitiative = () => {
    saveTrackerData({ ...td, in_initiative: !inInitiative });
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
    if (!ability.tracker_key) return;
    try { await useFeature(ability.tracker_key); } catch {}
    markBucket(bucketForAbility(ability, section));
  };

  const handleCastClick = (section) => {
    setCastingBucket(section);
    setCastingSpell(true);
    markBucket(bucketForAbility({ cost_type: 'cast_spell' }, section));
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
        <button className="btn btn-primary btn-sm" onClick={() => setCustom(true)}>+ Custom</button>
      </div>

      {slotLevels.length > 0 && (
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',flexShrink:0}}>
          <span style={{color:'var(--text-dim)',fontSize:11,minWidth:40}}>Slots:</span>
          {slotLevels.map(([lvl, slot]) => (
            <div key={lvl} style={{display:'flex',alignItems:'center',gap:2}}>
              <button onClick={() => useSlot(parseInt(lvl))} disabled={slot.current<=0}
                style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:'12px 0 0 12px',
                  background: slot.current > 0 ? `var(--slot-${lvl})` : 'var(--border)',
                  color: slot.current > 0 ? '#fff' : 'var(--text-dim)',
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
                  <div style={{flex:1}}>
                    <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:11}}>recharges {it.charges.recharge?.replace('_',' ')}</div>
                    {bucketUsed && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                  </div>
                  <select value={it.cost_type || ''} onChange={e => setItemCostType(idx, e.target.value)} title="Action economy cost" style={{fontSize:11,padding:'2px 4px',width:78}}>
                    {ITEM_COST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div style={{color: it.charges.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{it.charges.current}/{it.charges.max}</div>
                  {it.granted_spells?.length > 0 ? (
                    <button className="btn btn-sm" disabled={bucketUsed} style={{background:'var(--accent)',color:'#fff'}} onClick={() => setViewingItemSpells(idx)}>✨</button>
                  ) : (
                    <>
                      <button className="btn btn-sm" disabled={it.charges.current<=0||bucketUsed} style={{background:'var(--danger)',color:'#fff'}} onClick={() => handleItemUse(idx, itemBucket)}>−</button>
                      <button className="btn btn-sm" disabled={it.charges.current>=it.charges.max} style={{background:'var(--success)',color:'#fff'}} onClick={() => useItemCharge(idx,1)}>+</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {SECTION_ORDER.map(section => {
          const abilities = ae[section];
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
                    <div style={{flex:1}}>
                      <div style={{color: bucketUsed ? 'var(--text-dim)' : 'var(--text-primary)',fontWeight:500,fontSize:13}}>Haste Action</div>
                      <div style={{color:'var(--text-dim)',fontSize:11}}>Haste · Attack, Dash, Disengage, Hide, or Use an Object only</div>
                      {bucketUsed && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                    </div>
                    <button className="btn btn-sm" onClick={() => markBucket('Haste')} disabled={bucketUsed} style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                      USE
                    </button>
                  </div>
                );
              })()}
              {abilities.map((ability, i) => {
                const uses = getUses(ability);
                const depleted = uses && uses.current <= 0;
                const isCastSpell = ability.cost_type === 'cast_spell';
                const isTuck = !isCastSpell && !!features[ability.tracker_key]?.spell_picker;
                const bucket = bucketForAbility(ability, section);
                const bucketUsed = isBucketUsed(bucket);
                const unavailable = depleted || bucketUsed;
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',background: unavailable ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: unavailable ? 0.5 : 1,gap:8}}>
                    <div style={{flex:1,cursor: (ability.description || isTuck) ? 'pointer' : 'default'}} onClick={() => { if (isTuck) setTuckTarget({ ability, section }); else if (ability.description) setDetail(ability); }}>
                      <div style={{color: unavailable ? 'var(--text-dim)' : 'var(--text-primary)',fontWeight:500,fontSize:13,textDecoration: depleted ? 'line-through' : 'none'}}>
                        {isTuck ? '🃏 ' : ''}{ability.name}
                      </div>
                      {ability.source && <div style={{color:'var(--text-dim)',fontSize:11}}>{ability.source}</div>}
                      {isTuck && features[ability.tracker_key]?.tucked_spell && (
                        <div style={{color:'var(--accent-light)',fontSize:11}}>Tucked: {features[ability.tracker_key].tucked_spell}</div>
                      )}
                      {bucketUsed && !depleted && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                    </div>
                    {uses && <div style={{color: uses.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{uses.current}/{uses.max}</div>}
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
                    {!isCastSpell && !isTuck && ability.tracker_key && !depleted && (
                      <button className="btn btn-sm" onClick={() => handleUse(ability, section)} disabled={bucketUsed}
                        style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                        USE
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {detail    && <AbilityDetailModal ability={detail} onClose={() => setDetail(null)} />}
      {showCustom && <CustomAbilityModal onClose={() => setCustom(false)} />}
      {castingSpell && (
        <CastSpellPickerModal bucket={castingBucket} onClose={() => { setCastingSpell(false); setCastingBucket(null); }} />
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
    </div>
  );
}
