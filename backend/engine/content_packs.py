"""
Stock 5e content packs.
Each class has: hit_die, primary_ability, saves, features per level, spell_slots per level.
"""

CLASSES = {
    "Barbarian": {
        "hit_die": 12, "primary_ability": "STR",
        "saves": ["STR", "CON"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Rage", "max": 2, "rest_type": "long", "action": "Bonus Action", "description": "Enter a rage. Advantage on STR checks/saves, bonus damage on STR attacks, resistance to physical damage. Lasts 1 min."},
                 {"name": "Unarmored Defense", "max": 0, "rest_type": "long", "action": "Passive", "description": "AC = 10 + DEX modifier + CON modifier when not wearing armor."}],
            2:  [{"name": "Reckless Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Advantage on first STR attack roll each turn, but attacks against you have advantage until your next turn."},
                 {"name": "Danger Sense", "max": 0, "rest_type": "long", "action": "Passive", "description": "Advantage on DEX saves against visible effects."}],
            3:  [{"name": "Primal Path", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Primal Path subclass."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack twice when you take the Attack action."},
                 {"name": "Fast Movement", "max": 0, "rest_type": "long", "action": "Passive", "description": "+10 ft speed when not wearing heavy armor."}],
            7:  [{"name": "Feral Instinct", "max": 0, "rest_type": "long", "action": "Passive", "description": "Advantage on initiative. Can enter rage to act normally if surprised."}],
            9:  [{"name": "Brutal Critical", "max": 0, "rest_type": "long", "action": "Passive", "description": "Roll one additional weapon damage die on critical hits."}],
            11: [{"name": "Relentless Rage", "max": 0, "rest_type": "short", "action": "Passive", "description": "When reduced to 0 HP while raging, DC 10 CON save (increases by 5 each use) to drop to 1 HP instead."}],
            15: [{"name": "Persistent Rage", "max": 0, "rest_type": "long", "action": "Passive", "description": "Rage only ends early if you fall unconscious or choose to end it."}],
            20: [{"name": "Primal Champion", "max": 0, "rest_type": "long", "action": "Passive", "description": "+4 STR, +4 CON."}],
        },
        "rage_uses": {1: 2, 3: 3, 6: 4, 12: 5, 17: 6, 20: "unlimited"},
        "rage_damage": {1: 2, 9: 3, 16: 4},
    },
    "Bard": {
        "hit_die": 8, "primary_ability": "CHA",
        "saves": ["DEX", "CHA"], "is_spellcaster": True, "spellcasting_ability": "CHA",
        "features": {
            1:  [{"name": "Bardic Inspiration", "max": 0, "rest_type": "short", "action": "Bonus Action", "description": "Give one creature a Bardic Inspiration die (d6 at L1). They can add it to one ability check, attack, or save within 10 min."},
                 {"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "You can cast bard spells using CHA as your spellcasting ability."}],
            2:  [{"name": "Jack of All Trades", "max": 0, "rest_type": "long", "action": "Passive", "description": "Add half proficiency bonus to ability checks you're not proficient in."},
                 {"name": "Song of Rest", "max": 0, "rest_type": "long", "action": "Passive", "description": "Allies regain extra HP during short rests when you play music (d6 at L2)."}],
            3:  [{"name": "Bard College", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Bard College subclass."},
                 {"name": "Expertise", "max": 0, "rest_type": "long", "action": "Passive", "description": "Double proficiency bonus on two chosen skills."}],
            5:  [{"name": "Font of Inspiration", "max": 0, "rest_type": "long", "action": "Passive", "description": "Regain Bardic Inspiration on short or long rest."}],
            6:  [{"name": "Countercharm", "max": 0, "rest_type": "long", "action": "Action", "description": "Use action to give nearby allies advantage on saves vs charm/fright."}],
            10: [{"name": "Magical Secrets", "max": 0, "rest_type": "long", "action": "Passive", "description": "Learn 2 spells from any class."}],
            20: [{"name": "Superior Inspiration", "max": 0, "rest_type": "long", "action": "Passive", "description": "Regain at least one Bardic Inspiration when you roll initiative."}],
        },
    },
    "Cleric": {
        "hit_die": 8, "primary_ability": "WIS",
        "saves": ["WIS", "CHA"], "is_spellcaster": True, "spellcasting_ability": "WIS",
        "features": {
            1:  [{"name": "Divine Domain", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Divine Domain subclass."},
                 {"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast cleric spells using WIS as your spellcasting ability."},
                 {"name": "Channel Divinity", "max": 1, "rest_type": "short", "action": "Action", "description": "Use a Channel Divinity option from your domain or Turn Undead."}],
            2:  [{"name": "Turn Undead", "max": 0, "rest_type": "long", "action": "Passive", "description": "Channel Divinity: undead within 30 ft must flee on failed WIS save."}],
            5:  [{"name": "Destroy Undead", "max": 0, "rest_type": "long", "action": "Passive", "description": "Turn Undead instantly destroys undead of CR 1/2 or lower."}],
            10: [{"name": "Divine Intervention", "max": 1, "rest_type": "long", "action": "Action", "description": "Call on your deity for aid. Roll d100 — succeeds if roll ≤ cleric level."}],
        },
        "channel_divinity_uses": {1: 1, 6: 2, 18: 3},
    },
    "Druid": {
        "hit_die": 8, "primary_ability": "WIS",
        "saves": ["INT", "WIS"], "is_spellcaster": True, "spellcasting_ability": "WIS",
        "features": {
            1:  [{"name": "Druidic", "max": 0, "rest_type": "long", "action": "Passive", "description": "Know Druidic language. Leave hidden messages only druids can spot."},
                 {"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast druid spells using WIS as your spellcasting ability."}],
            2:  [{"name": "Wild Shape", "max": 2, "rest_type": "short", "action": "Action", "description": "Magically transform into a beast you have seen. CR limit and restrictions apply based on level."},
                 {"name": "Druid Circle", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Druid Circle subclass."}],
            18: [{"name": "Timeless Body", "max": 0, "rest_type": "long", "action": "Passive", "description": "Age 10x slower. Immune to magical aging."},
                 {"name": "Beast Spells", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast spells in Wild Shape form (no material components with hands)."}],
            20: [{"name": "Archdruid", "max": 0, "rest_type": "long", "action": "Passive", "description": "Unlimited Wild Shape uses."}],
        },
    },
    "Fighter": {
        "hit_die": 10, "primary_ability": "STR or DEX",
        "saves": ["STR", "CON"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Second Wind", "max": 1, "rest_type": "short", "action": "Bonus Action", "description": "Regain 1d10 + fighter level HP."},
                 {"name": "Fighting Style", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose a fighting style specialty."}],
            2:  [{"name": "Action Surge", "max": 1, "rest_type": "short", "action": "Action", "description": "Take one additional action this turn."}],
            3:  [{"name": "Martial Archetype", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Martial Archetype subclass."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack twice when you take the Attack action."}],
            9:  [{"name": "Indomitable", "max": 1, "rest_type": "long", "action": "Passive", "description": "Reroll a failed saving throw, using the new roll."}],
            11: [{"name": "Extra Attack (2)", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack three times when you take the Attack action."}],
            17: [{"name": "Action Surge (2)", "max": 0, "rest_type": "long", "action": "Passive", "description": "Action Surge can be used twice before a rest."},
                 {"name": "Indomitable (3)", "max": 0, "rest_type": "long", "action": "Passive", "description": "Indomitable can be used three times per long rest."}],
            20: [{"name": "Extra Attack (3)", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack four times when you take the Attack action."}],
        },
        "action_surge_uses": {2: 1, 17: 2},
        "indomitable_uses": {9: 1, 13: 2, 17: 3},
    },
    "Monk": {
        "hit_die": 8, "primary_ability": "DEX and WIS",
        "saves": ["STR", "DEX"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Unarmored Defense", "max": 0, "rest_type": "long", "action": "Passive", "description": "AC = 10 + DEX + WIS when unarmored."},
                 {"name": "Martial Arts", "max": 0, "rest_type": "long", "action": "Passive", "description": "Use DEX for unarmed strikes. Bonus unarmed strike after Attack action."}],
            2:  [{"name": "Ki", "max": 0, "rest_type": "short", "action": "Passive", "description": "Spend Ki points to fuel monk abilities. Ki = monk level."},
                 {"name": "Flurry of Blows", "max": 0, "rest_type": "short", "action": "Bonus Action", "description": "Spend 1 Ki after Attack action — make 2 unarmed strikes."},
                 {"name": "Patient Defense", "max": 0, "rest_type": "short", "action": "Bonus Action", "description": "Spend 1 Ki to Dodge as a bonus action."},
                 {"name": "Step of the Wind", "max": 0, "rest_type": "short", "action": "Bonus Action", "description": "Spend 1 Ki to Dash or Disengage as bonus action. Jump distance doubled."}],
            3:  [{"name": "Monastic Tradition", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Monastic Tradition subclass."},
                 {"name": "Deflect Missiles", "max": 0, "rest_type": "long", "action": "Reaction", "description": "Reduce ranged weapon damage by 1d10 + DEX + monk level. Catch if reduced to 0."}],
            4:  [{"name": "Slow Fall", "max": 0, "rest_type": "long", "action": "Reaction", "description": "Reduce falling damage by 5x monk level."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack twice when you take the Attack action."},
                 {"name": "Stunning Strike", "max": 0, "rest_type": "long", "action": "Passive", "description": "Spend 1 Ki on hit — CON save or target stunned until end of your next turn."}],
        },
    },
    "Paladin": {
        "hit_die": 10, "primary_ability": "STR and CHA",
        "saves": ["WIS", "CHA"], "is_spellcaster": True, "spellcasting_ability": "CHA",
        "features": {
            1:  [{"name": "Divine Sense", "max": 0, "rest_type": "long", "action": "Action", "description": "Detect celestials, fiends, undead within 60 ft. Uses = 1 + CHA modifier."},
                 {"name": "Lay on Hands", "max": 0, "rest_type": "long", "action": "Action", "description": "Heal HP pool = paladin level x 5. Cure disease/poison for 5 HP per effect."}],
            2:  [{"name": "Fighting Style", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose a fighting style specialty."},
                 {"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast paladin spells using CHA as your spellcasting ability."},
                 {"name": "Divine Smite", "max": 0, "rest_type": "long", "action": "Passive", "description": "On hit, spend a spell slot to deal 2d8 radiant + 1d8 per slot level above 1st (max 5d8). +1d8 vs undead/fiends."}],
            3:  [{"name": "Sacred Oath", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Sacred Oath subclass."},
                 {"name": "Divine Health", "max": 0, "rest_type": "long", "action": "Passive", "description": "Immune to disease."},
                 {"name": "Channel Divinity", "max": 1, "rest_type": "short", "action": "Action", "description": "Use a Channel Divinity option from your Sacred Oath."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack twice when you take the Attack action."}],
            6:  [{"name": "Aura of Protection", "max": 0, "rest_type": "long", "action": "Passive", "description": "You and allies within 10 ft add CHA modifier to saving throws (min +1)."}],
            10: [{"name": "Aura of Courage", "max": 0, "rest_type": "long", "action": "Passive", "description": "You and allies within 10 ft can't be frightened while you're conscious."}],
            11: [{"name": "Improved Divine Smite", "max": 0, "rest_type": "long", "action": "Passive", "description": "+1d8 radiant damage on all melee weapon hits."}],
        },
    },
    "Ranger": {
        "hit_die": 10, "primary_ability": "DEX and WIS",
        "saves": ["STR", "DEX"], "is_spellcaster": True, "spellcasting_ability": "WIS",
        "features": {
            1:  [{"name": "Favored Enemy", "max": 0, "rest_type": "long", "action": "Passive", "description": "Advantage on Survival to track chosen enemy type. Advantage on INT checks about them."},
                 {"name": "Natural Explorer", "max": 0, "rest_type": "long", "action": "Passive", "description": "Expertise in chosen terrain type. Various exploration bonuses."}],
            2:  [{"name": "Fighting Style", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose a fighting style specialty."},
                 {"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast ranger spells using WIS as your spellcasting ability."}],
            3:  [{"name": "Ranger Archetype", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Ranger Archetype subclass."},
                 {"name": "Primeval Awareness", "max": 0, "rest_type": "long", "action": "Action", "description": "Spend a spell slot to sense aberrations, celestials, dragons, elementals, fey, fiends, undead within 1 mile."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attack twice when you take the Attack action."}],
        },
    },
    "Rogue": {
        "hit_die": 8, "primary_ability": "DEX",
        "saves": ["DEX", "INT"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Expertise", "max": 0, "rest_type": "long", "action": "Passive", "description": "Double proficiency on two chosen skills."},
                 {"name": "Sneak Attack", "max": 0, "rest_type": "long", "action": "Passive", "description": "Once per turn, deal extra damage when you have advantage or an ally is adjacent to the target (1d6 per 2 rogue levels)."},
                 {"name": "Thieves Cant", "max": 0, "rest_type": "long", "action": "Passive", "description": "Know thieves cant language and secret signs."}],
            2:  [{"name": "Cunning Action", "max": 0, "rest_type": "long", "action": "Bonus Action", "description": "Dash, Disengage, or Hide as a bonus action."}],
            3:  [{"name": "Roguish Archetype", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Roguish Archetype subclass."}],
            5:  [{"name": "Uncanny Dodge", "max": 0, "rest_type": "long", "action": "Reaction", "description": "When an attacker you can see hits you, halve the damage."}],
            7:  [{"name": "Evasion", "max": 0, "rest_type": "long", "action": "Passive", "description": "On DEX save for half damage, take none on success and half on fail."}],
            11: [{"name": "Reliable Talent", "max": 0, "rest_type": "long", "action": "Passive", "description": "Treat any roll below 10 as a 10 for proficient skill checks."}],
            14: [{"name": "Blindsense", "max": 0, "rest_type": "long", "action": "Passive", "description": "Aware of hidden/invisible creatures within 10 ft."}],
            18: [{"name": "Elusive", "max": 0, "rest_type": "long", "action": "Passive", "description": "Attackers never have advantage against you while you're not incapacitated."}],
            20: [{"name": "Stroke of Luck", "max": 1, "rest_type": "short", "action": "Passive", "description": "Turn a miss into a hit or a failed ability check into a 20."}],
        },
    },
    "Sorcerer": {
        "hit_die": 6, "primary_ability": "CHA",
        "saves": ["CON", "CHA"], "is_spellcaster": True, "spellcasting_ability": "CHA",
        "features": {
            1:  [{"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast sorcerer spells using CHA as your spellcasting ability."},
                 {"name": "Sorcerous Origin", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Sorcerous Origin subclass."}],
            2:  [{"name": "Font of Magic (Sorcery Points)", "max": 0, "rest_type": "long", "action": "Passive", "description": "Sorcery Points = sorcerer level. Spend on Metamagic, or use Flexible Casting to convert points to a spell slot or a slot to points."},
                 {"name": "Flexible Casting", "max": 0, "rest_type": "long", "action": "Passive", "description": "As a bonus action, convert sorcery points into a spell slot (no higher than 5th level) or convert a spell slot into sorcery points equal to its level. Slots created this way vanish on a long rest if unused."}],
            3:  [{"name": "Metamagic", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose 2 Metamagic options to modify your spells."}],
            20: [{"name": "Sorcerous Restoration", "max": 0, "rest_type": "long", "action": "Passive", "description": "Regain 4 sorcery points on short rest."}],
        },
    },
    "Warlock": {
        "hit_die": 8, "primary_ability": "CHA",
        "saves": ["WIS", "CHA"], "is_spellcaster": True, "spellcasting_ability": "CHA",
        "features": {
            1:  [{"name": "Otherworldly Patron", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Otherworldly Patron subclass."},
                 {"name": "Pact Magic", "max": 0, "rest_type": "short", "action": "Passive", "description": "Cast warlock spells using CHA. Slots regain on short or long rest."}],
            2:  [{"name": "Eldritch Invocations", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose 2 Eldritch Invocations to enhance your magic."}],
            3:  [{"name": "Pact Boon", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose Pact of the Chain, Blade, or Tome."}],
            11: [{"name": "Mystic Arcanum", "max": 1, "rest_type": "long", "action": "Passive", "description": "Cast one 6th-level spell without expending a slot."}],
            20: [{"name": "Eldritch Master", "max": 1, "rest_type": "long", "action": "Action", "description": "Spend 1 minute to regain all warlock spell slots."}],
        },
    },
    "Wizard": {
        "hit_die": 6, "primary_ability": "INT",
        "saves": ["INT", "WIS"], "is_spellcaster": True, "spellcasting_ability": "INT",
        "features": {
            1:  [{"name": "Spellcasting", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast wizard spells using INT as your spellcasting ability."},
                 {"name": "Arcane Recovery", "max": 1, "rest_type": "long", "action": "Action", "description": "Once per long rest during a short rest, recover spell slots totaling up to half your wizard level (rounded up)."}],
            2:  [{"name": "Arcane Tradition", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose your Arcane Tradition subclass."}],
            18: [{"name": "Spell Mastery", "max": 0, "rest_type": "long", "action": "Passive", "description": "Cast chosen 1st and 2nd level spells at their lowest level without expending a slot."}],
            20: [{"name": "Signature Spells", "max": 0, "rest_type": "long", "action": "Passive", "description": "Two 3rd-level spells become signature spells, always prepared and castable once each without a slot per short rest."}],
        },
    },
    # Artificer (official WotC content, Tasha's/Eberron) was missing from this engine
    # entirely before now - not a homebrew addition, just a pre-existing gap.
    "Artificer": {
        "hit_die": 8, "primary_ability": "INT",
        "saves": ["CON", "INT"], "is_spellcaster": True, "spellcasting_ability": "INT",
        "features": {
            1:  [{"name": "Magical Tinkering", "max": 0, "rest_type": "none", "action": "Action", "description": "Touch a Tiny nonmagical object (with thieves'/artisan's tools in hand) to give it a minor magical property of your choice: dim/bright light, a recorded 6-second message triggered on tap, a continuous sound/smell, or a static visual effect. Property lasts indefinitely until you end it as an action. Max objects affected at once equals your Intelligence modifier (minimum 1); exceeding that ends the oldest one."},
                 {"name": "Spellcasting", "max": 0, "rest_type": "none", "action": "Passive", "description": "Cast artificer spells using Intelligence, requiring thieves' tools or artisan's tools as a spellcasting focus. Spell save DC = 8 + proficiency bonus + INT modifier; spell attack modifier = proficiency bonus + INT modifier. Prepare a number of spells equal to INT modifier + half artificer level (rounded down, minimum 1); can change the prepared list after a long rest. Can cast ritual-tagged prepared spells as rituals."},
                 {"name": "Replicate Magic Item: Enhanced Weapon", "max": 0, "rest_type": "long", "action": "Passive", "description": "Infusion (2nd-level artificer minimum to learn alongside Infuse Item). Applied to a simple or martial weapon: grants +1 to attack and damage rolls with it, increasing to +2 at 10th artificer level."},
                 {"name": "Replicate Magic Item: Enhanced Defense", "max": 0, "rest_type": "long", "action": "Passive", "description": "Infusion applied to a suit of armor or a shield: grants +1 AC while worn/wielded, increasing to +2 at 10th artificer level."},
                 {"name": "Replicate Magic Item: Homunculus Servant", "max": 0, "rest_type": "long", "action": "Bonus Action", "description": "Infusion that creates a friendly Tiny construct companion (AC 13, HP = 1 + INT mod + artificer level, fly/walk speed, ranged force attack using your spell attack modifier). Shares your initiative, acts immediately after you; only takes Dodge unless you spend a bonus action to command another action. Heals 2d6 HP from mending; vanishes if it or you die."}],
            2:  [{"name": "Infuse Item", "max": 4, "rest_type": "long", "action": "Passive", "description": "Learn 4 artificer infusions (more at higher levels per the Infusions Known column). At the end of a long rest, infuse a number of nonmagical objects (up to the Infused Items column maximum) with known infusions, turning each into a magic item; can attune instantly if required. Infusion lasts until replaced or you die (then fades after days equal to INT modifier, minimum 1). Exceeding your max infused items ends the oldest infusion."}],
            3:  [{"name": "The Right Tool for the Job", "max": 0, "rest_type": "none", "action": "Action", "description": "With thieves' tools or artisan's tools, spend 1 hour of uninterrupted work (can coincide with a short/long rest) to magically create one set of artisan's tools in an empty space within 5 feet of you. Nonmagical; vanishes when you use this feature again."}],
            4:  [{"name": "Ability Score Improvement", "max": 0, "rest_type": "none", "action": "Passive", "description": "Increase one ability score by 2, or two ability scores by 1 each (max 20). Also gained at 8th, 12th, 16th, and 19th level."}],
            6:  [{"name": "Tool Expertise", "max": 0, "rest_type": "none", "action": "Passive", "description": "Your proficiency bonus is doubled for any ability check that uses your proficiency with a tool."},
                 {"name": "Replicate Magic Item: Repeating Shot", "max": 0, "rest_type": "long", "action": "Passive", "description": "Infusion applied to a weapon with the ammunition property (requires attunement): grants +1 attack/damage on ranged attacks, ignores the loading property, and auto-generates magic ammunition that vanishes after the attack if the weapon has none loaded."}],
            7:  [{"name": "Flash of Genius", "max": 0, "rest_type": "long", "action": "Reaction", "description": "When you or a creature you can see within 30 feet makes an ability check or saving throw, use your reaction to add your INT modifier to the roll. Usable a number of times equal to INT modifier (minimum 1) per long rest."}],
            10:  [{"name": "Magic Item Adept", "max": 0, "rest_type": "none", "action": "Passive", "description": "You can attune to up to 4 magic items at once. Crafting a common or uncommon magic item takes only a quarter of the normal time and half the usual gold cost."}],
            11:  [{"name": "Spell-Storing Item", "max": 1, "rest_type": "long", "action": "Passive", "description": "After a long rest, store a 1st- or 2nd-level artificer spell (1-action casting time, doesn't need to be prepared) into a weapon or spellcasting focus you touch. Any creature holding it can use an action to trigger the spell using your spellcasting modifier; spell remains until used a number of times equal to twice your INT modifier (minimum 2) or until you store a new spell."}],
            14:  [{"name": "Magic Item Savant", "max": 0, "rest_type": "none", "action": "Passive", "description": "You can attune to up to 5 magic items at once, and you ignore all class, race, spell, and level requirements for attuning to or using a magic item."},
                 {"name": "Replicate Magic Item: Arcane Propulsion Armor", "max": 0, "rest_type": "none", "action": "Passive", "description": "Infusion applied to a suit of armor (requires attunement): +5 ft walking speed; includes gauntlets that are proficient magic melee weapons (1d8 force, thrown 20/60 ft, return to wearer); armor can't be removed against the wearer's will and replaces missing limbs."}],
            18:  [{"name": "Magic Item Master", "max": 0, "rest_type": "none", "action": "Passive", "description": "You can attune to up to 6 magic items at once."}],
            20:  [{"name": "Soul of Artifice", "max": 0, "rest_type": "none", "action": "Reaction", "description": "Gain a +1 bonus to all saving throws per magic item you're currently attuned to. If reduced to 0 HP but not killed outright, use your reaction to end one of your artificer infusions to drop to 1 HP instead of 0."}],
        },
    },
    # Pugilist, Illrigger, and Blood Hunter are third-party/homebrew D&D Beyond classes
    # (Blood Hunter is Matthew Mercer's well-known homebrew), not official WotC content -
    # added so they're selectable in manual character creation alongside the 13 official
    # classes. Like every other class here, subclass-specific features live in the separate
    # searchable backend/data/class_features.json library (browse-and-add), not auto-granted
    # by this engine - see ClassFeatureBrowserModal.js.
    "Pugilist": {
        "hit_die": 10, "primary_ability": "STR",
        "saves": ["STR", "CON"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Fisticuffs", "max": 0, "rest_type": "none", "action": "Passive", "description": "While unarmed or wielding only Pugilist weapons (simple melee/improvised), wearing light or no armor, no shield: gain a bonus Unarmed Strike as a bonus action; roll a Fisticuffs die (1d8, scaling to 1d10 at 5th, 1d12 at 11th, 2d6 at 17th) in place of normal unarmed/Pugilist weapon damage; and improvised weapons gain the Sap weapon mastery property for you."},
                 {"name": "Iron Chin", "max": 0, "rest_type": "none", "action": "Passive", "description": "While wearing light or no armor and no shield, base AC = 12 + CON modifier (an alternative to the normal 10 + DEX or armor formula; choose whichever is higher)."}],
            2:  [{"name": "Moxie", "max": 2, "rest_type": "short", "action": "Passive", "description": "Gain a pool of Moxie Points (2 at 2nd level, scaling by level per the class table up to 12 at 20th) usable to fuel three known features: Brace Up (bonus action, spend 1 point, roll Fisticuffs die for temp HP equal to roll + Pugilist level + CON modifier, lasting 10 minutes), One-Two Punch (spend 1 point to make two Unarmed Strikes as a bonus action), and Stick and Move (bonus action, spend 1 point, make an Unarmed Strike and Dash or Disengage). All expended points restore on a short or long rest."},
                 {"name": "Bloodied But Unbowed", "max": 1, "rest_type": "short", "action": "Reaction", "description": "When you take damage, use your reaction to regain all expended Moxie Points; if Bloodied (at or below half HP) when you do, also gain temp HP equal to 4 times your Pugilist level (lasts until your next short rest). Usable once until a short or long rest."},
                 {"name": "Swagger Streak", "max": 0, "rest_type": "short", "action": "Free Action", "description": "When you fail a STR, DEX, CON, or CHA check, spend a Moxie Point to roll your Fisticuffs die and add it to the check, potentially turning it into a success. If it still fails, the point is refunded but this can't be used again until a short or long rest."}],
            3:  [{"name": "Heavy Hitter", "max": 0, "rest_type": "none", "action": "Passive", "description": "When you hit with an Unarmed Strike, you can apply both its damage and your choice of the Grapple or Shove option in the same attack."},
                 {"name": "Pugilist Subclass", "max": 0, "rest_type": "none", "action": "Passive", "description": "Choose a Pugilist subclass, granting features at 3rd, 6th, 11th, and 17th level."}],
            4:  [{"name": "Ability Score Improvement", "max": 0, "rest_type": "none", "action": "Passive", "description": "Gain a feat (typically Ability Score Improvement) of your choice. Gained again at 8th, 12th, and 16th level."},
                 {"name": "Dig Deep", "max": 1, "rest_type": "long", "action": "Bonus Action", "description": "For 10 minutes, gain resistance to bludgeoning/piercing/slashing damage and ignore the effects of exhaustion levels below 6. Usable once until a long rest, or restore its use early by taking 1 exhaustion level."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "none", "action": "Passive", "description": "Attack twice instead of once whenever you take the Attack action."},
                 {"name": "Haymaker", "max": 0, "rest_type": "none", "action": "Free Action", "description": "When attacking with an Unarmed Strike or Pugilist weapon, spend 1 Moxie Point to swing wildly; on a hit, regain the point and deal maximum damage with that attack."}],
            6:  [{"name": "Moxie-Fueled Fists", "max": 0, "rest_type": "none", "action": "Passive", "description": "Damage from your Unarmed Strike or an improvised weapon attack can be your choice of force damage or its normal type."}],
            7:  [{"name": "Down But Not Out", "max": 1, "rest_type": "long", "action": "Passive", "description": "When you use Bloodied But Unbowed while Bloodied, gain a damage bonus on your Unarmed Strikes/Pugilist weapon attacks for the next minute equal to CON modifier + your current exhaustion levels. Usable once until a long rest."}],
            9:  [{"name": "School of Hard Knocks", "max": 0, "rest_type": "none", "action": "Free Action", "description": "Once per turn when you hit with an Unarmed Strike or Pugilist weapon, deal an extra 1d12 damage of the same type, or forgo it to either: Endanger (the next attack against the target deals max damage instead of rolling) or Provoke (target has disadvantage on attacks against creatures other than you until the end of your next turn)."}],
            10:  [{"name": "Herculean", "max": 0, "rest_type": "none", "action": "Passive", "description": "STR score doubles for carrying capacity; an Unarmed Strike that hits an object is automatically a critical hit; jump distance is doubled."},
                 {"name": "Shake It Off", "max": 1, "rest_type": "long", "action": "Free Action", "description": "At the start of each of your turns, you can remove one exhaustion level or end one condition on yourself (blinded, charmed, deafened, frightened, paralyzed, poisoned, restrained, or stunned). Usable once until a long rest, or restore its use early by taking 1 exhaustion level."}],
            13:  [{"name": "Dig Deeper", "max": 1, "rest_type": "long", "action": "Bonus Action", "description": "For 1 minute, gain all benefits of Dig Deep and can use School of Hard Knocks twice per turn instead of once. Usable once until a long rest (twice at 20th level)."}],
            14:  [{"name": "Unbreakable", "max": 0, "rest_type": "none", "action": "Passive", "description": "Advantage on STR, DEX, and CON saves. Additionally, when you fail a save, you can spend 1 Moxie Point to reroll it and must use the new result."}],
            15:  [{"name": "Pugnacious", "max": 1, "rest_type": "long", "action": "Free Action", "description": "When you roll initiative, remove one exhaustion level and regain all uses of Down But Not Out, Dig Deep, and Shake It Off. Usable once until a long rest."}],
            18:  [{"name": "Fighting Spirit", "max": 1, "rest_type": "long", "action": "Free Action", "description": "When reduced to 0 HP but not killed outright, you can drop to 1 HP instead, gain temp HP equal to half your max HP, regain all expended Moxie Points, and gain resistance to all damage except force for 1 minute. Usable once until a long rest."}],
            19:  [{"name": "Epic Boon", "max": 0, "rest_type": "none", "action": "Passive", "description": "Gain an Epic Boon feat (Boon of Combat Prowess recommended) or another feat you qualify for."}],
            20:  [{"name": "Peak Physical Condition", "max": 0, "rest_type": "none", "action": "Passive", "description": "STR and CON scores increase by 2 (max 23). On finishing a long rest, lose all exhaustion levels. On finishing a short rest, regain HP equal to twice your Pugilist level."}],
        },
    },
    "Illrigger": {
        "hit_die": 10, "primary_ability": "STR or DEX, and CHA",
        "saves": ["CON", "CHA"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Baleful Interdict", "max": 3, "rest_type": "short", "action": "Bonus Action", "description": "Once per turn, place an invisible seal on a creature within 30 feet (free on a weapon hit, or as a bonus action otherwise), lasting 1 minute or until burned. You have a limited pool of seals (3 at 1st level, scaling per the class table to 7 at 20th), regained on a short or long rest. If a sealed creature dies, move its seals to a new target within 30 feet as a bonus action. Burning Seals: when a sealed creature you can see within 30 feet takes damage from another source, burn any number of its seals (no action) to deal 1d6 fire or necrotic damage (your choice) per seal, scaling to 2d6 at 5th level, 3d6 at 11th, 4d6 at 20th. Interdict save DC = 8 + proficiency bonus + CHA modifier."},
                 {"name": "Forked Tongue", "max": 0, "rest_type": "none", "action": "Passive", "description": "Speak, read, and write Infernal. Speak (but not read/write) two other languages of choice, swappable on a long rest. At 9th level, gain a third bonus language and advantage on WIS (Insight) checks to discern intentions/sincerity."}],
            2:  [{"name": "Combat Mastery", "max": 0, "rest_type": "none", "action": "Passive", "description": "Choose one combat mastery: Bravado (unarmored AC = 10 + DEX + CHA modifier, shield still usable), Brutal (push a hit target up to one size larger 5 feet with a two-handed melee weapon), Inexorable (+1 save bonus per hostile creature within 5 feet, max +5), Lies (use CHA instead of STR/DEX for one chosen melee weapon type's attack/damage, swappable on a long rest), Lissome (move 5 feet without opportunity attacks after a melee hit), or Unfettered (Baleful Interdict range becomes 60 feet, Infernal Conduit range becomes 30 feet at 6th level, and ranged attacks within 5 feet of a hostile creature avoid disadvantage)."},
                 {"name": "Interdiction", "max": 0, "rest_type": "none", "action": "Passive", "description": "Learn interdict boons (special enhancements to your seals); know 1 at 2nd level, gaining more per the class table. Boons can be swapped when you level up. Passive boons apply automatically; others must be activated (only one non-passive boon per turn)."}],
            3:  [{"name": "Diabolic Contract", "max": 0, "rest_type": "none", "action": "Passive", "description": "Choose an archdevil patron subclass (Architect of Ruin, Hellspeaker, Painkiller, Sanguine Knight, or Shadowmaster), granting features at 3rd, 7th, 11th, and 15th level."},
                 {"name": "Invoke Hell", "max": 1, "rest_type": "short", "action": "Free Action", "description": "Use one of two diabolic-contract-granted Invoke Hell options, chosen at time of use. Usable once until a short or long rest. Effects requiring a save use your interdict save DC."}],
            4:  [{"name": "Ability Score Improvement", "max": 0, "rest_type": "none", "action": "Passive", "description": "Increase one ability score by 2, or two ability scores by 1 each (max 20), or take a feat instead. Gained again at 8th, 12th, 16th, and 19th level."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "none", "action": "Passive", "description": "Attack twice instead of once whenever you take the Attack action."}],
            6:  [{"name": "Infernal Conduit", "max": 0, "rest_type": "long", "action": "Action", "description": "Touch a creature (action) and spend one or more d10s from your Infernal Conduit dice pool (size scaling by level per the class table); the target makes a CON save vs your interdict save DC (can willingly fail). Choose Invigorate (heal the target the rolled total, you take that much necrotic damage, can't be reduced, half on a successful save) or Devour (target takes that necrotic damage, you heal that much, half on a successful save; at 11th level a failed save also adds an exhaustion level, capped at 3 combined from all illriggers' use of this feature). All dice restore on a long rest."}],
            10:  [{"name": "Blood Price", "max": 0, "rest_type": "none", "action": "Free Action", "description": "Whenever you fail a saving throw, you can spend a Hit Die, rolling it and adding the result to that save."}],
            11:  [{"name": "Terrorizing Force", "max": 0, "rest_type": "long", "action": "Passive", "description": "Choose a damage type (cold, fire, necrotic, or poison), swappable on a long rest; weapon attacks deal an extra 1d8 of that type."}],
            14:  [{"name": "Superior Interdict", "max": 1, "rest_type": "long", "action": "Bonus Action", "description": "Seal damage ignores damage resistances. As a bonus action, if you have no seals remaining, regain one; usable once until a long rest."}],
            17:  [{"name": "Infernal Majesty", "max": 1, "rest_type": "long", "action": "Bonus Action", "description": "For 10 minutes: resistance to fire/cold/necrotic damage, a 60 ft flight speed from spectral wings, Blood Price's Hit Die also damages a nearby enemy, and Terrorizing Force deals 2d8 instead of 1d8. If you die during the duration, your body can vanish in flame and reform in Hell 1d6 days later, returning you to life at full HP. Usable once until a long rest."}],
            20:  [{"name": "Master of Hell", "max": 1, "rest_type": "long", "action": "Action", "description": "Summon a 50-ft-radius hellstorm within 150 feet, choosing one effect: Inferno (DEX save, 5d10 fire + 5d10 necrotic and burning for 1 minute on a failure, half and no burning on a success; burning deals 1d10 fire + 1d10 necrotic each turn until a save succeeds), Pestilence (CON save, 5d10 poison + 5d10 necrotic and poisoned for 1 minute on a failure, half on a success), or Darkness (CON save, 10d10 cold on a failure / half on a success, plus 1 minute of blindness and gloom in the area). Usable once until a long rest."}],
        },
    },
    "Blood Hunter": {
        "hit_die": 10, "primary_ability": "STR or DEX, and INT",
        "saves": ["DEX", "INT"], "is_spellcaster": False,
        "features": {
            1:  [{"name": "Hunter's Bane", "max": 0, "rest_type": "none", "action": "Passive", "description": "Advantage on WIS (Survival) checks to track fey, fiends, or undead, and on INT checks to recall information about them. Hemocraft save DC = 8 + proficiency bonus + your Hemocraft modifier (INT, or WIS with DM permission)."},
                 {"name": "Blood Maledict", "max": 1, "rest_type": "short", "action": "Bonus Action", "description": "Know one blood curse, learning more at 6th, 10th, 14th, and 18th level (swappable when learning a new one). Each use invokes one known curse; you can amplify it by taking necrotic damage equal to a hemocraft die roll (can't be reduced) for an extra effect. Creatures without blood are immune unless amplified. Usable once between rests, twice at 6th level, three times at 13th, four times at 17th."},
                 {"name": "Blood Curse of the Anxious", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: target within 30 feet has CHA (Intimidation) checks made against it with advantage until the end of your next turn. Amplify: their next WIS save before the curse ends has disadvantage."},
                 {"name": "Blood Curse of Binding", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: a Large or smaller creature within 30 feet makes a STR save or its speed becomes 0 and it can't use reactions until the end of your next turn. Amplify: lasts 1 minute, works on any size, repeatable save each turn to end early."},
                 {"name": "Blood Curse of Bloated Agony", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: a creature within 30 feet has disadvantage on STR/DEX checks until the end of your next turn and takes 1d8 necrotic damage if it makes more than one attack on its turn. Amplify: lasts 1 minute, repeatable CON save each turn to end early."},
                 {"name": "Blood Curse of Exposure", "max": 0, "rest_type": "none", "action": "Reaction", "description": "Blood Maledict option: when a creature within 30 feet takes damage from an attack/spell, use your reaction so it loses resistance to all damage types of that attack/spell until the end of its next turn (including the triggering hit). Amplify: instead removes immunity (downgrading to resistance) to those types until its next turn."},
                 {"name": "Blood Curse of the Eyeless", "max": 0, "rest_type": "none", "action": "Reaction", "description": "Blood Maledict option: when a creature within 30 feet makes an attack, react to roll a hemocraft die and subtract it from the attack roll (decided after the roll, before hit/miss is known); doesn't affect creatures immune to blinded. Amplify: applies to all that creature's attacks until the end of its turn, rolled separately each time."},
                 {"name": "Blood Curse of the Fallen Puppet", "max": 0, "rest_type": "none", "action": "Reaction", "description": "Blood Maledict option: when a creature within 30 feet drops to 0 HP, react to force it to make one weapon attack against a target you choose within its range. Amplify: it can first move up to half speed, and the attack gets a bonus equal to your Hemocraft modifier (min +1)."},
                 {"name": "Blood Curse of the Marked", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: mark a creature within 30 feet; until the end of your turn, hits against it with an active-crimson-rite weapon roll an extra hemocraft die for rite damage. Amplify: your next attack against it before the end of your turn has advantage."},
                 {"name": "Blood Curse of the Muddled Mind", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: a concentrating creature within 30 feet has disadvantage on its next concentration CON save before the end of your next turn. Amplify: disadvantage applies to all its concentration saves until the end of your next turn."}],
            2:  [{"name": "Fighting Style", "max": 0, "rest_type": "none", "action": "Passive", "description": "Choose one: Archery (+2 to ranged attack rolls), Dueling (+2 damage with a one-handed melee weapon wielded alone), Great Weapon Fighting (reroll 1s/2s on damage dice for two-handed/versatile melee weapons), or Two-Weapon Fighting (add ability modifier to the second attack's damage in two-weapon fighting)."},
                 {"name": "Crimson Rite", "max": 0, "rest_type": "short", "action": "Bonus Action", "description": "As a bonus action, take necrotic damage equal to one hemocraft die roll (can't be reduced) to activate a known rite on a held weapon until your next short or long rest; attacks with it become magical and deal extra damage equal to your hemocraft die of the rite's type. Choose one rite at 2nd level (Flame=fire, Frozen=cold, Storm=lightning), learning another at 7th and 14th level (Dead=necrotic, Oracle=psychic, Roar=thunder, all requiring 14th level). Only one rite active per weapon; doesn't benefit other creatures."}],
            3:  [{"name": "Blood Hunter Order", "max": 0, "rest_type": "none", "action": "Passive", "description": "Choose an order (Ghostslayer, Lycan, Mutant, or Profane Soul), granting features at 7th, 11th, 15th, and 18th level."}],
            4:  [{"name": "Ability Score Improvement", "max": 0, "rest_type": "none", "action": "Passive", "description": "Increase one ability score by 2, or two ability scores by 1 each (max 20), or take a feat instead. Gained again at 8th, 12th, 16th, and 19th level."}],
            5:  [{"name": "Extra Attack", "max": 0, "rest_type": "none", "action": "Passive", "description": "Attack twice instead of once whenever you take the Attack action."}],
            6:  [{"name": "Brand of Castigation", "max": 1, "rest_type": "short", "action": "Free Action", "description": "When you damage a creature with a weapon that has an active crimson rite, brand it (no action). You always know its direction on the same plane, and whenever it damages you or a creature within 5 feet of you, it takes psychic damage equal to your Hemocraft modifier (min 1). The brand lasts until dismissed or replaced, can be dispelled (treated as a spell of level equal to half your blood hunter level, max 9th). Usable once until a short or long rest."}],
            9:  [{"name": "Grim Psychometry", "max": 0, "rest_type": "none", "action": "Passive", "description": "Advantage on INT (History) checks to recall the sinister or tragic history of an object/location you're touching/at."}],
            10:  [{"name": "Dark Augmentation", "max": 0, "rest_type": "none", "action": "Passive", "description": "Speed increases by 5 feet, and gain a bonus equal to your Hemocraft modifier (min +1) on STR, DEX, and CON saves."}],
            13:  [{"name": "Brand of Tethering", "max": 0, "rest_type": "none", "action": "Passive", "description": "Brand of Castigation's psychic damage doubles to twice your Hemocraft modifier (min 2). A branded creature can't Dash, and attempting to teleport or leave the plane deals it 4d6 psychic damage and forces a WIS save or the attempt fails."}],
            14:  [{"name": "Hardened Soul", "max": 0, "rest_type": "none", "action": "Passive", "description": "Advantage on saving throws against being charmed and frightened."}],
            15:  [{"name": "Blood Curse of Corrosion", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: poison a creature within 30 feet; it can repeat a CON save each turn to end it. Amplify: it also takes 4d6 necrotic damage immediately and again each time it fails that save."},
                 {"name": "Blood Curse of the Exorcist", "max": 0, "rest_type": "none", "action": "Bonus Action", "description": "Blood Maledict option: end charmed, frightened, or possession on a target within 30 feet. Amplify: whatever charmed/frightened/possessed it takes 3d6 psychic damage and must succeed a WIS save or be stunned until the end of your next turn."}],
            18:  [{"name": "Blood Curse of the Howl", "max": 0, "rest_type": "none", "action": "Action", "description": "Blood Maledict option: unleash a howl; each creature within 30 feet that hears it makes a WIS save or is frightened of you until the end of your next turn (stunned too if it fails by 5+); a success grants 24-hour immunity. You can exempt any creatures you choose. Amplify: range becomes 60 feet."},
                 {"name": "Blood Curse of the Soul Eater", "max": 0, "rest_type": "none", "action": "Reaction", "description": "Blood Maledict option: when a non-construct, non-undead creature within 30 feet drops to 0 HP, react to gain advantage on attacks and resistance to all damage until the end of your next turn. Amplify: also regain an expended warlock spell slot (amplify usable only once per long rest)."}],
            20:  [{"name": "Sanguine Mastery", "max": 0, "rest_type": "none", "action": "Passive", "description": "Once per turn, reroll any hemocraft die roll required by a blood hunter feature and use either result. When you score a critical hit with a weapon under an active crimson rite, regain one expended use of Blood Maledict."}],
        },
    },
}

SPELL_SLOTS = {
    "full": {
        1:  {"1": 2},
        2:  {"1": 3},
        3:  {"1": 4, "2": 2},
        4:  {"1": 4, "2": 3},
        5:  {"1": 4, "2": 3, "3": 2},
        6:  {"1": 4, "2": 3, "3": 3},
        7:  {"1": 4, "2": 3, "3": 3, "4": 1},
        8:  {"1": 4, "2": 3, "3": 3, "4": 2},
        9:  {"1": 4, "2": 3, "3": 3, "4": 3, "5": 1},
        10: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2},
        11: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1},
        12: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1},
        13: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1, "7": 1},
        14: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1, "7": 1},
        15: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1, "7": 1, "8": 1},
        16: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1, "7": 1, "8": 1},
        17: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2, "6": 1, "7": 1, "8": 1, "9": 1},
        18: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 1, "7": 1, "8": 1, "9": 1},
        19: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "7": 1, "8": 1, "9": 1},
        20: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1},
    },
    "half": {
        1:  {},
        2:  {"1": 2},
        3:  {"1": 3},
        4:  {"1": 3},
        5:  {"1": 4, "2": 2},
        6:  {"1": 4, "2": 2},
        7:  {"1": 4, "2": 3},
        8:  {"1": 4, "2": 3},
        9:  {"1": 4, "2": 3, "3": 2},
        10: {"1": 4, "2": 3, "3": 2},
        11: {"1": 4, "2": 3, "3": 3},
        12: {"1": 4, "2": 3, "3": 3},
        13: {"1": 4, "2": 3, "3": 3, "4": 1},
        14: {"1": 4, "2": 3, "3": 3, "4": 1},
        15: {"1": 4, "2": 3, "3": 3, "4": 2},
        16: {"1": 4, "2": 3, "3": 3, "4": 2},
        17: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 1},
        18: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 1},
        19: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2},
        20: {"1": 4, "2": 3, "3": 3, "4": 3, "5": 2},
    },
    "warlock": {
        1:  {"1": 1},
        2:  {"1": 2},
        3:  {"2": 2},
        4:  {"2": 2},
        5:  {"3": 2},
        6:  {"3": 2},
        7:  {"4": 2},
        8:  {"4": 2},
        9:  {"5": 2},
        10: {"5": 2},
        11: {"5": 3},
        12: {"5": 3},
        13: {"5": 3},
        14: {"5": 3},
        15: {"5": 3},
        16: {"5": 3},
        17: {"5": 4},
        18: {"5": 4},
        19: {"5": 4},
        20: {"5": 4},
    },
    "none": {},
}

SPELLCASTER_TYPE = {
    "Bard": "full", "Cleric": "full", "Druid": "full",
    "Sorcerer": "full", "Wizard": "full",
    "Paladin": "half", "Ranger": "half",
    "Artificer": "half",
    "Warlock": "warlock",
    "Barbarian": "none", "Fighter": "none",
    "Monk": "none", "Rogue": "none",
    "Pugilist": "none", "Illrigger": "none", "Blood Hunter": "none",
}

RACES = [
    "Dragonborn", "Dwarf (Hill)", "Dwarf (Mountain)", "Elf (High)", "Elf (Wood)",
    "Elf (Dark/Drow)", "Gnome (Forest)", "Gnome (Rock)", "Half-Elf", "Half-Orc",
    "Halfling (Lightfoot)", "Halfling (Stout)", "Human", "Tiefling",
    "Aasimar", "Firbolg", "Goliath", "Kenku", "Lizardfolk", "Tabaxi",
    "Triton", "Yuan-Ti Pureblood", "Bugbear", "Goblin", "Hobgoblin",
    "Kobold", "Orc", "Tortle", "Shadar-kai", "Custom",
]

SUBCLASSES = {
    "Barbarian": ["Path of the Ancestral Guardian", "Path of the Battlerager", "Path of the Beast", "Path of the Berserker", "Path of the Giant", "Path of the Storm Herald", "Path of the Totem Warrior", "Path of the Zealot", "Path of Wild Magic", "Path of the Infernal", "Path of the Juggernaut"],
    "Bard":      ["College of Creation", "College of Eloquence", "College of Glamour", "College of Lore", "College of Spirits", "College of Swords", "College of Valor", "College of Whispers", "College of Cuisine", "College of Fleshweaving", "College of Mercantile", "College of Tragedy"],
    "Cleric":    ["Arcana Domain", "Death Domain", "Forge Domain", "Grave Domain", "Knowledge Domain", "Life Domain", "Light Domain", "Nature Domain", "Order Domain", "Peace Domain", "Tempest Domain", "Trickery Domain", "Twilight Domain", "War Domain", "Blood Domain", "Festus Domain", "Hunt Domain", "Moon Domain"],
    "Druid":     ["Circle of Dreams", "Circle of Spores", "Circle of Stars", "Circle of the Land", "Circle of the Moon", "Circle of the Shepherd", "Circle of Wildfire", "Circle of Dragons", "Circle of the Blighted", "Circle of the Hive"],
    "Fighter":   ["Arcane Archer", "Battle Master", "Cavalier", "Champion", "Eldritch Knight", "Psi Warrior", "Purple Dragon Knight", "Rune Knight", "Samurai", "Echo Knight", "Gunslinger", "Steel Hawk"],
    "Monk":      ["Way of Mercy", "Way of Shadow", "Way of the Ascendant Dragon", "Way of the Astral Self", "Way of the Drunken Master", "Way of the Four Elements", "Way of the Kensei", "Way of the Long Death", "Way of the Open Hand", "Way of the Sun Soul", "Way of the Aether", "Way of the Cobalt Soul"],
    "Paladin":   ["Oath of Conquest", "Oath of Devotion", "Oath of Glory", "Oath of Redemption", "Oath of the Ancients", "Oath of the Crown", "Oath of the Watchers", "Oath of Vengeance", "Oathbreaker", "Oath of the Harvest", "Oath of the Open Sea", "Oath of the Spelldrinker"],
    "Ranger":    ["Beast Master", "Drakewarden", "Fey Wanderer", "Gloom Stalker", "Horizon Walker", "Hunter", "Monster Slayer", "Swarmkeeper", "Rocborne", "Trapper"],
    "Rogue":     ["Arcane Trickster", "Assassin", "Inquisitive", "Mastermind", "Phantom", "Scout", "Soulknife", "Swashbuckler", "Thief", "Grim Surgeon"],
    "Sorcerer":  ["Aberrant Mind", "Clockwork Soul", "Divine Soul", "Draconic Bloodline", "Lunar Sorcery", "Shadow Magic", "Storm Sorcery", "Wild Magic", "Desert Soul", "Runechild", "Skinshifter"],
    "Warlock":   ["The Archfey", "The Celestial", "The Fathomless", "The Fiend", "The Genie", "The Great Old One", "The Hexblade", "The Undead", "The Undying", "The Many", "The Parasite"],
    "Wizard":    ["Bladesinging", "Order of Scribes", "School of Abjuration", "School of Conjuration", "School of Divination", "School of Enchantment", "School of Evocation", "School of Illusion", "School of Necromancy", "School of Transmutation", "War Magic", "Blood Magic", "Chronurgy Magic", "Graviturgy Magic", "School of Biomancy", "Wand Lore"],
    "Artificer": ["Alchemist", "Armorer", "Artillerist", "Battle Smith"],
    "Pugilist":  ["Dog & Hound", "Hand of Dread", "Piss and Vinegar", "Squared Circle", "Street Saint", "Sweet Science"],
    "Illrigger": ["Architect of Ruin", "Hellspeaker", "Painkiller", "Sanguine Knight", "Shadowmaster"],
    "Blood Hunter": ["Order of the Ghostslayer", "Order of the Lycan", "Order of the Mutant", "Order of the Profane Soul"],
}

PROFICIENCY_BONUS = {1:2,2:2,3:2,4:2,5:3,6:3,7:3,8:3,9:4,10:4,11:4,12:4,13:5,14:5,15:5,16:5,17:6,18:6,19:6,20:6}

def get_classes():
    return [{"name": k, "hit_die": v["hit_die"], "primary_ability": v["primary_ability"], "is_spellcaster": v.get("is_spellcaster", False)} for k, v in CLASSES.items()]

def get_races():
    return RACES

def get_subclasses(class_name):
    return SUBCLASSES.get(class_name, [])

def get_class_features(class_name):
    cls = CLASSES.get(class_name)
    if not cls:
        return {}
    return cls.get("features", {})

def get_spell_slots(class_name, level):
    caster_type = SPELLCASTER_TYPE.get(class_name, "none")
    slots_table = SPELL_SLOTS.get(caster_type, {})
    raw = slots_table.get(level, {})
    return {lvl: {"current": max_uses, "max": max_uses} for lvl, max_uses in raw.items()}

def get_proficiency_bonus(level):
    return PROFICIENCY_BONUS.get(level, 2)

# Third-caster subclasses (Eldritch Knight Fighter, Arcane Trickster Rogue) count 1/3 their
# class level, rounded down, toward the multiclass spellcaster table per RAW - detected by
# subclass name since the base class (Fighter/Rogue) is otherwise SPELLCASTER_TYPE "none".
THIRD_CASTER_SUBCLASSES = {"Fighter": "Eldritch Knight", "Rogue": "Arcane Trickster"}

# RAW multiclass spellcaster table: full casters count their whole class level, half
# casters (Paladin/Ranger/Artificer) count half (rounded down), third casters (Eldritch
# Knight/Arcane Trickster) count a third (rounded down), then the combined "effective
# caster level" indexes into the SAME progression the single-class "full" caster table
# already uses (PHB's Multiclass Spellcaster table is literally that table reused).
# Warlock is excluded entirely - Pact Magic is its own separate slot pool that never feeds
# into or draws from the shared table, returned separately as pact_slots.
def get_multiclass_spell_slots(classes):
    """classes: list of {class_name, level, subclass}. Returns (spell_slots, pact_slots) -
    pact_slots is None if no class in the list is a Warlock."""
    effective = 0
    warlock_level = 0
    for c in classes:
        caster_type = SPELLCASTER_TYPE.get(c["class_name"], "none")
        if caster_type == "full":
            effective += c["level"]
        elif caster_type == "half":
            effective += c["level"] // 2
        elif caster_type == "warlock":
            warlock_level += c["level"]
        elif THIRD_CASTER_SUBCLASSES.get(c["class_name"]) == c.get("subclass"):
            effective += c["level"] // 3
    spell_slots = {}
    if effective > 0:
        raw = SPELL_SLOTS["full"].get(min(effective, 20), {})
        spell_slots = {lvl: {"current": mx, "max": mx} for lvl, mx in raw.items()}
    pact_slots = None
    if warlock_level > 0:
        raw = SPELL_SLOTS["warlock"].get(min(warlock_level, 20), {})
        pact_slots = {lvl: {"current": mx, "max": mx} for lvl, mx in raw.items()}
    return spell_slots, pact_slots
