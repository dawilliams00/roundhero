from datetime import datetime, timedelta
from email.message import EmailMessage
import hashlib
import os
import secrets
import smtplib

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from sqlalchemy import func
from werkzeug.security import generate_password_hash, check_password_hash
from database import db
from models.user import User
from models.password_reset_token import PasswordResetToken

auth_bp = Blueprint("auth", __name__)


def _hash_reset_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _frontend_url():
    return os.environ.get("FRONTEND_URL", "https://roundhero.app").rstrip("/")


def _reset_link(token):
    return f"{_frontend_url()}/reset-password?token={token}"


def _send_password_reset_email(user, reset_url):
    host = os.environ.get("MAIL_SERVER") or os.environ.get("SMTP_HOST")
    username = os.environ.get("MAIL_USERNAME") or os.environ.get("SMTP_USERNAME")
    password = os.environ.get("MAIL_PASSWORD") or os.environ.get("SMTP_PASSWORD")
    sender = os.environ.get("MAIL_FROM") or username
    port = int(os.environ.get("MAIL_PORT") or os.environ.get("SMTP_PORT") or "587")
    use_tls = (os.environ.get("MAIL_USE_TLS") or os.environ.get("SMTP_USE_TLS") or "true").lower() != "false"

    if not host or not sender:
        current_app.logger.warning("Password reset requested but mail is not configured. Link: %s", reset_url)
        return False

    message = EmailMessage()
    message["Subject"] = "Reset your RoundHero password"
    message["From"] = sender
    message["To"] = user.email
    message.set_content(
        "A password reset was requested for your RoundHero account.\n\n"
        f"Reset your password here:\n{reset_url}\n\n"
        "This link expires soon and can only be used once. If you did not request this, you can ignore this email."
    )

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)

    return True


def _generic_reset_response(extra=None):
    payload = {"message": "If that email exists, a password reset link has been sent."}
    if extra:
        payload.update(extra)
    return jsonify(payload), 200

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not data.get("username") or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Username, email and password required"}), 400
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username taken"}), 409
    user = User(
        username=data["username"],
        email=data["email"],
        password_hash=generate_password_hash(data["password"])
    )
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": {"id": user.id, "username": user.username, "email": user.email}}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400
    user = User.query.filter_by(email=data["email"]).first()
    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": {"id": user.id, "username": user.username, "email": user.email}}), 200

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = (data.get("email") if data else "").strip().lower()
    if not email:
        return _generic_reset_response()

    user = User.query.filter(func.lower(User.email) == email).first()
    if not user:
        return _generic_reset_response()

    raw_token = secrets.token_urlsafe(32)
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expires_at=datetime.utcnow() + timedelta(hours=int(os.environ.get("PASSWORD_RESET_HOURS", "1"))),
    )
    db.session.add(token)
    db.session.commit()

    reset_url = _reset_link(raw_token)
    try:
        sent = _send_password_reset_email(user, reset_url)
    except Exception:
        current_app.logger.exception("Password reset email failed")
        sent = False

    if not sent and os.environ.get("PASSWORD_RESET_EXPOSE_LINK", "").lower() == "true":
        return _generic_reset_response({"reset_url": reset_url})

    return _generic_reset_response()

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    raw_token = (data.get("token") if data else "") or ""
    new_password = (data.get("password") if data else "")

    if not raw_token or new_password is None or new_password == "":
        return jsonify({"error": "Reset token and password required"}), 400

    token = PasswordResetToken.query.filter_by(token_hash=_hash_reset_token(raw_token)).first()
    if not token or token.used_at or token.expires_at < datetime.utcnow():
        return jsonify({"error": "Reset link is invalid or expired"}), 400

    user = User.query.get(token.user_id)
    if not user:
        return jsonify({"error": "Reset link is invalid or expired"}), 400

    user.password_hash = generate_password_hash(new_password)
    token.used_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Password updated. You can sign in now."}), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username, "email": user.email}), 200
