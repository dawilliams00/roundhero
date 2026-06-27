from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.custom_content import CustomContent
from engine.content_packs import get_classes, get_races, get_class_features, get_subclasses
from engine.spell_data import get_all_spells, get_spells_for_class
from engine.item_data import get_all_items

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
    feats = [c.to_dict() for c in CustomContent.query.filter_by(content_type="feat").all()]
    return jsonify(feats), 200

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

@content_bp.route("/items", methods=["GET"])
def list_items():
    return jsonify(get_all_items()), 200
