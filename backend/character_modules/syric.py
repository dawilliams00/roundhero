import json
import os
import re
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "syric"
DEFAULT_ALLOWED_EMAILS = {
    "dawilliams00_7@yahoo.com",
    "dawilliams00@gmail.com",
    "roundherottrpg@gmail.com",
}
DEFAULT_CODEX_PAGES = [1, 2, 3, 4, 5, 6]
SECTION_ORDER = [
    "Action",
    "Haste Action",
    "Bonus Action",
    "Reaction",
    "Movement",
    "Free Action",
    "Magic Items",
    "No Action",
    "Special",
    "Passive",
    "Out of Combat",
]


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


def _unlocked_codex_pages(character):
    raw = (character.tracker_data or {}).get("codex_pages_found") or DEFAULT_CODEX_PAGES
    pages = set()
    for value in raw:
        try:
            page = int(value)
        except (TypeError, ValueError):
            continue
        if 1 <= page <= 10:
            pages.add(page)
    return sorted(pages or DEFAULT_CODEX_PAGES)


def _infer_codex_page(row):
    if not isinstance(row, dict):
        return None
    direct = row.get("codex_page")
    if direct is not None:
        try:
            return int(direct)
        except (TypeError, ValueError):
            return None
    text = " ".join(str(row.get(key, "") or "") for key in (
        "name", "display_name", "source", "tracker_key", "description"
    ))
    match = re.search(r"Codex\s*P(?:age)?\s*(\d+)", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r"\(Page\s*(\d+)\)", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _page_allowed(row, unlocked_pages):
    page = _infer_codex_page(row)
    return page is None or page in set(unlocked_pages)


def _normalize_codex_text(text):
    # The Pi action-economy file is canonical for David's table: d6 is free, d10 is bonus.
    # Older tracker descriptions still said d12 in one place, so normalize that display.
    return (text or "").replace("BONUS ACTION (d12)", "BONUS ACTION (d10)").replace("d12s", "d10s")


def _ensure_tracker_collections(td):
    td.setdefault("features", {})
    td.setdefault("item_charges", {})
    td.setdefault("syric_module", {})
    td["syric_module"].setdefault("round", {})
    td["syric_module"].setdefault("shadow", {})
    return td


def _apply_feature(features, feature):
    name = feature.get("name")
    if not name:
        return None
    previous = features.get(name, {})
    merged = dict(feature)
    if previous:
        merged["current"] = previous.get("current", merged.get("current", 0))
    features[name] = merged
    return name


def _apply_item_charge(item_charges, item):
    name = item.get("name")
    if not name:
        return None
    previous = item_charges.get(name, {})
    merged = dict(item)
    if previous:
        merged["current"] = previous.get("current", merged.get("current", 0))
    item_charges[name] = merged
    return name


def _remove_codex_page_entries(td, page_num, codex):
    page = codex.get(str(page_num), {})
    names = {row.get("name") for row in page.get("features", []) + page.get("item_charges", []) if row.get("name")}
    for name in names:
        td.get("features", {}).pop(name, None)
        td.get("item_charges", {}).pop(name, None)


def sync_codex_pages(character, pages):
    codex = _load_json("codex_tracker_abilities.json", {})
    td = _ensure_tracker_collections(character.tracker_data)
    normalized = set()
    for value in pages:
        try:
            page = int(value)
        except (TypeError, ValueError):
            continue
        if 1 <= page <= 10:
            normalized.add(page)
    normalized = sorted(normalized)
    previous = set(td.get("codex_pages_found") or [])
    for page_num in previous - set(normalized):
        _remove_codex_page_entries(td, page_num, codex)
    changed = []
    for page_num in normalized:
        page = codex.get(str(page_num), {})
        for old_name in page.get("migrates_from", []):
            td["features"].pop(old_name, None)
            td["item_charges"].pop(old_name, None)
        for feature in page.get("features", []):
            changed.append(_apply_feature(td["features"], feature))
        for item in page.get("item_charges", []):
            changed.append(_apply_item_charge(td["item_charges"], item))
    td["codex_pages_found"] = normalized
    character.tracker_data = td
    return [name for name in changed if name]


def sync_shadow_level(character, level):
    shadow = _load_json("shadow_tracker_abilities.json", {})
    defined = sorted(int(key) for key in shadow if str(key).isdigit())
    if not defined:
        return []
    effective = max((value for value in defined if value <= int(level)), default=defined[0])
    td = _ensure_tracker_collections(character.tracker_data)
    features = td["features"]
    for old_name in shadow.get("_migrates_from_live_tracker", []):
        features.pop(old_name, None)
    preserved = {name: value for name, value in features.items() if value.get("sync_source") == "shadow_sync"}
    for name in list(preserved):
        features.pop(name, None)
    changed = []
    for feature in shadow.get(str(effective), {}).get("features", []):
        name = feature.get("name")
        if name in preserved:
            features[name] = preserved[name]
        changed.append(_apply_feature(features, feature))
    td["shadow_level_synced"] = int(level)
    character.tracker_data = td
    return [name for name in changed if name]


def _find_tracker_record(td, tracker_key=None, aliases=None):
    aliases = aliases or []
    keys = [key for key in [tracker_key, *aliases] if key]
    for collection in ("features", "item_charges"):
        rows = td.get(collection, {})
        for key in keys:
            if key in rows:
                return collection, key, rows[key]
    return None, None, None


def _arcane_charge_record(td):
    collection, key, row = _find_tracker_record(td, "Arcane Charge")
    if row is None:
        td.setdefault("item_charges", {})
        row = {"name": "Arcane Charge", "current": 0, "max": 10, "overload_threshold": 10, "sync_source": "codex_sync"}
        td["item_charges"]["Arcane Charge"] = row
        return "item_charges", "Arcane Charge", row
    return collection, key, row


def _arcane_status(td):
    _collection, _key, row = _arcane_charge_record(td)
    current = int(row.get("current", 0))
    threshold = int(row.get("overload_threshold") or row.get("max") or 10)
    return {
        "current": current,
        "max": int(row.get("max", threshold)),
        "threshold": threshold,
        "overloaded": current >= threshold,
    }


def _set_arcane_charge(td, value):
    _collection, _key, row = _arcane_charge_record(td)
    row["current"] = max(0, int(value))
    return _arcane_status(td)


def _spend_tracker_record(td, tracker_key=None, aliases=None, amount=1):
    collection, key, row = _find_tracker_record(td, tracker_key, aliases)
    if row is None:
        return {"spent": False, "reason": "not_found"}
    maximum = int(row.get("max", 0))
    if maximum <= 0:
        return {"spent": True, "collection": collection, "key": key, "current": row.get("current", 0), "max": maximum}
    current = int(row.get("current", 0))
    cost = max(0, int(amount or 1))
    if current < cost:
        return {"spent": False, "reason": "depleted", "collection": collection, "key": key, "current": current, "max": maximum}
    row["current"] = current - cost
    return {"spent": True, "collection": collection, "key": key, "current": row["current"], "max": maximum}


def syric_action(character, action, payload=None):
    payload = payload or {}
    td = _ensure_tracker_collections(character.tracker_data)
    result = {"action": action}

    if action == "record_spell_cast":
        level = max(0, int(payload.get("level") or 0))
        spell_name = payload.get("spell_name") or "Spell"
        before = _arcane_status(td)
        if level > 0:
            after = _set_arcane_charge(td, before["current"] + level)
            td["syric_module"]["round"]["leveled_spell_cast"] = True
        else:
            after = before
        result.update({
            "spell_name": spell_name,
            "level": level,
            "arcane": after,
            "overload_check_required": level > 0 and before["overloaded"],
            "overload_dc": after["current"],
            "message": f"{spell_name} cast at L{level}. Arcane Charge {before['current']} -> {after['current']}." if level > 0 else f"{spell_name} cast as a cantrip.",
        })

    elif action == "vent":
        amount = max(0, int(payload.get("amount") or 0))
        before = _arcane_status(td)
        after = _set_arcane_charge(td, before["current"] - amount)
        td["syric_module"]["round"]["last_vent"] = amount
        result.update({"arcane": after, "message": f"Vented {amount}. Arcane Charge {before['current']} -> {after['current']}."})

    elif action == "end_turn":
        before = _arcane_status(td)
        round_state = td["syric_module"]["round"]
        if payload.get("vent_amount") is not None:
            reduction = max(0, int(payload.get("vent_amount") or 0))
            reason = "manual vent roll"
        elif round_state.get("leveled_spell_cast"):
            reduction = 2
            reason = "minimum passive vent"
        else:
            reduction = 12
            reason = "no leveled spell this round"
        after = _set_arcane_charge(td, before["current"] - reduction)
        round_state["leveled_spell_cast"] = False
        round_state["last_end_turn_vent"] = reduction
        result.update({
            "arcane": after,
            "vent_amount": reduction,
            "overload_check_required": after["overloaded"],
            "overload_dc": after["current"],
            "message": f"End turn: {reason}, reduced Arcane Charge by {reduction}.",
        })

    elif action == "discharge":
        before = _arcane_status(td)
        after = _set_arcane_charge(td, 0)
        td["syric_module"]["round"]["leveled_spell_cast"] = False
        result.update({"arcane": after, "message": f"Arcane Discharge reset charge from {before['current']} to 0."})

    elif action == "spend":
        spend = _spend_tracker_record(td, payload.get("tracker_key"), payload.get("tracker_aliases") or [], payload.get("amount") or 1)
        result.update(spend)

    elif action == "shadow_store":
        spell_name = (payload.get("spell_name") or "").strip()
        level = int(payload.get("level") or 0)
        if not spell_name or level <= 0:
            raise ValueError("Spell name and level are required.")
        slots = td.get("spell_slots", {})
        slot = slots.get(str(level))
        if not slot or int(slot.get("current", 0)) <= 0:
            raise ValueError(f"No L{level} slot available to store.")
        slot["current"] = int(slot.get("current", 0)) - 1
        td["syric_module"]["shadowcast"] = {
            "spell_name": spell_name,
            "level": level,
            "tracker_key": payload.get("tracker_key") or "Shadow: Nightbound Shadowcast",
            "tracker_aliases": payload.get("tracker_aliases") or [],
        }
        result.update({"stored": td["syric_module"]["shadowcast"], "message": f"Shadow now holds {spell_name} (L{level})."})

    elif action == "shadow_release":
        stored = td["syric_module"].get("shadowcast")
        if not stored:
            raise ValueError("Shadow is not holding a spell.")
        spend = _spend_tracker_record(td, stored.get("tracker_key"), stored.get("tracker_aliases") or [], 1)
        if not spend.get("spent"):
            result.update(spend)
        else:
            td["syric_module"]["shadowcast"] = None
            result.update({"spent": True, "released": stored, "message": f"Shadow released {stored.get('spell_name')} (L{stored.get('level')})."})

    elif action == "shadow_state":
        shadow_state = td["syric_module"].setdefault("shadow", {})
        for key in ("current_hp", "temp_hp", "form"):
            if key in payload:
                shadow_state[key] = payload[key]
        result.update({"shadow": shadow_state})

    else:
        raise ValueError("Unknown Syric action.")

    character.tracker_data = td
    return result


def _feature_summary(features, unlocked_pages=None):
    rows = []
    for name, feature in (features or {}).items():
        if not isinstance(feature, dict):
            continue
        if unlocked_pages is not None and not _page_allowed({**feature, "name": name}, unlocked_pages):
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
            "description": _normalize_codex_text(feature.get("description") or ""),
            "codex_page": _infer_codex_page({**feature, "name": name}),
        })
    return sorted(rows, key=lambda row: (row["action"], row["name"]))


def _counter_summary(tracker, codex, unlocked_pages):
    counters = []
    for name, value in (tracker.get("item_charges") or {}).items():
        if not isinstance(value, dict):
            continue
        if not _page_allowed({**value, "name": name}, unlocked_pages):
            continue
        counters.append({
            "name": value.get("display_name") or name,
            "tracker_key": name,
            "current": value.get("current", 0),
            "max": value.get("max", 0),
            "description": _normalize_codex_text(value.get("description") or ""),
            "source": value.get("sync_source") or "tracker",
            "codex_page": _infer_codex_page({**value, "name": name}),
        })
    for page in (codex or {}).values():
        if not isinstance(page, dict):
            continue
        for item in page.get("item_charges") or []:
            if not _page_allowed(item, unlocked_pages):
                continue
            counters.append({
                "name": item.get("display_name") or item.get("name"),
                "tracker_key": item.get("name"),
                "current": item.get("current", 0),
                "max": item.get("max", 0),
                "description": _normalize_codex_text(item.get("description") or ""),
                "source": item.get("sync_source") or "codex",
                "codex_page": item.get("codex_page"),
            })
    deduped = {}
    for counter in counters:
        key = counter.get("tracker_key") or counter.get("name")
        deduped[key] = counter
    return list(deduped.values())


def _codex_pages(codex, unlocked_pages):
    rows = []
    for key, page in (codex or {}).items():
        if not str(key).isdigit() or not isinstance(page, dict):
            continue
        feature_count = len(page.get("features") or [])
        item_count = len(page.get("item_charges") or [])
        rows.append({
            "page": int(key),
            "title": page.get("title") or f"Codex Page {key}",
            "feature_count": feature_count,
            "counter_count": item_count,
            "unlocked": int(key) in set(unlocked_pages),
        })
    return sorted(rows, key=lambda row: row["page"])


def _shadow_for_level(shadow, level):
    level_key = str(level or 13)
    data = shadow.get(level_key) or shadow.get("13") or {}
    features = data.get("features") or []
    core_reference = next((
        feature.get("description") or ""
        for feature in features
        if isinstance(feature, dict) and "core" in (feature.get("display_name") or feature.get("name") or "").lower()
    ), "")
    return {
        "level": int(level_key) if level_key.isdigit() else level,
        "title": data.get("title") or "Shadow",
        "summary": data.get("summary") or "",
        "gui": data.get("gui") or {},
        "core_reference": _normalize_codex_text(core_reference),
        "features": _feature_summary({
            feature.get("name") or feature.get("display_name") or f"Feature {index}": feature
            for index, feature in enumerate(features)
            if isinstance(feature, dict)
        }),
    }


def _action_sections(action_economy, owner, unlocked_pages):
    owner_data = action_economy.get(owner) or {}
    sections = []
    for section in SECTION_ORDER:
        rows = owner_data.get(section)
        if not isinstance(rows, list):
            continue
        actions = []
        for row in rows:
            if not isinstance(row, dict) or not _page_allowed(row, unlocked_pages):
                continue
            actions.append({
                "name": row.get("name"),
                "source": row.get("source") or "",
                "source_type": row.get("source_type") or "",
                "cost_type": row.get("cost_type") or "",
                "tracker_key": row.get("tracker_key"),
                "tracker_aliases": row.get("tracker_aliases") or [],
                "description": _normalize_codex_text(row.get("description") or ""),
                "codex_page": _infer_codex_page(row),
                "slot_levels": row.get("slot_levels") or [],
                "static": bool(row.get("static")),
            })
        if not actions:
            continue
        sections.append({
            "name": section,
            "actions": actions,
        })
    return sections


def get_syric_module(character):
    tracker = _load_json("syric_magic_tracker.json", {})
    action_economy = _load_json("action_economy.json", {})
    shadow = _load_json("shadow_tracker_abilities.json", {})
    codex = _load_json("codex_tracker_abilities.json", {})
    unlocked_pages = _unlocked_codex_pages(character)
    return {
        "id": "syric_arcane",
        "label": "Syric Console",
        "character_id": character.id,
        "character_name": character.name,
        "summary": "Private Syric/Shadow/Codex control layer imported from the Pi Arcane Controller.",
        "source": "Syric Arcane Controller",
        "unlocked_codex_pages": unlocked_pages,
        "locked_codex_pages": [page for page in range(1, 11) if page not in set(unlocked_pages)],
        "counters": _counter_summary(tracker, codex, unlocked_pages),
        "features": _feature_summary(tracker.get("features") or {}, unlocked_pages),
        "action_sections": _action_sections(action_economy, "syric", unlocked_pages),
        "shadow_action_sections": _action_sections(action_economy, "shadow", unlocked_pages),
        "shadow": _shadow_for_level(shadow, character.level),
        "codex_pages": _codex_pages(codex, unlocked_pages),
        "level_notes": codex.get("_level_notes") or {},
    }
