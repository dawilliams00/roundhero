import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER, SECTION_COLORS, slotColor } from '../utils/dnd';
import AbilityDetailModal from './AbilityDetailModal';
import CustomAbilityModal from './CustomAbilityModal';
import RestModal from './RestModal';
import RestSummaryModal from './RestSummaryModal';
import CastSpellPickerModal from './CastSpellPickerModal';
import ItemSpellsModal from './ItemSpellsModal';

export default function ActionEconomyTab() {
  const { character, useFeature, useSlot, doRest, saveTrackerData, useItemCharge } = useCharacter();
  const [detail, setDetail]     = useState(null);
  const [showCustom, setCustom] = useState(false);
  const [showRest, setRest]     = useState(false);
  const [restSummary, setRestSummary] = useState(null);
  const [castingSpell, setCastingSpell] = useState(false);
  const [viewingItemSpells, setViewingItemSpells] = useState(null);
  const [turnUsed, setTurnUsed] = useState({ Action: false, 'Bonus Action': false, Reaction: false });

  if (!character) return null;

  const ae       = character.ae_data || {};
  const td       = character.tracker_data || {};
  const features = td.features || {};
  const slots    = td.spell_slots || {};
  const items    = td.inventory?.items || [];
  const chargeItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.charges);
  const inInitiative = !!td.in_initiative;

  const resetTurn = () => setTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false });

  const toggleInitiative = () => {
    saveTrackerData({ ...td, in_initiative: !inInitiative });
    if (inInitiative) resetTurn();
  };

  const markBucket = (cost_type) => {
    if (!inInitiative) return;
    if (['action','cast_spell'].includes(cost_type)) setTurnUsed(p => ({ ...p, Action: true }));
    else if (cost_type === 'bonus_action') setTurnUsed(p => ({ ...p, 'Bonus Action': true }));
    else if (cost_type === 'reaction') setTurnUsed(p => ({ ...p, Reaction: true }));
  };

  const handleUse = async (ability) => {
    if (!ability.tracker_key) return;
    try { await useFeature(ability.tracker_key); } catch {}
    markBucket(ability.cost_type);
  };

  const handleCastClick = () => {
    setCastingSpell(true);
    markBucket('cast_spell');
  };

  const getUses = (ability) => {
    if (!ability.tracker_key) return null;
    const feat = features[ability.tracker_key];
    if (!feat) return null;
    const { current, max } = feat;
    if (max === 0) return null;
    return { current, max };
  };

  const slotLevels = Object.entries(slots).filter(([,s]) => (s.max||0) > 0);

  return (
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',gap:8,padding:'8px 12px',borderBottom:'1px solid var(--border)',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
        <button className="btn btn-sm" onClick={toggleInitiative} style={{background: inInitiative ? 'var(--success)' : 'var(--bg-hover)',color: inInitiative ? '#fff' : 'var(--text-secondary)',fontWeight:600}}>
          {inInitiative ? '⚔ In Initiative' : 'Not in Initiative'}
        </button>
        {inInitiative && (
          <div style={{display:'flex',gap:4}}>
            {['Action','Bonus Action','Reaction'].map(s => (
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
        <button className="btn btn-secondary btn-sm" onClick={() => setRest(true)}>Rest</button>
        <button className="btn btn-primary btn-sm" onClick={() => setCustom(true)}>+ Custom</button>
      </div>

      {slotLevels.length > 0 && (
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',flexShrink:0}}>
          <span style={{color:'var(--text-dim)',fontSize:11,minWidth:40}}>Slots:</span>
          {slotLevels.map(([lvl, slot]) => (
            <button key={lvl} onClick={() => useSlot(parseInt(lvl))} disabled={slot.current<=0}
              style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:12,
                background: slot.current > 0 ? `var(--slot-${lvl})` : 'var(--border)',
                color: slot.current > 0 ? '#fff' : 'var(--text-dim)',
                border:'none',fontSize:12,fontWeight:500,opacity: slot.current<=0 ? 0.5 : 1}}>
              L{lvl} {slot.current}/{slot.max}
            </button>
          ))}
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',padding:'0 0 16px'}}>
        {chargeItems.length > 0 && (
          <div>
            <div style={{padding:'6px 12px',background:'#5d4037',fontSize:11,fontWeight:600,color:'#fff',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
              ITEMS
            </div>
            {chargeItems.map(({it, idx}) => (
              <div key={idx} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>recharges {it.charges.recharge?.replace('_',' ')}</div>
                </div>
                <div style={{color: it.charges.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{it.charges.current}/{it.charges.max}</div>
                {it.granted_spells?.length > 0 ? (
                  <button className="btn btn-sm" style={{background:'var(--accent)',color:'#fff'}} onClick={() => setViewingItemSpells(idx)}>✨</button>
                ) : (
                  <>
                    <button className="btn btn-sm" disabled={it.charges.current<=0} style={{background:'var(--danger)',color:'#fff'}} onClick={() => useItemCharge(idx,-1)}>−</button>
                    <button className="btn btn-sm" disabled={it.charges.current>=it.charges.max} style={{background:'var(--success)',color:'#fff'}} onClick={() => useItemCharge(idx,1)}>+</button>
                  </>
                )}
              </div>
            ))}
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
              {abilities.map((ability, i) => {
                const uses = getUses(ability);
                const depleted = uses && uses.current <= 0;
                const isCastSpell = ability.cost_type === 'cast_spell';
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',background: depleted ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: depleted ? 0.6 : 1,gap:8}}>
                    <div style={{flex:1,cursor: ability.description ? 'pointer' : 'default'}} onClick={() => ability.description && setDetail(ability)}>
                      <div style={{color: depleted ? 'var(--text-dim)' : 'var(--text-primary)',fontWeight:500,fontSize:13,textDecoration: depleted ? 'line-through' : 'none'}}>
                        {ability.name}
                      </div>
                      {ability.source && <div style={{color:'var(--text-dim)',fontSize:11}}>{ability.source}</div>}
                    </div>
                    {uses && <div style={{color: uses.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{uses.current}/{uses.max}</div>}
                    {isCastSpell && (
                      <button className="btn btn-sm" onClick={handleCastClick} style={{background:'var(--accent)',color:'#fff',minWidth:36}}>
                        CAST
                      </button>
                    )}
                    {!isCastSpell && ability.tracker_key && !depleted && (
                      <button className="btn btn-sm" onClick={() => handleUse(ability)}
                        style={{background: depleted ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
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
      {showRest   && (
        <RestModal onClose={() => setRest(false)} onRest={async (type) => {
          const result = await doRest(type);
          resetTurn();
          setRest(false);
          setRestSummary({ summary: result.summary, restType: type });
        }} />
      )}
      {restSummary && (
        <RestSummaryModal summary={restSummary.summary} restType={restSummary.restType} onClose={() => setRestSummary(null)} />
      )}
      {castingSpell && <CastSpellPickerModal onClose={() => setCastingSpell(false)} />}
      {viewingItemSpells !== null && (
        <ItemSpellsModal
          item={items[viewingItemSpells]}
          onCast={(chargeCost) => useItemCharge(viewingItemSpells, -chargeCost)}
          onClose={() => setViewingItemSpells(null)}
        />
      )}
    </div>
  );
}
