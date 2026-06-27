import json
import os

_FEATS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "feats.json")

with open(_FEATS_PATH, encoding="utf-8") as f:
    _ALL_FEATS = json.load(f)["feats"]

def get_all_feats():
    return _ALL_FEATS
