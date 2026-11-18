import logging

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from auth import COOKIE_NAME, issue_token, require_roles
from extensions import db, limiter
from models import AccountStatus, Role, User
from utils import is_strong_password, is_valid_email, log_action

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _set_cookie(resp, token):
    forwarded_proto = request.headers.get("X-Forwarded-Proto", "").split(",")[0].strip()
    secure = request.is_secure or forwarded_proto == "https" or current_app.config.get("ENV") == "production"
    resp.set_cookie(COOKIE_NAME, token, httponly=True, secure=secure,
                    samesite="Lax", max_age=8 * 3600, path="/")
    return resp


@bp.post("/register")
@limiter.limit("20 per 15 minutes")
def register():
    body = request.get_json(silent=True) or {}
    full_name = str(body.get("fullName", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    phone = str(body.get("phone", "")).strip() or None
    password = body.get("password", "")
    errors = {}
    if not (2 <= len(full_name) <= 150):
        errors["fullName"] = "Full name must be 2-150 characters."
    if not is_valid_email(email):
        errors["email"] = "Enter a valid email address."
    if phone and len(phone) > 30:
        errors["phone"] = "Phone must be 30 characters or fewer."
    if not is_strong_password(password):
        errors["password"] = "Password needs 8+ characters, one uppercase letter and one number."
    if errors:
        return jsonify({"error": "Invalid input", "details": errors}), 400
    try:
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409
        user = User(full_name=full_name, email=email, phone=phone,
                    password_hash=generate_password_hash(password), role=Role.CITIZEN)
        db.session.add(user)
        db.session.flush()
        log_action(request, user.id, "USER_REGISTERED", "User", user.id)
        db.session.commit()
        return jsonify({"id": user.id}), 201
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Registration failed")
        return jsonify({"error": "Registration could not be completed. Please try again."}), 500


@bp.post("/login")
@limiter.limit("20 per 15 minutes")
def login():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password", "")
    if not email or not isinstance(password, str) or not password:
        return jsonify({"error": "Email and password are required."}), 400
    try:
        user = User.query.filter_by(email=email).first()
        if not user or user.status != AccountStatus.ACTIVE or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password."}), 401
        try:
            log_action(request, user.id, "LOGIN", "User", user.id)
            db.session.commit()
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Could not write login audit record")
        token = issue_token(user.id)
        public_user = user.public_dict()
        response = jsonify({"user": public_user, "id": user.id,
                            "fullName": user.full_name, "role": public_user["role"]})
        return _set_cookie(response, token)
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Login failed while querying the user or creating the session")
        return jsonify({"error": "Login service is temporarily unavailable. Please try again."}), 500


@bp.post("/logout")
@require_roles()
def logout():
    try:
        log_action(request, g.user.id, "LOGOUT", "User", g.user.id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not write logout audit record")
    resp = jsonify({"ok": True})
    resp.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="Lax")
    return resp


@bp.get("/me")
@require_roles()
def me():
    return jsonify(g.user.public_dict())


@bp.post("/forgot-password")
@limiter.limit("10 per 15 minutes")
def forgot_password():
    return jsonify({"message": "If that account exists, password reset instructions will be sent once an email provider is configured."})


@bp.put("/me")
@require_roles()
def update_profile():
    body = request.get_json(silent=True) or {}
    if "fullName" in body:
        name = str(body["fullName"]).strip()
        if not (2 <= len(name) <= 150):
            return jsonify({"error": "Full name must be 2-150 characters."}), 400
        g.user.full_name = name
    if "phone" in body:
        phone = str(body["phone"]).strip() or None
        if phone and len(phone) > 30:
            return jsonify({"error": "Phone must be 30 characters or fewer."}), 400
        g.user.phone = phone
    db.session.commit()
    return jsonify(g.user.public_dict())
