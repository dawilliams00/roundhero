from flask import Blueprint, jsonify
from engine.content_packs import get_classes, get_races, get_class_features, get_subclasses

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
