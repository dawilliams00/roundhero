import json
import os

_CLASS_FEATURES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "class_features.json")

with open(_CLASS_FEATURES_PATH, encoding="utf-8") as f:
    _DATA = json.load(f)
    _ALL_CLASS_FEATURES = _DATA["class_features"]
    _ALL_CLASS_BASE_INFO = _DATA["classes"]

def get_all_class_features():
    return _ALL_CLASS_FEATURES

def get_all_class_base_info():
    return _ALL_CLASS_BASE_INFO
