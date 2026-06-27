import json
import os

_BACKGROUNDS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "backgrounds.json")

with open(_BACKGROUNDS_PATH, encoding="utf-8") as f:
    _ALL_BACKGROUNDS = json.load(f)["backgrounds"]

def get_all_backgrounds():
    return _ALL_BACKGROUNDS
