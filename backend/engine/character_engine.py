from .content_packs import CLASSES, get_spell_slots, get_proficiency_bonus, SPELLCASTER_TYPE

ABILITY_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"]

def modifier(score):
    return (score - 10) // 2

def get_features_up_to_level(class_name, level):
    cls = CLASSES.get(class_name, {})
    features_by_level = cls.get("features", {})
    result = []
    for feat_level in sorted(features_by_level.keys()):
        if feat_level <= level:
            for feat in features_by_level[feat_level]:
                result.append(feat)
    return result

def apply_dynamic_feature_maxes(features, class_name, level, ability_scores):
    """Recomputes the max AND current of every class resource whose count scales with THIS
    class's own level/ability score - Rage uses, Divine Sense, Lay on Hands, Bardic
    Inspiration, Ki Points, Action Surge, Indomitable, Sorcery Points. Shared by the
    single-class manual-build path (build_tracker_data below), the multiclass leveling path
    (multiclass_engine.level_up_one_class), and the on-demand recalculate route
    (multiclass_engine.recalculate_class_resources) so a Barbarian's Rage or a Fighter's
    Action Surge scales correctly regardless of which engine built the character - this was
    the actual gap: the multiclass path granted new FEATURES on level-up via
    class_features.json, but never recomputed any of these formulas, so a PDF-imported/
    multiclass character's Rage uses (etc.) stayed wherever the PDF parser happened to leave
    them forever, even across real level-ups.

    `level` here is always THIS CLASS's own level (e.g. Barbarian level within a Barbarian
    5/Fighter 3 multiclass build, not total character level) - matches RAW, where these
    all scale off the single class's own progression table, never total character level.

    Always meant to run on a FRESHLY BUILT features dict (current == max for everything,
    same as _build_features_for_class_level/build_tracker_data already produce) - NOT
    directly on a live character's already-in-play features. An already-spent resource is
    never silently refilled by this function; that's _merge_features_for_level_up's job
    (called right after, by every caller), which compares old spent-vs-max against
    whatever max this function just computed. Mutates `features` in place and returns it.
    """
    scores = ability_scores or {}
    cls = CLASSES.get(class_name, {})
    cha_mod = modifier(scores.get("CHA", 10))

    def _apply(name, value):
        if name not in features:
            return
        features[name]["max"] = value
        features[name]["current"] = value

    if class_name == "Barbarian":
        rage_table = cls.get("rage_uses", {})
        rage_uses = 2
        for lvl in sorted(rage_table.keys()):
            if level >= lvl:
                val = rage_table[lvl]
                rage_uses = 99 if val == "unlimited" else val
        _apply("Rage", rage_uses)

    if class_name == "Paladin":
        _apply("Divine Sense", max(1, 1 + cha_mod))
        _apply("Lay on Hands", level * 5)

    if class_name == "Bard":
        _apply("Bardic Inspiration", max(1, cha_mod))

    if class_name == "Monk":
        ki_max = level
        if "Ki Points" not in features:
            features["Ki Points"] = {
                "current": ki_max, "max": ki_max,
                "rest_type": "short", "action": "Passive",
                "description": f"Ki pool: {ki_max} points. Regain on short or long rest."
            }
        else:
            _apply("Ki Points", ki_max)

    if class_name == "Fighter":
        surge_table = cls.get("action_surge_uses", {})
        surge_uses = 0
        for lvl in sorted(surge_table.keys()):
            if level >= lvl:
                surge_uses = surge_table[lvl]
        if surge_uses:
            _apply("Action Surge", surge_uses)
        indom_table = cls.get("indomitable_uses", {})
        indom_uses = 0
        for lvl in sorted(indom_table.keys()):
            if level >= lvl:
                indom_uses = indom_table[lvl]
        if indom_uses:
            _apply("Indomitable", indom_uses)

    if class_name == "Sorcerer":
        # RAW: sorcery points = sorcerer level, starting at 2nd level (Font of Magic).
        _apply("Font of Magic (Sorcery Points)", level if level >= 2 else 0)

    return features

def build_tracker_data(class_name, level, ability_scores):
    scores = ability_scores or {}
    prof = get_proficiency_bonus(level)
    features_raw = get_features_up_to_level(class_name, level)
    features = {}
    for feat in features_raw:
        max_uses = feat.get("max", 0)
        if feat["name"] not in features:
            features[feat["name"]] = {
                "current":     max_uses,
                "max":         max_uses,
                "rest_type":   feat.get("rest_type", "long"),
                "action":      feat.get("action", "Action"),
                "description": feat.get("description", ""),
            }

    apply_dynamic_feature_maxes(features, class_name, level, scores)
    cls = CLASSES.get(class_name, {})
    con_mod = modifier(scores.get("CON", 10))

    spell_slots = get_spell_slots(class_name, level)

    hit_die = cls.get("hit_die", 8)
    max_hp = hit_die + con_mod
    max_hp += (level - 1) * (hit_die // 2 + 1 + con_mod)
    dex_mod = modifier(scores.get("DEX", 10))

    return {
        "features":     features,
        "spell_slots":  spell_slots,
        "item_charges": {},
        "conditions":   [],
        "hp":           {"current": max_hp, "max": max_hp, "temp": 0, "max_override": None},
        "ac":           10 + dex_mod,
        "initiative":   dex_mod,
        "inspiration":  False,
        "traits":       {"resistances": [], "immunities": [], "vulnerabilities": [], "advantages": []},
        "inventory":    {"currency": {"cp": 0, "sp": 0, "ep": 0, "gp": 0, "pp": 0}, "items": []},
        "hit_dice":     {"current": level, "total": level, "die_size": hit_die},
    }

def build_spell_data(class_name, level):
    caster_type = SPELLCASTER_TYPE.get(class_name, "none")
    return {
        "class":        class_name,
        "caster_type":  caster_type,
        "spell_lists":  {},
        "active_list":  None,
        "known_spells": [],
        "prepared":     [],
    }

def build_ae_data(class_name, level):
    stock_actions = [
        {"name": "Attack",       "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Make one or more melee or ranged attacks. Number of attacks depends on class and level."},
        {"name": "Cast a Spell", "source": "Core 5e", "source_type": "raw", "cost_type": "cast_spell",  "description": "Cast a spell with a casting time of 1 action."},
        {"name": "Dash",         "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Double your movement speed this turn."},
        {"name": "Disengage",    "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Your movement doesn't provoke opportunity attacks for the rest of the turn."},
        {"name": "Dodge",        "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Attackers have disadvantage vs you. DEX saves with advantage until your next turn."},
        {"name": "Help",         "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Give an ally advantage on their next ability check or attack roll."},
        {"name": "Hide",         "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Make a DEX (Stealth) check to hide."},
        {"name": "Ready",        "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Prepare an action triggered by a specific condition."},
        {"name": "Search",       "source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Devote your attention to finding something — Perception or Investigation check."},
        {"name": "Use an Object","source": "Core 5e", "source_type": "raw", "cost_type": "action",      "description": "Interact with a second object or use a magic item that requires an action."},
    ]
    stock_bonus = [
        {"name": "Off-hand Attack","source": "Core 5e", "source_type": "raw", "cost_type": "bonus_action", "description": "When you attack with a light weapon, attack with a different light weapon in your off hand. No ability modifier to damage unless negative."},
        {"name": "Cast a Spell", "source": "Core 5e", "source_type": "raw", "cost_type": "cast_spell", "description": "Cast a spell with a casting time of 1 bonus action."},
    ]
    stock_reactions = [
        {"name": "Opportunity Attack", "source": "Core 5e", "source_type": "raw", "cost_type": "reaction", "description": "When a hostile creature moves out of your reach, make one melee attack."},
        {"name": "Readied Action",     "source": "Core 5e", "source_type": "raw", "cost_type": "reaction", "description": "Trigger the action you prepared with the Ready action."},
        {"name": "Cast a Spell", "source": "Core 5e", "source_type": "raw", "cost_type": "cast_spell", "description": "Cast a spell with a casting time of 1 reaction."},
    ]
    features_raw = get_features_up_to_level(class_name, level)
    sections = {"Action": [], "Bonus Action": [], "Reaction": [], "Free Action": [], "Passive": []}
    cost_type_map = {"Action": "action", "Bonus Action": "bonus_action", "Reaction": "reaction", "Free Action": "free_action", "Passive": "passive"}
    for feat in features_raw:
        action = feat.get("action", "Passive")
        section = action if action in sections else "Passive"
        if section == "Passive":
            continue
        sections[section].append({
            "name":        feat["name"],
            "source":      class_name,
            "source_type": "class",
            "cost_type":   cost_type_map[section],
            "tracker_key": feat["name"],
            "description": feat.get("description", ""),
        })
    return {
        "Action":        stock_actions + sections["Action"],
        "Bonus Action":  stock_bonus   + sections["Bonus Action"],
        "Reaction":      stock_reactions + sections["Reaction"],
        "Free Action":   sections["Free Action"],
        "Passive":       sections["Passive"],
    }

def build_character(data):
    class_name     = data.get("class_name", "Fighter")
    level          = int(data.get("level", 1))
    ability_scores = data.get("ability_scores", {a: 10 for a in ABILITY_KEYS})
    return {
        "tracker_data": build_tracker_data(class_name, level, ability_scores),
        "spell_data":   build_spell_data(class_name, level),
        "ae_data":      build_ae_data(class_name, level),
    }

def _merge_features_for_level_up(old_features, new_features):
    # Keeps whatever was already SPENT on a feature, but adds any gained max as freshly
    # available - same "preserve spent, grant the gain" rule _merge_spell_slots_for_level_up
    # uses. A naive min(old_current, new_max) would instead just cap the old current at the
    # new max without ever granting the new capacity as usable (e.g. Sorcery Points 2/2 used
    # 1 -> level grants a 3rd point -> should be 2/3 available, not 1/3).
    merged = dict(old_features or {})
    for name, nf in new_features.items():
        of = merged.get(name)
        if of:
            old_max = of.get("max", nf["max"])
            spent = max(0, old_max - of.get("current", old_max))
            cur = max(0, nf["max"] - spent) if nf["max"] else of.get("current", 0)
            merged[name] = {**nf, "current": cur}
        else:
            merged[name] = nf
    return merged

def _merge_spell_slots_for_level_up(old_slots, new_slots):
    # A new level can grant more slots at a level the character already had, or a whole
    # new slot level - current goes up by the same amount max did, so an already-spent
    # slot stays spent rather than the level-up silently refilling it (that's what a rest
    # is for); a brand new slot level starts full.
    merged = {}
    for lvl, s in new_slots.items():
        old_s = (old_slots or {}).get(lvl)
        if old_s:
            cur = max(0, min(s["max"], old_s.get("current", 0) + (s["max"] - old_s.get("max", 0))))
        else:
            cur = s["max"]
        merged[lvl] = {"current": cur, "max": s["max"]}
    return merged

def _merge_ae_data_for_level_up(old_ae, new_ae):
    # build_ae_data always returns the same fixed set of class-sourced entries (plus the
    # hardcoded stock actions) for a given level - rebuilding it fresh and keeping only the
    # OLD entries that aren't source_type "class" preserves anything the player added
    # through +Custom/Browse Feats without duplicating or losing class features on level-up.
    merged = {}
    for section, fresh in new_ae.items():
        kept = [a for a in (old_ae or {}).get(section, []) if a.get("source_type") != "class"]
        merged[section] = fresh + kept
    return merged

def level_up_character(old_tracker_data, old_spell_data, old_ae_data, class_name, new_level, ability_scores):
    """Recomputes HP/spell-slots/class-features for a new level and merges with existing
    live state (current HP/charges, custom abilities, known spells, inventory). Only
    meaningful for a class_name the engine actually recognizes (content_packs.CLASSES) -
    PDF-imported characters typically have a decorated class_name like "Wizard 13" that
    won't match, and the caller should refuse to call this for those."""
    new_td = build_tracker_data(class_name, new_level, ability_scores)
    new_ae = build_ae_data(class_name, new_level)

    merged_td = dict(old_tracker_data)
    merged_td["features"] = _merge_features_for_level_up(old_tracker_data.get("features"), new_td["features"])
    merged_td["spell_slots"] = _merge_spell_slots_for_level_up(old_tracker_data.get("spell_slots"), new_td["spell_slots"])

    old_hp = old_tracker_data.get("hp") or new_td["hp"]
    old_max_hp = old_hp.get("max", new_td["hp"]["max"])
    hp_gained = max(0, new_td["hp"]["max"] - old_max_hp)
    merged_td["hp"] = {
        **old_hp, "max": new_td["hp"]["max"],
        "current": max(0, min(new_td["hp"]["max"], old_hp.get("current", new_td["hp"]["max"]) + hp_gained)),
    }

    old_hd = old_tracker_data.get("hit_dice") or new_td["hit_dice"]
    hd_gained = max(0, new_td["hit_dice"]["total"] - old_hd.get("total", new_td["hit_dice"]["total"]))
    merged_td["hit_dice"] = {
        "current": old_hd.get("current", new_td["hit_dice"]["current"]) + hd_gained,
        "total": new_td["hit_dice"]["total"], "die_size": new_td["hit_dice"]["die_size"],
    }

    # known_spells/spell_lists/prepared/notes/inventory are intentionally untouched - this
    # engine doesn't model "you learn N new spells at this level," the player adds any new
    # known spells manually via the Spells tab, same as they always have.
    merged_ae = _merge_ae_data_for_level_up(old_ae_data, new_ae)

    return merged_td, dict(old_spell_data), merged_ae, hp_gained
