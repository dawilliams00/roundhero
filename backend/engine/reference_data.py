import json
import os

_REFERENCE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "reference.json")

with open(_REFERENCE_PATH, encoding="utf-8") as f:
    _REFERENCE_DATA = json.load(f)

def get_reference_categories():
    return list(_REFERENCE_DATA.keys())

def get_reference(category):
    return _REFERENCE_DATA.get(category)
