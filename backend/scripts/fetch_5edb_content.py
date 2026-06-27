"""One-time fetch from github.com/5e-bits/5e-database (OGL-licensed 5e SRD data,
the dataset behind the open dnd5eapi.co) into backend/data/. Run manually with
`python fetch_5edb_content.py` from this folder. The app never calls this live at
runtime -- it only reads the files this writes.

For categories that overlap with data already in the app (spells, magic items,
monsters, conditions, feats), this only ADDS entries that are genuinely missing
by name -- it never overwrites or duplicates what's already there. For categories
with no existing equivalent (equipment, backgrounds, races, and a grab-bag of small
reference lists), it writes new files.

Deliberately skipped: Classes, Subclasses, Features, Levels -- engine/content_packs.py
already hand-authors class progression data for the character engine; a shallow SRD
copy of the same concept would just create a second, unused source of truth.
"""
import json
import os
import re
import urllib.request

RAW_BASE = "https://raw.githubusercontent.com/5e-bits/5e-database/main/src"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SOURCE_LABEL = "5e SRD (5e-bits/5e-database)"

CR_FRACTIONS = {0.125: "1/8", 0.25: "1/4", 0.5: "1/2"}


def fetch(ruleset, filename):
    url = f"{RAW_BASE}/{ruleset}/en/{filename}"
    req = urllib.request.Request(url, headers={"User-Agent": "RoundHero-content-pipeline/1.0"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def load_existing(filename, key):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as f:
        return json.load(f)[key]


def write_json(filename, payload):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote -> {path}")


def missing_by_name(db_entries, existing_entries):
    existing_names = {e["name"].lower() for e in existing_entries}
    return [e for e in db_entries if e["name"].lower() not in existing_names]


# ---------- generic cleaner for the new, no-existing-equivalent categories ----------

def clean(obj):
    if isinstance(obj, dict):
        cleaned = {k: clean(v) for k, v in obj.items() if k not in ("url", "image")}
        if set(cleaned.keys()) <= {"index", "name"} and "name" in cleaned:
            return cleaned["name"]
        return cleaned
    if isinstance(obj, list):
        return [clean(x) for x in obj]
    return obj


# ---------- merge: magic items ----------

def reshape_missing_item(it):
    desc_lines = it.get("desc") or []
    rarity = (it.get("rarity") or {}).get("name") or ""
    item_type = (it.get("equipment_category") or {}).get("name") or ""
    full_text = " ".join(desc_lines).lower()
    attunement = "requires attunement" in full_text
    description = "\n\n".join(desc_lines[1:]) if len(desc_lines) > 1 else (desc_lines[0] if desc_lines else "")
    return {
        "name": it["name"],
        "type": item_type,
        "rarity": rarity,
        "attunement": attunement,
        "weight": 0,
        "description": description,
        "charges": None,
        "buffs": [],
        "granted_spells": [],
        "source": SOURCE_LABEL,
    }


# ---------- merge: monsters ----------

def _parse_speed(s):
    m = re.match(r"(\d+)", s or "")
    return int(m.group(1)) if m else 0


def _cr_string(cr):
    if cr in CR_FRACTIONS:
        return CR_FRACTIONS[cr]
    return str(int(cr)) if cr == int(cr) else str(cr)


def _flatten_named_list(items):
    out = []
    for it in items or []:
        out.append(it["name"] if isinstance(it, dict) else str(it))
    return ", ".join(out)


def reshape_missing_monster(m):
    ac_list = m.get("armor_class") or []
    ac = ac_list[0].get("value") if ac_list else None
    ac_desc = ac_list[0].get("type") if ac_list else ""

    saves, skills = {}, {}
    for p in m.get("proficiencies") or []:
        name = (p.get("proficiency") or {}).get("name") or ""
        value = p.get("value")
        if name.startswith("Saving Throw:"):
            saves[name.split(":", 1)[1].strip().lower()] = value
        elif name.startswith("Skill:"):
            skills[name.split(":", 1)[1].strip().lower()] = value

    senses_obj = m.get("senses") or {}
    sense_parts = [f"{k.replace('_', ' ')} {v}" for k, v in senses_obj.items() if k != "passive_perception"]
    if "passive_perception" in senses_obj:
        sense_parts.append(f"passive Perception {senses_obj['passive_perception']}")

    cr = m.get("challenge_rating")

    def actions_of(key):
        return [{"name": a.get("name", ""), "desc": a.get("desc", "")} for a in (m.get(key) or [])]

    return {
        "name": m["name"],
        "description": "",
        "size": m.get("size", ""),
        "type": m.get("type", ""),
        "subtype": m.get("subtype") or "",
        "group": None,
        "alignment": m.get("alignment", ""),
        "armor_class": ac,
        "armor_desc": ac_desc or "",
        "hit_points": m.get("hit_points"),
        "hit_dice": m.get("hit_points_roll") or m.get("hit_dice") or "",
        "speed": {k: _parse_speed(v) for k, v in (m.get("speed") or {}).items()},
        "ability_scores": {
            "strength": m.get("strength"), "dexterity": m.get("dexterity"), "constitution": m.get("constitution"),
            "intelligence": m.get("intelligence"), "wisdom": m.get("wisdom"), "charisma": m.get("charisma"),
        },
        "saves": saves,
        "skills": skills,
        "damage_vulnerabilities": _flatten_named_list(m.get("damage_vulnerabilities")),
        "damage_resistances": _flatten_named_list(m.get("damage_resistances")),
        "damage_immunities": _flatten_named_list(m.get("damage_immunities")),
        "condition_immunities": _flatten_named_list(m.get("condition_immunities")),
        "senses": ", ".join(sense_parts),
        "languages": m.get("languages", ""),
        "challenge_rating": _cr_string(cr) if cr is not None else "",
        "cr": cr,
        "actions": actions_of("actions"),
        "bonus_actions": actions_of("bonus_actions"),
        "reactions": actions_of("reactions"),
        "legendary_desc": "",
        "legendary_actions": actions_of("legendary_actions"),
        "special_abilities": actions_of("special_abilities"),
        "spell_list": [],
        "environments": [],
        "page_no": None,
        "source": SOURCE_LABEL,
    }


# ---------- merge: 2024 feats ----------

FEAT_TYPE_LABELS = {"origin": "Origin Feat", "general": "General Feat", "fighting-style": "Fighting Style", "epic-boon": "Epic Boon"}


def reshape_2024_feat(f):
    parts = [f.get("description", "").replace("**", "")]
    prereq = f.get("prerequisites") or {}
    if prereq.get("minimum_level"):
        parts.append(f"Prerequisite: {prereq['minimum_level']}th level")
    if f.get("repeatable"):
        parts.append(f["repeatable"])
    type_label = FEAT_TYPE_LABELS.get(f.get("type"), "")
    return {
        "name": f["name"],
        "section": "Passive",
        "cost_type": "passive",
        "max_uses": 0,
        "rest_type": "long",
        "source": f"SRD 2024 · {type_label}" if type_label else "SRD 2024",
        "official": True,
        "description": "\n\n".join(parts),
    }


# ---------- new: equipment ----------

def reshape_equipment(it):
    cleaned = clean(it)
    cleaned.pop("index", None)
    return cleaned


# ---------- main ----------

def main():
    # Magic items: add genuinely missing entries
    existing_items = load_existing("magic_items.json", "items")
    db_items = fetch("2014", "5e-SRD-Magic-Items.json")
    new_items = [reshape_missing_item(it) for it in missing_by_name(db_items, existing_items)]
    write_json("magic_items.json", {"items": existing_items + new_items})
    print(f"magic items: added {len(new_items)}")

    # Monsters: add genuinely missing entries (lycanthrope/vampire alt-forms)
    existing_monsters = load_existing("monsters.json", "monsters")
    db_monsters = fetch("2014", "5e-SRD-Monsters.json")
    new_monsters = [reshape_missing_monster(m) for m in missing_by_name(db_monsters, existing_monsters)]
    new_monsters.sort(key=lambda m: m["name"])
    write_json("monsters.json", {"monsters": existing_monsters + new_monsters})
    print(f"monsters: added {len(new_monsters)}")

    # Feats: add the 2024 SRD's newly-opened official feats
    existing_feats = load_existing("feats.json", "feats")
    db_feats_2024 = fetch("2024", "5e-SRD-Feats.json")
    new_feats = [reshape_2024_feat(f) for f in missing_by_name(db_feats_2024, existing_feats)]
    new_feats.sort(key=lambda f: f["name"])
    write_json("feats.json", {"feats": existing_feats + new_feats})
    print(f"feats: added {len(new_feats)}")

    # Equipment: brand new category, no existing equivalent
    db_equipment = fetch("2014", "5e-SRD-Equipment.json")
    equipment = sorted((reshape_equipment(it) for it in db_equipment), key=lambda e: e["name"])
    write_json("equipment.json", {"equipment": equipment})
    print(f"equipment: {len(equipment)}")

    # Backgrounds: use the richer 2024 set
    db_backgrounds = fetch("2024", "5e-SRD-Backgrounds.json")
    backgrounds = []
    for bg in db_backgrounds:
        cleaned = clean(bg)
        cleaned.pop("index", None)
        backgrounds.append(cleaned)
    backgrounds.sort(key=lambda b: b["name"])
    write_json("backgrounds.json", {"backgrounds": backgrounds})
    print(f"backgrounds: {len(backgrounds)}")

    # Races + subraces: real trait text, supplementary to content_packs.py's bare name list
    races = [clean(r) for r in fetch("2014", "5e-SRD-Races.json")]
    subraces = [clean(r) for r in fetch("2014", "5e-SRD-Subraces.json")]
    for r in races + subraces:
        r.pop("index", None)
    races.sort(key=lambda r: r["name"])
    subraces.sort(key=lambda r: r["name"])
    write_json("races.json", {"races": races, "subraces": subraces})
    print(f"races: {len(races)}, subraces: {len(subraces)}")

    # Small reference/glossary categories, bundled into one file
    ref_files = {
        "ability_scores": "5e-SRD-Ability-Scores.json",
        "alignments": "5e-SRD-Alignments.json",
        "damage_types": "5e-SRD-Damage-Types.json",
        "languages": "5e-SRD-Languages.json",
        "magic_schools": "5e-SRD-Magic-Schools.json",
        "proficiencies": "5e-SRD-Proficiencies.json",
        "skills": "5e-SRD-Skills.json",
        "weapon_properties": "5e-SRD-Weapon-Properties.json",
        "rule_sections": "5e-SRD-Rule-Sections.json",
        "rules": "5e-SRD-Rules.json",
        "traits": "5e-SRD-Traits.json",
        "equipment_categories": "5e-SRD-Equipment-Categories.json",
    }
    reference = {}
    for key, filename in ref_files.items():
        entries = [clean(e) for e in fetch("2014", filename)]
        for e in entries:
            if isinstance(e, dict):
                e.pop("index", None)
        reference[key] = entries
        print(f"reference.{key}: {len(entries)}")
    write_json("reference.json", reference)


if __name__ == "__main__":
    main()
