from datetime import datetime
import json

from database import db


class Campaign(db.Model):
    __tablename__ = "campaigns"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    invite_code = db.Column(db.String(16), unique=True, nullable=False, index=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = db.relationship("User", foreign_keys=[owner_user_id])
    members = db.relationship("CampaignMember", back_populates="campaign", cascade="all, delete-orphan")
    characters = db.relationship("CampaignCharacter", back_populates="campaign", cascade="all, delete-orphan")
    effects = db.relationship("CampaignEffect", back_populates="campaign", cascade="all, delete-orphan")
    encounters = db.relationship("CampaignEncounter", back_populates="campaign", cascade="all, delete-orphan")

    def to_dict(self, include_detail=False):
        data = {
            "id": self.id,
            "name": self.name,
            "invite_code": self.invite_code,
            "owner_user_id": self.owner_user_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_detail:
            data["members"] = [member.to_dict() for member in self.members]
            data["characters"] = [character.to_dict() for character in self.characters]
            data["effects"] = [effect.to_dict() for effect in self.effects]
            data["encounters"] = [encounter.to_dict() for encounter in self.encounters]
        return data


class CampaignMember(db.Model):
    __tablename__ = "campaign_members"

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(24), default="player", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    campaign = db.relationship("Campaign", back_populates="members")
    user = db.relationship("User")

    __table_args__ = (
        db.UniqueConstraint("campaign_id", "user_id", name="uq_campaign_member_user"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "",
            "email": self.user.email if self.user else "",
            "role": self.role,
            "created_at": self.created_at.isoformat(),
        }


class CampaignCharacter(db.Model):
    __tablename__ = "campaign_characters"

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False, index=True)
    character_id = db.Column(db.Integer, db.ForeignKey("characters.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    active = db.Column(db.Boolean, default=True, nullable=False)
    is_primary = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    campaign = db.relationship("Campaign", back_populates="characters")
    character = db.relationship("Character")
    user = db.relationship("User")

    __table_args__ = (
        db.UniqueConstraint("campaign_id", "character_id", name="uq_campaign_character"),
    )

    def to_dict(self):
        character = self.character
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "character_id": self.character_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "",
            "active": self.active,
            "is_primary": self.is_primary,
            "name": character.name if character else "",
            "class_name": character.class_name if character else "",
            "race": character.race if character else "",
            "level": character.level if character else None,
            "created_at": self.created_at.isoformat(),
        }


class CampaignEffect(db.Model):
    __tablename__ = "campaign_effects"

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    source_character_id = db.Column(db.Integer, db.ForeignKey("characters.id"), nullable=True)
    target_character_id = db.Column(db.Integer, db.ForeignKey("characters.id"), nullable=True)
    name = db.Column(db.String(160), nullable=False)
    effect_type = db.Column(db.String(60), default="spell", nullable=False)
    status = db.Column(db.String(24), default="pending", nullable=False)
    _payload = db.Column("payload", db.Text, default="{}")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = db.relationship("Campaign", back_populates="effects")
    created_by = db.relationship("User")
    source_character = db.relationship("Character", foreign_keys=[source_character_id])
    target_character = db.relationship("Character", foreign_keys=[target_character_id])

    @property
    def payload(self):
        return json.loads(self._payload or "{}")

    @payload.setter
    def payload(self, value):
        self._payload = json.dumps(value or {})

    def to_dict(self):
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "created_by_user_id": self.created_by_user_id,
            "created_by_username": self.created_by.username if self.created_by else "",
            "source_character_id": self.source_character_id,
            "source_character_name": self.source_character.name if self.source_character else "",
            "target_character_id": self.target_character_id,
            "target_character_name": self.target_character.name if self.target_character else "",
            "name": self.name,
            "effect_type": self.effect_type,
            "status": self.status,
            "payload": self.payload,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class CampaignEncounter(db.Model):
    __tablename__ = "campaign_encounters"

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(24), default="planned", nullable=False)
    _data = db.Column("data", db.Text, default="{}")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = db.relationship("Campaign", back_populates="encounters")
    created_by = db.relationship("User")

    @property
    def data(self):
        return json.loads(self._data or "{}")

    @data.setter
    def data(self, value):
        self._data = json.dumps(value or {})

    def to_dict(self):
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "created_by_user_id": self.created_by_user_id,
            "created_by_username": self.created_by.username if self.created_by else "",
            "name": self.name,
            "status": self.status,
            "data": self.data,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
