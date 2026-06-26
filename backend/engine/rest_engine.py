import copy

LONG_REST_RECHARGES = {"dawn", "dusk", "long_rest"}
SHORT_REST_RECHARGES = {"short_rest"}

def apply_rest(tracker_data, spell_data, rest_type="long"):
    td = copy.deepcopy(tracker_data)
    features = td.get("features", {})
    slots    = td.get("spell_slots", {})
    items    = td.get("inventory", {}).get("items", [])

    summary = {"features_reset": [], "items_recharged": [], "slots_restored": False}

    if rest_type == "long":
        for name, feat in features.items():
            mx = int(feat.get("max", 0))
            if mx > 0 and feat.get("current", 0) < mx:
                feat["current"] = mx
                summary["features_reset"].append(name)
        for level, slot in slots.items():
            mx = int(slot.get("max", 0))
            if slot.get("current", 0) < mx:
                slot["current"] = mx
                summary["slots_restored"] = True
        for item in items:
            ch = item.get("charges")
            if ch and str(ch.get("recharge", "")).lower() in LONG_REST_RECHARGES:
                mx = int(ch.get("max", 0))
                if ch.get("current", 0) < mx:
                    ch["current"] = mx
                    summary["items_recharged"].append(item["name"])
        td["conditions"] = []
        if "hp" in td:
            td["hp"]["current"] = td["hp"].get("max", td["hp"]["current"])
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
        for item in items:
            ch = item.get("charges")
            if ch and str(ch.get("recharge", "")).lower() in SHORT_REST_RECHARGES:
                mx = int(ch.get("max", 0))
                if ch.get("current", 0) < mx:
                    ch["current"] = mx
                    summary["items_recharged"].append(item["name"])
        caster_type = spell_data.get("caster_type", "none")
        if caster_type == "warlock":
            for level, slot in slots.items():
                mx = int(slot.get("max", 0))
                if slot.get("current", 0) < mx:
                    slot["current"] = mx
                    summary["slots_restored"] = True

    return td, summary
