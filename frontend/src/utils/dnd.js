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

export const calcSaves = (abilityScores, className, level, explicitProfs) => {
  const prof = profBonus(level);
  const profs = explicitProfs && explicitProfs.length ? explicitProfs : (SAVE_PROFS[className] || []);
  return Object.fromEntries(
    ABILITY_KEYS.map(ab => {
      const base = modifier(abilityScores[ab] || 10);
      const bonus = profs.includes(ab) ? base + prof : base;
      return [ab, { bonus, proficient: profs.includes(ab) }];
    })
  );
};

export const calcSkills = (abilityScores, proficiencies = [], expertises = [], level) => {
  const prof = profBonus(level);
  return Object.entries(SKILL_MAP).map(([skill, ab]) => {
    const base = modifier(abilityScores[ab] || 10);
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
export const maxPreparedSpells = (classNameRaw, abilityScores) => {
  if (!classNameRaw) return null;
  const parts = String(classNameRaw).split('/').map(p => p.trim());
  const m = parts[0].match(/^(.+?)\s+(\d+)\s*$/);
  if (!m) return null;
  const className = m[1].trim();
  const classLevel = parseInt(m[2]);
  const ability = PREPARED_CASTER_ABILITY[className];
  if (!ability) return null;
  const mod = modifier(abilityScores?.[ability] ?? 10);
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
};
