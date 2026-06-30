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
        public["death_saves"] = row.get("death_saves") or {"successes": 0, "failures": 0}
    return public


def _player_encounter_view(encounter):
    data = encounter.data or {}
    combatants = data.get("combatants") if isinstance(data.get("combatants"), list) else []
    return {
        "id": encounter.id,
        "name": encounter.name,
        "status": encounter.status,
        "updated_at": encounter.updated_at.isoformat(),
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
            "encounters": [_player_encounter_view(encounter) for encounter in running],
            "effects": [
                effect.to_dict() for effect in campaign.effects
                if effect.status != "removed" and _effect_visible_to_character(effect, character.id, campaign, member)
            ],
        })
    return jsonify(views), 200


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
    db.session.commit()
    return jsonify(_campaign_response(campaign, member)), 200


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
