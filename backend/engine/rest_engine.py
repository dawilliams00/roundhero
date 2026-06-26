import copy
import random
import re

LONG_REST_RECHARGES = {"dawn", "dusk", "long_rest"}
SHORT_REST_RECHARGES = {"short_rest"}

def roll_dice(formula):
    m = re.match(r"^\s*(\d+)\s*d\s*(\d+)\s*(?:\+\s*(\d+))?\s*$", formula or "", re.I)
    if not m:
        return None
    count, sides, bonus = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
    return sum(random.randint(1, sides) for _ in range(count)) + bonus

def _recharge_item(ch, recharge_set, summary, item_name):
    if not ch or str(ch.get("recharge", "")).lower() not in recharge_set:
        return
    mx = int(ch.get("max", 0))
    cur = ch.get("current", 0)
    if cur >= mx:
        return
    formula = ch.get("recharge_amount")
    if formula:
        rolled = roll_dice(formula)
        if rolled is None:
            return
        ch["current"] = min(mx, cur + rolled)
        if ch["current"] > cur:
            summary["items_recharged"].append(f"{item_name} (+{ch['current']-cur})")
    else:
        ch["current"] = mx
        summary["items_recharged"].append(item_name)

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
            _recharge_item(item.get("charges"), LONG_REST_RECHARGES, summary, item["name"])
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
        for item in items:
            _recharge_item(item.get("charges"), SHORT_REST_RECHARGES, summary, item["name"])
        caster_type = spell_data.get("caster_type", "none")
        if caster_type == "warlock":
            for level, slot in slots.items():
                mx = int(slot.get("max", 0))
                if slot.get("current", 0) < mx:
                    slot["current"] = mx
                    summary["slots_restored"] = True

    return td, summary
