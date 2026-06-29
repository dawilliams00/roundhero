from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.character import Character
from engine.character_engine import build_character, level_up_character
from engine.content_packs import CLASSES
from engine.pdf_import import parse_character_pdf, resync_character
from engine.spell_data import get_all_spells
from engine.multiclass_engine import infer_classes, level_up_one_class, apply_subclass_choice, apply_ability_score_improvement

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

@characters_bp.route("/<int:char_id>/class_status", methods=["GET"])
@jwt_required()
def class_status_route(char_id):
    """Read-only check used to proactively prompt a player to confirm class(es) (e.g. a
    banner shown on first opening a PDF-imported character) without the side effect of
    actually attempting a level-up the way POST /level_up's own needs_class_confirmation
    response does."""
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    if char.tracker_data.get("classes") or char.class_name in CLASSES:
        return jsonify({"needs_confirmation": False}), 200
    return jsonify({"needs_confirmation": True, "inferred_classes": infer_classes(char.class_name, char.level)}), 200

def _snapshot_for_rollback(char):
    """Captures everything a level-up (and any subclass/ASI choices made right after it)
    touches, so POST /rollback_level_up can put the character back exactly as it was
    before the player clicked Level Up - players like to preview a level-up and back out
    if they don't like what they see. Single-step undo only (this overwrites whatever
    snapshot was already there), and the snapshot is stripped of any snapshot-of-its-own
    so it can't nest/grow across repeated level-ups."""
    td = dict(char.tracker_data)
    td.pop("_level_up_snapshot", None)
    return {
        "tracker_data": td, "spell_data": char.spell_data, "ae_data": char.ae_data,
        "level": char.level, "class_name": char.class_name, "subclass": char.subclass,
        "ability_scores": char.ability_scores,
    }

@characters_bp.route("/<int:char_id>/level_up", methods=["POST"])
@jwt_required()
def level_up_character_route(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    data = request.get_json(silent=True) or {}
    leveling_class = data.get("leveling_class")
    td = char.tracker_data
    stored_classes = td.get("classes")
    snapshot = _snapshot_for_rollback(char)

    # Original single-class manual-creation path, byte-for-byte unchanged except for the
    # added rollback snapshot, so an existing manually-created character that's never
    # touched the newer multiclass confirmation flow below keeps working exactly as it
    # always has.
    if not stored_classes and char.class_name in CLASSES:
        if char.level >= 20:
            return jsonify({"error": "Already at level 20."}), 400
        new_level = char.level + 1
        merged_td, merged_sd, merged_ae, hp_gained = level_up_character(
            char.tracker_data, char.spell_data, char.ae_data, char.class_name, new_level, char.ability_scores,
        )
        merged_td["_level_up_snapshot"] = snapshot
        char.level = new_level
        char.tracker_data = merged_td
        char.spell_data = merged_sd
        char.ae_data = merged_ae
        db.session.commit()
        return jsonify({**char.to_dict(), "level_up_summary": {"new_level": new_level, "hp_gained": hp_gained}}), 200

    # Multiclass (or single-class-but-decorated, e.g. PDF-imported "Wizard 13") path -
    # needs tracker_data.classes confirmed once before anything here can be computed.
    if not stored_classes:
        inferred = infer_classes(char.class_name, char.level)
        return jsonify({
            "error": "needs_class_confirmation",
            "message": "Confirm your class(es) below before leveling up - this is a one-time step." if inferred else
                       f"Couldn't confidently recognize \"{char.class_name}\" as one or more known classes. Confirm your class(es) below to enable level-up.",
            "inferred_classes": inferred,
        }), 400

    if len(stored_classes) > 1 and not leveling_class:
        return jsonify({
            "error": "needs_leveling_class_choice",
            "message": "Multiclass character - choose which class is gaining this level.",
            "classes": stored_classes,
        }), 400

    leveling_class = leveling_class or stored_classes[0]["class_name"]
    if leveling_class not in [c["class_name"] for c in stored_classes]:
        return jsonify({"error": f"\"{leveling_class}\" isn't one of this character's current classes."}), 400
    if sum(c["level"] for c in stored_classes) >= 20:
        return jsonify({"error": "Already at level 20."}), 400

    merged_td, merged_sd, merged_ae, info = level_up_one_class(
        char.tracker_data, char.spell_data, char.ae_data, stored_classes, leveling_class, char.ability_scores,
    )
    merged_td["_level_up_snapshot"] = snapshot
    char.level = info["new_total_level"]
    char.class_name = info["new_class_name"]
    char.tracker_data = merged_td
    char.spell_data = merged_sd
    char.ae_data = merged_ae
    db.session.commit()
    return jsonify({**char.to_dict(), "level_up_summary": info}), 200

@characters_bp.route("/<int:char_id>/rollback_level_up", methods=["POST"])
@jwt_required()
def rollback_level_up_route(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    snapshot = char.tracker_data.get("_level_up_snapshot")
    if not snapshot:
        return jsonify({"error": "Nothing to roll back - no recent level-up found."}), 400
    char.tracker_data = snapshot["tracker_data"]
    char.spell_data = snapshot["spell_data"]
    char.ae_data = snapshot["ae_data"]
    char.level = snapshot["level"]
    char.class_name = snapshot["class_name"]
    char.subclass = snapshot["subclass"]
    char.ability_scores = snapshot["ability_scores"]
    db.session.commit()
    return jsonify(char.to_dict()), 200

@characters_bp.route("/<int:char_id>/classes/subclass", methods=["POST"])
@jwt_required()
def set_subclass_route(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    class_name = data.get("class_name")
    subclass_name = data.get("subclass_name")
    if not class_name or not subclass_name:
        return jsonify({"error": "class_name and subclass_name are required."}), 400
    char.tracker_data, char.ae_data = apply_subclass_choice(char.tracker_data, char.ae_data, class_name, subclass_name)
    # Keeps the display `subclass` column in sync for a single-class character - matches
    # what CharacterEditorModal's Subclass dropdown already writes there directly. A true
    # multiclass character has no single "the" subclass to put in that column, so it's
    # left alone (tracker_data.classes[i].subclass is the source of truth for those).
    if len(char.tracker_data.get("classes", [])) == 1:
        char.subclass = subclass_name
    db.session.commit()
    return jsonify(char.to_dict()), 200

@characters_bp.route("/<int:char_id>/asi", methods=["POST"])
@jwt_required()
def apply_asi_route(char_id):
    user_id = int(get_jwt_identity())
    char = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    increases = data.get("increases") or {}
    if not increases or sum(increases.values()) > 2 or any(v <= 0 for v in increases.values()):
        return jsonify({"error": "Increases must total at most 2 points across one or two abilities."}), 400
    char.ability_scores = apply_ability_score_improvement(char.ability_scores, increases)
    db.session.commit()
    return jsonify(char.to_dict()), 200

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

@characters_bp.route("/<int:char_id>/duplicate", methods=["POST"])
@jwt_required()
def duplicate_character(char_id):
    """Clones a character wholesale so a player can freely experiment with leveling/build
    choices on the copy without any risk to the original - source_pdf is copied too, so
    Re-sync still works on the duplicate. The copy is otherwise fully independent from
    the moment it's created (no link back to the original, same as a fresh import)."""
    user_id = int(get_jwt_identity())
    original = Character.query.filter_by(id=char_id, user_id=user_id).first_or_404()
    copy = Character(
        user_id=user_id,
        name=f"{original.name} (Copy)",
        class_name=original.class_name,
        subclass=original.subclass,
        race=original.race,
        level=original.level,
    )
    copy.ability_scores = original.ability_scores
    copy.tracker_data = original.tracker_data
    copy.spell_data = original.spell_data
    copy.ae_data = original.ae_data
    copy.notes = original.notes
    copy.source_pdf = original.source_pdf
    db.session.add(copy)
    db.session.commit()
    return jsonify(copy.to_dict()), 201

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
