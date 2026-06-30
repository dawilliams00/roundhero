from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from database import db
from sqlalchemy import text
from datetime import timedelta
import os

# Lightweight additive-column migrations. db.create_all() only creates missing
# tables, never alters existing ones, so any new column added to a model must
# be listed here too or it will be silently absent on already-deployed databases.
PENDING_COLUMNS = [
    ("characters", "source_pdf", "BYTEA", "BLOB"),
    ("campaign_characters", "is_primary", "BOOLEAN DEFAULT FALSE", "BOOLEAN DEFAULT 0"),
    ("characters", "background", "VARCHAR(80)", "VARCHAR(80)"),
    ("campaigns", "rules", "TEXT DEFAULT '{}'", "TEXT DEFAULT '{}'"),
]

def _apply_pending_migrations(app):
    is_sqlite = app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite")
    with db.engine.connect() as conn:
        for table, column, pg_type, sqlite_type in PENDING_COLUMNS:
            try:
                if is_sqlite:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_type}"))
                else:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {pg_type}"))
                conn.commit()
            except Exception:
                conn.rollback()

def create_app():
    app = Flask(__name__)

    database_url = os.environ.get("DATABASE_URL", "sqlite:///roundhero.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")
    # Default is 15 minutes, which silently 401s every save mid-session for this single-user app.
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30)

    CORS(app, origins=["http://localhost:3000", "https://roundhero.app", "https://www.roundhero.app", "https://roundhero-web.onrender.com"])
    JWTManager(app)
    db.init_app(app)

    from routes.auth import auth_bp
    from routes.characters import characters_bp
    from routes.tracker import tracker_bp
    from routes.spells import spells_bp
    from routes.content import content_bp
    from routes.feedback import feedback_bp
    from routes.campaigns import campaigns_bp
    from routes.character_modules import character_modules_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(characters_bp, url_prefix="/api/characters")
    app.register_blueprint(tracker_bp, url_prefix="/api/tracker")
    app.register_blueprint(spells_bp, url_prefix="/api/spells")
    app.register_blueprint(content_bp, url_prefix="/api/content")
    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")
    app.register_blueprint(campaigns_bp, url_prefix="/api/campaigns")
    app.register_blueprint(character_modules_bp, url_prefix="/api/character-modules")

    with app.app_context():
        db.create_all()
        _apply_pending_migrations(app)

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
