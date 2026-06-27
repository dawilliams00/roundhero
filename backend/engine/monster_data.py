import json
import os

_MONSTERS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "monsters.json")

with open(_MONSTERS_PATH, encoding="utf-8") as f:
    _ALL_MONSTERS = json.load(f)["monsters"]

_MONSTERS_BY_NAME = {m["name"].lower(): m for m in _ALL_MONSTERS}

def get_all_monsters():
    return _ALL_MONSTERS

def get_monster_by_name(name):
    return _MONSTERS_BY_NAME.get((name or "").lower())
