import React, { useEffect, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { effectiveAbilityScores, weaponAbilityMod, weaponItemBonus, weaponDamageDice, profBonus, rollD20, rollDamageDetailed, modifier, cantripHitBonusForLevel, fightingStyleBonus, featWeaponBonus, featBuffItems, raceBuffItems, hybridFormWeaponBonus } from '../utils/dnd';

// Equipment.json weapon damage strings are always plain "NdM" (or, for things like
// the Blowgun, a flat "1") - no inline "+N" the way some spell damage_dice has.
const parseDice = (diceStr) => {
  const m = String(diceStr || '').match(/^(\d+)d(\d+)$/);
  if (m) return { count: parseInt(m[1]), sides: parseInt(m[2]) };
  const flat = parseInt(diceStr);
  return { count: 0, sides: 0, flat: isNaN(flat) ? 0 : flat };
};

export default function WeaponAttackModal({ itemIndex, weaponOverride, onClose, attacksUsed, maxAttacks, onAttack, cantripSpell }) {
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
  const [unarmedChoice, setUnarmedChoice] = useState(null);
  // "I'll roll in person" + a heal-or-advantage item skips the digital damage roll
  // entirely - the player rolls the bonus dice themselves, so this just asks for the
  // result they got (to apply as healing) instead of rolling it for them.
  const [manualHealAdvOpen, setManualHealAdvOpen] = useState(false);
  const [manualHealAmount, setManualHealAmount] = useState('');
  const [encounterTargets, setEncounterTargets] = useState([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [resolvingTarget, setResolvingTarget] = useState(false);
  const [encounterResolution, setEncounterResolution] = useState(null);
  // "I'll roll in person" against an encounter target still needs both numbers (the
  // backend compares attack total to a hidden AC, so the app can't skip asking) - this
  // drives that two-step manual entry instead of the old single-click shortcut.
  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [manualAttackTotal, setManualAttackTotal] = useState('');
  const [manualAttackSubmitted, setManualAttackSubmitted] = useState(false);
  const [manualDamageTotal, setManualDamageTotal] = useState('');

  useEffect(() => {
    if (!character?.id) return;
    let cancelled = false;
    api.get(`/campaigns/player-view/${character.id}`, { suppressGlobalError: true })
      .then(r => {
        if (cancelled) return;
        const targets = [];
        (r.data || []).forEach(view => {
          const sourceIds = (view.source_combatant_ids || []).map(String);
          (view.encounters || []).filter(enc => enc.status === 'running').forEach(enc => {
            (enc.combatants || []).forEach(row => {
              if (row.dead || sourceIds.includes(String(row.id))) return;
              targets.push({
                key: `${view.id}:${enc.id}:${row.id}`,
                campaignId: view.id,
                encounterId: enc.id,
                targetId: row.id,
                label: `${enc.name}: ${row.name}${row.type === 'enemy' ? ' (enemy)' : ''}`,
              });
            });
          });
        });
        setEncounterTargets(targets);
        setSelectedTargetKey(current => current || targets[0]?.key || '');
      })
      .catch(() => {
        if (!cancelled) setEncounterTargets([]);
      });
    return () => { cancelled = true; };
  }, [character?.id]);

  if (!character) return null;
  const td = character.tracker_data || {};
  const items = td.inventory?.items || [];
  // weaponOverride is a virtual, non-inventory "weapon" (currently just Unarmed Strike) -
  // itemIndex stays meaningless for it, which is fine since the only itemIndex-dependent
  // feature (Versatile two-handed toggle) never applies to something with no inventory row.
  const weapon = weaponOverride || items[itemIndex];
  if (!weapon) return null;
  // attacksUsed is LIVE from the parent and already reflects the +1 this modal's own
  // onAttack() just caused (thisAttackCounted) - without the thisAttackCounted escape
  // hatch, clicking Roll Attack as your last attack would immediately disable Roll
  // Damage for that exact same swing, before you ever got to finish resolving it.
  const attacksExhausted = td.in_initiative && attacksUsed >= maxAttacks && !thisAttackCounted;

  // Divine Smite isn't a separate charge pool - it just spends a real spell slot on a
  // melee hit, so any character with the feature (manually-built Paladins always get it
  // at level 2+; PDF-imported ones if the sheet's Features & Traits printed it by this
  // exact name) and an available slot can offer it here, in the same flow as rolling
  // damage, rather than needing its own resource-tracking mechanism.
  const hasSmite = !!td.features?.['Divine Smite'] && weapon.weapon_range !== 'Ranged';
  const smiteSlotLevels = Object.entries(td.spell_slots || {})
    .filter(([,s]) => (s.current||0) > 0).map(([lvl]) => parseInt(lvl)).sort((a,b)=>a-b);

  // Feat-granted ability score buffs (Set To/Add To, via the same Modifiers editor items
  // use) still apply to weapon attacks. A feat can now also grant a flat
  // weapon_attack_modifier/weapon_damage_modifier that applies to EVERY weapon (unlike an
  // item's own copy of those, which stays tied to that one weapon - see featWeaponBonus).
  const effAb = effectiveAbilityScores(character.ability_scores, [...items, ...featBuffItems(td.features), ...raceBuffItems(character.race)]);
  const abilityMod = weaponAbilityMod(weapon, effAb);
  const itemBonus = weaponItemBonus(weapon);
  const featBonus = featWeaponBonus(td.features);
  // Fighting Styles (Dueling/Archery) don't apply to the virtual Unarmed Strike "weapon" -
  // RAW Dueling/Archery require an actual weapon, not an unarmed attack.
  const fsBonus = weaponOverride ? { attack: 0, damage: 0 } : fightingStyleBonus(td.features, weapon);
  // Feral Might's melee damage bonus applies to a real wielded weapon too, but skipped
  // here for the virtual Unarmed Strike - that one already carries its own
  // weapon_attack_modifier/weapon_damage_modifier buffs (see ActionEconomyTab.js), which
  // itemBonus above already picks up, so adding this too would double-count it.
  const hybridBonus = weaponOverride ? { attack: 0, damage: 0 } : hybridFormWeaponBonus(td, character.class_name, character.level, weapon);
  const prof = profBonus(character.level);
  const profPart = weapon.proficient ? prof : 0;
  const attackMod = abilityMod + profPart + itemBonus.attack + fsBonus.attack + featBonus.attack + hybridBonus.attack;
  const isVersatile = (weapon.properties || []).includes('Versatile') && weapon.two_handed_damage;
  const abilityLabel = (weapon.properties || []).includes('Finesse')
    ? (modifier(effAb.STR || 10) >= modifier(effAb.DEX || 10) ? 'STR' : 'DEX')
    : (weapon.weapon_range === 'Ranged' ? 'DEX' : 'STR');

  const toggleTwoHanded = () => {
    const newItems = items.map((it, i) => i === itemIndex ? { ...it, two_handed: !it.two_handed } : it);
    saveTrackerData({ ...td, inventory: { ...td.inventory, items: newItems } });
  };

  // Encounter target is picked BEFORE anything is rolled - the player needs to know who
  // they're attacking for a hit/miss result to mean anything, and the target's AC stays
  // hidden server-side rather than being computed client-side. Once an attack roll has
  // gone out against a target, the target picker locks (see the dropdown's `disabled`
  // below) so a mid-swing target swap can't desync the attack roll from the damage roll.
  const selectedTarget = encounterTargets.find(row => row.key === selectedTargetKey);

  const damageComponentsFor = (result) => {
    if (!result) return [];
    const components = [{ amount: result.total || 0, damage_type: result.damage_type }];
    ['extra', 'cantrip', 'smite'].forEach(key => {
      if (result[key]) components.push({ amount: result[key].total || 0, damage_type: result[key].damage_type });
    });
    return components;
  };

  // Attack-phase resolve: sends only the attack total, no damage - the backend compares
  // it against the target's hidden AC and reports hit/miss without touching HP yet.
  const resolveAttackAgainstTarget = async (attackTotal) => {
    if (!selectedTarget) return null;
    setResolvingTarget(true);
    setEncounterResolution(null);
    try {
      const r = await api.post(`/campaigns/${selectedTarget.campaignId}/encounters/${selectedTarget.encounterId}/resolve`, {
        source_character_id: character.id,
        target_id: selectedTarget.targetId,
        label: weapon.name,
        mode: 'attack',
        attack_total: attackTotal,
      }, { suppressGlobalError: true });
      setEncounterResolution(r.data.resolution);
      return r.data.resolution;
    } catch (err) {
      const res = { error: err.response?.data?.error || 'Could not resolve against encounter target.' };
      setEncounterResolution(res);
      return res;
    } finally {
      setResolvingTarget(false);
    }
  };

  // Damage-phase resolve: same attack total (so the backend's hit determination matches
  // what was already shown), now with damage components attached so HP actually changes.
  // Called automatically the moment damage is rolled/entered - there's no separate
  // "now go pick a target and click Resolve" step anymore, since the target was already
  // locked in before the attack roll.
  const applyDamageToTarget = async (attackTotal, result) => {
    if (!selectedTarget) return null;
    setResolvingTarget(true);
    try {
      const r = await api.post(`/campaigns/${selectedTarget.campaignId}/encounters/${selectedTarget.encounterId}/resolve`, {
        source_character_id: character.id,
        target_id: selectedTarget.targetId,
        label: weapon.name,
        mode: 'attack',
        attack_total: attackTotal ?? '',
        damage_components: damageComponentsFor(result),
      }, { suppressGlobalError: true });
      setEncounterResolution(r.data.resolution);
      return r.data.resolution;
    } catch (err) {
      setEncounterResolution({ error: err.response?.data?.error || 'Could not apply damage to encounter target.' });
      return null;
    } finally {
      setResolvingTarget(false);
    }
  };

  const rollAttack = async () => {
    if (!thisAttackCounted) { onAttack(); setThisAttackCounted(true); }
    const d20 = rollD20();
    const total = d20 + attackMod;
    setAttackResult({ d20, mod: attackMod, total });
    if (selectedTarget) await resolveAttackAgainstTarget(total);
  };

  const rerollAttack = async () => {
    const d20 = rollD20();
    const total = d20 + attackMod;
    setAttackResult({ d20, mod: attackMod, total });
    if (selectedTarget) await resolveAttackAgainstTarget(total);
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
    return { count, sides, bonus: (flat || 0) + abilityMod + itemBonus.damage + fsBonus.damage + featBonus.damage + hybridBonus.damage, damage_type: dice.damage_type };
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

  // A weapon-attack cantrip (Booming Blade, Green-Flame Blade, etc.) cast through here -
  // its on-hit bonus damage rolls as a third, independent component, same pattern as the
  // weapon's own bonus dice. cantrip_hit_bonus_by_level (character-level tiers, e.g.
  // Booming Blade's 1d8/2d8/3d8 at 5th/11th/17th) takes priority when present since it's
  // the correct RAW mechanic for these specific cantrips; falls back to a plain
  // damage_dice field for anything simpler. Delayed-trigger/second-target effects (the
  // "if it moves" rider, Green-Flame Blade's second creature) aren't auto-applied here -
  // those need target/condition tracking this app doesn't have, and are shown as a
  // reminder banner instead for the player to apply by hand.
  const buildCantripDamage = () => {
    if (!cantripSpell) return null;
    const tieredDice = cantripHitBonusForLevel(cantripSpell.cantrip_hit_bonus_by_level, character.level);
    const diceStr = tieredDice || cantripSpell.damage_dice;
    if (!diceStr) return null;
    const { count, sides, flat } = parseDice(diceStr);
    if (!count && !flat) return null;
    // Ferocious Strike (and any cantrip with no fixed damage_type) deals its bonus damage
    // as the same type as the weapon's own damage, not a fixed elemental type.
    return { count, sides, bonus: flat || 0, damage_type: cantripSpell.damage_type || weaponDamageDice(weapon).damage_type };
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
    const cantripSpec = buildCantripDamage();
    const cantrip = cantripSpec ? { ...cantripSpec, ...rollDamageDetailed(cantripSpec) } : null;
    let smite = null;
    if (smiteOn && smiteLevel) {
      if (!smiteApplied) { await useSlot(smiteLevel); setSmiteApplied(true); }
      const count = Math.min(5, 2 + (smiteLevel - 1)) + (smiteVsUndeadFiend ? 1 : 0);
      const smiteSpec = { count, sides: 8, bonus: 0, damage_type: 'Radiant' };
      smite = { ...smiteSpec, ...rollDamageDetailed(smiteSpec) };
    }
    const result = { ...buildDamage(), ...dmg, extra, cantrip, smite };
    setDamageResult(result);
    // Fires immediately, not read from `damageResult` state - state set above hasn't
    // committed yet in this tick, and reading it here would silently apply zero/stale
    // damage (the exact stale-closure bug class this codebase has hit before).
    if (selectedTarget) await applyDamageToTarget(attackResult?.total, result);
  };

  // Consolidated "what to roll" checklist - shown whether or not the player ends up
  // using the digital roll, so picking "I'll roll in person" still leaves them knowing
  // exactly which dice and damage types apply instead of having to piece it together
  // from the separate Attack/Damage/cantrip/smite lines above.
  const damageComponentsPreview = () => {
    const list = [];
    const base = buildDamage();
    list.push({ label: 'Weapon', dice: `${base.count}d${base.sides}${base.bonus ? ` ${base.bonus>=0?'+':''}${base.bonus}` : ''}`, type: base.damage_type });
    const extra = buildBonusDamage();
    if (extra) list.push({ label: 'Bonus', dice: `${extra.count}d${extra.sides}${extra.bonus ? ` +${extra.bonus}` : ''}`, type: extra.damage_type });
    const cantrip = buildCantripDamage();
    if (cantrip) list.push({ label: cantripSpell.name, dice: `${cantrip.count}d${cantrip.sides}`, type: cantrip.damage_type });
    if (smiteOn && smiteLevel) {
      const count = Math.min(5, 2 + (smiteLevel - 1)) + (smiteVsUndeadFiend ? 1 : 0);
      list.push({ label: 'Divine Smite', dice: `${count}d8`, type: 'Radiant' });
    }
    return list;
  };

  // Rerolling after damage has already been applied to a target would double-apply it
  // (the backend has no "undo the last event" concept) - the button is disabled in that
  // case (see render below), so this only ever runs pre-application.
  const rerollDamage = () => {
    const dmg = rollDamageDetailed(buildDamage());
    const extraSpec = buildBonusDamage();
    const extra = extraSpec ? { ...extraSpec, ...rollDamageDetailed(extraSpec) } : null;
    const cantripSpec = buildCantripDamage();
    const cantrip = cantripSpec ? { ...cantripSpec, ...rollDamageDetailed(cantripSpec) } : null;
    const smite = damageResult.smite ? { ...damageResult.smite, ...rollDamageDetailed(damageResult.smite) } : null;
    setUnarmedChoice(null);
    setDamageResult({ ...buildDamage(), ...dmg, extra, cantrip, smite });
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
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
          {encounterTargets.length > 0 && (
            <div style={{border:'1px solid var(--accent-light)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Encounter Target</div>
              <select
                value={selectedTargetKey}
                onChange={e => { setSelectedTargetKey(e.target.value); setEncounterResolution(null); }}
                disabled={!!attackResult}
                style={{width:'100%'}}
              >
                <option value="">— No target (just roll) —</option>
                {encounterTargets.map(target => <option key={target.key} value={target.key}>{target.label}</option>)}
              </select>
            </div>
          )}

          <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
            <div><b>Attack:</b> {attackMod>=0?'+':''}{attackMod} ({abilityLabel} {abilityMod>=0?'+':''}{abilityMod}{weapon.proficient ? `, +${prof} prof` : ', not proficient'}{itemBonus.attack ? `, +${itemBonus.attack} item` : ''}{fsBonus.attack ? `, +${fsBonus.attack} Archery` : ''}{featBonus.attack ? `, +${featBonus.attack} feat` : ''})</div>
            <div><b>Damage:</b> {weaponDamageDice(weapon).damage_dice} {(abilityMod + itemBonus.damage + fsBonus.damage + featBonus.damage + hybridBonus.damage) !== 0 ? `${(abilityMod + itemBonus.damage + fsBonus.damage + featBonus.damage + hybridBonus.damage) >= 0 ? '+' : ''}${abilityMod + itemBonus.damage + fsBonus.damage + featBonus.damage + hybridBonus.damage} ` : ''}{weaponDamageDice(weapon).damage_type}{weapon.bonus_damage_dice ? ` + ${weapon.bonus_damage_dice} ${weapon.bonus_damage_type || weaponDamageDice(weapon).damage_type}` : ''}{fsBonus.damage ? ` (incl. +${fsBonus.damage} Dueling)` : ''}{featBonus.damage ? ` (incl. +${featBonus.damage} feat)` : ''}{hybridBonus.damage ? ` (incl. +${hybridBonus.damage} Feral Might)` : ''}</div>
          </div>

          {cantripSpell && (() => {
            const tieredDice = cantripHitBonusForLevel(cantripSpell.cantrip_hit_bonus_by_level, character.level);
            const onHitDice = tieredDice || cantripSpell.damage_dice;
            const onHitType = cantripSpell.damage_type || weaponDamageDice(weapon).damage_type;
            return (
              <div style={{border:'1px solid var(--accent-light)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:12}}>
                <div style={{color:'var(--accent-light)',fontWeight:600,fontSize:13,marginBottom:4}}>✨ {cantripSpell.name}{onHitDice ? ` (+${onHitDice} ${onHitType} on hit)` : ' (no on-hit bonus at your level)'}</div>
                {cantripSpell.description && <div style={{color:'var(--text-secondary)',fontSize:12,whiteSpace:'pre-wrap'}}>{cantripSpell.description}</div>}
                {cantripSpell.higher_level && <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}><b>At Higher Levels.</b> {cantripSpell.higher_level}</div>}
              </div>
            );
          })()}

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
              {!attackResult.manual && (
                <div style={{color:'var(--text-dim)',fontSize:11}}>d20: {attackResult.d20} {attackResult.mod>=0?'+':''}{attackResult.mod}</div>
              )}
              {selectedTarget && (
                <div style={{fontSize:13,fontWeight:600,marginTop:6,color: resolvingTarget ? 'var(--text-dim)' : encounterResolution?.error ? 'var(--danger)' : encounterResolution?.hit === false ? 'var(--danger)' : encounterResolution?.hit === true ? 'var(--success)' : 'var(--text-dim)'}}>
                  {resolvingTarget ? 'Checking hit...' : encounterResolution?.error || (encounterResolution?.hit === false ? 'Miss' : encounterResolution?.hit === true ? 'Hit!' : '')}
                </div>
              )}
              <button className="btn btn-secondary btn-sm" style={{marginTop:8}} disabled={!!damageResult} onClick={rerollAttack}>Reroll</button>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{flexDirection:'column'}}>
          {damageResult ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                {damageResult.damage_type} damage{damageResult.extra ? ` + ${damageResult.extra.damage_type}` : ''}{damageResult.cantrip ? ` + ${damageResult.cantrip.damage_type}` : ''}{damageResult.smite ? ` + Divine Smite` : ''}
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
                {damageResult.cantrip && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.cantrip.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>{damageResult.cantrip.damage_type} · [{damageResult.cantrip.rolls.join(', ')}] ({cantripSpell.name})</div>
                  </div>
                )}
                {damageResult.smite && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.smite.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>Radiant · [{damageResult.smite.rolls.join(', ')}]</div>
                  </div>
                )}
              </div>
              {(damageResult.extra || damageResult.cantrip || damageResult.smite) && (
                <div style={{borderTop:'1px solid var(--border)',marginTop:10,paddingTop:8}}>
                  <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Total Damage</div>
                  <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:24}}>
                    {damageResult.total + (damageResult.extra?.total||0) + (damageResult.cantrip?.total||0) + (damageResult.smite?.total||0)}
                  </div>
                </div>
              )}
              {(weapon.bonus_heal_or_advantage || weapon.unarmed_heal_or_advantage) && damageResult.extra && (
                unarmedChoice ? (
                  <div style={{color:'var(--success)',fontSize:12,marginTop:10}}>
                    {unarmedChoice === 'healed' ? `Healed ${damageResult.extra.total} HP.` : 'Advantage on your next roll - remove the chip from the header once used.'}
                  </div>
                ) : (
                  <div style={{borderTop:'1px solid var(--border)',marginTop:10,paddingTop:8}}>
                    <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>Use the {damageResult.extra.total} {damageResult.extra.damage_type} damage to:</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-secondary" style={{flex:1}} onClick={async () => {
                        const hp = td.hp || {};
                        const cap = hp.max_override || hp.max || 0;
                        await saveTrackerData({ ...td, hp: { ...hp, current: Math.min(cap, (hp.current||0) + damageResult.extra.total) } });
                        setUnarmedChoice('healed');
                      }}>Heal {damageResult.extra.total} HP</button>
                      <button className="btn btn-secondary" style={{flex:1}} onClick={async () => {
                        const effects = td.active_effects || [];
                        if (!effects.includes('Advantage (next roll)')) {
                          await saveTrackerData({ ...td, active_effects: [...effects, 'Advantage (next roll)'] });
                        }
                        setUnarmedChoice('advantage');
                      }}>Gain Advantage (next roll)</button>
                    </div>
                  </div>
                )
              )}
              {selectedTarget && (
                <div style={{borderTop:'1px solid var(--border)',marginTop:10,paddingTop:8,textAlign:'left'}}>
                  <div style={{color: resolvingTarget ? 'var(--text-dim)' : encounterResolution?.error ? 'var(--danger)' : 'var(--success)',fontSize:12}}>
                    {resolvingTarget ? 'Applying damage...' : encounterResolution?.error || `${encounterResolution?.hit === false ? 'Miss' : encounterResolution?.hit === true ? 'Hit' : 'Resolved'} · ${encounterResolution?.damage_applied || 0} damage applied to ${selectedTarget.label.split(': ').slice(1).join(': ')}`}
                  </div>
                  {encounterResolution?.error && (
                    <button className="btn btn-secondary btn-sm" style={{marginTop:6}} onClick={() => applyDamageToTarget(attackResult?.total, damageResult)}>Retry</button>
                  )}
                </div>
              )}
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button className="btn btn-secondary" style={{flex:1}} disabled={!!(selectedTarget && encounterResolution && !encounterResolution.error)} onClick={rerollDamage}>Reroll</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={onClose}>Done</button>
              </div>
            </div>
          ) : manualHealAdvOpen ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12}}>
              {unarmedChoice ? (
                <div style={{color:'var(--success)',fontSize:12}}>
                  {unarmedChoice === 'healed' ? `Healed ${manualHealAmount || 0} HP.` : 'Advantage on your next roll - remove the chip from the header once used.'}
                </div>
              ) : (
                <>
                  <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8,textAlign:'center'}}>
                    Roll your {weapon.bonus_damage_dice} {weapon.bonus_damage_type || weaponDamageDice(weapon).damage_type} bonus damage yourself, then:
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
                    <input type="number" placeholder="Amount rolled" value={manualHealAmount} onChange={e => setManualHealAmount(e.target.value)} style={{flex:1}} />
                    <button className="btn btn-secondary" disabled={!manualHealAmount} onClick={async () => {
                      const amt = parseInt(manualHealAmount) || 0;
                      const hp = td.hp || {};
                      const cap = hp.max_override || hp.max || 0;
                      await saveTrackerData({ ...td, hp: { ...hp, current: Math.min(cap, (hp.current||0) + amt) } });
                      setUnarmedChoice('healed');
                    }}>Heal That Much</button>
                  </div>
                  <button className="btn btn-secondary" style={{width:'100%'}} onClick={async () => {
                    const effects = td.active_effects || [];
                    if (!effects.includes('Advantage (next roll)')) {
                      await saveTrackerData({ ...td, active_effects: [...effects, 'Advantage (next roll)'] });
                    }
                    setUnarmedChoice('advantage');
                  }}>Gain Advantage (next roll) Instead</button>
                </>
              )}
              <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
            </div>
          ) : manualLogOpen ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12}}>
              {!manualAttackSubmitted ? (
                <>
                  <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8,textAlign:'center'}}>Roll your attack in person, then enter the total:</div>
                  <div style={{display:'flex',gap:6}}>
                    <input type="number" placeholder="Attack total" value={manualAttackTotal} onChange={e => setManualAttackTotal(e.target.value)} style={{flex:1}} />
                    <button
                      className="btn btn-primary"
                      disabled={!manualAttackTotal || resolvingTarget}
                      onClick={async () => {
                        const total = parseInt(manualAttackTotal);
                        if (isNaN(total)) return;
                        setAttackResult({ d20: null, mod: attackMod, total, manual: true });
                        setManualAttackSubmitted(true);
                        await resolveAttackAgainstTarget(total);
                      }}
                    >Submit</button>
                  </div>
                </>
              ) : encounterResolution?.hit === false ? (
                <div style={{color:'var(--danger)',fontSize:13,textAlign:'center'}}>Miss - no damage to apply.</div>
              ) : !damageResult ? (
                <>
                  {encounterResolution?.error && (
                    <div style={{color:'var(--danger)',fontSize:12,marginBottom:8,textAlign:'center'}}>{encounterResolution.error} You can still enter damage below to retry.</div>
                  )}
                  {encounterResolution && !encounterResolution.error && (
                    <div style={{color:'var(--success)',fontSize:12,marginBottom:8,textAlign:'center'}}>Hit! Now enter damage dealt:</div>
                  )}
                  <div style={{display:'flex',gap:6}}>
                    <input type="number" placeholder="Damage total" value={manualDamageTotal} onChange={e => setManualDamageTotal(e.target.value)} style={{flex:1}} />
                    <button
                      className="btn btn-primary"
                      disabled={!manualDamageTotal || resolvingTarget}
                      onClick={async () => {
                        const total = parseInt(manualDamageTotal);
                        if (isNaN(total)) return;
                        const result = { count: 0, sides: 0, bonus: total, damage_type: weaponDamageDice(weapon).damage_type, total, rolls: [] };
                        setDamageResult(result);
                        await applyDamageToTarget(attackResult?.total, result);
                      }}
                    >Apply</button>
                  </div>
                </>
              ) : (
                <div style={{color: encounterResolution?.error ? 'var(--danger)' : 'var(--success)',fontSize:13,textAlign:'center'}}>
                  {encounterResolution?.error || 'Damage applied.'}
                </div>
              )}
              <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              {!attacksExhausted && (
                <div style={{width:'100%',marginBottom:8}}>
                  <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Damage to Roll</div>
                  {damageComponentsPreview().map((c, i) => (
                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-secondary)'}}>
                      <span>{c.label}</span>
                      <span>{c.dice} {c.type}</span>
                    </div>
                  ))}
                  {selectedTarget && encounterResolution?.hit === false && (
                    <div style={{color:'var(--danger)',fontSize:12,marginTop:4}}>Miss - no damage to roll.</div>
                  )}
                  {selectedTarget && !attackResult && (
                    <div style={{color:'var(--text-dim)',fontSize:12,marginTop:4}}>Roll to attack first to see if this hits.</div>
                  )}
                </div>
              )}
              <div style={{display:'flex',gap:8,width:'100%'}}>
                <button className="btn btn-primary" style={{flex:1}} disabled={attacksExhausted} onClick={rollAttack}>Roll Attack</button>
                <button
                  className="btn btn-primary"
                  style={{flex:1}}
                  disabled={attacksExhausted || !!(selectedTarget && (!attackResult || resolvingTarget || !encounterResolution || encounterResolution.error || encounterResolution.hit === false))}
                  onClick={rollDamageNow}
                >Roll Damage?</button>
              </div>
              {td.in_initiative && (
                <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} disabled={attacksExhausted} onClick={async () => {
                  if (!thisAttackCounted) { onAttack(); setThisAttackCounted(true); }
                  if (smiteOn && smiteLevel && !smiteApplied) { await useSlot(smiteLevel); setSmiteApplied(true); }
                  if (selectedTarget) {
                    setManualLogOpen(true);
                  } else if ((weapon.bonus_heal_or_advantage || weapon.unarmed_heal_or_advantage) && weapon.bonus_damage_dice) {
                    setManualHealAdvOpen(true);
                  } else {
                    onClose();
                  }
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
