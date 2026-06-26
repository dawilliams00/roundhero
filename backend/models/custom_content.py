from database import db
from datetime import datetime
import json

class CustomContent(db.Model):
    """User-created content (spells, and later feats/items) shared across that
    user's characters, rather than baked into one character's JSON blob."""
    __tablename__   = "custom_content"
    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content_type    = db.Column(db.String(20), nullable=False)  # "spell" | "feat" | "item"
    name            = db.Column(db.String(120), nullable=False)
    _data           = db.Column("data", db.Text, default="{}")
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def data(self):
        return json.loads(self._data or "{}")
    @data.setter
    def data(self, value):
        self._data = json.dumps(value)

    def to_dict(self):
        d = dict(self.data)
        d["_custom_id"] = self.id
        d["_source"] = "custom"
        return d
