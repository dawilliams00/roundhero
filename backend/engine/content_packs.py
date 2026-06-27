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
            2:  [{"name": "Font of Magic (Sorcerer Points)", "max": 0, "rest_type": "long", "action": "Passive", "description": "Sorcery Points = sorcerer level. Spend on Metamagic, or use Flexible Casting to convert points to a spell slot or a slot to points."},
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
    "Warlock": "warlock",
    "Barbarian": "none", "Fighter": "none",
    "Monk": "none", "Rogue": "none",
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
    "Barbarian": ["Path of the Berserker", "Path of the Totem Warrior", "Path of the Ancestral Guardian", "Path of the Storm Herald", "Path of the Zealot", "Path of the Beast", "Path of Wild Magic"],
    "Bard":      ["College of Lore", "College of Valor", "College of Glamour", "College of Swords", "College of Whispers", "College of Creation", "College of Eloquence"],
    "Cleric":    ["Life Domain", "Light Domain", "Trickery Domain", "Knowledge Domain", "Nature Domain", "Tempest Domain", "War Domain", "Arcana Domain", "Death Domain", "Forge Domain", "Grave Domain", "Order Domain", "Peace Domain", "Twilight Domain"],
    "Druid":     ["Circle of the Land", "Circle of the Moon", "Circle of Dreams", "Circle of the Shepherd", "Circle of Spores", "Circle of Stars", "Circle of Wildfire"],
    "Fighter":   ["Champion", "Battle Master", "Eldritch Knight", "Arcane Archer", "Cavalier", "Echo Knight", "Psi Warrior", "Rune Knight", "Samurai"],
    "Monk":      ["Way of the Open Hand", "Way of Shadow", "Way of the Four Elements", "Way of the Drunken Master", "Way of the Kensei", "Way of the Sun Soul", "Way of Mercy", "Way of the Astral Self"],
    "Paladin":   ["Oath of Devotion", "Oath of the Ancients", "Oath of Vengeance", "Oath of Conquest", "Oath of Redemption", "Oath of Glory", "Oath of the Watchers", "Oathbreaker"],
    "Ranger":    ["Hunter", "Beast Master", "Gloom Stalker", "Horizon Walker", "Monster Slayer", "Fey Wanderer", "Swarmkeeper"],
    "Rogue":     ["Thief", "Assassin", "Arcane Trickster", "Inquisitive", "Mastermind", "Scout", "Soulknife", "Swashbuckler", "Phantom"],
    "Sorcerer":  ["Draconic Bloodline", "Wild Magic", "Divine Soul", "Shadow Magic", "Storm Sorcery", "Aberrant Mind", "Clockwork Soul"],
    "Warlock":   ["The Archfey", "The Fiend", "The Great Old One", "The Hexblade", "The Celestial", "The Fathomless", "The Genie"],
    "Wizard":    ["School of Abjuration", "School of Conjuration", "School of Divination", "School of Enchantment", "School of Evocation", "School of Illusion", "School of Necromancy", "School of Transmutation", "Bladesinger", "Order of Scribes", "War Magic", "Chronurgy Magic", "Graviturgy Magic"],
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
