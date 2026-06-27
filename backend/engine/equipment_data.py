import json
import os

_EQUIPMENT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "equipment.json")

with open(_EQUIPMENT_PATH, encoding="utf-8") as f:
    _ALL_EQUIPMENT = json.load(f)["equipment"]

def get_all_equipment():
    return _ALL_EQUIPMENT
