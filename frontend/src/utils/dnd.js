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

// Manually-built characters get this feature named "Font of Magic (Sorcerer Points)"
// straight from content_packs.py, but PDF-imported characters carry over whatever D&D
// Beyond printed - usually the bare "Font of Magic", since the rename only applies going
// forward through the engine, not retroactively to already-imported data. Detection stays
// substring-based (sorceryFeatureName = .find(n => n.toLowerCase().includes('font of
// magic'))) so this works either way; this just fixes what gets DISPLAYED for the bare
// case, without touching the underlying tracker_key/feature name (renaming that on a live
// character would break every reference to it - the slot conversions, Metamagic spend, etc).
export const sorceryDisplayName = (name) => {
  if (!name) return name;
  const lower = name.toLowerCase();
  if (lower.includes('sorcery points') || lower.includes('sorcerer points')) return name;
  return `${name} (Sorcery Points)`;
};

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

// Unarmored base AC formula - varies by class. A "Set Base AC To" item buff (heavy
// armor, medium armor, light armor) overrides this entirely while equipped; this is the
// fallback when no such override is present (i.e. the character is unarmored). The
// features arg allows detecting Draconic Resilience specifically even if the subclass
// string doesn't contain "Draconic" (PDF-imported characters may have the feature listed).
export const unarmoredAC = (classNameRaw, abilityScores, features) => {
  const dexMod = modifier(abilityScores?.DEX ?? 10);
  const classLower = (classNameRaw || '').toLowerCase();
  if (classLower.includes('barbarian')) {
    return { formula: '10 + DEX + CON', ac: 10 + dexMod + modifier(abilityScores?.CON ?? 10) };
  }
  if (classLower.includes('monk')) {
    return { formula: '10 + DEX + WIS', ac: 10 + dexMod + modifier(abilityScores?.WIS ?? 10) };
  }
  if (Object.keys(features || {}).some(n => n.toLowerCase().includes('draconic resilience'))) {
    return { formula: '13 + DEX (Draconic Resilience)', ac: 13 + dexMod };
  }
  return { formula: '10 + DEX', ac: 10 + dexMod };
};

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
// Bard/Sorcerer/Warlock know a fixed number of spells and don't prepare a daily subset.
// Ranger is a known caster in 2014 rules; in 2024 rules it became a prepared caster.
export const KNOWN_SPELL_CASTERS = new Set(['Bard','Sorcerer','Warlock']);

// Returns null if the class doesn't use daily spell preparation (e.g. Sorcerer/Bard/Warlock
// know fixed spells permanently). Handles multiclass correctly by summing across every
// prepared-caster class found in the string - a Cleric 5/Wizard 5 prepares WIS+5 + INT+5
// spells, not just one or the other. Accepts `totalLevel` as a fallback for plain class
// strings without a level number (e.g. "Wizard" from a manually-created character, where
// the level lives on the character model, not embedded in class_name).
export const maxPreparedSpells = (classNameRaw, abilityScores, items, totalLevel) => {
  if (!classNameRaw) return null;
  const effAb = items ? effectiveAbilityScores(abilityScores, items) : abilityScores;
  const parsed = parseClassLevels(classNameRaw);
  if (parsed.length > 0) {
    let total = 0; let anyPrepared = false;
    for (const { className, level } of parsed) {
      const ability = PREPARED_CASTER_ABILITY[className];
      if (!ability) continue;
      anyPrepared = true;
      const mod = modifier(effAb?.[ability] ?? 10);
      const effLvl = HALF_LEVEL_PREP_CLASSES.includes(className) ? Math.floor(level / 2) : level;
      total += Math.max(0, effLvl + mod);
    }
    return anyPrepared ? Math.max(1, total) : null;
  }
  // Plain class name without a level number — fall back to totalLevel param.
  if (!totalLevel) return null;
  const cls = classNameRaw.trim();
  const ability = PREPARED_CASTER_ABILITY[cls];
  if (!ability) return null;
  const mod = modifier(effAb?.[ability] ?? 10);
  const effLvl = HALF_LEVEL_PREP_CLASSES.includes(cls) ? Math.floor(totalLevel / 2) : totalLevel;
  return Math.max(1, effLvl + mod);
};

// Message shown in the level-up "done" screen reminding the player what spell work to
// do now. Covers three cases: full-list prepared casters (update your daily list),
// Wizard specifically (copy 2 new spells into spellbook AND update prep list), and
// known-spell casters (learn a new permanent spell). Returns null for non-casters.
export const spellLevelUpNote = (classNameRaw, leveledClass, newLevel, classLevel, abilityScores, items) => {
  const cls = leveledClass || (parseClassLevels(classNameRaw)[0]?.className) || classNameRaw?.trim();
  if (!cls) return null;
  const prepLimit = maxPreparedSpells(classNameRaw, abilityScores, items, newLevel);
  // Wizard: copies 2 free spells into spellbook per level AND has a prepared limit
  if (cls === 'Wizard') {
    return `📚 Add 2 new spells to your spellbook (Spells → Edit Known Spells). Your prepared limit is now ${prepLimit ?? '?'} — update your list in Manage Lists.`;
  }
  // Other prepared casters: daily list may now fit more spells
  if (PREPARED_CASTER_ABILITY[cls] && !KNOWN_SPELL_CASTERS.has(cls)) {
    if (prepLimit == null) return null;
    return `📋 Your prepared spell limit is now ${prepLimit}. Update your daily list via Spells → Manage Lists.`;
  }
  // Known-spell casters: learn a new permanent spell this level
  if (KNOWN_SPELL_CASTERS.has(cls)) {
    return `✨ You can learn 1 new spell permanently (Spells → Edit Known Spells).`;
  }
  return null;
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

// RAW: Cleric/Druid/Paladin have access to their entire class spell list and choose
// which to prepare each day, rather than "knowing" a curated subset the way a Wizard's
// spellbook works (Artificer is technically a known-spells half-caster in 2014 rules,
// included here anyway per the owner's explicit call; the three homebrew classes are
// included on the same basis - not an attempt at RAW accuracy for them, since this app
// has no rules text for them to check against). Drives whether the Spells tab
// auto-populates known_spells from the full class list (see SpellsTab.js) instead of
// requiring the player to manually Browse & Add one at a time.
export const FULL_LIST_CASTER_CLASSES = ['Cleric', 'Druid', 'Paladin', 'Artificer', 'Pugilist', 'Illrigger', 'Blood Hunter'];

// Multiclass-aware: a Paladin/Sorcerer only gets the full-list treatment for the
// Paladin half - the Sorcerer half stays a manually-curated known-spells list, same as
// a single-class Sorcerer. Falls back to treating the whole string as one class name for
// a clean, non-decorated value (e.g. "Cleric") since parseClassLevels only matches the
// decorated "Name LEVEL" pattern PDF imports and multiclass strings use.
export const fullListCasterClassNames = (classNameRaw) => {
  const parsed = parseClassLevels(classNameRaw);
  const names = parsed.length ? parsed.map(p => p.className) : [classNameRaw];
  return names.filter(n => FULL_LIST_CASTER_CLASSES.includes(n));
};

export const isFullListCaster = (classNameRaw) => fullListCasterClassNames(classNameRaw).length > 0;

// Highest spell level this character currently has a real slot for - the level cap for
// auto-populating a full-list caster's master spell list. Cantrips are handled
// separately (always included, not slot-gated) by the caller.
export const maxCastableSpellLevel = (spellSlots) =>
  Object.entries(spellSlots || {}).reduce((max, [lvl, s]) => (s?.max > 0 ? Math.max(max, parseInt(lvl)) : max), 0);

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

// A character can track up to two companion slots (e.g. a Blood Hunter's normal form and
// Hybrid Transformation, or a familiar plus an animal companion) but only one is ever "in
// play" at a time - tracker_data.active_companion (1 or 2) picks which. Falls back to slot
// 1 whenever slot 2 isn't enabled, so turning slot 2 off in Settings never leaves the app
// pointed at a companion that no longer exists.
export const activeCompanionKey = (td) => (td?.active_companion === 2 && td?.companion2?.enabled) ? 'companion2' : 'companion';

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
  // Body armor (heavy armor especially) replaces the unarmored AC calculation entirely
  // rather than adding to it the way a shield/ring/cloak does - kept separate from the
  // additive ac_base bonus below so a Plate Armor item's "Set Base AC To 18" and a
  // Shield's plain "+2 AC" can both be equipped at once and combine correctly (override
  // the base, then add the shield on top), instead of summing two flat numbers that don't
  // actually stack that way in 5e. Takes the max across equipped items, same precedent as
  // ability score overrides, for the rare case of more than one equipped at once.
  let acOverride = null;
  (items || []).forEach(it => {
    if (!isItemActive(it)) return;
    (it.buffs || []).forEach(b => {
      if (!b || !b.stat) return;
      if (b.mode === 'set' && ABILITY_KEYS.includes(b.stat)) {
        abilityOverrides[b.stat] = Math.max(abilityOverrides[b.stat] ?? -Infinity, b.value || 0);
      } else if (b.mode === 'add' && ABILITY_KEYS.includes(b.stat)) {
        abilityAdds[b.stat] = (abilityAdds[b.stat] || 0) + (b.value || 0);
      } else if ((b.mode === 'set' || b.mode === 'set_dex' || b.mode === 'set_ability') && b.stat === 'ac_base') {
        // 'set'          — flat value (heavy armor that ignores DEX, e.g. Plate = 18)
        // 'set_ability'  — base + chosen ability mod (Robe of Archmagi: 15+DEX,
        //                   Mage Armor: 13+DEX, Chain Shirt: 13+DEX). Stores b.ability.
        // 'set_dex'      — legacy alias for set_ability with DEX (kept for existing data).
        // Tracks the highest BASE value offered; the caller adds the ability mod at render.
        const abilityKey = b.mode === 'set_dex' ? 'DEX' : (b.ability || null);
        const entry = { value: b.value || 0, ability: abilityKey };
        if (acOverride === null || b.value > (acOverride.value ?? -Infinity)) acOverride = entry;
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
  // acOverrideRaw carries the {value, ability} shape so callers can add the right ability
  // mod at display time. acOverride (the plain number) is kept for callers that don't need
  // the ability detail — they'd use acOverrideRaw instead if they do.
  const acOverrideRaw = acOverride;
  const acOverrideFlatValue = acOverride !== null ? acOverride.value : null;
  return { ...bonuses, acOverride: acOverrideFlatValue, acOverrideRaw, abilityOverrides, abilityAdds, advantageSaves, resistances, immunities, vulnerabilities, conditionImmunities };
};

// A feat's buffs (AC/saves/spell attack-DC/ability scores/weapon mods/resistances etc.,
// same editor as AddItemModal's) are always-on once you have the feat - there's no
// equip/attune step the way an item has one. Rather than duplicating computeItemBonuses'
// whole aggregation a second time for feats, this synthesizes a feat into the exact shape
// an always-equipped, attunement-not-required item already takes, so every existing
// consumer (computeItemBonuses, effectiveAbilityScores, calcSaves, calcSkills,
// getSpellcastingBlocks) picks feat buffs up automatically just by including these
// alongside the real items array passed in - no changes needed to any of them.
export const featBuffItems = (features) =>
  Object.entries(features || {})
    .filter(([, f]) => (f.buffs || []).length > 0)
    .map(([name, f]) => ({ name, equipped: true, attunement: false, buffs: f.buffs }));

// RAW racial ability score increases, keyed by the same flat decorated race string
// (e.g. "Dwarf (Hill)") the Race dropdown/manual character creation already use - best-
// effort from training knowledge for anything past the core 9 PHB races (same "type in
// the well-known mechanical numbers, not the copyrighted flavor text" approach already
// used for feats.json's expansion), not pulled from a licensed dataset, so double-check
// against the printed source if a player disputes a specific number. Half-Elf's actual
// RAW grants +1/+1 to two abilities OF THE PLAYER'S CHOICE on top of the flat CHA+2 -
// that choice can't be represented in a flat table, so only the guaranteed CHA+2 is
// applied here, same "track what's computable, the player applies the choice-based rest
// themselves" philosophy already used for Resilient/Half-Elf-style feats. Empty/missing
// entries (including "Custom") simply contribute no bonus.
export const RACE_ABILITY_BONUSES = {
  'Dragonborn': [{ stat: 'STR', value: 2 }, { stat: 'CHA', value: 1 }],
  'Dwarf (Hill)': [{ stat: 'CON', value: 2 }, { stat: 'WIS', value: 1 }],
  'Dwarf (Mountain)': [{ stat: 'CON', value: 2 }, { stat: 'STR', value: 2 }],
  'Elf (High)': [{ stat: 'DEX', value: 2 }, { stat: 'INT', value: 1 }],
  'Elf (Wood)': [{ stat: 'DEX', value: 2 }, { stat: 'WIS', value: 1 }],
  'Elf (Dark/Drow)': [{ stat: 'DEX', value: 2 }, { stat: 'CHA', value: 1 }],
  'Gnome (Forest)': [{ stat: 'INT', value: 2 }, { stat: 'DEX', value: 1 }],
  'Gnome (Rock)': [{ stat: 'INT', value: 2 }, { stat: 'CON', value: 1 }],
  'Half-Elf': [{ stat: 'CHA', value: 2 }],
  'Half-Orc': [{ stat: 'STR', value: 2 }, { stat: 'CON', value: 1 }],
  'Halfling (Lightfoot)': [{ stat: 'DEX', value: 2 }, { stat: 'CHA', value: 1 }],
  'Halfling (Stout)': [{ stat: 'DEX', value: 2 }, { stat: 'CON', value: 1 }],
  'Human': [{ stat: 'STR', value: 1 }, { stat: 'DEX', value: 1 }, { stat: 'CON', value: 1 }, { stat: 'INT', value: 1 }, { stat: 'WIS', value: 1 }, { stat: 'CHA', value: 1 }],
  'Tiefling': [{ stat: 'CHA', value: 2 }, { stat: 'INT', value: 1 }],
  'Aasimar': [{ stat: 'CHA', value: 2 }, { stat: 'WIS', value: 1 }],
  'Firbolg': [{ stat: 'WIS', value: 2 }, { stat: 'STR', value: 1 }],
  'Goliath': [{ stat: 'STR', value: 2 }, { stat: 'CON', value: 1 }],
  'Kenku': [{ stat: 'DEX', value: 2 }, { stat: 'WIS', value: 1 }],
  'Lizardfolk': [{ stat: 'CON', value: 2 }, { stat: 'WIS', value: 1 }],
  'Tabaxi': [{ stat: 'DEX', value: 2 }, { stat: 'CHA', value: 1 }],
  'Triton': [{ stat: 'STR', value: 1 }, { stat: 'CON', value: 1 }, { stat: 'CHA', value: 1 }],
  'Yuan-Ti Pureblood': [{ stat: 'CHA', value: 2 }, { stat: 'INT', value: 1 }],
  'Bugbear': [{ stat: 'STR', value: 2 }, { stat: 'DEX', value: 1 }],
  'Goblin': [{ stat: 'DEX', value: 2 }, { stat: 'CON', value: 1 }],
  'Hobgoblin': [{ stat: 'CON', value: 2 }, { stat: 'INT', value: 1 }],
  'Kobold': [{ stat: 'DEX', value: 2 }, { stat: 'STR', value: -2 }],
  'Orc': [{ stat: 'STR', value: 2 }, { stat: 'CON', value: 1 }],
  'Tortle': [{ stat: 'STR', value: 2 }, { stat: 'WIS', value: 1 }],
  'Shadar-kai': [{ stat: 'DEX', value: 2 }, { stat: 'WIS', value: 1 }],
};

// Synthesizes a race's ability bonuses into the same always-equipped, no-attunement
// "item" shape featBuffItems already uses for feats - every existing buff consumer
// (computeItemBonuses, effectiveAbilityScores, calcSaves, calcSkills,
// getSpellcastingBlocks) picks it up automatically by including this alongside the real
// items array, no changes needed to any of them. A negative racial modifier (Kobold's
// STR-2) is a genuine ADD-mode buff here, not a floor like a Set-To item buff - RAW
// racial penalties do lower the score, unlike a magic item that only ever raises one.
export const raceBuffItems = (race) => {
  const bonuses = RACE_ABILITY_BONUSES[race];
  if (!bonuses || !bonuses.length) return [];
  return [{ name: race, equipped: true, attunement: false, buffs: bonuses.map(b => ({ stat: b.stat, mode: 'add', value: b.value })) }];
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

// A feat granting a flat weapon attack/damage bonus applies to EVERY weapon attack the
// character makes, unlike an item's own weapon_attack_modifier/weapon_damage_modifier
// (weaponItemBonus above), which is intrinsically tied to that one weapon and must never
// leak onto a character's other weapons. Reads tracker_data.features directly (not the
// featBuffItems-synthesized item shape computeItemBonuses/effectiveAbilityScores use) -
// there's no equip/attune step to gate a feat's bonus on, same "always active once you
// have the feature" rule Fighting Styles already follow below.
export const featWeaponBonus = (features) => {
  const bonus = { attack: 0, damage: 0 };
  Object.values(features || {}).forEach(f => {
    (f.buffs || []).forEach(b => {
      if (b?.stat === 'weapon_attack_modifier') bonus.attack += b.value || 0;
      if (b?.stat === 'weapon_damage_modifier') bonus.damage += b.value || 0;
    });
  });
  return bonus;
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

// Detects the real-world failure mode behind "unequipping a Set-To-X item didn't lower
// my score back down, and a different belt's lower value didn't move it either": the
// floor in effectiveAbilityScores is correct RAW behavior (a worse item never lowers an
// already-higher score), but it silently defends a contaminated number forever if the
// RAW base itself ever got baked-in from a Set-To buff - usually because a PDF import
// captured the character sheet's printed (already-buffed) score as if it were the
// unmodified base, since a real character sheet has no separate "base" field to read.
// There's no way to algorithmically recover the true base after the fact, so this can't
// auto-fix anything - it just flags an ability whose RAW score exactly matches the
// Set-To value of SOME item in the character's inventory (equipped or not, current belt
// or an old one), which is a strong tell that the number isn't really an unbuffed base,
// so the player knows exactly which ability to manually correct and why.
export const suspectedAbilityContamination = (abilityScores, items) => {
  const flags = {};
  ABILITY_KEYS.forEach(ab => {
    const raw = abilityScores?.[ab];
    if (raw == null) return;
    const match = (items || []).find(it => (it.buffs || []).some(b => b && b.mode === 'set' && b.stat === ab && b.value === raw));
    if (match) flags[ab] = match.name;
  });
  return flags;
};

// Best-effort guess at a PDF-imported character's true raw (pre-modifier) ability
// scores, since the D&D Beyond export only ever has the final, already-modified number -
// there's no separate "base" field anywhere in the PDF to parse. Subtracts any ADD-mode
// item/race bonus (those are safely reversible - effective = raw + bonus). A SET-mode
// item bonus (e.g. a Belt of Giant Strength) is NOT safely reversible the same way -
// effective = max(raw, override), so if the imported score exactly matches that item's
// override value (suspectedAbilityContamination's signal), the true raw is genuinely
// unknowable from the final number alone. Rather than leave the contaminated number in
// place, this falls back to a conservative, clearly-a-guess floor (10 + any racial bonus)
// for just that ability, so the player edits from an honest "we don't know" starting
// point instead of unknowingly keeping a number that's already double-counting the item.
export const guessRawAbilityScores = (importedScores, race, items) => {
  const allItems = [...(items || []), ...raceBuffItems(race)];
  const { abilityAdds } = computeItemBonuses(allItems);
  const contamination = suspectedAbilityContamination(importedScores, items);
  const raceAdds = computeItemBonuses(raceBuffItems(race)).abilityAdds;
  const guesses = {};
  ABILITY_KEYS.forEach(ab => {
    const imported = importedScores?.[ab] ?? 10;
    if (contamination[ab]) {
      guesses[ab] = 10 + (raceAdds[ab] || 0);
    } else {
      guesses[ab] = imported - (abilityAdds[ab] || 0);
    }
  });
  return guesses;
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

// RAW: a damage-dealing cantrip's dice double at 5th character level, triple at 11th,
// quadruple at 17th - based on total CHARACTER level, unlike a leveled spell's upcast
// scaling below which is keyed off the slot it's cast with. Doesn't apply to the handful
// of weapon-attack cantrips (Booming Blade etc.) that scale via cantrip_hit_bonus_by_level
// instead - those have no damage_dice of their own (their damage comes from the weapon),
// so scaleSpellDamage's own `if (!spell?.damage_dice) return null` already excludes them.
const cantripDiceMultiplier = (characterLevel) => {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5) return 2;
  return 1;
};

// Scales a spell's printed damage_dice up using its higher_level scaling text, if the
// spell was cast above its base level. Only handles the common "+NdM per slot level
// above Xth" phrasing; spells that scale differently (e.g. extra missiles) aren't scaled.
// `characterLevel` is optional and only used for the cantrip-scaling case above - omit it
// (or pass a falsy value) to get the pre-cantrip-scaling behavior unchanged.
export const scaleSpellDamage = (spell, castLevel, characterLevel) => {
  if (!spell?.damage_dice) return null;
  const base = spell.damage_dice.match(/(\d+)d(\d+)\s*(?:\+\s*(\d+))?/i);
  if (!base) return null;
  let count = parseInt(base[1]);
  const sides = parseInt(base[2]);
  const bonus = base[3] ? parseInt(base[3]) : 0;
  if (spell.level_int === 0) {
    if (characterLevel) count *= cantripDiceMultiplier(characterLevel);
  } else {
    // base_level_int (set when a spell is resolved from an item's fixed cast_level) is the
    // spell's true base level - level_int itself may already be overridden to the cast level.
    const baseLevel = spell.base_level_int ?? spell.level_int;
    if (spell.higher_level && castLevel > baseLevel) {
      const scale = spell.higher_level.match(/increases by (\d+)d(\d+) for each slot level above (\d+)/i);
      if (scale && parseInt(scale[2]) === sides) {
        count += (castLevel - parseInt(scale[3])) * parseInt(scale[1]);
      }
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
