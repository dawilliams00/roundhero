import json
import os

_SPELLS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "spells.json")

with open(_SPELLS_PATH, encoding="utf-8") as f:
    _ALL_SPELLS = json.load(f)["spells"]

def get_all_spells():
    return _ALL_SPELLS

def get_spells_for_class(class_name):
    return [s for s in _ALL_SPELLS if class_name in s.get("classes", [])]
