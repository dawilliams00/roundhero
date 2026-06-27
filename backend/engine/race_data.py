import json
import os

_RACES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "races.json")

with open(_RACES_PATH, encoding="utf-8") as f:
    _RACES_DATA = json.load(f)

def get_all_races():
    return _RACES_DATA["races"]

def get_all_subraces():
    return _RACES_DATA["subraces"]
