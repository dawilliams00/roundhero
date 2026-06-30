import api from './api';

// A few feats need a one-time choice made AT THE MOMENT they're taken (Resilient: which
// ability; Magic Initiate: which class list, which spellcasting ability, which 2 cantrips
// + 1 first-level spell) - previously every one of these just had instructional text
// telling the player to go apply it themselves elsewhere in the app. This resolves a
// feat's CHOICE-SPECIFIC side effects only (ability bump/save proficiency, spell grants) -
// the normal "attach this feat as an ability" logic (TrackerTab's addFeatFromLibrary,
// LevelUpFlowModal's submitFeat) still runs separately afterward, same as any other feat.
export const FEAT_CHOICE_TYPES = ['ability_save_increase', 'magic_initiate', 'skill_proficiencies'];

// Shared "attach this feat as an ability" builder - previously duplicated identically in
// TrackerTab.js and LevelUpFlowModal.js (and now a third caller, BackgroundSelectModal.js,
// when a chosen background grants an Origin feat), risking the exact "three copies
// drifting apart" mistake this codebase has been bitten by before with item/feat buffs.
// Pure builder, no commit - callers fold the result into their own single updateCharacter
// call, optionally alongside a choice-feat's extra patches from resolveFeatChoice below.
// Returns 'duplicate' if the feat (by name) is already attached, or {newAe, newTd, newSd}.
export async function buildFeatAttachPatch(feat, character) {
  const ae = character.ae_data || {};
  const td = character.tracker_data || {};
  const key = feat.name;
  const alreadyHas = Object.values(ae).some(arr => (arr || []).some(a => a.tracker_key === key));
  if (alreadyHas) return 'duplicate';
  const newAbility = { name: feat.name, source: feat.source, source_type: 'custom', cost_type: feat.cost_type, tracker_key: key, description: feat.description };
  const newAe = { ...ae };
  if (!newAe[feat.section]) newAe[feat.section] = [];
  newAe[feat.section] = [...newAe[feat.section], newAbility];
  const newTd = { ...td };
  if (feat.max_uses > 0 || feat.isTuck || feat.grantsSpell || feat.buffs?.length > 0) {
    newTd.features = {
      ...newTd.features,
      [key]: {
        current: feat.max_uses || 0, max: feat.max_uses || 0,
        rest_type: feat.rest_type, action: feat.section, description: feat.description,
        ...(feat.isTuck ? { spell_picker: true, tucked_spell: '', tucked_level: '' } : {}),
        ...(feat.grantsSpell ? { granted_spell: feat.grantedSpellName, ability_override: feat.abilityOverride || null } : {}),
        ...(feat.buffs?.length ? { buffs: feat.buffs } : {}),
      },
    };
  }
  let newSd = null;
  if (feat.grantsSpell && feat.grantedSpellName) {
    try {
      const r = await api.get('/content/spells');
      const master = r.data.find(s => s.name.toLowerCase() === feat.grantedSpellName.toLowerCase());
      const sd = character.spell_data || {};
      const known = sd.known_spells || [];
      if (master && !known.some(s => s.name.toLowerCase() === master.name.toLowerCase())) {
        newSd = { ...sd, known_spells: [...known, { ...master, granted_by: feat.name, ability_override: feat.abilityOverride || null, free_use_feature: key }] };
      }
    } catch {
      // Non-fatal - the feature/charge still gets attached even if the spell lookup failed.
    }
  }
  return { newAe, newTd, newSd };
}

// Resolves choiceData (gathered by FeatChoiceModal) into the actual patches a caller needs
// to apply. Async because Magic Initiate needs to look up the chosen spells' full data.
export async function resolveFeatChoice(feat, choiceData) {
  if (feat.choice_type === 'ability_save_increase') {
    const { ability } = choiceData;
    if (!ability) return null;
    return { abilityScoreIncrease: { [ability]: 1 }, saveProficiencyAdd: ability };
  }
  if (feat.choice_type === 'magic_initiate') {
    const { magicInitiateClass, ability, cantrips, levelOneSpell } = choiceData;
    if (!magicInitiateClass || !ability || (cantrips || []).length !== 2 || !levelOneSpell) return null;
    const r = await api.get('/content/spells', { params: { class_name: magicInitiateClass } });
    const findByName = name => (r.data || []).find(s => s.name.toLowerCase() === name.toLowerCase());
    const featKey = `Magic Initiate (${magicInitiateClass})`;
    const newKnownSpells = [];
    cantrips.forEach(name => {
      const master = findByName(name);
      if (master) newKnownSpells.push({ ...master, granted_by: feat.name, ability_override: ability });
    });
    const lvl1 = findByName(levelOneSpell);
    if (lvl1) newKnownSpells.push({ ...lvl1, granted_by: feat.name, ability_override: ability, free_use_feature: featKey });
    return {
      newKnownSpells,
      newFeature: {
        key: featKey, current: 1, max: 1, rest_type: 'long', action: 'Cast a Spell',
        description: `Magic Initiate (${magicInitiateClass}): ${levelOneSpell} can be cast once free, regaining the ability on a long rest. Also always knows ${cantrips.join(' and ')}.`,
      },
    };
  }
  if (feat.choice_type === 'skill_proficiencies') {
    const { skills } = choiceData;
    const count = feat.choice_count || 3;
    if (!skills || skills.length !== count) return null;
    return { skillProficienciesAdd: skills };
  }
  return null;
}
