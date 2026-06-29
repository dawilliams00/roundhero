import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { schoolColor, getSpellcastingBlocks, getAbilityOverrideBlock, scaleSpellDamage, rollDamageDetailed, concentrationSlotCount, maxAttacksForCharacter, HASTED_EFFECT, METAMAGIC_OPTIONS, metamagicCost, featBuffItems } from '../utils/dnd';
import InfoModal from './InfoModal';
import WeaponAttackModal from './WeaponAttackModal';

const SELF_TARGET_EFFECTS = { haste: HASTED_EFFECT };

export default function SpellDetailModal({ spell, onClose, chargeMode, onCastSuccess }) {
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
  // Weapon-attack cantrips (Booming Blade, Green-Flame Blade, etc.) - flagged on the
  // spell with requires_weapon_attack, set via the spell editor - hand off to
  // WeaponAttackModal instead of this modal's own damage roll, since the actual damage is
  // weapon damage + the cantrip's bonus together, not the spell alone.
  const [awaitingWeapon, setAwaitingWeapon] = useState(false);
  const [pickedWeaponIdx, setPickedWeaponIdx] = useState(null);

  if (!character) return null;
  const slots = character.tracker_data?.spell_slots || {};
  const isCantrip = spell.level_int === 0;
  const availableLevels = Object.entries(slots)
    .filter(([lvl, s]) => parseInt(lvl) >= spell.level_int && (s.current || 0) > 0)
    .map(([lvl]) => parseInt(lvl))
    .sort((a,b) => a-b);
  const [castLevel, setCastLevel] = useState(availableLevels[0] || spell.level_int);
  const selfEffect = SELF_TARGET_EFFECTS[spell.name?.toLowerCase()];
  const buffItems = [...(character.tracker_data?.inventory?.items || []), ...featBuffItems(character.tracker_data?.features)];
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
  const previewDamage = scaleSpellDamage(spell, previewLevel);
  // Upcasting only matters for spells whose text actually does something different at a
  // higher level - Haste, Silvery Barbs, etc. have no higher_level text at all, so picking
  // a level for them is a pointless choice that just wastes a bigger slot for nothing.
  const canMeaningfullyUpcast = !!spell.higher_level;

  const finish = () => { onClose(); if (onCastSuccess) onCastSuccess(); };

  const rollNow = () => setDamageResult({
    ...pendingDamage,
    ...rollDamageDetailed(pendingDamage),
    secondaryResult: pendingDamage.secondary ? rollDamageDetailed(pendingDamage.secondary) : undefined,
  });

  const continueAfterCast = (levelUsed) => {
    if (spell.requires_weapon_attack) {
      setAwaitingWeapon(true);
      return;
    }
    const dmg = scaleSpellDamage(spell, levelUsed);
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
    const maxSlots = concentrationSlotCount(items);
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
      const tracked = await tryTrackConcentration(levelUsed);
      if (tracked) continueAfterCast(levelUsed);
    } finally { setCasting(false); }
  };

  // Free cast via a feat's charge (e.g. Draconic Healing, once per long rest) - always
  // at the spell's own base level, independent of whether a slot was ever available.
  const doFreeCast = async () => {
    setCasting(true);
    try {
      await useFeature(freeUseFeature);
      setCast(`Cast free (${freeUseFeature})!`);
      const tracked = await tryTrackConcentration(spell.level_int);
      if (tracked) continueAfterCast(spell.level_int);
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
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
                  <div style={{color:'var(--text-dim)',fontSize:10}}>{spell.damage_type} · [{damageResult.rolls.join(', ')}]{damageResult.bonus ? ` ${damageResult.bonus>=0?'+':''}${damageResult.bonus}` : ''}</div>
                </div>
                {damageResult.secondaryResult && (
                  <div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.secondaryResult.total}</div>
                    <div style={{color:'var(--text-dim)',fontSize:10}}>{damageResult.secondary.type} · [{damageResult.secondaryResult.rolls.join(', ')}]</div>
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={rollNow}>Reroll</button>
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
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={finish}>Skip</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={rollNow}>Roll Damage?</button>
              </div>
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
                    {metamagicAvailable && (
                      <div style={{marginBottom:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{color:'var(--text-dim)',fontSize:12}}>Metamagic:</span>
                          <select value={metamagicChoice} onChange={e => setMetamagicChoice(e.target.value)}>
                            <option value="">None</option>
                            {knownMetamagic.map(name => {
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
                    {!isCantrip && freeUseAvailable && (
                      <button className="btn btn-primary" style={{width:'100%',marginBottom:8}} disabled={casting} onClick={doFreeCast}>
                        {casting ? 'Casting...' : `Cast Free (${freeUseFeature}: ${freeUseCharge.current}/${freeUseCharge.max})`}
                      </button>
                    )}
                    {!isCantrip && availableLevels.length === 0 ? (
                      !freeUseAvailable && <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>No spell slots available.</div>
                    ) : (
                      <button className="btn btn-primary" style={{width:'100%'}} disabled={casting} onClick={doCast}>
                        {casting ? 'Casting...' : isCantrip ? 'Cast (Cantrip)' : `Cast — Use Level ${castLevel} Slot`}
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
