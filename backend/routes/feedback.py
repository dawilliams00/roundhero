from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from models.user import User

feedback_bp = Blueprint("feedback", __name__)

# Gmail SMTP needs an App Password (regular account passwords are rejected), set as
# Render env vars - FEEDBACK_SMTP_USER/FEEDBACK_SMTP_PASSWORD for the sending account,
# FEEDBACK_EMAIL_TO for where it lands (defaults to the owner's own inbox). Not in the
# repo since these are secrets, not code - see CLAUDE.md for the one-time setup steps.
@feedback_bp.route("", methods=["POST"])
@jwt_required()
def submit_feedback():
    comment = (request.form.get("comment") or "").strip()
    if not comment:
        return jsonify({"error": "Write something before sending."}), 400

    smtp_user = os.environ.get("FEEDBACK_SMTP_USER")
    smtp_password = os.environ.get("FEEDBACK_SMTP_PASSWORD")
    to_addr = os.environ.get("FEEDBACK_EMAIL_TO", "dawilliams00@gmail.com")
    if not smtp_user or not smtp_password:
        return jsonify({"error": "Feedback email isn't set up on the server yet - the owner needs to add FEEDBACK_SMTP_USER/FEEDBACK_SMTP_PASSWORD env vars."}), 500

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    character_name = (request.form.get("character_name") or "").strip()

    msg = MIMEMultipart()
    msg["Subject"] = f"RoundHero Feedback{f' ({character_name})' if character_name else ''}"
    msg["From"] = smtp_user
    msg["To"] = to_addr
    body = f"From: {user.username if user else 'unknown user'} ({user.email if user else 'no email'})\n"
    if character_name:
        body += f"Character: {character_name}\n"
    body += f"\n{comment}"
    msg.attach(MIMEText(body, "plain"))

    image = request.files.get("image")
    if image and image.filename:
        img_data = image.read()
        img = MIMEImage(img_data)
        img.add_header("Content-Disposition", "attachment", filename=image.filename)
        msg.attach(img)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_addr, msg.as_string())
    except Exception:
        return jsonify({"error": "Could not send the feedback email - check the server's SMTP configuration."}), 500

    return jsonify({"ok": True}), 200
