import copy

LONG_REST_RECHARGES = {"dawn", "dusk", "long_rest"}
SHORT_REST_RECHARGES = {"short_rest"}

def _recharge_item(ch, recharge_set, summary, item_name):
    if not ch or str(ch.get("recharge", "")).lower() not in recharge_set:
        return
    mx = int(ch.get("max", 0))
    cur = ch.get("current", 0)
    if cur >= mx:
        return
    formula = ch.get("recharge_amount")
    if formula:
        # Items with a rolled (not flat-full) recharge are never auto-rolled - the player
        # rolls it themselves via the item's Recharge button, so this rest doesn't silently
        # decide the result for them. Just remind them it's eligible.
        summary["items_need_recharge"].append(item_name)
    else:
        ch["current"] = mx
        summary["items_recharged"].append(item_name)

def _restore_pact_slots(td, summary):
    # Multiclass characters with a Warlock level keep Pact Magic as a separate pool from
    # the combined spell_slots table (see get_multiclass_spell_slots) - Pact Magic
    # recovers on a short OR long rest per RAW, unconditionally, unlike the shared table
    # which is long-rest only. A single-class Warlock still uses the older convention of
    # storing pact slots directly in spell_slots (gated on spell_data.caster_type below),
    # so this only ever does anything for a character that actually has this field.
    pact = td.get("pact_slots")
    if not pact:
        return
    for slot in pact.values():
        mx = int(slot.get("max", 0))
        if slot.get("current", 0) < mx:
            slot["current"] = mx
            summary["slots_restored"] = True

def apply_rest(tracker_data, spell_data, rest_type="long"):
    td = copy.deepcopy(tracker_data)
    features = td.get("features", {})
    slots    = td.get("spell_slots", {})
    items    = td.get("inventory", {}).get("items", [])
    # Up to two companion slots (e.g. a Blood Hunter's normal form and Hybrid
    # Transformation) - both reset on rest regardless of which one is currently active,
    # same as a real character's own resources don't pause just because you're not
    # looking at them.
    companion_abilities = td.get("companion", {}).get("abilities", []) + td.get("companion2", {}).get("abilities", [])

    summary = {"features_reset": [], "items_recharged": [], "items_need_recharge": [], "slots_restored": False}

    if rest_type == "long":
        for name, feat in features.items():
            mx = int(feat.get("max", 0))
            if mx > 0 and feat.get("current", 0) < mx:
                feat["current"] = mx
                summary["features_reset"].append(name)
        for ability in companion_abilities:
            mx = int(ability.get("max", 0))
            if mx > 0 and ability.get("current", 0) < mx:
                ability["current"] = mx
                summary["features_reset"].append(ability.get("name", "Companion ability"))
        for level, slot in slots.items():
            mx = int(slot.get("max", 0))
            if slot.get("current", 0) < mx:
                slot["current"] = mx
                summary["slots_restored"] = True
        for item in items:
            _recharge_item(item.get("charges"), LONG_REST_RECHARGES, summary, item["name"])
        _restore_pact_slots(td, summary)
        td["conditions"] = []
        if "hp" in td:
            hp = td["hp"]
            effective_max = hp.get("max_override") or hp.get("max", hp.get("current", 0))
            hp["current"] = effective_max
            hp["temp"] = 0
        hd = td.get("hit_dice")
        if hd and hd.get("total", 0) > 0:
            before = hd.get("current", 0)
            regain = max(1, hd["total"] // 2)
            hd["current"] = min(hd["total"], before + regain)
            if hd["current"] > before:
                summary["hit_dice_regained"] = hd["current"] - before

    elif rest_type == "short":
        for name, feat in features.items():
            if feat.get("rest_type") == "short":
                mx = int(feat.get("max", 0))
                if mx > 0 and feat.get("current", 0) < mx:
                    feat["current"] = mx
                    summary["features_reset"].append(name)
        for ability in companion_abilities:
            if ability.get("rest_type") == "short":
                mx = int(ability.get("max", 0))
                if mx > 0 and ability.get("current", 0) < mx:
                    ability["current"] = mx
                    summary["features_reset"].append(ability.get("name", "Companion ability"))
        for item in items:
            _recharge_item(item.get("charges"), SHORT_REST_RECHARGES, summary, item["name"])
        _restore_pact_slots(td, summary)
        caster_type = spell_data.get("caster_type", "none")
        if caster_type == "warlock":
            for level, slot in slots.items():
                mx = int(slot.get("max", 0))
                if slot.get("current", 0) < mx:
                    slot["current"] = mx
                    summary["slots_restored"] = True

    return td, summary
