import json
import os
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "syric"
DEFAULT_ALLOWED_EMAILS = {
    "dawilliams00_7@yahoo.com",
    "dawilliams00@gmail.com",
    "roundherottrpg@gmail.com",
}


def _load_json(filename, fallback):
    path = DATA_DIR / filename
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _allowed_emails():
    raw = os.environ.get("SYRIC_MODULE_EMAILS", "")
    if not raw.strip():
        return DEFAULT_ALLOWED_EMAILS
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def syric_module_allowed(user, character):
    if not user or not character:
        return False
    email_allowed = (user.email or "").lower() in _allowed_emails()
    character_allowed = "syric" in (character.name or "").lower()
    return email_allowed and character_allowed


def _feature_summary(features):
    rows = []
    for name, feature in (features or {}).items():
        if not isinstance(feature, dict):
            continue
        current = feature.get("current", feature.get("current_uses"))
        maximum = feature.get("max", feature.get("max_uses"))
        if current is None and maximum is None and not feature.get("description"):
            continue
        rows.append({
            "name": feature.get("display_name") or feature.get("name") or name,
            "tracker_key": name,
            "current": current,
            "max": maximum,
            "rest_type": feature.get("rest_type") or feature.get("usage_type") or "",
            "action": feature.get("action") or "",
            "source": feature.get("source") or feature.get("sync_source") or "",
            "description": feature.get("description") or "",
        })
    return sorted(rows, key=lambda row: (row["action"], row["name"]))


def _counter_summary(tracker, codex):
    counters = []
    for name, value in (tracker.get("item_charges") or {}).items():
        if not isinstance(value, dict):
            continue
        counters.append({
            "name": value.get("display_name") or name,
            "tracker_key": name,
            "current": value.get("current", 0),
            "max": value.get("max", 0),
            "description": value.get("description") or "",
            "source": value.get("sync_source") or "tracker",
        })
    for page in (codex or {}).values():
        if not isinstance(page, dict):
            continue
        for item in page.get("item_charges") or []:
            counters.append({
                "name": item.get("display_name") or item.get("name"),
                "tracker_key": item.get("name"),
                "current": item.get("current", 0),
                "max": item.get("max", 0),
                "description": item.get("description") or "",
                "source": item.get("sync_source") or "codex",
                "codex_page": item.get("codex_page"),
            })
    deduped = {}
    for counter in counters:
        key = counter.get("tracker_key") or counter.get("name")
        deduped[key] = counter
    return list(deduped.values())


def _codex_pages(codex):
    rows = []
    for key, page in (codex or {}).items():
        if not str(key).isdigit() or not isinstance(page, dict):
            continue
        feature_count = len(page.get("features") or [])
        item_count = len(page.get("item_charges") or [])
        if feature_count or item_count:
            rows.append({
                "page": int(key),
                "title": page.get("title") or f"Codex Page {key}",
                "feature_count": feature_count,
                "counter_count": item_count,
            })
    return sorted(rows, key=lambda row: row["page"])


def _shadow_for_level(shadow, level):
    level_key = str(level or 13)
    data = shadow.get(level_key) or shadow.get("13") or {}
    return {
        "level": int(level_key) if level_key.isdigit() else level,
        "title": data.get("title") or "Shadow",
        "summary": data.get("summary") or "",
        "features": _feature_summary({
            feature.get("name") or feature.get("display_name") or f"Feature {index}": feature
            for index, feature in enumerate(data.get("features") or [])
            if isinstance(feature, dict)
        }),
    }


def _action_sections(action_economy):
    syric = action_economy.get("syric") or {}
    sections = []
    for section, rows in syric.items():
        if not isinstance(rows, list):
            continue
        sections.append({
            "name": section,
            "actions": [
                {
                    "name": row.get("name"),
                    "source": row.get("source") or "",
                    "source_type": row.get("source_type") or "",
                    "cost_type": row.get("cost_type") or "",
                    "tracker_key": row.get("tracker_key"),
                    "description": row.get("description") or "",
                }
                for row in rows
                if isinstance(row, dict)
            ],
        })
    return sections


def get_syric_module(character):
    tracker = _load_json("syric_magic_tracker.json", {})
    action_economy = _load_json("action_economy.json", {})
    shadow = _load_json("shadow_tracker_abilities.json", {})
    codex = _load_json("codex_tracker_abilities.json", {})
    return {
        "id": "syric_arcane",
        "label": "Syric Console",
        "character_id": character.id,
        "character_name": character.name,
        "summary": "Private Syric/Shadow/Codex control layer imported from the Pi Arcane Controller.",
        "source": "Syric Arcane Controller",
        "counters": _counter_summary(tracker, codex),
        "features": _feature_summary(tracker.get("features") or {}),
        "action_sections": _action_sections(action_economy),
        "shadow": _shadow_for_level(shadow, character.level),
        "codex_pages": _codex_pages(codex),
        "level_notes": codex.get("_level_notes") or {},
    }
