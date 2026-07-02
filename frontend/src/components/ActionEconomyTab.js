import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER, SECTION_COLORS, slotBadgeTextColor, concentrationSlotCount, isCharacterCaster, HASTED_EFFECT, LETHARGIC_CONDITION, maxAttacksForCharacter, isItemActive, formatItemBuff, martialArtsDie, sorceryDisplayName, activeCompanionKey, HYBRID_FORM_EFFECT, hybridFormStats } from '../utils/dnd';
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
  const { character, useFeature, useSlot, restoreSlot, saveTrackerData, useItemCharge, turnUsed, setTurnUsed, companionTurnUsed, setCompanionTurnUsed } = useCharacter();
  const [detail, setDetail]     = useState(null);
  const [companionDetail, setCompanionDetail] = useState(null);
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
  const [standardActionChoice, setStandardActionChoice] = useState('Dash');

  if (!character) return null;

  const ae       = character.ae_data || {};
  const td       = character.tracker_data || {};
  const features = td.features || {};
  const slots    = td.spell_slots || {};
  const items    = td.inventory?.items || [];
  const chargeItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.charges);
  const weaponItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.is_weapon);
  // Items with no charges to track but a real passive effect while equipped (stat
  // modifiers, or an unarmed-strike boost) had no AE presence at all before this - the
  // ITEMS section only ever looked for it.charges. A Ring of Twilight Mind or a Staff of
  // the Magi sitting un-attuned has nothing to show here either - isItemActive already
  // gates equipped+attuned the same way every other buff consumer does.
  const passiveItems = items.map((it,i) => ({ it, idx: i }))
    .filter(({it}) => !it.charges && isItemActive(it) && ((it.buffs||[]).length > 0 || it.grants_unarmed_bonus));
  // Unarmed Strike is always a valid RAW attack option, with or without a magic item
  // boosting it - the row always shows; an equipped+attuned item with
  // grants_unarmed_bonus (gauntlets, etc.) folds its bonus dice in via the same
  // bonus_damage_dice mechanism weapons already use. itemIndex doesn't apply to this
  // virtual "weapon" (no inventory row), so WeaponAttackModal takes it as weaponOverride.
  const unarmedBonusItem = items.find(it => it.grants_unarmed_bonus && isItemActive(it));
  // Martial Arts (Monk) replaces the flat "1 + STR mod" RAW baseline with a scaling die
  // (1d4 -> 1d10 by MONK level, computed dynamically - not hardcoded to any one
  // character) and lets the attack use DEX instead of STR, same as a Finesse weapon -
  // reusing Finesse's existing "better of STR/DEX" logic in weaponAbilityMod rather than
  // adding a parallel ability-choice path.
  const monkDie = martialArtsDie(character.class_name, character.level);
  // Order of the Lycan's Hybrid Transformation does the same thing to Unarmed Strike that
  // Martial Arts does (scaling die, DEX-or-STR via Finesse), plus a flat attack/damage
  // bonus (Predatory Strikes/Stalker's Prowess) only while the form is actually active -
  // computed live from Blood Hunter class level, not hardcoded. Takes priority over Monk's
  // die if somehow both apply, since the active form is the one actually swinging right now.
  const hybridStats = hybridFormStats(character.class_name, character.level);
  const isHybridForm = (td.active_effects || []).includes(HYBRID_FORM_EFFECT);
  const hybridActive = isHybridForm && hybridStats;
  const unarmedStrike = {
    name: 'Unarmed Strike', weapon_category: 'Simple', weapon_range: 'Melee',
    damage_dice: hybridActive ? `1d${hybridStats.unarmedDie}` : (monkDie ? `1d${monkDie}` : '1'),
    damage_type: 'Bludgeoning', proficient: true, is_weapon: true,
    properties: (hybridActive || monkDie) ? ['Finesse'] : [],
    bonus_damage_dice: unarmedBonusItem?.unarmed_bonus_damage_dice || '',
    bonus_damage_type: unarmedBonusItem?.unarmed_bonus_damage_type || '',
    unarmed_heal_or_advantage: !!unarmedBonusItem?.unarmed_heal_or_advantage,
    boostedBy: unarmedBonusItem?.name,
    ...(hybridActive ? {
      equipped: true,
      buffs: [
        { stat: 'weapon_attack_modifier', value: hybridStats.unarmedAttackBonus },
        { stat: 'weapon_damage_modifier', value: hybridStats.meleeDamageBonus },
      ],
    } : {}),
  };
  // Companion's own hardcoded ability list (Settings > "Track a Companion") - split into
  // a second column below, with its own turn-bucket state (companionTurnUsed) so e.g.
  // Shadow using its Reaction doesn't dim Syric's. No weapons/items/spellcasting on this
  // side by design - everything here is a plain ability the player typed in themselves.
  // Only the active slot (of up to 2 - see activeCompanionKey) shows here; the other
  // slot's abilities/turn state are untouched and resume right where they were once the
  // player toggles back (e.g. a Blood Hunter's Hybrid Transformation vs. normal form).
  const companionKey = activeCompanionKey(td);
  const companion = td[companionKey] || {};
  const companionEnabled = !!(td.companion?.enabled || td.companion2?.enabled);
  const companionAbilities = companion.abilities || [];

  const inInitiative = !!td.in_initiative;
  const isHasted = (td.active_effects || []).includes(HASTED_EFFECT);
  const concSlots = td.concentration?.slots || [];
  const concMaxSlots = concentrationSlotCount(items, isCharacterCaster(character));
  // Sorcery Points/Metamagic management (SorceryPointsModal) is also reachable from the
  // Feats/Attunement tab - surfaced here too since "anything with a use/rest/charge
  // belongs on the AE tab" is the standing rule for this tab now. Detected by substring
  // so it works whether the feature is the engine's exact name or a PDF-imported variant.
  const sorceryFeatureName = Object.keys(features).find(n => n.toLowerCase().includes('font of magic'));
  const knownMetamagic = td.metamagic_known || [];
  // Hybrid Transformation's toggle button only shows up at all if the character actually
  // has the feature (same substring-detection convention as Sorcery Points above). Uses
  // are only gated/decremented if the feature has a real tracked max - a PDF-imported
  // sheet that printed "Hybrid Transformation" with no numeric Uses still gets a working
  // toggle, same "no charge to spend" precedent as a passive feature's USE button.
  const hybridFeatureName = Object.keys(features).find(n => n.toLowerCase().includes('hybrid transformation'));
  const hybridCanActivate = isHybridForm || !hybridFeatureName
    || (features[hybridFeatureName].max || 0) === 0
    || (features[hybridFeatureName].current || 0) > 0;
  const baseMaxAttacks = maxAttacksForCharacter(features);
  // A hasted melee character gets their normal attacks (Extra Attack) PLUS one more via
  // Haste's bonus action - RAW lets that extra action be used to Attack specifically, not
  // just Dash/Disengage/Hide/Use an Object. Folding it into maxAttacks here means the
  // WEAPONS section's ATTACK button doesn't grey out one swing too early for a hasted
  // character; the bonus swing marks the Haste bucket instead of Action (see recordAttack).
  const maxAttacks = baseMaxAttacks + (isHasted ? 1 : 0);

  const recordAttack = () => {
    setTurnUsed(p => {
      const used = (p.Attacks || 0) + 1;
      const patch = { Attacks: used };
      if (used >= baseMaxAttacks) patch.Action = true;
      if (isHasted && used >= maxAttacks) patch.Haste = true;
      return { ...p, ...patch };
    });
  };

  // Lethargic RAW lasts "until the end of your next turn" - this app has no real
  // round/turn counter to time that precisely against, so clicking New Turn (the
  // simplest stand-in for "a turn has passed") clears it. Simplified, but matches the
  // rest of this app's philosophy of tracking state rather than enforcing exact timing.
  const resetTurn = () => {
    setTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false, Haste: false, Movement: false, Attacks: 0 });
    setCompanionTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false, Movement: false });
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

  // Hybrid Transformation is a bonus action that toggles HYBRID_FORM_EFFECT on/off -
  // everything it mechanically grants (AC, resistances, STR-save advantage, melee/unarmed
  // damage and unarmed attack bonuses) is computed live from that one flag elsewhere
  // (CharacterHeader.js, ActionEconomyTab's own unarmedStrike construction,
  // WeaponAttackModal.js), so flipping it here is the single source of truth for the
  // whole form. Also auto-switches the active companion slot to the Hybrid one (if the
  // player set one up via Settings > Track a Companion) so the separate ability list
  // toggles in sync with the mechanical state instead of needing two manual clicks.
  const toggleHybridForm = () => {
    const turningOn = !isHybridForm;
    const newEffects = turningOn
      ? [...(td.active_effects || []), HYBRID_FORM_EFFECT]
      : (td.active_effects || []).filter(e => e !== HYBRID_FORM_EFFECT);
    let newFeatures = features;
    if (turningOn && hybridFeatureName && (features[hybridFeatureName].max || 0) > 0) {
      newFeatures = { ...features, [hybridFeatureName]: { ...features[hybridFeatureName], current: Math.max(0, (features[hybridFeatureName].current || 0) - 1) } };
    }
    saveTrackerData({
      ...td, active_effects: newEffects, features: newFeatures,
      ...(td.companion2?.enabled ? { active_companion: turningOn ? 'companion2' : 'companion' } : {}),
    });
    markBucket('Bonus Action');
  };

  // Companion abilities only ever live in Action/Bonus Action/Reaction/Free Action/Passive
  // (same SECTION_ORDER the main column uses) - Free Action/Passive aren't turn-limited,
  // same convention as bucketForAbility above. Shares the same inInitiative toggle as the
  // main character (one combat, two columns), but its own companionTurnUsed state.
  const companionBucket = (section) => ['Action', 'Bonus Action', 'Reaction'].includes(section) ? section : null;
  const markCompanionBucket = (bucket) => {
    if (!inInitiative || !bucket) return;
    setCompanionTurnUsed(p => ({ ...p, [bucket]: true }));
  };
  const isCompanionBucketUsed = (bucket) => inInitiative && bucket && companionTurnUsed[bucket];
  const useCompanionAbility = (idx, section) => {
    const ab = companionAbilities[idx];
    if (ab && (ab.max || 0) > 0) {
      const newCurrent = Math.max(0, (ab.current || 0) - 1);
      saveTrackerData({ ...td, [companionKey]: { ...companion, abilities: companionAbilities.map((a, i) => i === idx ? { ...a, current: newCurrent } : a) } });
    }
    markCompanionBucket(companionBucket(section));
  };

  // Only spend a charge through the API if the feature actually has one to spend - a
  // passive/no-charge feature (max: 0, e.g. Evasion, Stillness of Mind, Deflect Missiles
  // on a PDF-imported sheet with no numeric "Uses" printed) still gets a USE button so
  // it marks the turn-bucket consumed (same as Disengage/Dodge having no tracker_key at
  // all), but calling useFeature() on one always 400s "No uses remaining" since current
  // is permanently 0 - the local try/catch here swallowed that, but the global axios
  // error interceptor in utils/api.js pops its alert BEFORE the catch ever sees it, so
  // the player got a scary "Something didn't save" dialog for a perfectly normal click.
  // Skipping the API call entirely when there's no real max avoids triggering it at all.
  const handleUse = async (ability, section) => {
    const feat = ability.tracker_key ? features[ability.tracker_key] : null;
    if (feat && (feat.max || 0) > 0) {
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
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection: companionEnabled ? 'row' : 'column'}}>
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
        {hybridFeatureName && (
          <button className="btn btn-sm" onClick={toggleHybridForm} disabled={!hybridCanActivate}
            title={isHybridForm ? 'Revert to normal form (bonus action)' : 'Transform into Hybrid Form (bonus action)'}
            style={{background: isHybridForm ? 'var(--danger)' : 'var(--border)', color: isHybridForm ? '#fff' : 'var(--text-secondary)', fontWeight:600, opacity: hybridCanActivate ? 1 : 0.5}}>
            🐺 {isHybridForm ? 'Revert' : 'Transform'}
          </button>
        )}
        {inInitiative && (
          <div style={{display:'flex',gap:4}}>
            {(isHasted ? ['Action','Bonus Action','Reaction','Haste','Movement'] : ['Action','Bonus Action','Reaction','Movement']).map(s => (
              <div key={s} style={{fontSize:11,padding:'3px 8px',borderRadius:12,
                background: turnUsed[s] ? 'var(--border)' : (SECTION_COLORS[s] || '#455a64'),
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
        <div>
          <div style={{padding:'6px 12px',background:'#37474f',fontSize:11,fontWeight:600,color:'#fff',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
            WEAPONS
          </div>
          {/* Extra Attack (detected by feature name, same substring approach used
              elsewhere) raises maxAttacks to 2 - the Action bucket itself only marks
              used once all granted attacks for the turn are spent, so a Fighter/Paladin
              etc. actually gets two free swings before anything else sharing the Action
              bucket dims. attacksUsed is a turn-scoped count (turnUsed.Attacks), reset
              the same places Action/Bonus/Reaction already reset. Unarmed Strike always
              shows (RAW always lets you do this), even with no weapons in inventory. */}
          {[...weaponItems.map(({it, idx}) => ({ it, idx, key: idx })), { it: unarmedStrike, idx: 'unarmed', key: 'unarmed' }].map(({it, idx, key}) => {
            const attacksUsed = turnUsed.Attacks || 0;
            // The Haste bucket is one shared bonus action - if it's already been spent on
            // the "Haste Action" row (Dash/Disengage/Hide/Use an Object) before all normal
            // attacks were taken, the bonus 3rd swing it would have unlocked isn't
            // available either; don't let both be spent independently.
            const hasteSpentElsewhere = isHasted && isBucketUsed('Haste') && attacksUsed < maxAttacks;
            const attacksExhausted = inInitiative && (attacksUsed >= maxAttacks || hasteSpentElsewhere);
            return (
              <div key={key} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',gap:8,opacity: attacksExhausted ? 0.5 : 1}}>
                <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                  <button className="btn btn-sm" onClick={() => setAttackingWeapon(idx)} disabled={attacksExhausted} style={{background: attacksExhausted ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:56}}>
                    ATTACK
                  </button>
                </div>
                <div style={{flex:1,cursor:'pointer'}} onClick={() => setAttackingWeapon(idx)}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>
                    {it.weapon_range} · {it.damage_dice} {it.damage_type}{(it.properties||[]).length ? ` · ${it.properties.join(', ')}` : ''}{it.bonus_damage_dice ? ` + ${it.bonus_damage_dice} ${it.bonus_damage_type || it.damage_type}${it.boostedBy ? ` (${it.boostedBy})` : ''}` : ''}
                  </div>
                  {inInitiative && <div style={{color: attacksExhausted ? 'var(--text-dim)' : 'var(--text-secondary)',fontSize:10}}>Attack {Math.min(attacksUsed, maxAttacks)}/{maxAttacks} used this turn</div>}
                </div>
              </div>
            );
          })}
        </div>

        {(chargeItems.length > 0 || passiveItems.length > 0) && (
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
            {passiveItems.map(({it, idx}) => (
              <div key={`passive-${idx}`} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',gap:8}}>
                <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                  {it.grants_unarmed_bonus ? (
                    <button className="btn btn-sm" onClick={() => setAttackingWeapon('unarmed')} style={{background:'var(--accent)',color:'#fff',minWidth:56}}>👊</button>
                  ) : (
                    <span style={{fontSize:11,color:'var(--success)',border:'1px solid var(--success)',borderRadius:8,padding:'1px 6px'}}>Active</span>
                  )}
                </div>
                <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewingItemDetail(idx)}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{it.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>
                    {(it.buffs||[]).map(b => formatItemBuff(b)).join(', ')}
                    {it.grants_unarmed_bonus ? `${(it.buffs||[]).length ? ' · ' : ''}boosts Unarmed Strike${it.unarmed_bonus_damage_dice ? ` (+${it.unarmed_bonus_damage_dice} ${it.unarmed_bonus_damage_type || 'Bludgeoning'})` : ''}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {SECTION_ORDER.map(section => {
          // Defends against duplicate entries that can land in ae_data[section] (e.g. a
          // feat added twice via Browse Feats, or a PDF-imported descriptive feature and
          // a separately-added custom functional version sharing a name) - only the first
          // occurrence of a given tracker_key/name renders, so the player only ever sees one.
          // Dedup only — the hasSpellForBucket guard was removed because it hid the CAST
          // button in Bonus Action/Reaction whenever the casting_time format didn't match
          // exactly, which was more confusing than always showing it. A Sorcerer with
          // Quickened Spell or a Cleric with Counterspell always has reason to see it.
          const allAbilities = (ae[section] || []).filter((a, i, arr) =>
            arr.findIndex(b => (b.tracker_key || b.name) === (a.tracker_key || a.name)) === i
          );
          // Dash/Disengage/Dodge/Help/Hide/Ready/Search/Use an Object are all raw core
          // 5e actions that don't need individual AE rows each - collapse them into one
          // "Other Actions" picker row instead. Attack is handled separately in the
          // WEAPONS section; Cast a Spell and class features keep their individual rows.
          const COLLAPSIBLE_NAMES = new Set(['Dash','Disengage','Dodge','Help','Hide','Ready','Search','Use an Object']);
          const standardActions = section === 'Action' ? allAbilities.filter(a => a.source_type === 'raw' && a.cost_type === 'action' && COLLAPSIBLE_NAMES.has(a.name)) : [];
          const abilities = allAbilities.filter(a => !standardActions.includes(a));
          if (!abilities.length && !standardActions.length) return null;
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
              {standardActions.length > 0 && (() => {
                const bucketUsed = isBucketUsed('Action');
                const selectedDesc = standardActions.find(a => a.name === standardActionChoice)?.description || '';
                return (
                  <div style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',background: bucketUsed ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: bucketUsed ? 0.5 : 1,gap:8}}>
                    <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                      <button className="btn btn-sm" onClick={() => markBucket('Action')} disabled={bucketUsed}
                        style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                        USE
                      </button>
                    </div>
                    <div style={{flex:1}}>
                      <select value={standardActionChoice} onChange={e => setStandardActionChoice(e.target.value)}
                        style={{fontWeight:500,fontSize:13,color:'var(--text-primary)',background:'transparent',border:'none',padding:0,cursor:'pointer',width:'100%'}}>
                        {standardActions.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                      </select>
                      {selectedDesc && <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2}}>{selectedDesc}</div>}
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
                // Guard on sorceryFeatureName being truthy first: without it, a character
                // with no Font of Magic feature (sorceryFeatureName === undefined) matched
                // every stock action whose tracker_key is also undefined (undefined ===
                // undefined), tagging Attack/Dash/etc. as "(Sorcery Points)".
                const isSorcery = !isCastSpell && !isTuck && !!sorceryFeatureName && ability.tracker_key === sorceryFeatureName;
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
                        {isTuck ? '🃏 ' : ''}{isSorcery ? sorceryDisplayName(ability.name) : ability.name}
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
    </div>

    {companionEnabled && (
      <>
        <div style={{width:2,background:'var(--border)',flexShrink:0}}/>
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',gap:8,padding:'8px 12px',borderBottom:'1px solid var(--border)',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
            <div style={{fontWeight:600,fontSize:13,color:'var(--accent-light)'}}>🐾 {companion.tab_name || 'Companion'}</div>
            <div style={{flex:1}}/>
            {inInitiative && (
              <div style={{display:'flex',gap:4}}>
                {['Action','Bonus Action','Reaction'].map(s => (
                  <div key={s} style={{fontSize:11,padding:'3px 8px',borderRadius:12,
                    background: companionTurnUsed[s] ? 'var(--border)' : SECTION_COLORS[s],
                    color: companionTurnUsed[s] ? 'var(--text-dim)' : '#fff',
                    textDecoration: companionTurnUsed[s] ? 'line-through' : 'none',
                    transition:'all 0.2s', cursor:'pointer',
                  }} onClick={() => setCompanionTurnUsed(p => ({...p,[s]:!p[s]}))}>
                    {s === 'Bonus Action' ? 'Bonus' : s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0 0 16px'}}>
            {companionAbilities.length === 0 && (
              <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:20}}>
                No abilities yet — add them from the {companion.tab_name || 'Companion'} tab.
              </div>
            )}
            {SECTION_ORDER.map(section => {
              const sectionAbilities = companionAbilities.map((a,i) => ({a,i})).filter(({a}) => a.section === section);
              if (sectionAbilities.length === 0) return null;
              return (
                <div key={section}>
                  <div style={{padding:'6px 12px',background:SECTION_COLORS[section],fontSize:11,fontWeight:600,color:'#fff',letterSpacing:1,position:'sticky',top:0,zIndex:1}}>
                    {section.toUpperCase()}
                  </div>
                  {sectionAbilities.map(({a, i}) => {
                    const depleted = (a.max||0) > 0 && (a.current||0) <= 0;
                    const bucket = companionBucket(section);
                    const bucketUsed = isCompanionBucketUsed(bucket);
                    const unavailable = depleted || bucketUsed;
                    return (
                      <div key={i} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border)',background: unavailable ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: unavailable ? 0.5 : 1,gap:8}}>
                        <div style={{width:60,flexShrink:0,display:'flex',justifyContent:'center'}}>
                          {!depleted && (
                            <button className="btn btn-sm" onClick={() => useCompanionAbility(i, section)} disabled={bucketUsed} style={{background: bucketUsed ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:36}}>
                              USE
                            </button>
                          )}
                        </div>
                        <div style={{flex:1,cursor:'pointer'}} onClick={() => setCompanionDetail(a)}>
                          <div style={{color: unavailable ? 'var(--text-dim)' : 'var(--text-primary)',fontWeight:500,fontSize:13,textDecoration: depleted ? 'line-through' : 'none'}}>
                            {a.name}
                          </div>
                          {bucketUsed && !depleted && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
                        </div>
                        {(a.max||0) > 0 && <div style={{color: a.current > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:600,fontSize:13,minWidth:36,textAlign:'right'}}>{a.current}/{a.max}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </>
    )}

      {detail    && <AbilityDetailModal ability={detail} onClose={() => setDetail(null)} />}
      {companionDetail && <AbilityDetailModal ability={companionDetail} onClose={() => setCompanionDetail(null)} />}
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
          itemIndex={attackingWeapon === 'unarmed' ? null : attackingWeapon}
          weaponOverride={attackingWeapon === 'unarmed' ? unarmedStrike : undefined}
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
