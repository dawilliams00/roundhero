"""One-time fetch from api.open5e.com (no key needed) into static JSON files under
backend/data/. Run manually with `python fetch_open5e_content.py` from this folder --
the app never calls the live API at runtime, it only reads the files this writes.

Pulls:
  - monsters.json:   all SRD (wotc-srd) monsters
  - conditions.json: all SRD (wotc-srd) conditions
  - feats.json:      SRD + Tome of Heroes + Tal'Dorei feats, reshaped into this app's
                      ability shape ({name, section, cost_type, source, description,
                      max_uses, rest_type}) so FeatBrowserModal can add them straight
                      onto a character. Level Up: Advanced 5e (a5e) feats are excluded --
                      they reference a different ruleset's subsystems (maneuver DC,
                      expertise dice) that don't translate to standard 5e.
"""
import json
import os
import urllib.request

BASE = "https://api.open5e.com/v1"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

FEAT_DOCUMENTS = ["wotc-srd", "toh", "taldorei"]
FEAT_SOURCE_LABELS = {
    "wotc-srd": "SRD",
    "toh": "Tome of Heroes (3rd-party)",
    "taldorei": "Tal'Dorei (3rd-party)",
}


def fetch_all(endpoint, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{BASE}/{endpoint}/?{query}&limit=100"
    results = []
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": "RoundHero-content-pipeline/1.0"})
        with urllib.request.urlopen(req) as resp:
            page = json.loads(resp.read())
        results.extend(page["results"])
        url = page["next"]
    return results


def reshape_monster(m):
    saves = {k[:-5]: v for k, v in m.items() if k.endswith("_save") and v is not None}
    return {
        "name": m["name"],
        "description": (m.get("desc") or "").strip(),
        "size": m["size"],
        "type": m["type"],
        "subtype": m.get("subtype") or "",
        "group": m.get("group"),
        "alignment": m.get("alignment") or "",
        "armor_class": m["armor_class"],
        "armor_desc": m.get("armor_desc") or "",
        "hit_points": m["hit_points"],
        "hit_dice": m.get("hit_dice") or "",
        "speed": m.get("speed") or {},
        "ability_scores": {
            "strength": m["strength"], "dexterity": m["dexterity"], "constitution": m["constitution"],
            "intelligence": m["intelligence"], "wisdom": m["wisdom"], "charisma": m["charisma"],
        },
        "saves": saves,
        "skills": m.get("skills") or {},
        "damage_vulnerabilities": m.get("damage_vulnerabilities") or "",
        "damage_resistances": m.get("damage_resistances") or "",
        "damage_immunities": m.get("damage_immunities") or "",
        "condition_immunities": m.get("condition_immunities") or "",
        "senses": m.get("senses") or "",
        "languages": m.get("languages") or "",
        "challenge_rating": m.get("challenge_rating") or "",
        "cr": m.get("cr"),
        "actions": m.get("actions") or [],
        "bonus_actions": m.get("bonus_actions") or [],
        "reactions": m.get("reactions") or [],
        "legendary_desc": m.get("legendary_desc") or "",
        "legendary_actions": m.get("legendary_actions") or [],
        "special_abilities": m.get("special_abilities") or [],
        "spell_list": m.get("spell_list") or [],
        "environments": m.get("environments") or [],
        "page_no": m.get("page_no"),
        "source": m.get("document__title") or "",
    }


def reshape_condition(c):
    return {
        "name": c["name"],
        "description": (c.get("desc") or "").strip(),
        "source": c.get("document__title") or "",
    }


def _clean_bullet(s):
    s = s.strip()
    if s.startswith("* "):
        s = s[2:]
    return s


def reshape_feat(f):
    doc = f.get("document__slug", "")
    parts = []
    if f.get("desc"):
        parts.append(f["desc"].strip())
    prereq = (f.get("prerequisite") or "").strip().strip("*").strip()
    if prereq and prereq.lower() not in ("n/a", ""):
        if not prereq.lower().startswith("prerequisite"):
            prereq = f"Prerequisite: {prereq}"
        parts.append(prereq)
    effects = [_clean_bullet(e) for e in (f.get("effects_desc") or [])]
    if effects:
        parts.append("\n".join(f"- {e}" for e in effects))
    return {
        "name": f["name"],
        "section": "Passive",
        "cost_type": "passive",
        "max_uses": 0,
        "rest_type": "long",
        "source": FEAT_SOURCE_LABELS.get(doc, f.get("document__title") or "Open5e"),
        "official": doc == "wotc-srd",
        "description": "\n\n".join(parts),
    }


def write_json(filename, key, items):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({key: items}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {len(items)} {key} -> {path}")


def main():
    monsters = [reshape_monster(m) for m in fetch_all("monsters", document__slug="wotc-srd")]
    monsters.sort(key=lambda m: m["name"])
    write_json("monsters.json", "monsters", monsters)

    conditions = [reshape_condition(c) for c in fetch_all("conditions", document__slug="wotc-srd")]
    conditions.sort(key=lambda c: c["name"])
    write_json("conditions.json", "conditions", conditions)

    feats = []
    for doc in FEAT_DOCUMENTS:
        feats.extend(reshape_feat(f) for f in fetch_all("feats", document__slug=doc))
    feats.sort(key=lambda f: f["name"])
    write_json("feats.json", "feats", feats)


if __name__ == "__main__":
    main()
