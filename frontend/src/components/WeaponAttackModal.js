import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { effectiveAbilityScores, weaponAbilityMod, weaponItemBonus, weaponDamageDice, profBonus, rollD20, rollDamage, modifier } from '../utils/dnd';

// Equipment.json weapon damage strings are always plain "NdM" (or, for things like
// the Blowgun, a flat "1") - no inline "+N" the way some spell damage_dice has.
const parseDice = (diceStr) => {
  const m = String(diceStr || '').match(/^(\d+)d(\d+)$/);
  if (m) return { count: parseInt(m[1]), sides: parseInt(m[2]) };
  const flat = parseInt(diceStr);
  return { count: 0, sides: 0, flat: isNaN(flat) ? 0 : flat };
};

export default function WeaponAttackModal({ itemIndex, onClose }) {
  const { character, saveTrackerData, setTurnUsed, useSlot } = useCharacter();
  const [attackResult, setAttackResult] = useState(null);
  const [damageResult, setDamageResult] = useState(null);
  const [smiteOn, setSmiteOn] = useState(false);
  const [smiteLevel, setSmiteLevel] = useState(null);
  const [smiteVsUndeadFiend, setSmiteVsUndeadFiend] = useState(false);

  if (!character) return null;
  const td = character.tracker_data || {};
  const items = td.inventory?.items || [];
  const weapon = items[itemIndex];
  if (!weapon) return null;

  // Divine Smite isn't a separate charge pool - it just spends a real spell slot on a
  // melee hit, so any character with the feature (manually-built Paladins always get it
  // at level 2+; PDF-imported ones if the sheet's Features & Traits printed it by this
  // exact name) and an available slot can offer it here, in the same flow as rolling
  // damage, rather than needing its own resource-tracking mechanism.
  const hasSmite = !!td.features?.['Divine Smite'] && weapon.weapon_range !== 'Ranged';
  const smiteSlotLevels = Object.entries(td.spell_slots || {})
    .filter(([,s]) => (s.current||0) > 0).map(([lvl]) => parseInt(lvl)).sort((a,b)=>a-b);

  const effAb = effectiveAbilityScores(character.ability_scores, items);
  const abilityMod = weaponAbilityMod(weapon, effAb);
  const itemBonus = weaponItemBonus(weapon);
  const prof = profBonus(character.level);
  const profPart = weapon.proficient ? prof : 0;
  const attackMod = abilityMod + profPart + itemBonus.attack;
  const isVersatile = (weapon.properties || []).includes('Versatile') && weapon.two_handed_damage;
  const abilityLabel = (weapon.properties || []).includes('Finesse')
    ? (modifier(effAb.STR || 10) >= modifier(effAb.DEX || 10) ? 'STR' : 'DEX')
    : (weapon.weapon_range === 'Ranged' ? 'DEX' : 'STR');

  const markBucket = () => {
    if (!td.in_initiative) return;
    setTurnUsed(p => ({ ...p, Action: true }));
  };

  const toggleTwoHanded = () => {
    const newItems = items.map((it, i) => i === itemIndex ? { ...it, two_handed: !it.two_handed } : it);
    saveTrackerData({ ...td, inventory: { ...td.inventory, items: newItems } });
  };

  const rollAttack = () => {
    markBucket();
    setAttackResult(rollD20() + attackMod);
  };

  const buildDamage = () => {
    const dice = weaponDamageDice(weapon);
    const { count, sides, flat } = parseDice(dice.damage_dice);
    return { count, sides, bonus: (flat || 0) + abilityMod + itemBonus.damage, damage_type: dice.damage_type };
  };

  // 2d8 radiant, +1d8 per slot level above 1st (capped at 5d8 total), +1d8 more vs
  // undead/fiends - RAW Divine Smite. The slot is spent here, when damage is first
  // rolled, not just when the checkbox is ticked (so unchecking/closing without rolling
  // never costs a slot). Rerolling reuses the already-spent smite's dice spec instead of
  // calling this again, so clicking Reroll never spends a second slot.
  const rollDamageNow = async () => {
    const dmg = buildDamage();
    const total = rollDamage(dmg);
    let smite = null;
    if (smiteOn && smiteLevel) {
      await useSlot(smiteLevel);
      const count = Math.min(5, 2 + (smiteLevel - 1)) + (smiteVsUndeadFiend ? 1 : 0);
      smite = { count, sides: 8, bonus: 0, damage_type: 'Radiant' };
      smite.total = rollDamage(smite);
    }
    setDamageResult({ ...dmg, total, smite });
  };

  const rerollDamage = () => {
    const dmg = buildDamage();
    const total = rollDamage(dmg);
    const smite = damageResult.smite ? { ...damageResult.smite, total: rollDamage(damageResult.smite) } : null;
    setDamageResult({ ...dmg, total, smite });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{weapon.name}</h2>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'var(--text-dim)',border:'1px solid var(--border-light)',borderRadius:8,padding:'2px 8px'}}>{weapon.weapon_category} · {weapon.weapon_range}</span>
            {(weapon.properties||[]).map(p => (
              <span key={p} style={{fontSize:11,color:'var(--accent-light)',border:'1px solid var(--accent-light)',borderRadius:8,padding:'2px 8px'}}>{p}</span>
            ))}
          </div>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
            <div><b>Attack:</b> {attackMod>=0?'+':''}{attackMod} ({abilityLabel} {abilityMod>=0?'+':''}{abilityMod}{weapon.proficient ? `, +${prof} prof` : ', not proficient'}{itemBonus.attack ? `, +${itemBonus.attack} item` : ''})</div>
            <div><b>Damage:</b> {weaponDamageDice(weapon).damage_dice} {weaponDamageDice(weapon).damage_type}{itemBonus.damage ? ` +${itemBonus.damage}` : ''}</div>
          </div>

          {isVersatile && (
            <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:12,fontSize:13,color:'var(--text-secondary)'}}>
              <input type="checkbox" checked={!!weapon.two_handed} onChange={toggleTwoHanded} />
              Wielding two-handed ({weapon.two_handed_damage.damage_dice} {weapon.two_handed_damage.damage_type})
            </label>
          )}

          {hasSmite && (
            <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:12}}>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-secondary)'}}>
                <input type="checkbox" checked={smiteOn} onChange={e => { setSmiteOn(e.target.checked); if (e.target.checked && !smiteLevel) setSmiteLevel(smiteSlotLevels[0]); }} disabled={smiteSlotLevels.length===0} />
                ✨ Divine Smite{smiteSlotLevels.length===0 ? ' (no spell slots available)' : ''}
              </label>
              {smiteOn && smiteSlotLevels.length > 0 && (
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8,flexWrap:'wrap'}}>
                  <span style={{color:'var(--text-dim)',fontSize:12}}>Spend slot level:</span>
                  <select value={smiteLevel || ''} onChange={e => setSmiteLevel(parseInt(e.target.value))}>
                    {smiteSlotLevels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-secondary)'}}>
                    <input type="checkbox" checked={smiteVsUndeadFiend} onChange={e => setSmiteVsUndeadFiend(e.target.checked)} />
                    vs undead/fiend (+1d8)
                  </label>
                </div>
              )}
            </div>
          )}

          {attackResult != null && (
            <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center',marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Attack Roll</div>
              <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{attackResult}</div>
              <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={rollAttack}>Reroll</button>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{flexDirection:'column'}}>
          {damageResult ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                {damageResult.damage_type} damage{damageResult.smite ? ` + Divine Smite` : ''}
              </div>
              <div style={{display:'flex',gap:20,justifyContent:'center'}}>
                <div>
                  <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.total}</div>
                  {damageResult.smite && <div style={{color:'var(--text-dim)',fontSize:10}}>{damageResult.damage_type}</div>}
                </div>
                {damageResult.smite && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.smite.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>Radiant</div>
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={rerollDamage}>Reroll</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{display:'flex',gap:8,width:'100%'}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={rollAttack}>Roll Attack</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={rollDamageNow}>Roll Damage?</button>
              </div>
              <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
