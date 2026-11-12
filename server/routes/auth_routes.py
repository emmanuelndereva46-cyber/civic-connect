from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from auth import COOKIE_NAME, issue_token, require_roles
from extensions import db, limiter
from models import AccountStatus, Role, User
from utils import is_strong_password, is_valid_email, log_action

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _set_cookie(resp, token):
    resp.set_cookie(
        COOKIE_NAME, token, httponly=True, samesite="Strict",
        secure=False,  # set True once served over HTTPS in production
        max_age=8 * 3600, path="/",
    )
    return resp


@bp.post("/register")
@limiter.limit("20 per 15 minutes")
def register():
    body = request.get_json(silent=True) or {}
    full_name = str(body.get("fullName", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    phone = str(body.get("phone", "")).strip() or None
    county = str(body.get("county", "")).strip() or None
    password = body.get("password", "")

    errors = {}
    if not (2 <= len(full_name) <= 100):
        errors["fullName"] = "Full name must be 2-100 characters."
    if not is_valid_email(email):
        errors["email"] = "Enter a valid email address."
    if not is_strong_password(password):
        errors["password"] = "Password needs 8+ characters, one uppercase letter and one number."
    if errors:
        return jsonify({"error": "Invalid input", "details": errors}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    # role is always CITIZEN here; it is never taken from client input.
    user = User(
        full_name=full_name, email=email, phone=phone, county=county,
        password_hash=generate_password_hash(password), role=Role.CITIZEN,
    )
    db.session.add(user)
    db.session.flush()
    log_action(request, user.id, "USER_REGISTERED", "User", user.id)
    db.session.commit()
    return jsonify({"id": user.id}), 201


@bp.post("/login")
@limiter.limit("20 per 15 minutes")
def login():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password", "")

    user = User.query.filter_by(email=email).first()
    if (not user or user.status != AccountStatus.ACTIVE
            or not check_password_hash(user.password_hash, password)):
        return jsonify({"error": "Invalid credentials"}), 401

    log_action(request, user.id, "LOGIN", "User", user.id)
    db.session.commit()

    resp = jsonify({"id": user.id, "fullName": user.full_name, "role": user.role.value})
    return _set_cookie(resp, issue_token(user.id))


@bp.post("/logout")
@require_roles()
def logout():
    log_action(request, g.user.id, "LOGOUT", "User", g.user.id)
    db.session.commit()
    resp = jsonify({"ok": True})
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp


@bp.get("/me")
@require_roles()
def me():
    return jsonify(g.user.public_dict())


@bp.post("/forgot-password")
@limiter.limit("10 per 15 minutes")
def forgot_password():
    # No email provider is configured in this demo project, so no reset email
    # is actually sent. The response is identical whether or not the account
    # exists, to avoid confirming which emails are registered.
    return jsonify({
        "message": "If that account exists, password reset instructions will be "
                   "sent once an email provider is configured."
    })


@bp.put("/me")
@require_roles()
def update_profile():
    body = request.get_json(silent=True) or {}
    for field, attr in (("fullName", "full_name"), ("phone", "phone"),
                        ("county", "county"), ("location", "location")):
        if field in body:
            value = str(body[field]).strip()
            setattr(g.user, attr, value or None)
    db.session.commit()
    return jsonify(g.user.public_dict())
