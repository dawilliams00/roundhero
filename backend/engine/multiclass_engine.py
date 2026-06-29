import re

from .content_packs import CLASSES, get_multiclass_spell_slots
from .character_engine import get_features_up_to_level, modifier, _merge_features_for_level_up, _merge_spell_slots_for_level_up
from .class_feature_data import get_all_class_features

# "Wizard 13" -> [{"class_name": "Wizard", "level": 13}]; "Wizard 10 / Fighter 3" -> both
# parts. Python port of parseClassLevels in frontend/src/utils/dnd.js - keep both in sync.
def parse_class_levels(class_name_raw):
    if not class_name_raw:
        return []
    result = []
    for part in str(class_name_raw).split("/"):
        m = re.match(r"^(.+?)\s+(\d+)\s*$", part.strip())
        if m:
            result.append({"class_name": m.group(1).strip(), "level": int(m.group(2))})
    return result


def infer_classes(class_name_raw, total_level=None):
    """Best-effort attempt to resolve a (possibly decorated/multiclass) class_name string
    into a list of {class_name, level} the engine recognizes. Returns None if any part is
    unrecognized or nothing parses at all - the caller should ask the player to confirm
    classes by hand rather than silently guessing wrong (e.g. a homebrew class name, or a
    typo in the PDF's printed class/level field)."""
    parsed = parse_class_levels(class_name_raw)
    if parsed:
        if all(p["class_name"] in CLASSES for p in parsed):
            return parsed
        return None
    if class_name_raw in CLASSES:
        return [{"class_name": class_name_raw, "level": total_level or 1}]
    return None


def classes_to_display_name(classes):
    if len(classes) == 1:
        return classes[0]["class_name"]
    return " / ".join(f"{c['class_name']} {c['level']}" for c in classes)


# RAW: most classes get an Ability Score Improvement at 4/8/12/16/19; Fighter and Rogue
# get extra ones. This is tracked separately from content_packs.py's per-level features
# table, which only notes ASI descriptively at level 4 for a few classes rather than as a
# real recomputable mechanism for every level it actually recurs at.
ASI_LEVELS_DEFAULT = [4, 8, 12, 16, 19]
ASI_LEVELS_BY_CLASS = {
    "Fighter": [4, 6, 8, 12, 14, 16, 19],
    "Rogue": [4, 8, 10, 12, 16, 19],
}

def asi_levels_for_class(class_name):
    return ASI_LEVELS_BY_CLASS.get(class_name, ASI_LEVELS_DEFAULT)


# RAW (2014 PHB) level a class chooses its subclass at - varies by class. Homebrew
# classes (Pugilist/Illrigger/Blood Hunter) default to 3rd, the most common PHB level,
# since their actual subclass-choice level isn't specified anywhere in this app's data.
SUBCLASS_LEVEL = {
    "Cleric": 1, "Sorcerer": 1, "Warlock": 1,
    "Wizard": 2, "Druid": 2,
}

def subclass_level_for_class(class_name):
    return SUBCLASS_LEVEL.get(class_name, 3)


def compute_multiclass_hp(classes, con_mod):
    """Only the very first level taken overall gets the full hit-die-max bonus (RAW: that's
    always 1st level of whichever class the character started in) - every other level,
    across every class including the rest of that starting class's own levels, uses the
    average-rounded-up formula. `classes` order is assumed to reflect the order they were
    taken in (the first entry is the starting class)."""
    total = 0
    first = True
    for c in classes:
        hit_die = CLASSES.get(c["class_name"], {}).get("hit_die", 8)
        for _ in range(c["level"]):
            if first:
                total += hit_die + con_mod
                first = False
            else:
                total += hit_die // 2 + 1 + con_mod
    return max(1, total)


def _build_features_for_class_level(class_name, level):
    features = {}
    for feat in get_features_up_to_level(class_name, level):
        max_uses = feat.get("max", 0)
        if feat["name"] not in features:
            features[feat["name"]] = {
                "current": max_uses, "max": max_uses,
                "rest_type": feat.get("rest_type", "long"),
                "action": feat.get("action", "Action"),
                "description": feat.get("description", ""),
            }
    return features


def _build_subclass_features(class_name, subclass_name, level):
    """All class_features.json entries for this class+subclass at or below `level` - same
    tracker_data.features shape the base-class feature builder already uses, so it merges
    through the exact same _merge_features_for_level_up path with no special-casing."""
    if not subclass_name:
        return {}
    features = {}
    for f in get_all_class_features():
        if f.get("class_name") != class_name or f.get("subclass_name") != subclass_name:
            continue
        if f.get("level", 0) > level:
            continue
        max_uses = f.get("max_uses", 0)
        if f["name"] not in features:
            features[f["name"]] = {
                "current": max_uses, "max": max_uses,
                "rest_type": f.get("rest_type", "long"),
                "action": f.get("action", "Passive"),
                "description": f.get("description", ""),
            }
    return features


_AE_COST_TYPE = {"Action": "action", "Bonus Action": "bonus_action", "Reaction": "reaction", "Free Action": "free_action"}

def _add_ae_entries_for_features(old_ae_data, new_features, source_name):
    """Appends an Action Economy row for each non-Passive entry in `new_features` that
    isn't already present (by tracker_key) anywhere in old_ae_data - same shape
    build_ae_data's single-class path produces, but additive only (a multiclass character
    already has its stock actions/existing rows from creation or PDF import; this should
    never rebuild or duplicate those, only add what's newly granted by this level-up)."""
    merged = {section: list(rows) for section, rows in (old_ae_data or {}).items()}
    existing_keys = {row.get("tracker_key") or row.get("name") for rows in merged.values() for row in rows}
    for name, feat in new_features.items():
        section = feat.get("action", "Passive")
        if section not in _AE_COST_TYPE:
            continue
        if name in existing_keys:
            continue
        merged.setdefault(section, []).append({
            "name": name, "source": source_name, "source_type": "class",
            "cost_type": _AE_COST_TYPE[section], "tracker_key": name,
            "description": feat.get("description", ""),
        })
        existing_keys.add(name)
    return merged


def level_up_one_class(old_tracker_data, old_spell_data, old_ae_data, classes, leveling_class_name, ability_scores):
    """classes: the character's full current class list (list of {class_name, level,
    subclass}) BEFORE this level-up. leveling_class_name: which entry is gaining a level.
    Returns (merged_td, merged_sd, merged_ae, info)."""
    new_classes = [dict(c) for c in classes]
    target = next(c for c in new_classes if c["class_name"] == leveling_class_name)
    target["level"] += 1
    new_class_level = target["level"]
    new_total_level = sum(c["level"] for c in new_classes)

    # Incremental, not a from-scratch recompute: a from-scratch compute_multiclass_hp()
    # call here would overwrite the character's real recorded max HP with a generic
    # average-formula total, which essentially never matches a PDF-imported character's
    # actual (often manually-rolled, not averaged) HP - and if the recomputed total came
    # out LOWER than what was actually recorded, the old code silently shrank max HP while
    # reporting "+0 gained" (the max(0, ...) floor on a negative diff). The very-first-
    # level max-hit-die bonus (compute_multiclass_hp's "first" flag) only ever applies at
    # character creation, never on a level-up of an already-existing character, so the
    # gain for any level-up is always just the average-roll formula for the ONE new level.
    con_mod = modifier((ability_scores or {}).get("CON", 10))
    hit_die = CLASSES.get(leveling_class_name, {}).get("hit_die", 8)
    hp_gained = hit_die // 2 + 1 + con_mod
    old_hp = old_tracker_data.get("hp") or {}
    old_max_hp = old_hp.get("max", 0)
    new_max_hp = max(1, old_max_hp + hp_gained)

    new_spell_slots, new_pact_slots = get_multiclass_spell_slots(new_classes)

    new_features = _build_features_for_class_level(leveling_class_name, new_class_level)
    new_features.update(_build_subclass_features(leveling_class_name, target.get("subclass"), new_class_level))

    merged_td = dict(old_tracker_data)
    merged_td["features"] = _merge_features_for_level_up(old_tracker_data.get("features"), new_features)
    merged_td["spell_slots"] = _merge_spell_slots_for_level_up(old_tracker_data.get("spell_slots"), new_spell_slots)
    if new_pact_slots is not None:
        merged_td["pact_slots"] = _merge_spell_slots_for_level_up(old_tracker_data.get("pact_slots"), new_pact_slots)
    merged_td["classes"] = new_classes
    merged_td["hp"] = {
        **old_hp, "max": new_max_hp,
        "current": max(0, min(new_max_hp, old_hp.get("current", new_max_hp) + hp_gained)),
    }
    old_hd = old_tracker_data.get("hit_dice") or {}
    hd_gained = max(0, new_total_level - old_hd.get("total", new_total_level))
    merged_td["hit_dice"] = {
        "current": old_hd.get("current", new_total_level) + hd_gained,
        "total": new_total_level,
        # Multiclass hit dice can be different sizes per class - the existing single
        # die_size field can't represent that, so it's left at whichever class's die was
        # already recorded (or this class's, on a fresh multiclass character); hit dice
        # spent-on-rest tracking only cares about the count, not enforcing per-die sizes.
        "die_size": old_hd.get("die_size", CLASSES.get(leveling_class_name, {}).get("hit_die", 8)),
    }

    needs_subclass = [
        c["class_name"] for c in new_classes
        if c["level"] >= subclass_level_for_class(c["class_name"]) and not c.get("subclass")
    ]
    asi_level = new_class_level in asi_levels_for_class(leveling_class_name)

    merged_ae = _add_ae_entries_for_features(old_ae_data, new_features, leveling_class_name)

    info = {
        "hp_gained": hp_gained,
        "new_total_level": new_total_level,
        "new_class_level": new_class_level,
        "leveling_class": leveling_class_name,
        "needs_subclass": needs_subclass,
        "asi_level": asi_level,
        "new_class_name": classes_to_display_name(new_classes),
    }
    return merged_td, dict(old_spell_data), merged_ae, info


def apply_subclass_choice(tracker_data, ae_data, class_name, subclass_name):
    """Sets classes[i].subclass and grants every class_features.json entry for that
    class+subclass at or below the class's current level - covers both 'just hit the
    subclass-choice level' and 'retroactively assign a subclass that was never set'.
    Returns (tracker_data, ae_data) - the subclass's non-passive features need an
    Action Economy row too, same as level_up_one_class's own newly-granted features."""
    classes = tracker_data.get("classes", [])
    new_classes = [dict(c) for c in classes]
    target = next((c for c in new_classes if c["class_name"] == class_name), None)
    if not target:
        return tracker_data, ae_data
    target["subclass"] = subclass_name
    new_features = _build_subclass_features(class_name, subclass_name, target["level"])
    merged_td = dict(tracker_data)
    merged_td["classes"] = new_classes
    merged_td["features"] = _merge_features_for_level_up(tracker_data.get("features"), new_features)
    merged_ae = _add_ae_entries_for_features(ae_data, new_features, subclass_name)
    return merged_td, merged_ae


def apply_ability_score_improvement(ability_scores, increases):
    """increases: {ABILITY: amount}, e.g. {"STR": 2} or {"STR": 1, "DEX": 1}. RAW caps
    any single score at 20 via this feature (a few rare effects can exceed 20, but ASI
    itself never does) - same floor-only philosophy as item Set-To buffs elsewhere."""
    out = dict(ability_scores or {})
    for ability, amount in increases.items():
        out[ability] = min(20, out.get(ability, 10) + amount)
    return out
