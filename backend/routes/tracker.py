from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.character import Character

tracker_bp = Blueprint("tracker", __name__)

@tracker_bp.route("/<int:char_id>", methods=["GET"])
@jwt_required()
def get_tracker(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    return jsonify(char.tracker_data), 200

@tracker_bp.route("/<int:char_id>", methods=["PUT"])
@jwt_required()
def update_tracker(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    char.tracker_data = request.get_json()
    db.session.commit()
    return jsonify(char.tracker_data), 200

@tracker_bp.route("/<int:char_id>/feature/<string:feature_name>/use", methods=["POST"])
@jwt_required()
def use_feature(char_id, feature_name):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    td = char.tracker_data
    features = td.get("features", {})
    if feature_name not in features:
        return jsonify({"error": "Feature not found"}), 404
    feat = features[feature_name]
    cur = int(feat.get("current", 0))
    if cur <= 0:
        return jsonify({"error": "No uses remaining"}), 400
    feat["current"] = cur - 1
    char.tracker_data = td
    db.session.commit()
    return jsonify({"feature": feature_name, "current": feat["current"], "max": feat.get("max", 0)}), 200

@tracker_bp.route("/<int:char_id>/slot/<int:level>/use", methods=["POST"])
@jwt_required()
def use_slot(char_id, level):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    td = char.tracker_data
    slots = td.get("spell_slots", {})
    slot = slots.get(str(level))
    if not slot:
        return jsonify({"error": "Slot level not found"}), 404
    cur = int(slot.get("current", 0))
    if cur <= 0:
        return jsonify({"error": "No slots remaining"}), 400
    slot["current"] = cur - 1
    char.tracker_data = td
    db.session.commit()
    return jsonify({"level": level, "current": slot["current"], "max": slot.get("max", 0)}), 200
