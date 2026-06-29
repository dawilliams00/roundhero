from secrets import token_urlsafe

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from database import db
from models.campaign import Campaign, CampaignCharacter, CampaignEffect, CampaignMember
from models.character import Character


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


def _character_in_campaign(campaign_id, character_id):
    return CampaignCharacter.query.filter_by(
        campaign_id=campaign_id,
        character_id=character_id,
        active=True,
    ).first()


@campaigns_bp.route("/", methods=["GET"])
@jwt_required()
def list_campaigns():
    user_id = int(get_jwt_identity())
    memberships = CampaignMember.query.filter_by(user_id=user_id).all()
    return jsonify([
        {
            **membership.campaign.to_dict(),
            "role": membership.role,
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
    db.session.add(CampaignMember(campaign_id=campaign.id, user_id=user_id, role="dm"))
    db.session.commit()

    return jsonify(campaign.to_dict(include_detail=True)), 201


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
        return jsonify(campaign.to_dict(include_detail=True)), 200

    db.session.add(CampaignMember(campaign_id=campaign.id, user_id=user_id, role="player"))
    db.session.commit()
    return jsonify(campaign.to_dict(include_detail=True)), 200


@campaigns_bp.route("/<int:campaign_id>", methods=["GET"])
@jwt_required()
def get_campaign(campaign_id):
    user_id = int(get_jwt_identity())
    campaign, member = _campaign_for_user(campaign_id, user_id)
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    return jsonify({
        **campaign.to_dict(include_detail=True),
        "role": member.role,
        "is_dm": _is_dm(campaign, member),
    }), 200


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
    return jsonify(campaign.to_dict(include_detail=True)), 200


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
    else:
        db.session.add(CampaignCharacter(
            campaign_id=campaign.id,
            character_id=character.id,
            user_id=user_id,
        ))
    db.session.commit()
    return jsonify(campaign.to_dict(include_detail=True)), 200


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
    db.session.commit()
    return jsonify(campaign.to_dict(include_detail=True)), 200


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
        status="pending",
    )
    effect.payload = data.get("payload") or {}
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
