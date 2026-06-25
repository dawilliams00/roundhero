from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.character import Character

spells_bp = Blueprint("spells", __name__)

@spells_bp.route("/<int:char_id>", methods=["GET"])
@jwt_required()
def get_spells(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    return jsonify(char.spell_data), 200

@spells_bp.route("/<int:char_id>", methods=["PUT"])
@jwt_required()
def update_spells(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    char.spell_data = request.get_json()
    db.session.commit()
    return jsonify(char.spell_data), 200
