from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from character_modules import available_modules_for, get_module_payload
from models.character import Character
from models.user import User


character_modules_bp = Blueprint("character_modules", __name__)


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
