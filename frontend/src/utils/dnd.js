// Haste grants +2 AC and advantage on Dex saves while active, and inflicts "lethargy"
// (can't move/act/react until the end of your next turn) the instant it ends. Lethargy
// isn't an SRD condition (won't be in conditions.json), so it gets a hardcoded
// description here instead of coming from the API.
export const HASTED_EFFECT = 'Hasted';
export const LETHARGIC_CONDITION = 'Lethargic';
export const HARDCODED_CONDITION_INFO = {
  Lethargic: "When Haste ends, you can't move or take actions or reactions until the end of your next turn.",
};

// RAW (PHB 2014) exhaustion levels - not in conditions.json since exhaustion is tracked
// as its own 0-6 integer, not a checkable condition. Effects are cumulative.
export const EXHAUSTION_RAW_TEXT = `Effects are cumulative - each level includes the effects of all lower levels.

1: Disadvantage on ability checks
2: Speed halved
3: Disadvantage on attack rolls and saving throws
4: Hit point maximum halved
5: Speed reduced to 0
6: Death

Finishing a long rest reduces a creature's exhaustion level by 1, provided they have also had some food and drink.`;

// Sorcerer's Font of Magic / Metamagic, paraphrased in our own words (mechanical intent
// only, not the printed rules text) - point cost per option, plus a short plain-language
// summary the player applies themselves. Twinned Spell's cost depends on the spell being
// cast (its level, minimum 1 for a cantrip); every other option is a flat cost. The 8
// PHB options plus Tasha's Cauldron's Seeking Spell and Transmuted Spell.
export const METAMAGIC_OPTIONS = {
  'Careful Spell':    { cost: 1, text: "Pick up to your CHA modifier (minimum 1) creatures who'd be forced to save against this spell - they automatically succeed, no roll needed." },
  'Distant Spell':    { cost: 1, text: "Double this spell's range. If it's a touch spell, its range becomes 30 feet instead." },
  'Empowered Spell':  { cost: 1, text: "Reroll up to your CHA modifier (minimum 1) of this spell's damage dice and keep the new results. Only once per casting." },
  'Extended Spell':   { cost: 1, text: "Double this spell's duration (must be 1 minute or longer to start), up to a 24-hour cap." },
  'Heightened Spell': { cost: 3, text: "One target of this spell has disadvantage on its first saving throw against it." },
  'Quickened Spell':  { cost: 2, text: "Cast this spell as a bonus action instead of its normal action casting time." },
  'Subtle Spell':     { cost: 1, text: "Cast this spell with no verbal or somatic components." },
  'Twinned Spell':    { cost: 'level', text: "This spell can only target one creature and doesn't say \"self\" - target a second creature in range with the same casting. Costs sorcery points equal to the spell's level (1 for a cantrip)." },
  'Seeking Spell':    { cost: 2, text: "(Tasha's Cauldron) If this spell needed an attack roll and missed, reroll the d20 and use the new result. Stacks with another Metamagic option used this same cast." },
  'Transmuted Spell': { cost: 1, text: "(Tasha's Cauldron) Swap this spell's damage type to a different one from acid, cold, fire, lightning, poison, or thunder." },
};

export const metamagicCost = (optionName, spell) => {
  const opt = METAMAGIC_OPTIONS[optionName];
  if (!opt) return 0;
  return opt.cost === 'level' ? Math.max(1, spell?.level_int || 1) : opt.cost;
};

// Flexible Casting (also Font of Magic): converting points into a slot costs more than
// the slot's level, converting a slot into points gives back exactly the slot's level.
// No slot higher than 5th can be created this way.
export const SORCERY_POINTS_TO_SLOT_COST = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

export const ABILITY_KEYS = ['STR','DEX','CON','INT','WIS','CHA'];
export const ABILITY_LABELS = { STR:'Strength', DEX:'Dexterity', CON:'Constitution', INT:'Intelligence', WIS:'Wisdom', CHA:'Charisma' };
export const SKILL_MAP = {
  'Acrobatics':'DEX','Animal Handling':'WIS','Arcana':'INT','Athletics':'STR',
  'Deception':'CHA','History':'INT','Insight':'WIS','Intimidation':'CHA',
  'Investigation':'INT','Medicine':'WIS','Nature':'INT','Perception':'WIS',
  'Performance':'CHA','Persuasion':'CHA','Religion':'INT','Sleight of Hand':'DEX',
  'Stealth':'DEX','Survival':'WIS',
};
export const SAVE_PROFS = {
  Barbarian:['STR','CON'], Bard:['DEX','CHA'], Cleric:['WIS','CHA'],
  Druid:['INT','WIS'], Fighter:['STR','CON'], Monk:['STR','DEX'],
  Paladin:['WIS','CHA'], Ranger:['STR','DEX'], Rogue:['DEX','INT'],
  Sorcerer:['CON','CHA'], Warlock:['WIS','CHA'], Wizard:['INT','WIS'],
};
export const PROF_BONUS = {1:2,2:2,3:2,4:2,5:3,6:3,7:3,8:3,9:4,10:4,11:4,12:4,13:5,14:5,15:5,16:5,17:6,18:6,19:6,20:6};
export const HIT_DIE = { Barbarian:12, Fighter:10, Paladin:10, Ranger:10, Monk:8, Rogue:8, Bard:8, Cleric:8, Druid:8, Warlock:8, Sorcerer:6, Wizard:6 };

export const modifier = score => Math.floor((score - 10) / 2);
export const modStr   = score => { const m = modifier(score); return m >= 0 ? `+${m}` : `${m}`; };
export const profBonus = level => PROF_BONUS[level] || 2;

export const calcSaves = (abilityScores, className, level, explicitProfs, items) => {
  const prof = profBonus(level);
  const profs = explicitProfs && explicitProfs.length ? explicitProfs : (SAVE_PROFS[className] || []);
  const effAb = items ? effectiveAbilityScores(abilityScores, items) : abilityScores;
  const itemBonus = items ? computeItemBonuses(items).saving_throw_modifier : 0;
  return Object.fromEntries(
    ABILITY_KEYS.map(ab => {
      const base = modifier(effAb[ab] || 10);
      const bonus = (profs.includes(ab) ? base + prof : base) + itemBonus;
      return [ab, { bonus, proficient: profs.includes(ab) }];
    })
  );
};

export const calcSkills = (abilityScores, proficiencies = [], expertises = [], level, items) => {
  const prof = profBonus(level);
  const effAb = items ? effectiveAbilityScores(abilityScores, items) : abilityScores;
  return Object.entries(SKILL_MAP).map(([skill, ab]) => {
    const base = modifier(effAb[ab] || 10);
    const isExpertise = expertises.includes(skill);
    const isProf = proficiencies.includes(skill);
    const bonus = isExpertise ? base + prof*2 : isProf ? base + prof : base;
    return { skill, ability: ab, bonus, proficient: isProf, expertise: isExpertise };
  });
};

export const hpColor = (current, max) => {
  const pct = max > 0 ? current / max : 0;
  if (pct > 0.5) return 'var(--hp-high)';
  if (pct > 0.25) return 'var(--hp-mid)';
  return 'var(--hp-low)';
};

export const slotColor = level => `var(--slot-${Math.min(level, 9)})`;

export const PREPARED_CASTER_ABILITY = { Wizard:'INT', Cleric:'WIS', Druid:'WIS', Paladin:'CHA', Ranger:'WIS', Artificer:'INT' };
export const HALF_LEVEL_PREP_CLASSES = ['Paladin','Ranger','Artificer'];

// Returns null if the class doesn't use daily spell preparation (e.g. Sorcerer/Bard/Warlock know fixed spells)
export const maxPreparedSpells = (classNameRaw, abilityScores, items) => {
  if (!classNameRaw) return null;
  const parts = String(classNameRaw).split('/').map(p => p.trim());
  const m = parts[0].match(/^(.+?)\s+(\d+)\s*$/);
  if (!m) return null;
  const className = m[1].trim();
  const classLevel = parseInt(m[2]);
  const ability = PREPARED_CASTER_ABILITY[className];
  if (!ability) return null;
  const effAb = items ? effectiveAbilityScores(abilityScores, items) : abilityScores;
  const mod = modifier(effAb?.[ability] ?? 10);
  const effLevel = HALF_LEVEL_PREP_CLASSES.includes(className) ? Math.floor(classLevel / 2) : classLevel;
  return Math.max(1, effLevel + mod);
};

export const SECTION_ORDER = ['Action','Bonus Action','Reaction','Free Action','Passive'];
export const SECTION_COLORS = {
  'Action':       '#7f0000',
  'Bonus Action': '#e65100',
  'Reaction':     '#4a0072',
  'Free Action':  '#1b5e20',
  'Passive':      '#212121',
  'Haste':        '#006064',
};

// Which action-economy bucket a spell's printed casting time belongs to.
export const spellCastBucket = (castingTime) => {
  const t = (castingTime || '').toLowerCase();
  if (t.includes('bonus action')) return 'Bonus Action';
  if (t.includes('reaction')) return 'Reaction';
  return 'Action';
};

export const rollD20 = () => 1 + Math.floor(Math.random() * 20);
export const rollDie = sides => 1 + Math.floor(Math.random() * sides);

export const SCHOOL_COLORS = {
  Abjuration:     '#4A90E2',
  Conjuration:    '#F5A623',
  Divination:     '#9013FE',
  Enchantment:    '#E91E63',
  Evocation:      '#FF5722',
  Illusion:       '#607D8B',
  Necromancy:     '#795548',
  Transmutation:  '#4CAF50',
};
export const schoolColor = school => SCHOOL_COLORS[school] || 'var(--text-primary)';

// Slot levels 1-3 use light backgrounds (see --slot-1/2/3 in index.css) where white text
// fails contrast - use dark text on those, white on the darker levels 4-9.
const LIGHT_SLOT_LEVELS = new Set([1, 2, 3]);
export const slotBadgeTextColor = level => LIGHT_SLOT_LEVELS.has(level) ? '#16213e' : '#fff';

export const SPELLCASTING_ABILITY = { Bard:'CHA', Cleric:'WIS', Druid:'WIS', Paladin:'CHA', Ranger:'WIS', Sorcerer:'CHA', Warlock:'CHA', Wizard:'INT', Artificer:'INT' };

// "Wizard 13" -> [{className:"Wizard",level:13}]; "Wizard 10 / Fighter 3" -> both parts.
export const parseClassLevels = (classNameRaw) => {
  if (!classNameRaw) return [];
  return String(classNameRaw).split('/').map(part => {
    const m = part.trim().match(/^(.+?)\s+(\d+)\s*$/);
    return m ? { className: m[1].trim(), level: parseInt(m[2]) } : null;
  }).filter(Boolean);
};

// Most characters can only concentrate on one spell at a time; a small number of
// items/features grant a second slot. Rather than hardcoding a specific item name,
// this scans equipped+attuned items for a description that reads like it grants a
// second concentration slot.
export const concentrationSlotCount = (items) => {
  for (const it of (items || [])) {
    if (!it.equipped) continue;
    if (it.attunement && !it.attuned) continue;
    const desc = (it.description || '').toLowerCase();
    if (desc.includes('concentration') && /second|two|additional/.test(desc)) return 2;
  }
  return 1;
};

// Whether an item's buffs are currently "live" - worn/wielded, and attuned if
// attunement is required. Shared by every buff consumer so the gating rule can't
// drift between them (Staff of the Magi/Robe of the Archmagi being gated wrong
// was a real bug here once).
export const isItemActive = (item) => {
  if (!item?.equipped) return false;
  if (item.attunement && !item.attuned) return false;
  return true;
};

// Aggregates "while equipped (and attuned, if required)" stat buffs across inventory
// items. ADD-mode buffs on recognized stats sum together; SET-mode buffs on an ability
// score (e.g. Headband of Intellect) track the highest value offered, since RAW
// ability-score-setting items don't stack and have no effect if your score is already
// higher.
const ADDITIVE_BUFF_STATS = ['ac_base', 'saving_throw_modifier', 'spell_attack_modifier', 'spell_dc_modifier'];
export const computeItemBonuses = (items) => {
  const bonuses = { ac_base: 0, saving_throw_modifier: 0, spell_attack_modifier: 0, spell_dc_modifier: 0 };
  const abilityOverrides = {};
  const abilityAdds = {};
  const advantageSaves = [];
  const resistances = [];
  const immunities = [];
  const vulnerabilities = [];
  const conditionImmunities = [];
  (items || []).forEach(it => {
    if (!isItemActive(it)) return;
    (it.buffs || []).forEach(b => {
      if (!b || !b.stat) return;
      if (b.mode === 'set' && ABILITY_KEYS.includes(b.stat)) {
        abilityOverrides[b.stat] = Math.max(abilityOverrides[b.stat] ?? -Infinity, b.value || 0);
      } else if (b.mode === 'add' && ABILITY_KEYS.includes(b.stat)) {
        abilityAdds[b.stat] = (abilityAdds[b.stat] || 0) + (b.value || 0);
      } else if (b.stat === 'advantage_save') {
        advantageSaves.push({ ability: b.ability || 'all', source: it.name });
      } else if (b.stat === 'damage_resistance') {
        resistances.push({ type: b.damage_type, source: it.name });
      } else if (b.stat === 'damage_immunity') {
        immunities.push({ type: b.damage_type, source: it.name });
      } else if (b.stat === 'damage_vulnerability') {
        vulnerabilities.push({ type: b.damage_type, source: it.name });
      } else if (b.stat === 'condition_immunity') {
        conditionImmunities.push({ condition: b.condition, source: it.name });
      } else if (ADDITIVE_BUFF_STATS.includes(b.stat)) {
        bonuses[b.stat] += b.value || 0;
      }
    });
  });
  return { ...bonuses, abilityOverrides, abilityAdds, advantageSaves, resistances, immunities, vulnerabilities, conditionImmunities };
};

// Weapon attack/damage buffs (e.g. a +1 longsword) are intrinsically tied to that
// one weapon - they must NOT pool across a character's other weapons the way
// computeItemBonuses pools AC/saves/spell bonuses character-wide.
export const weaponItemBonus = (weapon) => {
  const bonus = { attack: 0, damage: 0 };
  if (!isItemActive(weapon)) return bonus;
  (weapon.buffs || []).forEach(b => {
    if (b?.stat === 'weapon_attack_modifier') bonus.attack += b.value || 0;
    if (b?.stat === 'weapon_damage_modifier') bonus.damage += b.value || 0;
  });
  return bonus;
};

// Finesse picks the better of STR/DEX; ranged weapons use DEX; everything else
// (including melee weapons with Thrown) uses STR, per RAW.
export const weaponAbilityMod = (weapon, effAb) => {
  const props = weapon?.properties || [];
  if (props.includes('Finesse')) return Math.max(modifier(effAb?.STR ?? 10), modifier(effAb?.DEX ?? 10));
  if (weapon?.weapon_range === 'Ranged') return modifier(effAb?.DEX ?? 10);
  return modifier(effAb?.STR ?? 10);
};

// Flat, always-on Fighting Style bonuses computable purely from data this app already
// has - detected by feature name (same substring approach as Extra Attack/Sorcery
// Points), not a separate "which style did you pick" setting, since a PDF-imported
// character's sheet already has a feature literally named after the style. Styles with a
// situational/manual rider (Great Weapon Fighting's reroll, Two-Weapon Fighting's off-
// hand modifier, Protection's reaction, etc.) aren't modeled - same "track what's
// computable, the player applies the rest" philosophy as everything else this app
// doesn't mechanically enforce.
export const hasFightingStyle = (features, styleName) => {
  const target = styleName.toLowerCase();
  return Object.keys(features || {}).some(n => n.toLowerCase().includes(target));
};

// Dueling (+2 damage) requires the weapon to actually be held in one hand right now -
// false for anything with the Two-Handed property, and false for a Versatile weapon
// currently toggled two-handed (the existing "Wielding two-handed" checkbox IS the same
// fact Dueling's "one hand" requirement cares about, so no separate input is needed).
// Archery (+2 to attack rolls) only needs the weapon to be Ranged.
export const fightingStyleBonus = (features, weapon) => {
  const bonus = { attack: 0, damage: 0 };
  if (!weapon) return bonus;
  const isRanged = weapon.weapon_range === 'Ranged';
  const heldOneHanded = !isRanged && !(weapon.properties || []).includes('Two-Handed') && !weapon.two_handed;
  if (heldOneHanded && hasFightingStyle(features, 'Dueling')) bonus.damage += 2;
  if (isRanged && hasFightingStyle(features, 'Archery')) bonus.attack += 2;
  return bonus;
};

// Which damage dice apply right now - the Versatile two-handed die if the player
// has it gripped two-handed, otherwise the weapon's base damage.
export const weaponDamageDice = (weapon) => {
  if (weapon?.two_handed && weapon?.two_handed_damage) return weapon.two_handed_damage;
  return { damage_dice: weapon?.damage_dice, damage_type: weapon?.damage_type };
};

const BUFF_STAT_LABELS = {
  ac_base: 'AC',
  saving_throw_modifier: 'All saving throws',
  spell_attack_modifier: 'Spell attack rolls',
  spell_dc_modifier: 'Spell save DC',
  weapon_attack_modifier: 'Weapon attack rolls',
  weapon_damage_modifier: 'Weapon damage',
};

// Human-readable line for a single item buff entry, for read-only display in item modals.
export const formatItemBuff = (b) => {
  if (!b || !b.stat) return '';
  if (b.mode === 'set' && ABILITY_KEYS.includes(b.stat)) {
    return `${ABILITY_LABELS[b.stat]} becomes ${b.value}`;
  }
  if (b.mode === 'add' && ABILITY_KEYS.includes(b.stat)) {
    return `${ABILITY_LABELS[b.stat]}: +${b.value}`;
  }
  if (b.stat === 'advantage_save') {
    return `Advantage on ${b.ability && b.ability !== 'all' ? `${ABILITY_LABELS[b.ability] || b.ability} ` : 'all '}saving throws`;
  }
  if (b.stat === 'damage_resistance') return `Resistance to ${b.damage_type} damage`;
  if (b.stat === 'damage_immunity') return `Immunity to ${b.damage_type} damage`;
  if (b.stat === 'damage_vulnerability') return `Vulnerability to ${b.damage_type} damage`;
  if (b.stat === 'condition_immunity') return `Immune to being ${b.condition}`;
  const label = BUFF_STAT_LABELS[b.stat] || b.stat.replace(/_/g, ' ');
  return `${label}: +${b.value}`;
};

// Ability scores after applying any item overrides - "set" buffs (Headband of
// Intellect, Belt of Giant Strength, etc.) are a floor, never lowering a score, taken
// BEFORE "add" buffs (a flat +N regardless of current score) are summed on top - this
// ordering matches how a player would naturally read two stacked effects on the same
// score, even though RAW rarely has both on one character at once.
export const effectiveAbilityScores = (abilityScores, items) => {
  const { abilityOverrides, abilityAdds } = computeItemBonuses(items);
  const out = { ...abilityScores };
  ABILITY_KEYS.forEach(k => {
    let v = out[k] ?? 10;
    if (abilityOverrides[k] != null) v = Math.max(v, abilityOverrides[k]);
    if (abilityAdds[k]) v += abilityAdds[k];
    out[k] = v;
  });
  return out;
};

// Sum of any equipped (and, where required, attuned) items' spell attack/DC buffs
// (e.g. Staff of the Magi, Robe of the Archmagi).
export const itemSpellBonuses = (items) => {
  const { spell_attack_modifier, spell_dc_modifier } = computeItemBonuses(items);
  return { atk: spell_attack_modifier, dc: spell_dc_modifier };
};

// One block per spellcasting class (multiclass characters get one each).
export const getSpellcastingBlocks = (classNameRaw, abilityScores, totalLevel, items) => {
  const parts = parseClassLevels(classNameRaw);
  const list = parts.length ? parts : [{ className: classNameRaw, level: totalLevel }];
  const prof = profBonus(totalLevel);
  const { spell_attack_modifier: itemAtk, spell_dc_modifier: itemDc } = computeItemBonuses(items);
  const effAb = effectiveAbilityScores(abilityScores, items);
  return list
    .filter(p => SPELLCASTING_ABILITY[p.className])
    .map(p => {
      const ability = SPELLCASTING_ABILITY[p.className];
      const mod = modifier(effAb?.[ability] ?? 10);
      return {
        className: p.className, ability,
        attackMod: mod + prof + itemAtk,
        saveDC: 8 + mod + prof + itemDc,
      };
    });
};

// Some feats grant a known spell with its OWN fixed spellcasting ability, overriding
// whatever the character's class would normally use for it (e.g. Draconic Healing lets
// you pick INT/WIS/CHA for the granted Cure Wounds, independent of your class). Same
// attack/DC math as getSpellcastingBlocks, just keyed off one fixed ability instead of
// the class->ability map - this is also why it works for non-casters with no spellBlocks.
export const getAbilityOverrideBlock = (ability, abilityScores, totalLevel, items) => {
  const prof = profBonus(totalLevel);
  const { spell_attack_modifier: itemAtk, spell_dc_modifier: itemDc } = computeItemBonuses(items);
  const effAb = effectiveAbilityScores(abilityScores, items);
  const mod = modifier(effAb?.[ability] ?? 10);
  return { className: null, ability, attackMod: mod + prof + itemAtk, saveDC: 8 + mod + prof + itemDc };
};

// Scales a spell's printed damage_dice up using its higher_level scaling text, if the
// spell was cast above its base level. Only handles the common "+NdM per slot level
// above Xth" phrasing; spells that scale differently (e.g. extra missiles) aren't scaled.
export const scaleSpellDamage = (spell, castLevel) => {
  if (!spell?.damage_dice) return null;
  const base = spell.damage_dice.match(/(\d+)d(\d+)\s*(?:\+\s*(\d+))?/i);
  if (!base) return null;
  let count = parseInt(base[1]);
  const sides = parseInt(base[2]);
  const bonus = base[3] ? parseInt(base[3]) : 0;
  // base_level_int (set when a spell is resolved from an item's fixed cast_level) is the
  // spell's true base level - level_int itself may already be overridden to the cast level.
  const baseLevel = spell.base_level_int ?? spell.level_int;
  if (spell.higher_level && castLevel > baseLevel) {
    const scale = spell.higher_level.match(/increases by (\d+)d(\d+) for each slot level above (\d+)/i);
    if (scale && parseInt(scale[2]) === sides) {
      count += (castLevel - parseInt(scale[3])) * parseInt(scale[1]);
    }
  }
  const result = { count, sides, bonus, label: `${count}d${sides}${bonus ? `+${bonus}` : ''}` };
  // A few spells deal two different damage types in one hit (Ice Storm: bludgeoning + cold,
  // Flame Strike: fire + radiant, Meteor Swarm: fire + bludgeoning) - damage_dice/damage_type
  // alone can only model one. secondary_damage_dice/type carries the other. Fixed at its
  // printed dice, not scaled - none of these spells scale the secondary half on upcast.
  if (spell.secondary_damage_dice) {
    const sec = spell.secondary_damage_dice.match(/(\d+)d(\d+)\s*(?:\+\s*(\d+))?/i);
    if (sec) {
      const sCount = parseInt(sec[1]);
      const sSides = parseInt(sec[2]);
      const sBonus = sec[3] ? parseInt(sec[3]) : 0;
      result.secondary = { count: sCount, sides: sSides, bonus: sBonus, label: `${sCount}d${sSides}${sBonus ? `+${sBonus}` : ''}`, type: spell.secondary_damage_type };
    }
  }
  return result;
};

// Returns the individual die results alongside the total, so the UI can show "3, 6 (+9)
// = 18" instead of just a final number - the player asked to actually see what was rolled
// rather than trust an opaque sum.
export const rollDamageDetailed = ({ count, sides, bonus }) => {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
  return { rolls, bonus: bonus || 0, total: rolls.reduce((a,b) => a+b, 0) + (bonus || 0) };
};

export const rollDamage = (spec) => rollDamageDetailed(spec).total;

// Several weapon-attack cantrips (Booming Blade, Green-Flame Blade, etc.) gain an
// on-hit bonus damage die that scales with CHARACTER level, not spell slot level - a
// different mechanic from scaleSpellDamage's upcast scaling, and not a uniform 1x/2x/3x
// multiplier either (e.g. Booming Blade has no on-hit bonus at all below 5th level).
// cantrip_hit_bonus_by_level is an array of {level, dice} tiers, ascending; this picks
// the highest tier the character qualifies for, or null below the first tier's level.
export const cantripHitBonusForLevel = (tiers, level) => {
  if (!tiers || !tiers.length) return null;
  let chosen = null;
  for (const t of tiers) {
    if (level >= t.level) chosen = t.dice;
  }
  return chosen;
};

// Monk's Martial Arts die scales with MONK level specifically (not total character
// level for a multiclass like Monk 11 / Barbarian 2), and lets you use DEX instead of
// STR for unarmed strikes - reuses parseClassLevels (same multiclass-string parsing
// already used for spell-list filtering) rather than assuming class_name is a clean
// single class name, so this works for PDF-imported/multiclass characters the same way
// it does for a manually-built single-class Monk. Returns the die's side count (4/6/8/10)
// or null if the character has no Monk levels at all.
export const martialArtsDie = (classNameRaw, totalLevel) => {
  const parts = parseClassLevels(classNameRaw);
  let monkLevel = null;
  if (parts.length) {
    const monk = parts.find(p => p.className.toLowerCase().includes('monk'));
    if (monk) monkLevel = monk.level;
  } else if ((classNameRaw || '').toLowerCase().includes('monk')) {
    monkLevel = totalLevel;
  }
  if (monkLevel == null) return null;
  if (monkLevel >= 17) return 10;
  if (monkLevel >= 11) return 8;
  if (monkLevel >= 5) return 6;
  return 4;
};

// Extra Attack (Fighter/Paladin/etc.) grants a second attack - detected by feature name
// substring, same approach as the Sorcery Points/Divine Smite name-based detection
// elsewhere, so it works for both engine-built and PDF-imported characters regardless of
// exact spelling. No support yet for 3+ attacks (Fighter 11/20) - same scoped-out
// territory as the rest of this app's "the mechanism exists, not every edge case" stance.
export const maxAttacksForCharacter = (features) =>
  Object.keys(features || {}).some(n => n.toLowerCase().includes('extra attack')) ? 2 : 1;

// Parses a recharge formula like "4d6 + 2" into {count, sides, bonus} for rollDamage.
// Mirrors the backend's old roll_dice regex (now removed server-side - recharge rolls
// are player-initiated from the item's Recharge button, not auto-rolled on rest).
export const parseDiceFormula = (formula) => {
  const m = String(formula || '').match(/^\s*(\d+)\s*d\s*(\d+)\s*(?:\+\s*(\d+))?\s*$/i);
  if (!m) return null;
  return { count: parseInt(m[1]), sides: parseInt(m[2]), bonus: parseInt(m[3] || 0) };
};
