from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.character import Character
from engine.character_engine import build_character, level_up_character
from engine.content_packs import CLASSES
from engine.pdf_import import parse_character_pdf, resync_character
from engine.spell_data import get_all_spells

characters_bp = Blueprint("characters", __name__)

_SPELL_DB_BY_NAME = {s["name"].lower(): s for s in get_all_spells()}

@characters_bp.route("/", methods=["GET"])
@jwt_required()
def list_characters():
    user_id = int(get_jwt_identity())
    chars = Character.query.filter_by(user_id=user_id).all()
    return jsonify([{"id": c.id, "name": c.name, "class_name": c.class_name, "race": c.race, "level": c.level} for c in chars]), 200

@characters_bp.route("/", methods=["POST"])
@jwt_required()
def create_character():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    built = build_character(data)
    char = Character(
        user_id=user_id,
        name=data["name"],
        class_name=data["class_name"],
        subclass=data.get("subclass"),
        race=data["race"],
        level=data.get("level", 1),
    )
    char.ability_scores = data.get("ability_scores", {})
    char.tracker_data   = built["tracker_data"]
    char.spell_data     = built["spell_data"]
    char.ae_data        = built["ae_data"]
    char.notes          = {}
    db.session.add(char)
    db.session.commit()
    return jsonify(char.to_dict()), 201

@characters_bp.route("/import", methods=["POST"])
@jwt_required()
def import_character():
    user_id = int(get_jwt_identity())
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400
    file_bytes = file.read()
    try:
        parsed = parse_character_pdf(file_bytes, spell_db_by_name=_SPELL_DB_BY_NAME)
    except Exception:
        return jsonify({"error": "Could not parse this PDF. Make sure it's a D&D Beyond character sheet export."}), 400

    char = Character(
        user_id=user_id,
        name=parsed["name"],
        class_name=parsed["class_name"],
        subclass=parsed["subclass"],
        race=parsed["race"],
        level=parsed["level"],
    )
    char.ability_scores = parsed["ability_scores"]
    char.tracker_data   = parsed["tracker_data"]
    char.spell_data     = parsed["spell_data"]
    char.ae_data        = parsed["ae_data"]
    char.notes          = parsed["notes"]
    char.source_pdf     = file_bytes
    db.session.add(char)
    db.session.commit()
    return jsonify(char.to_dict()), 201

@characters_bp.route("/<int:char_id>/resync", methods=["POST"])
@jwt_required()
def resync_character_route(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    if not char.source_pdf:
        return jsonify({"error": "This character wasn't created from a PDF import, so there's nothing to re-sync from."}), 400
    try:
        merged_td, merged_sd, merged_ae = resync_character(
            char.tracker_data, char.spell_data, char.source_pdf, char.class_name,
            spell_db_by_name=_SPELL_DB_BY_NAME,
        )
    except Exception:
        return jsonify({"error": "Could not re-sync from the stored PDF."}), 400
    char.tracker_data = merged_td
    char.spell_data   = merged_sd
    char.ae_data      = merged_ae
    db.session.commit()
    return jsonify(char.to_dict()), 200

@characters_bp.route("/<int:char_id>/level_up", methods=["POST"])
@jwt_required()
def level_up_character_route(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    if char.class_name not in CLASSES:
        return jsonify({"error": f"\"{char.class_name}\" isn't a single recognized class, so automatic level-up isn't available for this character (this usually means it was PDF-imported, possibly multiclass). Edit the level and add any new features/spell slots yourself."}), 400
    if char.level >= 20:
        return jsonify({"error": "Already at level 20."}), 400
    new_level = char.level + 1
    merged_td, merged_sd, merged_ae, hp_gained = level_up_character(
        char.tracker_data, char.spell_data, char.ae_data, char.class_name, new_level, char.ability_scores,
    )
    char.level = new_level
    char.tracker_data = merged_td
    char.spell_data = merged_sd
    char.ae_data = merged_ae
    db.session.commit()
    return jsonify({**char.to_dict(), "level_up_summary": {"new_level": new_level, "hp_gained": hp_gained}}), 200

@characters_bp.route("/<int:char_id>", methods=["GET"])
@jwt_required()
def get_character(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    return jsonify(char.to_dict()), 200

@characters_bp.route("/<int:char_id>", methods=["PUT"])
@jwt_required()
def update_character(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    data = request.get_json()
    for field in ["name", "class_name", "subclass", "race", "level"]:
        if field in data:
            setattr(char, field, data[field])
    if "ability_scores" in data: char.ability_scores = data["ability_scores"]
    if "tracker_data"   in data: char.tracker_data   = data["tracker_data"]
    if "spell_data"     in data: char.spell_data      = data["spell_data"]
    if "ae_data"        in data: char.ae_data         = data["ae_data"]
    if "notes"          in data: char.notes           = data["notes"]
    db.session.commit()
    return jsonify(char.to_dict()), 200

@characters_bp.route("/<int:char_id>", methods=["DELETE"])
@jwt_required()
def delete_character(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    db.session.delete(char)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200

@characters_bp.route("/<int:char_id>/rest", methods=["POST"])
@jwt_required()
def do_rest(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    data = request.get_json()
    rest_type = data.get("type", "long")
    from engine.rest_engine import apply_rest
    new_td, summary = apply_rest(char.tracker_data, char.spell_data, rest_type)
    char.tracker_data = new_td
    db.session.commit()
    return jsonify({"tracker_data": char.tracker_data, "spell_data": char.spell_data, "summary": summary}), 200
