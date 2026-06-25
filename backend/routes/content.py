from flask import Blueprint, jsonify, request
from engine.content_packs import get_classes, get_races, get_class_features, get_subclasses
from engine.spell_data import get_all_spells, get_spells_for_class

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
def list_spells():
    class_name = request.args.get("class_name")
    if class_name:
        return jsonify(get_spells_for_class(class_name)), 200
    return jsonify(get_all_spells()), 200
