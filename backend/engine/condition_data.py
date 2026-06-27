import json
import os

_CONDITIONS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "conditions.json")

with open(_CONDITIONS_PATH, encoding="utf-8") as f:
    _ALL_CONDITIONS = json.load(f)["conditions"]

def get_all_conditions():
    return _ALL_CONDITIONS
