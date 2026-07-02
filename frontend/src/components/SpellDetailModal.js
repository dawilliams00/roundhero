import React, { useEffect, useRef, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { schoolColor, getSpellcastingBlocks, getAbilityOverrideBlock, scaleSpellDamage, rollDamageDetailed, concentrationSlotCount, isCharacterCaster, maxAttacksForCharacter, HASTED_EFFECT, METAMAGIC_OPTIONS, metamagicCost, featBuffItems, raceBuffItems } from '../utils/dnd';
import InfoModal from './InfoModal';
import WeaponAttackModal from './WeaponAttackModal';

const SELF_TARGET_EFFECTS = { haste: HASTED_EFFECT };

export default function SpellDetailModal({ spell, onClose, chargeMode, onCastSuccess, prepared = true, syricCodex = null }) {
  const { character, useSlot, useFeature, saveTrackerData, setConcentration, replaceConcentration, spendFeatureCharges, turnUsed, setTurnUsed } = useCharacter();
  const [casting, setCasting] = useState(false);
  const [cast, setCast]       = useState(null);
  const [awaitingTarget, setAwaitingTarget] = useState(false);
  const [pendingDamage, setPendingDamage] = useState(null);
  const [damageResult, setDamageResult] = useState(null);
  const [concPrompt, setConcPrompt] = useState(null);
  const [concSlotIdx, setConcSlotIdx] = useState(null);
  const [hasteEndedMessage, setHasteEndedMessage] = useState(null);
  const [metamagicChoice, setMetamagicChoice] = useState('');
  const [codexMode, setCodexMode] = useState('');
  const [codexDiceCount, setCodexDiceCount] = useState(1);
  // Weapon-attack cantrips (Booming Blade, Green-Flame Blade, etc.) - flagged on the
  // spell with requires_weapon_attack, set via the spell editor - hand off to
  // WeaponAttackModal instead of this modal's own damage roll, since the actual damage is
  // weapon damage + the cantrip's bonus together, not the spell alone.
  const [awaitingWeapon, setAwaitingWeapon] = useState(false);
  const [pickedWeaponIdx, setPickedWeaponIdx] = useState(null);
  const [encounterTargets, setEncounterTargets] = useState([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [resolvingTarget, setResolvingTarget] = useState(false);
  const [encounterResolution, setEncounterResolution] = useState(null);
  // "I'll roll in person" for spell damage - the player rolls physical dice and types the
  // total, instead of the app rolling for them. Flows into the same damageResult screen
  // (and the same target resolution / Ask-DM path) as a digital roll.
  const [manualDamageOpen, setManualDamageOpen] = useState(false);
  const [manualDamageTotal, setManualDamageTotal] = useState('');
  const [castLevel, setCastLevel] = useState(spell?.level_int || 0);
  const castMetaRef = useRef(null);

  useEffect(() => {
    if (!character?.id) return;
    // Only offer encounter targets while the caster is actually in initiative - you
    // shouldn't be picking an enemy to hit with a spell if you're not in the fight. No
    // initiative => no target picker, even when a running encounter exists.
    if (!character?.tracker_data?.in_initiative) { setEncounterTargets([]); return; }
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
  }, [character?.id, character?.tracker_data?.in_initiative]);

  useEffect(() => {
    if (!character) return;
    const slots = character.tracker_data?.spell_slots || {};
    const levels = Object.entries(slots)
      .filter(([lvl, s]) => parseInt(lvl) >= spell.level_int && (s.current || 0) > 0)
      .map(([lvl]) => parseInt(lvl))
      .sort((a,b) => a-b);
    const next = levels[0] || spell.level_int;
    setCastLevel(current => (levels.includes(current) || current === spell.level_int ? current : next));
  }, [character, spell.level_int]);

  if (!character) return null;
  const slots = character.tracker_data?.spell_slots || {};
  const isCantrip = spell.level_int === 0;
  const availableLevels = Object.entries(slots)
    .filter(([lvl, s]) => parseInt(lvl) >= spell.level_int && (s.current || 0) > 0)
    .map(([lvl]) => parseInt(lvl))
    .sort((a,b) => a-b);
  const selfEffect = SELF_TARGET_EFFECTS[spell.name?.toLowerCase()];
  const buffItems = [...(character.tracker_data?.inventory?.items || []), ...featBuffItems(character.tracker_data?.features), ...raceBuffItems(character.race)];
  const spellBlocks = getSpellcastingBlocks(character.class_name, character.ability_scores, character.level, buffItems);
  // A feat-granted spell (e.g. Draconic Healing's Cure Wounds) can fix its own
  // spellcasting ability independent of the character's class - replaces the class
  // blocks entirely for this spell rather than adding to them, since the feat text reads
  // as "this spell always uses X," not "in addition to your class ability."
  const displayBlocks = spell.ability_override
    ? [getAbilityOverrideBlock(spell.ability_override, character.ability_scores, character.level, buffItems)]
    : spellBlocks;
  // free_use_feature names a tracker_data.features entry with a charge that casts this
  // spell without a slot (e.g. "once per long rest") - independent of whether the
  // character has any spell slots at all, which is what lets a non-caster use a
  // feat-granted spell that the class-spell-slot system has no idea about.
  const freeUseFeature = spell.free_use_feature;
  const freeUseCharge = freeUseFeature ? character.tracker_data?.features?.[freeUseFeature] : null;
  const freeUseAvailable = !!freeUseCharge && (freeUseCharge.current || 0) > 0;
  // Metamagic - name-based, not class-based, same reasoning as the Sorcery Points
  // detection in TrackerTab.js. Not offered for chargeMode (item-granted) casts - keeps
  // scope to the common case of a Sorcerer casting their own spell.
  const knownMetamagic = character.tracker_data?.metamagic_known || [];
  const sorceryFeatureName = Object.keys(character.tracker_data?.features || {}).find(n => n.toLowerCase().includes('font of magic'));
  const sorceryPoints = sorceryFeatureName ? (character.tracker_data.features[sorceryFeatureName]?.current || 0) : 0;
  const metamagicAvailable = !chargeMode && knownMetamagic.length > 0;
  // For a charge-cast spell (e.g. Lightning Bolt via Staff of the Magi), spell.level_int is
  // already overridden to the item's fixed cast_level - that's the level this preview and
  // the eventual cast both need, not the cast-level dropdown (which doesn't apply here).
  const previewLevel = chargeMode ? spell.level_int : (castLevel || spell.level_int);
  const previewDamage = scaleSpellDamage(spell, previewLevel, character.level);
  // Upcasting only matters for spells whose text actually does something different at a
  // higher level - Haste, Silvery Barbs, etc. have no higher_level text at all, so picking
  // a level for them is a pointless choice that just wastes a bigger slot for nothing.
  const canMeaningfullyUpcast = !!spell.higher_level;
  // A spell "deals damage" if it has damage dice (scaleSpellDamage returns null for pure
  // utility spells like Haste/Mirror Image/Polymorph) or is a weapon-attack cantrip. Used
  // to hide damage-only add-ons (Codex Dice surge, damage-reroll Metamagic) from utility
  // spells, where they'd be meaningless clutter.
  const spellDealsDamage = !!previewDamage || !!spell.requires_weapon_attack;
  // Only show Metamagic options that can actually apply to THIS spell - a damage-reroll
  // option on a no-damage spell, or a save-messing option on a no-save spell, is just
  // noise. Broadly-applicable options (Distant/Extended/Quickened/Subtle/Twinned) always
  // show; the rest are gated on the spell having the thing they act on.
  const metamagicAppliesToSpell = (name) => {
    if (name === 'Empowered Spell' || name === 'Transmuted Spell') return spellDealsDamage;
    if (name === 'Heightened Spell' || name === 'Careful Spell') return !!spell.save_type_abbr;
    if (name === 'Seeking Spell') return !!spell.is_attack || !!spell.requires_weapon_attack;
    return true;
  };
  const applicableMetamagic = knownMetamagic.filter(metamagicAppliesToSpell);

  const finish = () => { onClose(); if (onCastSuccess) onCastSuccess(castMetaRef.current || { spell, level: spell.level_int, chargeMode }); };

  // Target is picked up front (see the Encounter Target block at the top of the modal
  // body) rather than after damage is already rolled - the picker locks once damage has
  // been rolled against it so switching targets mid-cast can't desync things.
  const selectedTarget = encounterTargets.find(row => row.key === selectedTargetKey);

  const damageComponentsFor = (result) => {
    if (!result) return [];
    const components = [{ amount: result.total || 0, damage_type: spell.damage_type }];
    if (result.secondaryResult) {
      components.push({ amount: result.secondaryResult.total || 0, damage_type: result.secondary?.type || spell.damage_type });
    }
    return components;
  };

  // Sends the action to the encounter backend. For a SAVE spell this always queues a
  // pending DM save (save_roll blank) - the DM rolls the save in the encounter runner,
  // which is why the damage has to ride along in this same call (the DM resolver refuses a
  // pending event with no damage). For attack/plain-damage spells it applies damage
  // directly. `save_type` lets the DM runner pick the target's correct save modifier.
  const resolveSpellAgainstTarget = async (result) => {
    if (!selectedTarget) return null;
    setResolvingTarget(true);
    setEncounterResolution(null);
    try {
      const saveDC = displayBlocks[0]?.saveDC || '';
      const r = await api.post(`/campaigns/${selectedTarget.campaignId}/encounters/${selectedTarget.encounterId}/resolve`, {
        source_character_id: character.id,
        target_id: selectedTarget.targetId,
        label: spell.name,
        mode: spell.save_type_abbr ? 'save' : (spell.is_attack ? 'attack' : 'damage'),
        attack_total: '',
        save_dc: saveDC,
        save_type: spell.save_type_abbr || '',
        save_type_abbr: spell.save_type_abbr || '',
        save_roll: '',
        half_on_success: true,
        damage_components: damageComponentsFor(result),
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

  // Serves both the first roll (from the pendingDamage screen) and Reroll (from the
  // damageResult screen) - Reroll disables itself once a target resolution is finalized
  // (see render below) so this never double-applies damage to a target. Save spells are
  // deliberately NOT auto-resolved here - see resolveSpellAgainstTarget's comment above.
  const rollNow = async () => {
    const result = {
      ...pendingDamage,
      ...rollDamageDetailed(pendingDamage),
      secondaryResult: pendingDamage.secondary ? rollDamageDetailed(pendingDamage.secondary) : undefined,
    };
    setDamageResult(result);
    if (selectedTarget && !spell.save_type_abbr) await resolveSpellAgainstTarget(result);
  };

  // Manual damage entry ("I'll roll in person") - the player types the total they rolled
  // by hand. Feeds the same damageResult screen and resolution path as a digital roll, so
  // a save spell still gets the Ask-DM button and a plain damage spell still auto-applies.
  const submitManualDamage = async () => {
    const total = parseInt(manualDamageTotal);
    if (isNaN(total)) return;
    const result = { ...pendingDamage, total, rolls: [], bonus: 0, manual: true };
    setDamageResult(result);
    if (selectedTarget && !spell.save_type_abbr) await resolveSpellAgainstTarget(result);
  };

  const continueAfterCast = async (levelUsed) => {
    if (spell.requires_weapon_attack) {
      setAwaitingWeapon(true);
      return;
    }
    const dmg = scaleSpellDamage(spell, levelUsed, character.level);
    // Save spell against an encounter target: roll the damage right now and queue the DM
    // save in one step, so the moment you cast, the DM is notified to roll the DC save
    // (with the damage attached, which the DM resolver requires). No separate post-roll
    // "Ask DM" click - that was the confusing out-of-order step. The DM applies full/half
    // when they resolve the save on their end.
    if (dmg && spell.save_type_abbr && selectedTarget) {
      const result = {
        ...dmg,
        ...rollDamageDetailed(dmg),
        secondaryResult: dmg.secondary ? rollDamageDetailed(dmg.secondary) : undefined,
      };
      setDamageResult(result);
      await resolveSpellAgainstTarget(result);
      return;
    }
    if (dmg) {
      setPendingDamage(dmg);
    }
    if (selfEffect) {
      setAwaitingTarget(true);
    } else if (!dmg) {
      setTimeout(finish, 700);
    }
  };

  // Auto-fills an open concentration slot, same as casting does in the Pi tracker this
  // was ported from. Only prompts the player when every active slot is already taken -
  // if there's room, it tracks silently. Returns false while waiting on that prompt.
  const tryTrackConcentration = async (levelUsed) => {
    if (!spell.concentration) return true;
    const items = character?.tracker_data?.inventory?.items;
    const maxSlots = concentrationSlotCount(items, isCharacterCaster(character));
    const slots = character?.tracker_data?.concentration?.slots || [];
    for (let i = 0; i < maxSlots; i++) {
      if (!slots[i]?.spell) {
        await setConcentration(i, spell.name, levelUsed, undefined, chargeMode?.noLethargy);
        setConcSlotIdx(i);
        return true;
      }
    }
    setConcPrompt({
      levelUsed,
      options: Array.from({ length: maxSlots }, (_, i) => ({ idx: i, spell: slots[i]?.spell || '' })),
    });
    return false;
  };

  // Replacing an occupied slot (the "concentration full" prompt) needs the same Haste
  // cleanup as ConcentrationModal's Drop button - whatever spell USED to be in this slot
  // is what's ending, not the one being cast now.
  const resolveConcPrompt = async (idx, levelUsed) => {
    if (idx != null) {
      const result = await replaceConcentration(idx, spell.name, levelUsed, undefined, chargeMode?.noLethargy);
      setConcSlotIdx(idx);
      if (result?.wasSelfHaste) {
        setHasteEndedMessage(result.noLethargy
          ? "Haste ended - the item that granted it means you don't suffer lethargy this time."
          : "Haste ended - you are now Lethargic until the end of your next turn. While Lethargic, you can't move or take actions or reactions.");
      } else if (result?.wasAllyHaste) {
        setHasteEndedMessage("Your ally's Haste ended - they are now Lethargic until the end of their next turn. While Lethargic, they can't move or take actions or reactions. (Not tracked on their own sheet - just a reminder for the table.)");
      }
    }
    setConcPrompt(null);
    continueAfterCast(levelUsed);
  };

  const doCast = async () => {
    setCasting(true);
    try {
      let levelUsed = spell.level_int;
      // Spend the Metamagic cost FIRST, before anything else touches tracker_data this
      // cast - spendFeatureCharges reads characterRef fresh regardless of ordering (see
      // CharacterContext.js), but doing it first keeps the sequence easy to reason about.
      let metaNote = '';
      if (metamagicChoice && sorceryFeatureName) {
        const cost = metamagicCost(metamagicChoice, { level_int: isCantrip ? 0 : (castLevel || spell.level_int) });
        if (sorceryPoints >= cost) {
          await spendFeatureCharges(sorceryFeatureName, cost);
          metaNote = ` + ${metamagicChoice} (${cost} SP)`;
        }
      }
      if (syricCodex && codexMode) {
        const amount = Math.max(1, parseInt(codexDiceCount, 10) || 1);
        const spent = await syricCodex.onSpend(codexMode, amount);
        if (spent?.spent !== false) {
          metaNote += ` + Codex ${codexMode === 'bonus_d10' ? `${amount}d10` : `${amount}d6`}`;
        }
      }
      if (chargeMode) {
        await chargeMode.onCast();
        setCast(`Cast using ${chargeMode.chargeCost} charge${chargeMode.chargeCost===1?'':'s'}!${metaNote}`);
      } else if (isCantrip) {
        setCast(`Cast! (no slot used)${metaNote}`);
      } else if (castLevel) {
        await useSlot(castLevel);
        setCast(`Cast at level ${castLevel}!${metaNote}`);
        levelUsed = castLevel;
      }
      castMetaRef.current = { spell, level: levelUsed, chargeMode };
      const tracked = await tryTrackConcentration(levelUsed);
      if (tracked) await continueAfterCast(levelUsed);
    } finally { setCasting(false); }
  };

  // Free cast via a feat's charge (e.g. Draconic Healing, once per long rest) - always
  // at the spell's own base level, independent of whether a slot was ever available.
  const doFreeCast = async () => {
    setCasting(true);
    try {
      let metaNote = '';
      if (syricCodex && codexMode) {
        const amount = Math.max(1, parseInt(codexDiceCount, 10) || 1);
        const spent = await syricCodex.onSpend(codexMode, amount);
        if (spent?.spent !== false) {
          metaNote = ` + Codex ${codexMode === 'bonus_d10' ? `${amount}d10` : `${amount}d6`}`;
        }
      }
      await useFeature(freeUseFeature);
      setCast(`Cast free (${freeUseFeature})!${metaNote}`);
      castMetaRef.current = { spell, level: spell.level_int, freeUseFeature };
      const tracked = await tryTrackConcentration(spell.level_int);
      if (tracked) await continueAfterCast(spell.level_int);
    } finally { setCasting(false); }
  };

  // RAW: a ritual spell can always be cast as a ritual (10 extra minutes, no slot spent)
  // even if it isn't prepared today - this is what the `prepared` prop matters for: when
  // false, the normal slot-cast option below is hidden entirely and this is the only way
  // to cast it, same as 5e's actual restriction. When prepared, this still shows
  // alongside the normal cast button as the "skip the slot" alternative.
  const doCastRitual = async () => {
    setCasting(true);
    try {
      setCast('Cast as a ritual (10 extra minutes, no slot used)!');
      const tracked = await tryTrackConcentration(spell.level_int);
      if (tracked) await continueAfterCast(spell.level_int);
    } finally { setCasting(false); }
  };

  // Adding the active effect and tagging the concentration slot's target both have to
  // land in ONE save built from a single snapshot of tracker_data - two sequential
  // saveTrackerData-based calls here would have the second one's stale snapshot silently
  // revert the first's change, the exact bug class already fixed in ConcentrationModal.
  const chooseTarget = async (isSelf) => {
    const td = character.tracker_data;
    const effects = td.active_effects || [];
    const conc = td.concentration || {};
    const slots = [...(conc.slots || [{}, {}])];
    if (concSlotIdx != null && slots[concSlotIdx]) {
      slots[concSlotIdx] = { ...slots[concSlotIdx], target: isSelf ? 'self' : 'ally' };
    }
    await saveTrackerData({
      ...td,
      ...(isSelf && !effects.includes(selfEffect) ? { active_effects: [...effects, selfEffect] } : {}),
      concentration: { ...conc, slots },
    });
    finish();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-header">
          <h2 style={{color: schoolColor(spell.school)}}>{spell.name}</h2>
          <div style={{color:'var(--text-dim)',fontSize:12}}>
            {spell.level_int === 0 ? 'Cantrip' : `Level ${spell.level_int}`} · {spell.school}
            {spell.ritual ? ' · Ritual' : ''}{spell.concentration ? ' · Concentration' : ''}
          </div>
          {displayBlocks.length > 0 && (
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:6}}>
              {displayBlocks.map(b => (
                <span key={b.className || b.ability} style={{color:'var(--accent-light)',fontSize:12,fontWeight:600}}>
                  {b.className ? `${b.className}: ` : `${b.ability}: `}{b.attackMod>=0?'+':''}{b.attackMod} atk · DC {b.saveDC}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="modal-body">
          {encounterTargets.length > 0 && (
            <div style={{border:'1px solid var(--accent-light)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Encounter Target</div>
              <select
                value={selectedTargetKey}
                onChange={e => { setSelectedTargetKey(e.target.value); setEncounterResolution(null); }}
                disabled={!!damageResult}
                style={{width:'100%'}}
              >
                <option value="">— No target (just roll) —</option>
                {encounterTargets.map(target => <option key={target.key} value={target.key}>{target.label}</option>)}
              </select>
              {spell.save_type_abbr && selectedTarget && (
                <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>Casting sends this to the DM to roll the {spell.save_type_abbr} save — they apply the damage.</div>
              )}
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
            <div><b>Casting Time:</b> {spell.casting_time}</div>
            <div><b>Range:</b> {spell.range}</div>
            <div><b>Components:</b> {spell.components}</div>
            <div><b>Duration:</b> {spell.duration}</div>
          </div>
          {previewDamage && (
            <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
              <div><b>Damage:</b> {previewDamage.label} {spell.damage_type}{previewDamage.secondary ? ` + ${previewDamage.secondary.label} ${previewDamage.secondary.type}` : ''}</div>
              {spell.is_attack && <div><b>Attack:</b> {spell.attack_type}</div>}
              {spell.save_type_abbr && <div><b>Save:</b> {spell.save_type_abbr} (half on success)</div>}
            </div>
          )}
          <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{spell.description}</p>
          {spell.higher_level && (
            <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>
              <b>At Higher Levels.</b> {spell.higher_level}
            </p>
          )}
        </div>
        <div className="modal-footer" style={{flexDirection:'column'}}>
          {awaitingWeapon ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-secondary)',fontSize:13,marginBottom:8}}>Which weapon are you attacking with?</div>
              {(character.tracker_data?.inventory?.items || []).filter(it => it.is_weapon && it.equipped).length === 0 ? (
                <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:8}}>No equipped weapons found - add/equip one on the Inventory tab first.</div>
              ) : (character.tracker_data.inventory.items.map((it, i) => it.is_weapon && it.equipped ? (
                <button key={i} className="btn btn-secondary" style={{width:'100%',marginBottom:6}} onClick={() => setPickedWeaponIdx(i)}>{it.name}</button>
              ) : null))}
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={finish}>Skip (no weapon attack)</button>
            </div>
          ) : concPrompt ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--warning)',fontWeight:700,marginBottom:8}}>Concentration full</div>
              <div style={{color:'var(--text-secondary)',fontSize:12,marginBottom:10}}>Replace which spell with {spell.name}?</div>
              {concPrompt.options.map(o => (
                <button key={o.idx} className="btn btn-secondary" style={{width:'100%',marginBottom:6}} onClick={() => resolveConcPrompt(o.idx, concPrompt.levelUsed)}>
                  Replace: {o.spell || 'empty'}
                </button>
              ))}
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={() => resolveConcPrompt(null, concPrompt.levelUsed)}>Don't Track</button>
            </div>
          ) : damageResult ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                {damageResult.label} {spell.damage_type}{damageResult.secondary ? ` + ${damageResult.secondary.label} ${damageResult.secondary.type}` : ''} damage
                {spell.save_type_abbr ? ` · ${spell.save_type_abbr} DC vs caster · half on success` : ''}
                {spell.is_attack ? ' · requires a spell attack roll' : ''}
              </div>
              <div style={{display:'flex',gap:20,justifyContent:'center',flexWrap:'wrap'}}>
                <div>
                  <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.total}</div>
                  <div style={{color:'var(--text-dim)',fontSize:10}}>{spell.damage_type}{damageResult.manual ? ' · rolled in person' : ` · [${damageResult.rolls.join(', ')}]${damageResult.bonus ? ` ${damageResult.bonus>=0?'+':''}${damageResult.bonus}` : ''}`}</div>
                </div>
                {damageResult.secondaryResult && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.secondaryResult.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>{damageResult.secondary.type} · [{damageResult.secondaryResult.rolls.join(', ')}]</div>
                  </div>
                )}
              </div>
              {/* Save spell: the whole thing was sent to the DM to roll the save the moment
                  you cast. The player never sees the HP applied - only that it's with the
                  DM. Retry re-sends if the queue call failed. */}
              {selectedTarget && spell.save_type_abbr ? (
                <div style={{borderTop:'1px solid var(--border)',marginTop:10,paddingTop:8,textAlign:'left'}}>
                  <div style={{color: resolvingTarget ? 'var(--text-dim)' : encounterResolution?.error ? 'var(--danger)' : 'var(--accent-light)',fontSize:12,fontWeight:600}}>
                    {resolvingTarget
                      ? 'Sending to the DM...'
                      : encounterResolution?.error
                        ? encounterResolution.error
                        : `📨 Sent to the DM to roll the ${spell.save_type_abbr} save (DC ${displayBlocks[0]?.saveDC || '?'}) for ${encounterResolution?.target_name || selectedTarget.label.split(': ').slice(1).join(': ')}. The DM applies the damage.`}
                  </div>
                  {encounterResolution?.error && (
                    <button className="btn btn-secondary btn-sm" style={{marginTop:6}} onClick={() => resolveSpellAgainstTarget(damageResult)}>Retry send</button>
                  )}
                </div>
              ) : selectedTarget && (
                /* Attack / auto-hit damage spell - hide the applied HP number, show only
                   the outcome. */
                <div style={{borderTop:'1px solid var(--border)',marginTop:10,paddingTop:8,textAlign:'left'}}>
                  <div style={{color: resolvingTarget ? 'var(--text-dim)' : encounterResolution?.error ? 'var(--danger)' : 'var(--success)',fontSize:12}}>
                    {resolvingTarget ? 'Resolving...' : encounterResolution?.error || (encounterResolution?.hit === false ? 'Missed.' : encounterResolution?.hit === true ? 'Hit!' : 'Resolved.')}
                  </div>
                  {encounterResolution?.error && (
                    <button className="btn btn-secondary btn-sm" style={{marginTop:6}} onClick={() => resolveSpellAgainstTarget(damageResult)}>Retry</button>
                  )}
                </div>
              )}
              <div style={{display:'flex',gap:8,marginTop:10}}>
                {/* No reroll once it's been sent to the DM / applied against a target. */}
                <button className="btn btn-secondary" style={{flex:1}} disabled={!!(selectedTarget && encounterResolution)} onClick={rollNow}>Reroll</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={finish}>Done</button>
              </div>
            </div>
          ) : pendingDamage ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
                {pendingDamage.label} {spell.damage_type}{pendingDamage.secondary ? ` + ${pendingDamage.secondary.label} ${pendingDamage.secondary.type}` : ''} damage
                {spell.save_type_abbr ? ` · ${spell.save_type_abbr} DC vs caster · half on success` : ''}
                {spell.is_attack ? ' · requires a spell attack roll' : ''}
              </div>
              {manualDamageOpen ? (
                <>
                  <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8}}>Roll your {pendingDamage.label}{pendingDamage.secondary ? ` + ${pendingDamage.secondary.label}` : ''} in person, then enter the total:</div>
                  <div style={{display:'flex',gap:6,marginBottom:8}}>
                    <input type="number" placeholder="Damage total" value={manualDamageTotal} onChange={e => setManualDamageTotal(e.target.value)} style={{flex:1}} autoFocus />
                    <button className="btn btn-primary" disabled={!manualDamageTotal || resolvingTarget} onClick={submitManualDamage}>Enter</button>
                  </div>
                  <button className="btn btn-secondary" style={{width:'100%'}} onClick={() => setManualDamageOpen(false)}>Back</button>
                </>
              ) : (
                <>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-secondary" style={{flex:1}} onClick={finish}>Skip</button>
                    <button className="btn btn-primary" style={{flex:1}} onClick={rollNow}>Roll Damage?</button>
                  </div>
                  <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={() => setManualDamageOpen(true)}>✓ I'll roll in person - enter damage</button>
                </>
              )}
            </div>
          ) : (
            <>
              <div style={{width:'100%'}}>
                {awaitingTarget ? (
                  <>
                    <div style={{color:'var(--text-secondary)',fontSize:13,marginBottom:8,textAlign:'center'}}>Apply {selfEffect} to:</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-primary" style={{flex:1}} onClick={() => chooseTarget(true)}>Self</button>
                      <button className="btn btn-secondary" style={{flex:1}} onClick={() => chooseTarget(false)}>Ally</button>
                    </div>
                  </>
                ) : chargeMode ? (
                  <>
                    <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:8}}>
                      {chargeMode.chargesCurrent}/{chargeMode.chargesMax} charges on {chargeMode.itemName}
                    </div>
                    {chargeMode.chargesCurrent < chargeMode.chargeCost ? (
                      <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>Not enough charges remaining.</div>
                    ) : (
                      <button className="btn btn-primary" style={{width:'100%'}} disabled={casting} onClick={doCast}>
                        {casting ? 'Casting...' : `Cast — Use ${chargeMode.chargeCost} Charge${chargeMode.chargeCost===1?'':'s'}`}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {!isCantrip && canMeaningfullyUpcast && availableLevels.length > 1 && (
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                        <span style={{color:'var(--text-dim)',fontSize:12}}>Cast at level:</span>
                        <select value={castLevel} onChange={e => setCastLevel(parseInt(e.target.value))}>
                          {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    )}
                    {metamagicAvailable && applicableMetamagic.length > 0 && (
                      <div style={{marginBottom:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{color:'var(--text-dim)',fontSize:12}}>Metamagic:</span>
                          <select value={metamagicChoice} onChange={e => setMetamagicChoice(e.target.value)}>
                            <option value="">None</option>
                            {applicableMetamagic.map(name => {
                              const cost = metamagicCost(name, { level_int: isCantrip ? 0 : (castLevel || spell.level_int) });
                              return <option key={name} value={name} disabled={sorceryPoints < cost}>{name} ({cost} SP)</option>;
                            })}
                          </select>
                          <span style={{color:'var(--text-dim)',fontSize:11}}>{sorceryPoints} SP available</span>
                        </div>
                        {metamagicChoice && (
                          <div style={{color:'var(--accent-light)',fontSize:11,marginTop:4}}>{METAMAGIC_OPTIONS[metamagicChoice]?.text}</div>
                        )}
                      </div>
                    )}
                    {syricCodex && spellDealsDamage && (
                      <div style={{marginBottom:8,border:'1px solid rgba(124,92,252,0.38)',borderRadius:'var(--radius-sm)',padding:8,background:'rgba(124,92,252,0.10)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span style={{color:'var(--text-dim)',fontSize:12}}>Codex Dice:</span>
                          <select value={codexMode} onChange={e => setCodexMode(e.target.value)}>
                            <option value="">None</option>
                            <option value="free_d6">d6 Surge (Free)</option>
                            <option value="bonus_d10">d10 Surge (Bonus)</option>
                          </select>
                          <input
                            type="number"
                            min="1"
                            max={codexMode === 'free_d6' ? (syricCodex.freeMax || 6) : 99}
                            value={codexDiceCount}
                            disabled={!codexMode}
                            onChange={e => setCodexDiceCount(e.target.value)}
                            style={{width:72,textAlign:'center'}}
                          />
                          <span style={{color:'var(--text-dim)',fontSize:11}}>
                            {syricCodex.current ?? 0}/{syricCodex.max ?? '-'} available
                          </span>
                        </div>
                        {codexMode === 'free_d6' && (
                          <div style={{color:'var(--accent-light)',fontSize:11,marginTop:4}}>Free action d6 surge. Limit shown by Syric rules/proficiency.</div>
                        )}
                        {codexMode === 'bonus_d10' && (
                          <div style={{color:'var(--warning)',fontSize:11,marginTop:4}}>Bonus action d10 surge. This will mark Bonus used in Syric AE if initiative is active.</div>
                        )}
                      </div>
                    )}
                    {!isCantrip && freeUseAvailable && (
                      <button className="btn btn-primary" style={{width:'100%',marginBottom:8}} disabled={casting} onClick={doFreeCast}>
                        {casting ? 'Casting...' : `Cast Free (${freeUseFeature}: ${freeUseCharge.current}/${freeUseCharge.max})`}
                      </button>
                    )}
                    {!prepared && (
                      <div style={{color:'var(--warning)',fontSize:12,marginBottom:8,textAlign:'center'}}>
                        {spell.ritual
                          ? 'Not prepared today — castable only as a ritual.'
                          : 'Not prepared today.'}
                      </div>
                    )}
                    {prepared && (
                      !isCantrip && availableLevels.length === 0 ? (
                        !freeUseAvailable && <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>No spell slots available.</div>
                      ) : (
                        <button className="btn btn-primary" style={{width:'100%',marginBottom: spell.ritual ? 8 : 0}} disabled={casting} onClick={doCast}>
                          {casting ? 'Casting...' : isCantrip ? 'Cast (Cantrip)' : `Cast — Use Level ${castLevel} Slot`}
                        </button>
                      )
                    )}
                    {spell.ritual && !isCantrip && (
                      <button className="btn btn-secondary" style={{width:'100%'}} disabled={casting} onClick={doCastRitual}>
                        {casting ? 'Casting...' : '🕯 Cast as Ritual (+10 min, no slot)'}
                      </button>
                    )}
                  </>
                )}
                {cast && <div style={{color:'var(--success)',fontSize:12,marginTop:6,textAlign:'center'}}>{cast}</div>}
              </div>
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
      {hasteEndedMessage && <InfoModal title="Haste Ended" message={hasteEndedMessage} onClose={() => setHasteEndedMessage(null)} />}
      {pickedWeaponIdx != null && (
        <WeaponAttackModal
          itemIndex={pickedWeaponIdx}
          cantripSpell={spell}
          attacksUsed={turnUsed.Attacks || 0}
          maxAttacks={maxAttacksForCharacter(character.tracker_data?.features)}
          onAttack={() => setTurnUsed(p => {
            const used = (p.Attacks || 0) + 1;
            const max = maxAttacksForCharacter(character.tracker_data?.features);
            return { ...p, Attacks: used, ...(used >= max ? { Action: true } : {}) };
          })}
          onClose={() => {
            // Plain onClose(), not finish() - the weapon modal's own onAttack already
            // marks whatever action-economy bucket needs marking, gated on the player
            // actually rolling/logging an attack. Calling finish() here (which fires
            // onCastSuccess) would mark the cast_spell bucket unconditionally just for
            // opening the weapon picker and backing out, even with nothing rolled - the
            // exact "looked at my damage then backed out" case that shouldn't cost
            // anything.
            setPickedWeaponIdx(null);
            setAwaitingWeapon(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
