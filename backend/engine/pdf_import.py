import re
import fitz

SKILL_FIELD_MAP = {
    "Acrobatics": "Acrobatics",
    "Animal": "Animal Handling",
    "Arcana": "Arcana",
    "Athletics": "Athletics",
    "Deception": "Deception",
    "History": "History",
    "Insight": "Insight",
    "Intimidation": "Intimidation",
    "Investigation": "Investigation",
    "Medicine": "Medicine",
    "Nature": "Nature",
    "Perception": "Perception",
    "Performance": "Performance",
    "Persuasion": "Persuasion",
    "Religion": "Religion",
    "SleightofHand": "Sleight of Hand",
    "Stealth": "Stealth",
    "Survival": "Survival",
}

SAVE_FIELD_MAP = {"Str": "STR", "Dex": "DEX", "Con": "CON", "Int": "INT", "Wis": "WIS", "Cha": "CHA"}

FEATURE_BLOCKLIST = {
    "ability score improvement", "proficiencies", "languages", "size", "speed",
    "creature type", "hit points", "skills",
}

STOCK_ACTIONS = [
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
STOCK_BONUS = [
    {"name": "Off-hand Attack","source": "Core 5e", "source_type": "raw", "cost_type": "bonus_action", "description": "When you attack with a light weapon, attack with a different light weapon in your off hand. No ability modifier to damage unless negative."},
]
STOCK_REACTIONS = [
    {"name": "Opportunity Attack", "source": "Core 5e", "source_type": "raw", "cost_type": "reaction", "description": "When a hostile creature moves out of your reach, make one melee attack."},
    {"name": "Readied Action",     "source": "Core 5e", "source_type": "raw", "cost_type": "reaction", "description": "Trigger the action you prepared with the Ready action."},
]


def _parse_int(val, default=0):
    if val is None:
        return default
    s = str(val).replace(",", "").strip()
    m = re.search(r"-?\d+", s)
    return int(m.group()) if m else default


def _numbered_keys(fields, prefix):
    out = []
    for key in fields:
        m = re.match(rf"^{re.escape(prefix)}(\d+)$", key)
        if m:
            out.append((int(m.group(1)), key))
    out.sort()
    return [key for _, key in out]


def _parse_features(text_blobs):
    features = []
    current = None
    section = "Features"
    for blob in text_blobs:
        if not blob:
            continue
        for raw_line in blob.split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("==="):
                section = line.strip("= ").strip()
                continue
            if line.startswith("*"):
                if current:
                    features.append(current)
                rest = line[1:].strip()
                parts = rest.split("•")
                name = parts[0].strip()
                source = parts[1].strip() if len(parts) > 1 else section
                current = {"name": name or "Feature", "source": source, "section": section,
                           "description": "", "max_uses": 0, "rest_type": "long", "action": "Passive"}
                continue
            if line.startswith("|"):
                usage = line[1:].strip()
                m = re.search(r"(\d+)\s*/\s*(Long|Short)\s*Rest", usage, re.I)
                if m and current:
                    current["max_uses"] = int(m.group(1))
                    current["rest_type"] = "long" if m.group(2).lower() == "long" else "short"
                if current:
                    if "Bonus Action" in usage:
                        current["action"] = "Bonus Action"
                    elif "Reaction" in usage:
                        current["action"] = "Reaction"
                    elif "Action" in usage:
                        current["action"] = "Action"
                continue
            if current:
                current["description"] = (current["description"] + " " + line).strip()
    if current:
        features.append(current)
    return features


def parse_character_pdf(file_bytes, spell_db_by_name=None):
    doc = fitz.open(stream=file_bytes, filetype="pdf")

    fields = {}
    ordered = []
    for page in doc:
        for w in (page.widgets() or []):
            if not w.field_name:
                continue
            key = w.field_name.strip()
            fields[key] = w.field_value
            ordered.append((key, w.field_value))

    name = (fields.get("CharacterName") or "Imported Character").strip() or "Imported Character"
    race = (fields.get("RACE") or "").strip()
    class_level_raw = (fields.get("CLASS  LEVEL") or "").strip()
    total_level = sum(int(n) for n in re.findall(r"(\d+)", class_level_raw)) or 1

    ability_scores = {k: _parse_int(fields.get(k), 10) for k in ["STR", "DEX", "CON", "INT", "WIS", "CHA"]}

    save_proficiencies = [ab for stub, ab in SAVE_FIELD_MAP.items() if (fields.get(f"{stub}Prof") or "").strip()]

    skill_proficiencies = []
    for stub, skill in SKILL_FIELD_MAP.items():
        val = fields.get(f"{stub}Prof")
        if val is None:
            for k in fields:
                if k.strip() == f"{stub}Prof":
                    val = fields[k]
                    break
        if (val or "").strip():
            skill_proficiencies.append(skill)

    ac = _parse_int(fields.get("AC"), 10)
    initiative = _parse_int(fields.get("Init"), 0)
    max_hp = _parse_int(fields.get("MaxHP"), 1)
    current_hp_raw = (fields.get("CurrentHP") or "").strip()
    current_hp = _parse_int(current_hp_raw, max_hp) if current_hp_raw else max_hp
    temp_hp_raw = (fields.get("TempHP") or "").strip()
    temp_hp = _parse_int(temp_hp_raw, 0) if temp_hp_raw and temp_hp_raw != "--" else 0
    speed = (fields.get("Speed") or "").strip()
    senses = (fields.get("AdditionalSenses") or "").strip()

    resistances, immunities, vulnerabilities = [], [], []
    for line in (fields.get("Defenses") or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        rest = re.split(r"[-:]", line, maxsplit=1)
        items = [x.strip() for x in (rest[-1] if len(rest) > 1 else line).split(",") if x.strip()]
        if "immun" in low:
            immunities += items
        elif "vulnerab" in low:
            vulnerabilities += items
        elif "resist" in low:
            resistances += items

    advantages = [line.strip() for line in (fields.get("SaveModifiers") or "").split("\n") if line.strip()]
    inspiration = bool((fields.get("Inspiration") or "").strip())

    currency = {cur.lower(): _parse_int(fields.get(cur), 0) for cur in ["CP", "SP", "EP", "GP", "PP"]}

    attuned_names = set()
    for i in range(1, 10):
        n = (fields.get(f"Attuned Name{i}") or "").strip()
        if n:
            attuned_names.add(n)

    items = []
    seen = set()
    for key in _numbered_keys(fields, "Eq Name"):
        idx = re.search(r"\d+$", key).group()
        n = (fields.get(key) or "").strip()
        if not n or n in seen:
            continue
        seen.add(n)
        qty = _parse_int(fields.get(f"Eq Qty{idx}"), 1)
        weight_raw = (fields.get(f"Eq Weight{idx}") or "").strip()
        wm = re.search(r"[\d.]+", weight_raw)
        weight = float(wm.group()) if wm else 0.0
        items.append({
            "name": n, "quantity": qty, "weight": weight, "rarity": "Common",
            "equipped": False, "attunement": n in attuned_names, "attuned": n in attuned_names,
            "description": "", "charges": None, "granted_spells": [],
        })

    item_by_name = {it["name"]: it for it in items}
    inventory = {"currency": currency, "items": items}

    for key in fields:
        wm = re.match(r"^Wpn Notes (\d+)$", key)
        if not wm:
            continue
        cm = re.search(r"(\d+)\s*/\s*(\d+)\s*Charges", fields[key] or "", re.I)
        if not cm:
            continue
        n = wm.group(1)
        name_key = "Wpn Name" if n == "1" else f"Wpn Name {n}"
        wname = (fields.get(name_key) or "").strip()
        if wname in item_by_name:
            item_by_name[wname]["charges"] = {"current": int(cm.group(1)), "max": int(cm.group(2)), "recharge": "dawn"}

    feature_blobs = [fields[k] for k in _numbered_keys(fields, "FeaturesTraits")]
    parsed_features = _parse_features(feature_blobs)
    features = {}
    for f in parsed_features:
        if f["name"].strip().lower() in FEATURE_BLOCKLIST:
            continue
        nm = f["name"]
        suffix = 2
        while nm in features:
            nm = f"{f['name']} ({suffix})"
            suffix += 1
        features[nm] = {
            "current": f["max_uses"], "max": f["max_uses"], "rest_type": f["rest_type"],
            "action": f["action"], "description": f["description"].strip(),
        }

    actions_text = "\n".join(fields[k] for k in _numbered_keys(fields, "Actions") if fields.get(k))
    if actions_text.strip():
        features["Standard Actions Reference"] = {
            "current": 0, "max": 0, "rest_type": "none", "action": "Passive",
            "description": actions_text.strip(),
        }

    current_level = None
    spell_rows = {}
    slot_max = {}
    for fname, fval in ordered:
        m = re.match(r"^spellHeader(\d+)$", fname)
        if m:
            current_level = int(m.group(1))
            continue
        m2 = re.match(r"^spellSlotHeader(\d+)$", fname)
        if m2:
            lvl = int(m2.group(1))
            sm = re.search(r"(\d+)\s*Slot", fval or "")
            if sm:
                slot_max[lvl] = int(sm.group(1))
            continue
        m3 = re.match(r"^spell(Name|Source|SaveHit|CastingTime|Range|Components|Duration|Page|Notes)(\d+)$", fname)
        if m3 and current_level is not None:
            field, idx = m3.group(1), int(m3.group(2))
            row = spell_rows.setdefault(idx, {"level": current_level})
            row[field] = fval

    class_names = set()
    for part in class_level_raw.split("/"):
        cm = re.match(r"\s*(.+?)\s+\d+\s*$", part.strip())
        if cm:
            class_names.add(cm.group(1).strip().lower())

    known_spells = []
    spell_db_by_name = spell_db_by_name or {}
    for idx in sorted(spell_rows.keys()):
        row = spell_rows[idx]
        raw_name = (row.get("Name") or "").strip()
        if not raw_name:
            continue
        clean_name = re.sub(r"\s*\[R\]\s*$", "", raw_name).strip()
        level = row.get("level", 0)
        source = (row.get("Source") or "").strip()
        master = spell_db_by_name.get(clean_name.lower())
        if master:
            entry = dict(master)
        else:
            duration = (row.get("Duration") or "").strip()
            entry = {
                "name": clean_name, "level": str(level), "level_int": level, "school": "",
                "ritual": raw_name.strip().endswith("[R]"),
                "concentration": "concentration" in duration.lower(),
                "casting_time": (row.get("CastingTime") or "").strip(),
                "range": (row.get("Range") or "").strip(),
                "components": (row.get("Components") or "").strip(),
                "duration": duration,
                "description": f"Imported from character sheet. Source: {source}",
                "classes": [],
            }

        if source in item_by_name:
            item_by_name[source]["granted_spells"].append({
                "name": entry["name"], "level_int": entry.get("level_int", level), "charge_cost": 1,
            })
            continue

        if source and source.lower() not in class_names:
            entry["granted_by"] = source
        known_spells.append(entry)

    spell_slots = {str(lvl): {"current": mx, "max": mx} for lvl, mx in slot_max.items() if lvl > 0}
    caster_type = "full" if known_spells else "none"
    spell_data = {
        "class": class_level_raw, "caster_type": caster_type, "spell_lists": {},
        "active_list": None, "known_spells": known_spells, "prepared": [],
    }

    background = (fields.get("BACKGROUND") or "").strip()
    proficiencies_lang = (fields.get("ProficienciesLang") or "").strip()
    backstory = (fields.get("Backstory") or "").strip()
    personality = (fields.get("PersonalityTraits") or fields.get("PersonalityTraits ") or "").strip()

    notes_parts = []
    if background:
        notes_parts.append(f"Background: {background}")
    if "/" in class_level_raw:
        notes_parts.append(f"Multiclass: {class_level_raw}")
    if proficiencies_lang:
        notes_parts.append(proficiencies_lang)
    if personality:
        notes_parts.append(f"Personality Traits:\n{personality}")
    if backstory:
        notes_parts.append(f"Backstory:\n{backstory}")
    notes_text = "\n\n".join(notes_parts)

    tracker_data = {
        "features": features,
        "spell_slots": spell_slots,
        "item_charges": {},
        "conditions": [],
        "hp": {"current": current_hp, "max": max_hp, "temp": temp_hp},
        "ac": ac,
        "initiative": initiative,
        "inspiration": inspiration,
        "traits": {
            "resistances": resistances, "immunities": immunities,
            "vulnerabilities": vulnerabilities, "advantages": advantages,
        },
        "inventory": inventory,
        "save_proficiencies": save_proficiencies,
        "skill_proficiencies": skill_proficiencies,
        "speed": speed,
        "senses": senses,
    }

    ae_data = {"Action": list(STOCK_ACTIONS), "Bonus Action": list(STOCK_BONUS),
               "Reaction": list(STOCK_REACTIONS), "Free Action": [], "Passive": []}
    for fname, f in features.items():
        section = f["action"] if f["action"] in ae_data else "Passive"
        ae_data[section].append({
            "name": fname, "source": class_level_raw, "source_type": "imported",
            "cost_type": "feature" if f["max"] > 0 else "passive",
            "tracker_key": fname, "description": f["description"],
        })

    return {
        "name": name, "class_name": class_level_raw, "subclass": None, "race": race,
        "level": total_level, "ability_scores": ability_scores,
        "tracker_data": tracker_data, "spell_data": spell_data, "ae_data": ae_data,
        "notes": {"general": notes_text},
    }
