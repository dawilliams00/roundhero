from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from database import db
import os

def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///roundhero.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")

    CORS(app, origins=["http://localhost:3000", "https://roundhero.app"])
    JWTManager(app)
    db.init_app(app)

    from routes.auth import auth_bp
    from routes.characters import characters_bp
    from routes.tracker import tracker_bp
    from routes.spells import spells_bp
    from routes.content import content_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(characters_bp, url_prefix="/api/characters")
    app.register_blueprint(tracker_bp, url_prefix="/api/tracker")
    app.register_blueprint(spells_bp, url_prefix="/api/spells")
    app.register_blueprint(content_bp, url_prefix="/api/content")

    with app.app_context():
        db.create_all()

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
