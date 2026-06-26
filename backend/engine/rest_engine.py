import copy

def apply_rest(tracker_data, spell_data, rest_type="long"):
    td = copy.deepcopy(tracker_data)
    features = td.get("features", {})
    slots    = td.get("spell_slots", {})

    if rest_type == "long":
        for name, feat in features.items():
            mx = int(feat.get("max", 0))
            if mx > 0:
                feat["current"] = mx
        for level, slot in slots.items():
            mx = int(slot.get("max", 0))
            slot["current"] = mx
        td["conditions"] = []
        if "hp" in td:
            td["hp"]["current"] = td["hp"].get("max", td["hp"]["current"])

    elif rest_type == "short":
        for name, feat in features.items():
            if feat.get("rest_type") == "short":
                mx = int(feat.get("max", 0))
                if mx > 0:
                    feat["current"] = mx
        # Warlock slots restore on short rest
        caster_type = spell_data.get("caster_type", "none")
        if caster_type == "warlock":
            for level, slot in slots.items():
                mx = int(slot.get("max", 0))
                slot["current"] = mx

    return td
