from random import randint
from secrets import token_urlsafe
import os
import smtplib
from email.mime.text import MIMEText

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from database import db
from models.campaign import Campaign, CampaignCharacter, CampaignEffect, CampaignEncounter, CampaignMember
from models.character import Character
from models.user import User


campaigns_bp = Blueprint("campaigns", __name__)


def _invite_code():
    return token_urlsafe(6).replace("-", "").replace("_", "").upper()[:8]


def _make_unique_invite_code():
    for _ in range(10):
        code = _invite_code()
        if not Campaign.query.filter_by(invite_code=code).first():
            return code
    raise RuntimeError("Could not generate invite code")


def _membership(campaign_id, user_id):
    return CampaignMember.query.filter_by(campaign_id=campaign_id, user_id=user_id).first()


def _campaign_for_user(campaign_id, user_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    member = _membership(campaign.id, user_id)
    if not member:
        return None, None
    return campaign, member


def _is_dm(campaign, member):
    return campaign.owner_user_id == member.user_id or member.role == "dm"


def _campaign_response(campaign, member, include_detail=True):
    return {
        **campaign.to_dict(include_detail=include_detail),
        "role": member.role,
        "is_dm": _is_dm(campaign, member),
        "is_owner": campaign.owner_user_id == member.user_id,
    }


def _send_smtp_email(to_addr, subject, body):
    smtp_user = os.environ.get("FEEDBACK_SMTP_USER")
    smtp_password = os.environ.get("FEEDBACK_SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        raise RuntimeError("Campaign invite email is not configured on the server.")

    msg = MIMEText(body, "plain")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_addr

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_addr, msg.as_string())


def _character_in_campaign(campaign_id, character_id):
    return CampaignCharacter.query.filter_by(
        campaign_id=campaign_id,
        character_id=character_id,
        active=True,
    ).first()


def _public_combatant(row):
    row_type = row.get("type") or "enemy"
    public = {
        "id": row.get("id"),
        "type": row_type,
        "name": row.get("name") or "Combatant",
        "initiative": row.get("initiative") or "",
        "conditions": row.get("conditions") if isinstance(row.get("conditions"), list) else [],
        "concentration": row.get("concentration") or "",
        "effects": row.get("effects") if isinstance(row.get("effects"), list) else [],
        "notes": row.get("public_notes") or "",
    }
    if row_type == "player":
        public["hp_current"] = row.get("hp_current")
        public["hp_max"] = row.get("hp_max")
        public["temp_hp"] = row.get("temp_hp") or 0
    return public


def _death_save_result(roll):
    if roll == 1:
        return "critical_failure", 0, 2, "Natural 1: mark two death save failures."
    if roll == 20:
        return "critical_success", 1, 0, "Natural 20: RAW reminder, regain 1 HP."
    if roll >= 10:
        return "success", 1, 0, "10 or higher: mark one success."
    return "failure", 0, 1, "Below 10: mark one failure."


def _patch_death_saves(current, success_delta, failure_delta):
    current = current if isinstance(current, dict) else {}
    successes = max(0, min(3, int(current.get("successes") or 0) + success_delta))
    failures = max(0, min(3, int(current.get("failures") or 0) + failure_delta))
    return {"successes": successes, "failures": failures}


def _death_save_record(character, roll, result, note, blind, death_saves):
    return {
        "character_id": character.id,
        "character_name": character.name,
        "roll": roll,
        "result": result,
        "note": note,
        "blind": bool(blind),
        "successes": death_saves.get("successes", 0),
        "failures": death_saves.get("failures", 0),
    }


def _clean_campaign_rules(value):
    value = value if isinstance(value, dict) else {}
    return {
        "death_saves": str(value.get("death_saves") or "").strip(),
        "exhaustion": str(value.get("exhaustion") or "").strip(),
    }


def _player_encounter_view(encounter):
    data = encounter.data or {}
    combatants = data.get("combatants") if isinstance(data.get("combatants"), list) else []
    return {
        "id": encounter.id,
        "name": encounter.name,
        "status": encounter.status,
        "updated_at": encounter.updated_at.isoformat(),
        "campaign_rules": _clean_campaign_rules(encounter.campaign.rules if encounter.campaign else {}),
        "combatants": [_public_combatant(row) for row in combatants],
    }


def _effect_payload_target_ids(effect):
    payload = effect.payload or {}
    raw_ids = payload.get("target_character_ids") or []
    if not isinstance(raw_ids, list):
        return set()
    target_ids = set()
    for raw_id in raw_ids:
        try:
            target_ids.add(int(raw_id))
        except (TypeError, ValueError):
            continue
    return target_ids


def _effect_visible_to_character(effect, character_id, campaign, member):
    return (
        effect.target_character_id == character_id
        or character_id in _effect_payload_target_ids(effect)
        or effect.source_character_id == character_id
        or _is_dm(campaign, member)
    )


def _modifier_int(modifier):
    try:
        return int(modifier.get("value") or 0)
    except (TypeError, ValueError):
        return 0


def _max_hp_bonus_from_modifiers(modifiers):
    bonuses = [
        _modifier_int(modifier)
        for modifier in modifiers
        if isinstance(modifier, dict) and modifier.get("type") == "max_hp_bonus"
    ]
    return max(bonuses) if bonuses else 0


def _campaign_effect_max_hp_bonus(effect_record):
    if not isinstance(effect_record, dict):
        return 0
    modifiers = effect_record.get("modifiers") if isinstance(effect_record.get("modifiers"), list) else []
    return _max_hp_bonus_from_modifiers(modifiers)


def _campaign_effect_record(effect, modifiers):
    return {
        "id": effect.id,
        "name": effect.name,
        "modifiers": modifiers,
    }


def _effect_tag(effect):
    payload = effect.payload or {}
    return {
        "id": f"campaign_effect_{effect.id}",
        "name": effect.name,
        "type": effect.effect_type or "campaign_effect",
        "duration": payload.get("duration") or "",
        "modifiers": payload.get("modifiers") if isinstance(payload.get("modifiers"), list) else [],
        "source_name": effect.source_character.name if effect.source_character else "DM / Environment",
    }


def _apply_campaign_effect_to_tracker(tracker_data, effect):
    td = dict(tracker_data or {})
    applied = td.get("campaign_effects") if isinstance(td.get("campaign_effects"), list) else []
    if any(str(row.get("id")) == str(effect.id) for row in applied if isinstance(row, dict)):
        return td

    payload = effect.payload or {}
    modifiers = payload.get("modifiers") if isinstance(payload.get("modifiers"), list) else []
    hp = dict(td.get("hp") or {})
    traits = dict(td.get("traits") or {})
    for key in ["resistances", "immunities", "vulnerabilities", "advantages", "disadvantages"]:
        traits[key] = list(traits.get(key) or [])
    active_effects = list(td.get("active_effects") or [])
    conditions = list(td.get("conditions") or [])

    max_bonus = _max_hp_bonus_from_modifiers(modifiers)
    for modifier in modifiers:
        if not isinstance(modifier, dict):
            continue
        mod_type = modifier.get("type")
        detail = (modifier.get("detail") or modifier.get("label") or effect.name or "").strip()
        value = modifier.get("value")
        trait_item = {
            "name": detail or modifier.get("label") or effect.name,
            "description": f"{effect.name} ({payload.get('duration') or 'campaign effect'})",
            "campaign_effect_id": effect.id,
        }
        if mod_type == "temp_hp":
            hp["temp"] = max(int(hp.get("temp") or 0), _modifier_int(modifier))
        elif mod_type == "condition" and detail and detail not in conditions:
            conditions.append(detail)
        elif mod_type == "immunity" and detail:
            traits["immunities"].append(trait_item)
        elif mod_type == "resistance" and detail:
            traits["resistances"].append(trait_item)
        elif mod_type == "vulnerability" and detail:
            traits["vulnerabilities"].append(trait_item)
        elif mod_type == "advantage" and detail:
            traits["advantages"].append(trait_item)
        elif mod_type == "disadvantage" and detail:
            traits["disadvantages"].append(trait_item)
        elif mod_type in {"bonus_dice", "penalty_dice", "note"}:
            note = modifier.get("label") or detail or effect.name
            if note and note not in active_effects:
                active_effects.append(note)

    if effect.name not in active_effects:
        active_effects.append(effect.name)
    if max_bonus:
        base_max = int(hp.get("campaign_base_max") or hp.get("max") or hp.get("current") or 0)
        existing_bonus = sum(_campaign_effect_max_hp_bonus(row) for row in applied)
        current_max = int(hp.get("max_override") or hp.get("max") or base_max or 0)
        new_max = base_max + existing_bonus + max_bonus
        hp["campaign_base_max"] = base_max
        hp["max_override"] = new_max
        hp["current"] = int(hp.get("current") or 0) + max(0, new_max - current_max)

    td["hp"] = hp
    td["traits"] = traits
    td["active_effects"] = active_effects
    td["conditions"] = conditions
    td["campaign_effects"] = applied + [_campaign_effect_record(effect, modifiers)]
    return td


def _remove_campaign_effect_from_tracker(tracker_data, effect):
    td = dict(tracker_data or {})
    applied = td.get("campaign_effects") if isinstance(td.get("campaign_effects"), list) else []
    if not any(str(row.get("id")) == str(effect.id) for row in applied if isinstance(row, dict)):
        return td

    payload = effect.payload or {}
    modifiers = payload.get("modifiers") if isinstance(payload.get("modifiers"), list) else []
    hp = dict(td.get("hp") or {})
    traits = dict(td.get("traits") or {})
    active_effects = [name for name in (td.get("active_effects") or []) if name != effect.name]
    conditions = list(td.get("conditions") or [])

    max_bonus = _max_hp_bonus_from_modifiers(modifiers)
    for modifier in modifiers:
        if not isinstance(modifier, dict):
            continue
        mod_type = modifier.get("type")
        if mod_type == "condition":
            detail = (modifier.get("detail") or modifier.get("label") or "").strip()
            conditions = [name for name in conditions if name != detail]
        elif mod_type in {"bonus_dice", "penalty_dice", "note"}:
            note = modifier.get("label") or modifier.get("detail")
            active_effects = [name for name in active_effects if name != note]

    for key in ["resistances", "immunities", "vulnerabilities", "advantages", "disadvantages"]:
        traits[key] = [
            item for item in (traits.get(key) or [])
            if not (isinstance(item, dict) and str(item.get("campaign_effect_id")) == str(effect.id))
        ]

    if max_bonus:
        remaining = [
            row for row in applied
            if not (isinstance(row, dict) and str(row.get("id")) == str(effect.id))
        ]
        base_max = int(hp.get("campaign_base_max") or hp.get("max") or hp.get("current") or 0)
        remaining_bonus = sum(_campaign_effect_max_hp_bonus(row) for row in remaining)
        new_max = base_max + remaining_bonus
        hp["max_override"] = new_max if remaining_bonus else None
        if not remaining_bonus:
            hp.pop("campaign_base_max", None)
        hp["current"] = min(int(hp.get("current") or 0), new_max or int(hp.get("max") or 0))

    td["hp"] = hp
    td["traits"] = traits
    td["active_effects"] = active_effects
    td["conditions"] = conditions
    td["campaign_effects"] = [
        row for row in applied
        if not (isinstance(row, dict) and str(row.get("id")) == str(effect.id))
    ]
    return td


def _target_characters_for_effect(campaign, effect):
    target_ids = _effect_payload_target_ids(effect)
    if effect.target_character_id:
        target_ids.add(int(effect.target_character_id))
    if not target_ids:
        return []
    entries = CampaignCharacter.query.filter(
        CampaignCharacter.campaign_id == campaign.id,
        CampaignCharacter.active.is_(True),
        CampaignCharacter.character_id.in_(target_ids),
    ).all()
    return [entry.character for entry in entries if entry.character]


def _patch_encounter_effects(campaign, effect, apply_effect):
    target_ids = _effect_payload_target_ids(effect)
    if effect.target_character_id:
        target_ids.add(int(effect.target_character_id))
    if not target_ids:
        return

    tag = _effect_tag(effect)
    modifiers = tag["modifiers"]
    hp_bonus = _max_hp_bonus_from_modifiers(modifiers)
    temp_hp = max([_modifier_int(modifier) for modifier in modifiers if isinstance(modifier, dict) and modifier.get("type") == "temp_hp"] or [0])

    for encounter in campaign.encounters:
        if encounter.status == "complete":
            continue
        data = encounter.data or {}
        rows = data.get("combatants") if isinstance(data.get("combatants"), list) else []
        changed = False
        next_rows = []
        for row in rows:
            try:
                row_character_id = int(row.get("character_id") or 0)
            except (TypeError, ValueError):
                row_character_id = 0
            if row.get("type") != "player" or row_character_id not in target_ids:
                next_rows.append(row)
                continue
            effects = row.get("effects") if isinstance(row.get("effects"), list) else []
            has_effect = any(item.get("id") == tag["id"] for item in effects if isinstance(item, dict))
            patched = dict(row)
            if apply_effect and not has_effect:
                patched["effects"] = effects + [tag]
                if hp_bonus:
                    patched["hp_current"] = int(patched.get("hp_current") or 0) + hp_bonus
                    patched["hp_max"] = int(patched.get("hp_max") or 0) + hp_bonus
                if temp_hp:
                    patched["temp_hp"] = max(int(patched.get("temp_hp") or 0), temp_hp)
                changed = True
            elif not apply_effect and has_effect:
                patched["effects"] = [item for item in effects if not (isinstance(item, dict) and item.get("id") == tag["id"])]
                if hp_bonus:
                    patched["hp_max"] = max(0, int(patched.get("hp_max") or 0) - hp_bonus)
                    patched["hp_current"] = min(int(patched.get("hp_current") or 0), patched["hp_max"])
                changed = True
            next_rows.append(patched)
        if changed:
            data["combatants"] = next_rows
            encounter.data = data


@campaigns_bp.route("/", methods=["GET"])
@jwt_required()
def list_campaigns():
    user_id = int(get_jwt_identity())
    memberships = CampaignMember.query.filter_by(user_id=user_id).all()
    return jsonify([
        {
            **_campaign_response(membership.campaign, membership, include_detail=False),
            "member_count": len(membership.campaign.members),
            "character_count": len([entry for entry in membership.campaign.characters if entry.active]),
        }
        for membership in memberships
    ]), 200


@campaigns_bp.route("/", methods=["POST"])
@jwt_required()
def create_campaign():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Campaign name required"}), 400

    campaign = Campaign(
        name=name,
        invite_code=_make_unique_invite_code(),
        owner_user_id=user_id,
    )
    db.session.add(campaign)
    db.session.flush()
    member = CampaignMember(campaign_id=campaign.id, user_id=user_id, role="dm")
    db.session.add(member)
    db.session.commit()

    return jsonify(_campaign_response(campaign, member)), 201


@campaigns_bp.route("/join", methods=["POST"])
@jwt_required()
def join_campaign():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    invite_code = (data.get("invite_code") or "").strip().upper()
    if not invite_code:
        return jsonify({"error": "Invite code required"}), 400

    campaign = Campaign.query.filter_by(invite_code=invite_code).first()
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    existing = _membership(campaign.id, user_id)
    if existing:
        return jsonify(_campaign_response(campaign, existing)), 200

    member = CampaignMember(campaign_id=campaign.id, user_id=user_id, role="player")
    db.session.add(member)
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200


@campaigns_bp.route("/<int:campaign_id>/leave", methods=["POST"])
@jwt_required()
def leave_campaign(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if campaign.owner_user_id == user_id:
        return jsonify({"error": "The campaign owner cannot leave until ownership transfer exists"}), 400

    for entry in CampaignCharacter.query.filter_by(campaign_id=campaign.id, user_id=user_id).all():
        entry.active = False
        entry.is_primary = False
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Left campaign"}), 200


@campaigns_bp.route("/<int:campaign_id>/members/<int:member_id>/role", methods=["POST"])
@jwt_required()
def update_member_role(campaign_id, member_id):
    user_id = int(get_jwt_identity())
    campaign, current_member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, current_member):
        return jsonify({"error": "Only the DM can update campaign roles"}), 403

    target = CampaignMember.query.filter_by(id=member_id, campaign_id=campaign.id).first_or_404()
    if target.user_id == campaign.owner_user_id:
        return jsonify({"error": "The campaign owner must remain DM"}), 400

    data = request.get_json() or {}
    role = (data.get("role") or "").strip().lower()
    if role not in {"dm", "player"}:
        return jsonify({"error": "Role must be dm or player"}), 400

    target.role = role
    db.session.commit()
    return jsonify(_campaign_response(campaign, current_member)), 200


@campaigns_bp.route("/<int:campaign_id>/owner/transfer", methods=["POST"])
@jwt_required()
def transfer_campaign_owner(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, current_member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if campaign.owner_user_id != user_id:
        return jsonify({"error": "Only the current owner DM can transfer campaign ownership"}), 403

    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    if not email or "@" not in email:
        return jsonify({"error": "Valid target email required"}), 400

    target_user = User.query.filter(User.email.ilike(email)).first()
    if not target_user:
        return jsonify({"error": "No RoundHero user found with that email"}), 404

    target_member = _membership(campaign.id, target_user.id)
    if not target_member:
        target_member = CampaignMember(campaign_id=campaign.id, user_id=target_user.id, role="dm")
        db.session.add(target_member)
    else:
        target_member.role = "dm"

    current_member.role = "dm"
    campaign.owner_user_id = target_user.id
    db.session.commit()
    return jsonify(_campaign_response(campaign, current_member)), 200


@campaigns_bp.route("/<int:campaign_id>/members/<int:member_id>", methods=["DELETE"])
@jwt_required()
def remove_member(campaign_id, member_id):
    user_id = int(get_jwt_identity())
    campaign, current_member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, current_member):
        return jsonify({"error": "Only the DM can remove members"}), 403

    target = CampaignMember.query.filter_by(id=member_id, campaign_id=campaign.id).first_or_404()
    if target.user_id == campaign.owner_user_id:
        return jsonify({"error": "The campaign owner cannot be removed"}), 400

    for entry in CampaignCharacter.query.filter_by(campaign_id=campaign.id, user_id=target.user_id).all():
        entry.active = False
        entry.is_primary = False
    db.session.delete(target)
    db.session.commit()
    return jsonify(_campaign_response(campaign, current_member)), 200


@campaigns_bp.route("/<int:campaign_id>", methods=["GET"])
@jwt_required()
def get_campaign(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    return jsonify(_campaign_response(campaign, member)), 200


@campaigns_bp.route("/player-view/<int:character_id>", methods=["GET"])
@jwt_required()
def get_player_campaign_view(character_id):
    user_id = int(get_jwt_identity())
    character = Character.query.filter_by(id=character_id, user_id=user_id).first()
    if not character:
        return jsonify({"error": "Character not found"}), 404

    roster_entries = CampaignCharacter.query.filter_by(
        character_id=character.id,
        user_id=user_id,
        active=True,
    ).all()
    views = []
    for entry in roster_entries:
        member = _membership(entry.campaign_id, user_id)
        if not member:
            continue
        campaign = entry.campaign
        running = [
            encounter for encounter in campaign.encounters
            if encounter.status in {"running", "paused"}
        ]
        views.append({
            **_campaign_response(campaign, member, include_detail=False),
            "character_id": character.id,
            "character_name": character.name,
            "campaign_rules": _clean_campaign_rules(campaign.rules),
            "encounters": [_player_encounter_view(encounter) for encounter in running],
            "effects": [
                effect.to_dict() for effect in campaign.effects
                if effect.status == "applied" and _effect_visible_to_character(effect, character.id, campaign, member)
            ],
        })
    return jsonify(views), 200


@campaigns_bp.route("/player-view/<int:character_id>/death-save", methods=["POST"])
@jwt_required()
def roll_player_death_save(character_id):
    user_id = int(get_jwt_identity())
    character = Character.query.filter_by(id=character_id, user_id=user_id).first()
    if not character:
        return jsonify({"error": "Character not found"}), 404

    data = request.get_json() or {}
    blind = bool(data.get("blind"))
    roll = randint(1, 20)
    result, success_delta, failure_delta, note = _death_save_result(roll)

    td = dict(character.tracker_data or {})
    current_sheet_saves = td.get("death_saves") if isinstance(td.get("death_saves"), dict) else {}
    next_sheet_saves = _patch_death_saves(current_sheet_saves, success_delta, failure_delta)
    visible_death_saves = next_sheet_saves

    updated_encounters = []
    roster_entries = CampaignCharacter.query.filter_by(
        character_id=character.id,
        user_id=user_id,
        active=True,
    ).all()
    for entry in roster_entries:
        campaign = entry.campaign
        member = _membership(entry.campaign_id, user_id)
        if not campaign or not member:
            continue
        for encounter in campaign.encounters:
            if encounter.status not in {"running", "paused"}:
                continue
            encounter_data = encounter.data or {}
            rows = encounter_data.get("combatants") if isinstance(encounter_data.get("combatants"), list) else []
            changed = False
            next_rows = []
            for row in rows:
                if str(row.get("character_id")) == str(character.id):
                    row = dict(row)
                    death_saves = _patch_death_saves(row.get("death_saves"), success_delta, failure_delta)
                    record = _death_save_record(character, roll, result, note, blind, death_saves)
                    history = row.get("death_save_rolls") if isinstance(row.get("death_save_rolls"), list) else []
                    row["death_saves"] = death_saves
                    row["last_death_save"] = record
                    row["death_save_rolls"] = [*history[-9:], record]
                    visible_death_saves = death_saves
                    changed = True
                next_rows.append(row)
            if changed:
                encounter_data["combatants"] = next_rows
                encounter.data = encounter_data
                updated_encounters.append({"campaign_id": campaign.id, "encounter_id": encounter.id})

    if not blind:
        sheet_record = _death_save_record(character, roll, result, note, blind, visible_death_saves)
        sheet_history = td.get("death_save_rolls") if isinstance(td.get("death_save_rolls"), list) else []
        td["death_saves"] = visible_death_saves
        td["last_death_save"] = sheet_record
        td["death_save_rolls"] = [*sheet_history[-9:], sheet_record]
        character.tracker_data = td

    db.session.commit()

    response = {
        "blind": blind,
        "updated_encounters": updated_encounters,
        "message": "Death save rolled blind and sent to the DM." if blind else "Death save rolled.",
    }
    if not blind:
        response.update({
            "roll": roll,
            "result": result,
            "note": note,
            "death_saves": visible_death_saves,
            "tracker_data": character.tracker_data,
        })
    return jsonify(response), 200


@campaigns_bp.route("/<int:campaign_id>", methods=["PUT"])
@jwt_required()
def update_campaign(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, member):
        return jsonify({"error": "Only the DM can update this campaign"}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if name:
        campaign.name = name
    if "rules" in data:
        campaign.rules = _clean_campaign_rules(data.get("rules"))
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200


@campaigns_bp.route("/<int:campaign_id>", methods=["DELETE"])
@jwt_required()
def delete_campaign(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if campaign.owner_user_id != user_id:
        return jsonify({"error": "Only the owner DM can delete this campaign"}), 403

    db.session.delete(campaign)
    db.session.commit()
    return jsonify({"message": "Campaign deleted"}), 200


@campaigns_bp.route("/<int:campaign_id>/invite/regenerate", methods=["POST"])
@jwt_required()
def regenerate_invite(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, member):
        return jsonify({"error": "Only the DM can regenerate invite codes"}), 403

    campaign.invite_code = _make_unique_invite_code()
    db.session.commit()
    return jsonify({"invite_code": campaign.invite_code}), 200


@campaigns_bp.route("/<int:campaign_id>/invite/email", methods=["POST"])
@jwt_required()
def email_invite(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    data = request.get_json() or {}
    to_addr = (data.get("email") or "").strip()
    invite_url = (data.get("invite_url") or "").strip() or f"{request.host_url.rstrip('/')}/campaigns?join={campaign.invite_code}"
    if not to_addr or "@" not in to_addr:
        return jsonify({"error": "Valid recipient email required"}), 400

    sender = User.query.get(user_id)
    subject = f"Join my RoundHero campaign: {campaign.name}"
    body = (
        f"{sender.username if sender else 'A RoundHero user'} invited you to join {campaign.name}.\n\n"
        f"Invite code: {campaign.invite_code}\n\n"
        "Open this link, sign in or create an account, and join the campaign:\n"
        f"{invite_url}\n"
    )

    try:
        _send_smtp_email(to_addr, subject, body)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Could not send the campaign invite email - check the server's SMTP configuration."}), 500

    return jsonify({"ok": True}), 200


@campaigns_bp.route("/<int:campaign_id>/characters", methods=["POST"])
@jwt_required()
def attach_character(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    data = request.get_json() or {}
    character_id = data.get("character_id")
    character = Character.query.filter_by(id=character_id, user_id=user_id).first()
    if not character:
        return jsonify({"error": "Character not found"}), 404

    existing = CampaignCharacter.query.filter_by(
        campaign_id=campaign.id,
        character_id=character.id,
    ).first()
    if existing:
        existing.active = True
        if not CampaignCharacter.query.filter_by(campaign_id=campaign.id, user_id=user_id, active=True, is_primary=True).first():
            existing.is_primary = True
    else:
        is_primary = not CampaignCharacter.query.filter_by(
            campaign_id=campaign.id,
            user_id=user_id,
            active=True,
            is_primary=True,
        ).first()
        db.session.add(CampaignCharacter(
            campaign_id=campaign.id,
            character_id=character.id,
            user_id=user_id,
            is_primary=is_primary,
        ))
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200


@campaigns_bp.route("/<int:campaign_id>/characters/<int:campaign_character_id>", methods=["DELETE"])
@jwt_required()
def detach_character(campaign_id, campaign_character_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    entry = CampaignCharacter.query.filter_by(
        id=campaign_character_id,
        campaign_id=campaign.id,
    ).first_or_404()
    if entry.user_id != user_id and not _is_dm(campaign, member):
        return jsonify({"error": "You can only remove your own character"}), 403

    entry.active = False
    entry.is_primary = False
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200


@campaigns_bp.route("/<int:campaign_id>/characters/<int:campaign_character_id>/primary", methods=["POST"])
@jwt_required()
def set_primary_character(campaign_id, campaign_character_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    entry = CampaignCharacter.query.filter_by(
        id=campaign_character_id,
        campaign_id=campaign.id,
        active=True,
    ).first_or_404()
    if entry.user_id != user_id and not _is_dm(campaign, member):
        return jsonify({"error": "You can only set your own active character"}), 403

    for other in CampaignCharacter.query.filter_by(
        campaign_id=campaign.id,
        user_id=entry.user_id,
        active=True,
    ).all():
        other.is_primary = other.id == entry.id
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200




@campaigns_bp.route("/<int:campaign_id>/characters/<int:campaign_character_id>/active", methods=["POST"])
@jwt_required()
def set_campaign_character_active(campaign_id, campaign_character_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    entry = CampaignCharacter.query.filter_by(
        id=campaign_character_id,
        campaign_id=campaign.id,
    ).first_or_404()
    if entry.user_id != user_id and not _is_dm(campaign, member):
        return jsonify({"error": "You can only update your own character"}), 403

    data = request.get_json() or {}
    active = bool(data.get("active", True))
    entry.active = active
    if not active:
        entry.is_primary = False
    elif not CampaignCharacter.query.filter_by(campaign_id=campaign.id, user_id=entry.user_id, active=True, is_primary=True).first():
        entry.is_primary = True
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200

@campaigns_bp.route("/<int:campaign_id>/effects", methods=["POST"])
@jwt_required()
def create_effect(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, _member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Effect name required"}), 400

    source_character_id = data.get("source_character_id")
    target_character_id = data.get("target_character_id")
    if source_character_id and not _character_in_campaign(campaign.id, source_character_id):
        return jsonify({"error": "Source character is not in this campaign"}), 400
    if target_character_id and not _character_in_campaign(campaign.id, target_character_id):
        return jsonify({"error": "Target character is not in this campaign"}), 400

    effect = CampaignEffect(
        campaign_id=campaign.id,
        created_by_user_id=user_id,
        source_character_id=source_character_id,
        target_character_id=target_character_id,
        name=name,
        effect_type=(data.get("effect_type") or "spell").strip() or "spell",
        status=(data.get("status") or "pending").strip().lower() or "pending",
    )
    if effect.status not in {"pending", "applied", "dismissed", "removed"}:
        return jsonify({"error": "Invalid effect status"}), 400
    payload = data.get("payload") or {}
    target_ids = payload.get("target_character_ids") or []
    if target_ids and not isinstance(target_ids, list):
        return jsonify({"error": "Target character ids must be a list"}), 400
    for target_id in target_ids:
        if not _character_in_campaign(campaign.id, target_id):
            return jsonify({"error": "One or more targets are not in this campaign"}), 400
    for key in ["duration", "concentration", "notes"]:
        if key in data:
            payload[key] = data.get(key)
    effect.payload = payload
    db.session.add(effect)
    db.session.commit()
    return jsonify(effect.to_dict()), 201


@campaigns_bp.route("/<int:campaign_id>/effects/<int:effect_id>/status", methods=["POST"])
@jwt_required()
def update_effect_status(campaign_id, effect_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    effect = CampaignEffect.query.filter_by(id=effect_id, campaign_id=campaign.id).first_or_404()
    data = request.get_json() or {}
    status = (data.get("status") or "").strip().lower()
    if status not in {"pending", "applied", "dismissed", "removed"}:
        return jsonify({"error": "Invalid effect status"}), 400

    target_entry = _character_in_campaign(campaign.id, effect.target_character_id) if effect.target_character_id else None
    can_update = (
        _is_dm(campaign, member)
        or effect.created_by_user_id == user_id
        or (target_entry and target_entry.user_id == user_id)
    )
    if not can_update:
        return jsonify({"error": "You cannot update this effect"}), 403

    if status == "applied":
        for character in _target_characters_for_effect(campaign, effect):
            character.tracker_data = _apply_campaign_effect_to_tracker(character.tracker_data, effect)
        _patch_encounter_effects(campaign, effect, apply_effect=True)
    elif status == "removed":
        for character in _target_characters_for_effect(campaign, effect):
            character.tracker_data = _remove_campaign_effect_from_tracker(character.tracker_data, effect)
        _patch_encounter_effects(campaign, effect, apply_effect=False)

    effect.status = status
    db.session.commit()
    return jsonify(effect.to_dict()), 200


@campaigns_bp.route("/<int:campaign_id>/encounters", methods=["POST"])
@jwt_required()
def create_encounter(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, member):
        return jsonify({"error": "Only the DM can create encounters"}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Encounter name required"}), 400

    encounter = CampaignEncounter(
        campaign_id=campaign.id,
        created_by_user_id=user_id,
        name=name,
        status=(data.get("status") or "planned").strip().lower() or "planned",
    )
    if encounter.status not in {"planned", "running", "paused", "complete"}:
        return jsonify({"error": "Invalid encounter status"}), 400
    encounter.data = data.get("data") or {
        "combatants": [],
        "initiative_order": [],
        "notes": data.get("notes") or "",
    }
    db.session.add(encounter)
    db.session.commit()
    return jsonify(encounter.to_dict()), 201


@campaigns_bp.route("/<int:campaign_id>/encounters/<int:encounter_id>", methods=["PUT"])
@jwt_required()
def update_encounter(campaign_id, encounter_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, member):
        return jsonify({"error": "Only the DM can update encounters"}), 403

    encounter = CampaignEncounter.query.filter_by(id=encounter_id, campaign_id=campaign.id).first_or_404()
    data = request.get_json() or {}
    if "name" in data and str(data["name"]).strip():
        encounter.name = str(data["name"]).strip()
    if "status" in data:
        status = (data.get("status") or "").strip().lower()
        if status not in {"planned", "running", "paused", "complete"}:
            return jsonify({"error": "Invalid encounter status"}), 400
        encounter.status = status
    if "data" in data:
        encounter.data = data.get("data") or {}
    db.session.commit()
    return jsonify(encounter.to_dict()), 200


@campaigns_bp.route("/<int:campaign_id>/encounters/<int:encounter_id>", methods=["DELETE"])
@jwt_required()
def delete_encounter(campaign_id, encounter_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404
    if not _is_dm(campaign, member):
        return jsonify({"error": "Only the DM can delete encounters"}), 403

    encounter = CampaignEncounter.query.filter_by(id=encounter_id, campaign_id=campaign.id).first_or_404()
    db.session.delete(encounter)
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200
