import json
import os
import re

_SPELLS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "spells.json")

with open(_SPELLS_PATH, encoding="utf-8") as f:
    _ALL_SPELLS = json.load(f)["spells"]

def get_all_spells():
    return _ALL_SPELLS

# class_name is often a decorated/multiclass string ("Wizard 13", "Paladin 6 / Sorcerer
# 6") for PDF-imported characters, not a clean key matching a spell's "classes" list -
# mirrors parseClassLevels() in utils/dnd.js. Splitting on "/" and peeling off the
# trailing level lets a multiclass character see spells from EVERY one of their classes
# here (browsing is strictly better served by the union, unlike the single-class-only
# tuck&release/spell-list-filter use case elsewhere), and falls back to the raw string
# untouched so a clean manually-created class_name like "Wizard" still matches as before.
def _parse_class_names(class_name_raw):
    if not class_name_raw:
        return []
    names = []
    for part in str(class_name_raw).split("/"):
        m = re.match(r"^(.+?)\s+\d+\s*$", part.strip())
        names.append(m.group(1).strip() if m else part.strip())
    return [n for n in names if n]

def get_spells_for_class(class_name):
    names = _parse_class_names(class_name)
    return [s for s in _ALL_SPELLS if any(n in s.get("classes", []) for n in names)]
