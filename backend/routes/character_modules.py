from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from character_modules import available_modules_for, get_module_payload
from character_modules.syric import sync_codex_pages, sync_shadow_level, syric_action, syric_reference_docs
from database import db
from models.character import Character
from models.user import User


character_modules_bp = Blueprint("character_modules", __name__)


@character_modules_bp.route("/syric_arcane/references", methods=["GET"])
@jwt_required()
def get_syric_references():
    return jsonify(syric_reference_docs()), 200


def _owned_character(char_id, user_id):
    return Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()


@character_modules_bp.route("/<int:char_id>", methods=["GET"])
@jwt_required()
def list_character_modules(char_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    character = _owned_character(char_id, user_id)
    return jsonify(available_modules_for(user, character)), 200


@character_modules_bp.route("/<int:char_id>/<string:module_id>", methods=["GET"])
@jwt_required()
def get_character_module(char_id, module_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    character = _owned_character(char_id, user_id)
    payload = get_module_payload(module_id, user, character)
    if not payload:
        return jsonify({"error": "Module not available for this character"}), 404
    return jsonify(payload), 200


def _require_syric_module(user, character):
    payload = get_module_payload("syric_arcane", user, character)
    if not payload:
        return None
    return payload


@character_modules_bp.route("/<int:char_id>/syric_arcane/codex-pages", methods=["POST"])
@jwt_required()
def sync_syric_codex_pages(char_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    character = _owned_character(char_id, user_id)
    if not _require_syric_module(user, character):
        return jsonify({"error": "Syric module not available for this character"}), 404
    data = request.get_json() or {}
    changed = sync_codex_pages(character, data.get("pages") or [])
    db.session.commit()
    return jsonify({
        "changed": changed,
        "tracker_data": character.tracker_data,
        "module": get_module_payload("syric_arcane", user, character),
    }), 200


@character_modules_bp.route("/<int:char_id>/syric_arcane/shadow-level", methods=["POST"])
@jwt_required()
def sync_syric_shadow_level(char_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    character = _owned_character(char_id, user_id)
    if not _require_syric_module(user, character):
        return jsonify({"error": "Syric module not available for this character"}), 404
    data = request.get_json() or {}
    changed = sync_shadow_level(character, data.get("level") or character.level)
    db.session.commit()
    return jsonify({
        "changed": changed,
        "tracker_data": character.tracker_data,
        "module": get_module_payload("syric_arcane", user, character),
    }), 200


@character_modules_bp.route("/<int:char_id>/syric_arcane/action", methods=["POST"])
@jwt_required()
def run_syric_action(char_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    character = _owned_character(char_id, user_id)
    if not _require_syric_module(user, character):
        return jsonify({"error": "Syric module not available for this character"}), 404
    data = request.get_json() or {}
    try:
        result = syric_action(character, data.get("action"), data.get("payload") or {})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    db.session.commit()
    return jsonify({
        "result": result,
        "tracker_data": character.tracker_data,
        "module": get_module_payload("syric_arcane", user, character),
    }), 200
