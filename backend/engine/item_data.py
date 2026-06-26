import json
import os

_ITEMS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "magic_items.json")

with open(_ITEMS_PATH, encoding="utf-8") as f:
    _ALL_ITEMS = json.load(f)["items"]

_ITEMS_BY_NAME = {it["name"].lower(): it for it in _ALL_ITEMS}

def get_all_items():
    return _ALL_ITEMS

def get_item_by_name(name):
    return _ITEMS_BY_NAME.get((name or "").lower())
