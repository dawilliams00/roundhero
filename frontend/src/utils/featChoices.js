import api from './api';

// A few feats need a one-time choice made AT THE MOMENT they're taken (Resilient: which
// ability; Magic Initiate: which class list, which spellcasting ability, which 2 cantrips
// + 1 first-level spell) - previously every one of these just had instructional text
// telling the player to go apply it themselves elsewhere in the app. This resolves a
// feat's CHOICE-SPECIFIC side effects only (ability bump/save proficiency, spell grants) -
// the normal "attach this feat as an ability" logic (TrackerTab's addFeatFromLibrary,
// LevelUpFlowModal's submitFeat) still runs separately afterward, same as any other feat.
export const FEAT_CHOICE_TYPES = ['ability_save_increase', 'magic_initiate', 'skill_proficiencies'];

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
