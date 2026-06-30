from database import db
from datetime import datetime
import json

class Character(db.Model):
    __tablename__   = "characters"
    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name            = db.Column(db.String(120), nullable=False)
    class_name      = db.Column(db.String(80), nullable=False)
    subclass        = db.Column(db.String(120))
    background      = db.Column(db.String(80), nullable=True)
    race            = db.Column(db.String(80), nullable=False)
    level           = db.Column(db.Integer, default=1)
    _ability_scores = db.Column("ability_scores", db.Text, default="{}")
    _tracker_data   = db.Column("tracker_data", db.Text, default="{}")
    _spell_data     = db.Column("spell_data", db.Text, default="{}")
    _ae_data        = db.Column("ae_data", db.Text, default="{}")
    _notes          = db.Column("notes", db.Text, default="{}")
    source_pdf      = db.Column(db.LargeBinary, nullable=True)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def ability_scores(self):
        return json.loads(self._ability_scores or "{}")
    @ability_scores.setter
    def ability_scores(self, value):
        self._ability_scores = json.dumps(value)

    @property
    def tracker_data(self):
        return json.loads(self._tracker_data or "{}")
    @tracker_data.setter
    def tracker_data(self, value):
        self._tracker_data = json.dumps(value)

    @property
    def spell_data(self):
        return json.loads(self._spell_data or "{}")
    @spell_data.setter
    def spell_data(self, value):
        self._spell_data = json.dumps(value)

    @property
    def ae_data(self):
        return json.loads(self._ae_data or "{}")
    @ae_data.setter
    def ae_data(self, value):
        self._ae_data = json.dumps(value)

    @property
    def notes(self):
        return json.loads(self._notes or "{}")
    @notes.setter
    def notes(self, value):
        self._notes = json.dumps(value)

    def to_dict(self):
        return {
            "id":             self.id,
            "name":           self.name,
            "class_name":     self.class_name,
            "subclass":       self.subclass,
            "background":     self.background,
            "race":           self.race,
            "level":          self.level,
            "ability_scores": self.ability_scores,
            "tracker_data":   self.tracker_data,
            "spell_data":     self.spell_data,
            "ae_data":        self.ae_data,
            "notes":          self.notes,
            "has_source_pdf": self.source_pdf is not None,
            "created_at":     self.created_at.isoformat(),
            "updated_at":     self.updated_at.isoformat(),
        }
