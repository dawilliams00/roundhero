from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.custom_content import CustomContent
from engine.content_packs import get_classes, get_races, get_class_features, get_subclasses
from engine.spell_data import get_all_spells, get_spells_for_class
from engine.item_data import get_all_items
from engine.monster_data import get_all_monsters
from engine.condition_data import get_all_conditions
from engine.feat_data import get_all_feats
from engine.equipment_data import get_all_equipment
from engine.background_data import get_all_backgrounds
from engine.race_data import get_all_races as get_all_srd_races, get_all_subraces
from engine.reference_data import get_reference, get_reference_categories

content_bp = Blueprint("content", __name__)

@content_bp.route("/classes", methods=["GET"])
def list_classes():
    return jsonify(get_classes()), 200

@content_bp.route("/classes/<string:class_name>/features", methods=["GET"])
def class_features(class_name):
    return jsonify(get_class_features(class_name)), 200

@content_bp.route("/classes/<string:class_name>/subclasses", methods=["GET"])
def subclasses(class_name):
    return jsonify(get_subclasses(class_name)), 200

@content_bp.route("/races", methods=["GET"])
def list_races():
    return jsonify(get_races()), 200

@content_bp.route("/spells", methods=["GET"])
@jwt_required()
def list_spells():
    class_name = request.args.get("class_name")
    base = get_spells_for_class(class_name) if class_name else get_all_spells()
    # Custom content is shared across everyone, not just the creator - same as a homebrew
    # rulebook anyone at the table can pull from once one person has written the entry.
    customs = [c.to_dict() for c in CustomContent.query.filter_by(content_type="spell").all()]
    if class_name:
        customs = [c for c in customs if not c.get("classes") or class_name in c.get("classes", [])]
    return jsonify(base + customs), 200

@content_bp.route("/spells", methods=["POST"])
@jwt_required()
def create_custom_spell():
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Spell name is required"}), 400
    entry = CustomContent(user_id=user_id, content_type="spell", name=payload["name"].strip())
    entry.data = payload
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201

@content_bp.route("/feats", methods=["GET"])
@jwt_required()
def list_feats():
    base = get_all_feats()
    customs = [c.to_dict() for c in CustomContent.query.filter_by(content_type="feat").all()]
    return jsonify(base + customs), 200

@content_bp.route("/feats", methods=["POST"])
@jwt_required()
def create_custom_feat():
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Feat name is required"}), 400
    entry = CustomContent(user_id=user_id, content_type="feat", name=payload["name"].strip())
    entry.data = payload
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201

@content_bp.route("/feats/<int:custom_id>", methods=["PUT"])
@jwt_required()
def update_custom_feat(custom_id):
    entry = CustomContent.query.filter_by(id=custom_id, content_type="feat").first()
    if not entry:
        return jsonify({"error": "Custom feat not found"}), 404
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Feat name is required"}), 400
    entry.name = payload["name"].strip()
    entry.data = payload
    db.session.commit()
    return jsonify(entry.to_dict()), 200

@content_bp.route("/feats/<int:custom_id>", methods=["DELETE"])
@jwt_required()
def delete_custom_feat(custom_id):
    entry = CustomContent.query.filter_by(id=custom_id, content_type="feat").first()
    if not entry:
        return jsonify({"error": "Custom feat not found"}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200

# Homebrew "rulesets" (currently just homebrew exhaustion-rules name+description, more
# ruleset_types later) - shared the same way feats/spells are, so one player typing out a
# homebrew exhaustion table doesn't mean everyone else at the table has to retype it.
# Upserted by name rather than created fresh each time, since a player iterating on their
# own ruleset's wording across sessions would otherwise spam near-duplicate library entries.
@content_bp.route("/rulesets", methods=["GET"])
@jwt_required()
def list_rulesets():
    ruleset_type = request.args.get("ruleset_type")
    customs = [c.to_dict() for c in CustomContent.query.filter_by(content_type="ruleset").all()]
    if ruleset_type:
        customs = [c for c in customs if c.get("ruleset_type") == ruleset_type]
    return jsonify(customs), 200

@content_bp.route("/rulesets", methods=["PUT"])
@jwt_required()
def upsert_ruleset():
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Ruleset name is required"}), 400
    entry = CustomContent.query.filter_by(content_type="ruleset").filter(
        db.func.lower(CustomContent.name) == name.lower()
    ).first()
    if not entry:
        entry = CustomContent(user_id=user_id, content_type="ruleset", name=name)
        db.session.add(entry)
    entry.name = name
    entry.data = payload
    db.session.commit()
    return jsonify(entry.to_dict()), 200

@content_bp.route("/items", methods=["GET"])
def list_items():
    base = get_all_items()
    # Two distinct homebrew layers, unlike spells/feats/monsters which only have one:
    # "item_override" rows correct a canon entry IN PLACE (matched by name) so the fix
    # reaches everyone and every already-owned copy via the existing per-character Refresh
    # button - the original magic_items.json on disk never changes. "item" rows are fully
    # independent duplicates/new homebrew items, same pattern as monster duplication.
    overrides = {c.name.lower(): c for c in CustomContent.query.filter_by(content_type="item_override").all()}
    merged_base = []
    for item in base:
        ov = overrides.get(item["name"].lower())
        merged_base.append({**ov.data, "_override_id": ov.id, "_source": "canon_override"} if ov else item)
    customs = [c.to_dict() for c in CustomContent.query.filter_by(content_type="item").all()]
    return jsonify(merged_base + customs), 200

@content_bp.route("/items", methods=["POST"])
@jwt_required()
def create_custom_item():
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Item name is required"}), 400
    entry = CustomContent(user_id=user_id, content_type="item", name=payload["name"].strip())
    entry.data = payload
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201

@content_bp.route("/items/<int:custom_id>", methods=["PUT"])
@jwt_required()
def update_custom_item(custom_id):
    entry = CustomContent.query.filter_by(id=custom_id, content_type="item").first()
    if not entry:
        return jsonify({"error": "Custom item not found"}), 404
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Item name is required"}), 400
    entry.name = payload["name"].strip()
    entry.data = payload
    db.session.commit()
    return jsonify(entry.to_dict()), 200

@content_bp.route("/items/<int:custom_id>", methods=["DELETE"])
@jwt_required()
def delete_custom_item(custom_id):
    entry = CustomContent.query.filter_by(id=custom_id, content_type="item").first()
    if not entry:
        return jsonify({"error": "Custom item not found"}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200

@content_bp.route("/items/override", methods=["PUT"])
@jwt_required()
def upsert_item_override():
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    # _canon_name is the ORIGINAL canon item's name, kept separate from payload["name"]
    # (which the admin-edit form may have changed) so the override stays matched to the
    # right canon entry even if its displayed name is edited.
    canon_name = (payload.pop("_canon_name", None) or payload.get("name") or "").strip()
    if not canon_name:
        return jsonify({"error": "Item name is required"}), 400
    entry = CustomContent.query.filter_by(content_type="item_override").filter(
        db.func.lower(CustomContent.name) == canon_name.lower()
    ).first()
    if not entry:
        entry = CustomContent(user_id=user_id, content_type="item_override", name=canon_name)
        db.session.add(entry)
    entry.data = payload
    db.session.commit()
    return jsonify({**entry.data, "_override_id": entry.id, "_source": "canon_override"}), 200

@content_bp.route("/items/override/<string:name>", methods=["DELETE"])
@jwt_required()
def delete_item_override(name):
    entry = CustomContent.query.filter_by(content_type="item_override").filter(
        db.func.lower(CustomContent.name) == name.lower()
    ).first()
    if not entry:
        return jsonify({"error": "Override not found"}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200

@content_bp.route("/monsters", methods=["GET"])
def list_monsters():
    base = get_all_monsters()
    # Same shared-homebrew pattern as spells/feats - a duplicated-and-renamed monster
    # (see Bestiary's "Duplicate" button) is visible to everyone, not just its creator.
    customs = [c.to_dict() for c in CustomContent.query.filter_by(content_type="monster").all()]
    return jsonify(base + customs), 200

@content_bp.route("/monsters", methods=["POST"])
@jwt_required()
def create_custom_monster():
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Monster name is required"}), 400
    entry = CustomContent(user_id=user_id, content_type="monster", name=payload["name"].strip())
    entry.data = payload
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201

@content_bp.route("/monsters/<int:custom_id>", methods=["PUT"])
@jwt_required()
def update_custom_monster(custom_id):
    entry = CustomContent.query.filter_by(id=custom_id, content_type="monster").first()
    if not entry:
        return jsonify({"error": "Custom monster not found"}), 404
    payload = request.get_json() or {}
    if not (payload.get("name") or "").strip():
        return jsonify({"error": "Monster name is required"}), 400
    entry.name = payload["name"].strip()
    entry.data = payload
    db.session.commit()
    return jsonify(entry.to_dict()), 200

@content_bp.route("/monsters/<int:custom_id>", methods=["DELETE"])
@jwt_required()
def delete_custom_monster(custom_id):
    entry = CustomContent.query.filter_by(id=custom_id, content_type="monster").first()
    if not entry:
        return jsonify({"error": "Custom monster not found"}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200

@content_bp.route("/conditions", methods=["GET"])
def list_conditions():
    return jsonify(get_all_conditions()), 200

@content_bp.route("/equipment", methods=["GET"])
def list_equipment():
    return jsonify(get_all_equipment()), 200

@content_bp.route("/backgrounds", methods=["GET"])
def list_backgrounds():
    return jsonify(get_all_backgrounds()), 200

@content_bp.route("/srd-races", methods=["GET"])
def list_srd_races():
    return jsonify({"races": get_all_srd_races(), "subraces": get_all_subraces()}), 200

@content_bp.route("/reference", methods=["GET"])
def list_reference_categories():
    return jsonify(get_reference_categories()), 200

@content_bp.route("/reference/<string:category>", methods=["GET"])
def reference_category(category):
    data = get_reference(category)
    if data is None:
        return jsonify({"error": "Unknown reference category"}), 404
    return jsonify(data), 200
