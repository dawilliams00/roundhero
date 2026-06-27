import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { effectiveAbilityScores, weaponAbilityMod, weaponItemBonus, weaponDamageDice, profBonus, rollD20, rollDamageDetailed, modifier } from '../utils/dnd';

// Equipment.json weapon damage strings are always plain "NdM" (or, for things like
// the Blowgun, a flat "1") - no inline "+N" the way some spell damage_dice has.
const parseDice = (diceStr) => {
  const m = String(diceStr || '').match(/^(\d+)d(\d+)$/);
  if (m) return { count: parseInt(m[1]), sides: parseInt(m[2]) };
  const flat = parseInt(diceStr);
  return { count: 0, sides: 0, flat: isNaN(flat) ? 0 : flat };
};

export default function WeaponAttackModal({ itemIndex, onClose, attacksUsed, maxAttacks, onAttack }) {
  const { character, saveTrackerData, useSlot } = useCharacter();
  const [attackResult, setAttackResult] = useState(null);
  const [damageResult, setDamageResult] = useState(null);
  const [smiteOn, setSmiteOn] = useState(false);
  const [smiteLevel, setSmiteLevel] = useState(null);
  const [smiteVsUndeadFiend, setSmiteVsUndeadFiend] = useState(false);
  // Rolling Attack and rolling Damage both represent the SAME swing if done together -
  // only the first of either should count against Extra Attack, so clicking both for one
  // hit doesn't burn two attacks. Reroll buttons never count - they're correcting the
  // same swing, not adding a new one.
  const [thisAttackCounted, setThisAttackCounted] = useState(false);
  const [smiteApplied, setSmiteApplied] = useState(false);

  if (!character) return null;
  const td = character.tracker_data || {};
  const items = td.inventory?.items || [];
  const weapon = items[itemIndex];
  if (!weapon) return null;
  const attacksExhausted = td.in_initiative && attacksUsed >= maxAttacks;

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

  const toggleTwoHanded = () => {
    const newItems = items.map((it, i) => i === itemIndex ? { ...it, two_handed: !it.two_handed } : it);
    saveTrackerData({ ...td, inventory: { ...td.inventory, items: newItems } });
  };

  const rollAttack = () => {
    if (!thisAttackCounted) { onAttack(); setThisAttackCounted(true); }
    const d20 = rollD20();
    setAttackResult({ d20, mod: attackMod, total: d20 + attackMod });
  };

  const rerollAttack = () => {
    const d20 = rollD20();
    setAttackResult({ d20, mod: attackMod, total: d20 + attackMod });
  };

  // 2d8 radiant, +1d8 per slot level above 1st (capped at 5d8 total), +1d8 more vs
  // undead/fiends - shown live as the level/checkbox change, so unchecking "I'll roll
  // myself" still leaves the player knowing exactly what to roll by hand.
  const smitePreview = () => {
    if (!smiteOn || !smiteLevel) return null;
    const count = Math.min(5, 2 + (smiteLevel - 1)) + (smiteVsUndeadFiend ? 1 : 0);
    return `${count}d8 radiant (spends a level ${smiteLevel} slot)`;
  };

  const buildDamage = () => {
    const dice = weaponDamageDice(weapon);
    const { count, sides, flat } = parseDice(dice.damage_dice);
    return { count, sides, bonus: (flat || 0) + abilityMod + itemBonus.damage, damage_type: dice.damage_type };
  };

  // A bonus damage component (Vicious's extra 2d6, or a different-typed bonus die like
  // Flame Tongue's fire damage) rolls and displays separately from the base damage rather
  // than folding into one combined number - lets a weapon with a different-typed bonus
  // die actually show both types instead of collapsing them into the base type.
  const buildBonusDamage = () => {
    if (!weapon.bonus_damage_dice) return null;
    const { count, sides, flat } = parseDice(weapon.bonus_damage_dice);
    if (!count && !flat) return null;
    return { count, sides, bonus: flat || 0, damage_type: weapon.bonus_damage_type || weaponDamageDice(weapon).damage_type };
  };

  // 2d8 radiant, +1d8 per slot level above 1st (capped at 5d8 total), +1d8 more vs
  // undead/fiends - RAW Divine Smite. The slot is spent here, when damage is first
  // rolled, not just when the checkbox is ticked (so unchecking/closing without rolling
  // never costs a slot). Rerolling reuses the already-spent smite's dice spec instead of
  // calling this again, so clicking Reroll never spends a second slot.
  const rollDamageNow = async () => {
    if (!thisAttackCounted) { onAttack(); setThisAttackCounted(true); }
    const dmg = rollDamageDetailed(buildDamage());
    const extraSpec = buildBonusDamage();
    const extra = extraSpec ? { ...extraSpec, ...rollDamageDetailed(extraSpec) } : null;
    let smite = null;
    if (smiteOn && smiteLevel) {
      if (!smiteApplied) { await useSlot(smiteLevel); setSmiteApplied(true); }
      const count = Math.min(5, 2 + (smiteLevel - 1)) + (smiteVsUndeadFiend ? 1 : 0);
      const smiteSpec = { count, sides: 8, bonus: 0, damage_type: 'Radiant' };
      smite = { ...smiteSpec, ...rollDamageDetailed(smiteSpec) };
    }
    setDamageResult({ ...buildDamage(), ...dmg, extra, smite });
  };

  const rerollDamage = () => {
    const dmg = rollDamageDetailed(buildDamage());
    const extraSpec = buildBonusDamage();
    const extra = extraSpec ? { ...extraSpec, ...rollDamageDetailed(extraSpec) } : null;
    const smite = damageResult.smite ? { ...damageResult.smite, ...rollDamageDetailed(damageResult.smite) } : null;
    setDamageResult({ ...buildDamage(), ...dmg, extra, smite });
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
            <div><b>Damage:</b> {weaponDamageDice(weapon).damage_dice} {(abilityMod + itemBonus.damage) !== 0 ? `${(abilityMod + itemBonus.damage) >= 0 ? '+' : ''}${abilityMod + itemBonus.damage} ` : ''}{weaponDamageDice(weapon).damage_type}{weapon.bonus_damage_dice ? ` + ${weapon.bonus_damage_dice} ${weapon.bonus_damage_type || weaponDamageDice(weapon).damage_type}` : ''}</div>
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
              {smitePreview() && (
                <div style={{color:'var(--accent-light)',fontSize:12,marginTop:8}}>Roll: {smitePreview()}</div>
              )}
            </div>
          )}

          {attacksExhausted && (
            <div style={{color:'var(--warning)',fontSize:12,marginBottom:12}}>No attacks remaining this turn ({attacksUsed}/{maxAttacks} used).</div>
          )}

          {attackResult != null && (
            <div style={{background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center',marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Attack Roll</div>
              <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{attackResult.total}</div>
              <div style={{color:'var(--text-dim)',fontSize:11}}>d20: {attackResult.d20} {attackResult.mod>=0?'+':''}{attackResult.mod}</div>
              <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={rerollAttack}>Reroll</button>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{flexDirection:'column'}}>
          {damageResult ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                {damageResult.damage_type} damage{damageResult.extra ? ` + ${damageResult.extra.damage_type}` : ''}{damageResult.smite ? ` + Divine Smite` : ''}
              </div>
              <div style={{display:'flex',gap:20,justifyContent:'center',flexWrap:'wrap'}}>
                <div>
                  <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.total}</div>
                  <div style={{color:'var(--text-dim)',fontSize:10}}>{damageResult.damage_type} · [{damageResult.rolls.join(', ')}] {damageResult.bonus>=0?'+':''}{damageResult.bonus}</div>
                </div>
                {damageResult.extra && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.extra.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>{damageResult.extra.damage_type} · [{damageResult.extra.rolls.join(', ')}]</div>
                  </div>
                )}
                {damageResult.smite && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.smite.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>Radiant · [{damageResult.smite.rolls.join(', ')}]</div>
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
                <button className="btn btn-primary" style={{flex:1}} disabled={attacksExhausted} onClick={rollAttack}>Roll Attack</button>
                <button className="btn btn-primary" style={{flex:1}} disabled={attacksExhausted} onClick={rollDamageNow}>Roll Damage?</button>
              </div>
              {td.in_initiative && (
                <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} disabled={attacksExhausted} onClick={async () => {
                  if (smiteOn && smiteLevel && !smiteApplied) { await useSlot(smiteLevel); setSmiteApplied(true); }
                  onAttack();
                }}>
                  ✓ I'll roll in person - log an attack{smitePreview() ? ` (+ spend smite slot)` : ''}
                </button>
              )}
              <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
