import hashlib
import hmac
import secrets
from datetime import datetime

import jwt
from flask import Blueprint, current_app, g, jsonify, request

from auth import require_roles
from extensions import db
from models import (AccountStatus, PgStatus, PgType, PigeonholeSubmission,
                     PigeonholeUpdate, Role, User)
from utils import log_action, make_reference, notify

bp = Blueprint("pigeonhole", __name__, url_prefix="/api")

VALID_TYPES = {t.value for t in PgType}
VALID_STATUSES = {s.value for s in PgStatus}


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _current_user_id_optional():
    token = request.cookies.get("token")
    if not token:
        return None
    try:
        data = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    user = User.query.get(data.get("id"))
    return user.id if user and user.status == AccountStatus.ACTIVE else None


def _scope_filter(user):
    """Returns None when no extra filter is needed (admin sees everything)."""
    if user.role == Role.ADMIN:
        return None
    if user.role == Role.OFFICER:
        return PigeonholeSubmission.department_id == (user.department_id or -1)
    return PigeonholeSubmission.user_id == user.id


def _scoped_query(user):
    query = PigeonholeSubmission.query
    scope = _scope_filter(user)
    return query.filter(scope) if scope is not None else query


def _scoped_get(user, pg_id):
    return _scoped_query(user).filter(PigeonholeSubmission.id == pg_id).first()


@bp.post("/pigeonhole")
def submit_pigeonhole():
    """Public endpoint. Anonymous submissions never store a user_id."""
    body = request.get_json(silent=True) or {}
    submission_type = body.get("submissionType")
    subject = str(body.get("subject", "")).strip()
    message = str(body.get("message", "")).strip()
    department_id = body.get("departmentId")  # None / "not sure" -> general review queue
    anonymous = bool(body.get("anonymous"))
    consent = bool(body.get("consent"))

    errors = {}
    if submission_type not in VALID_TYPES:
        errors["submissionType"] = "Select a valid submission type."
    if not (3 <= len(subject) <= 150):
        errors["subject"] = "Subject must be 3-150 characters."
    if not (10 <= len(message) <= 5000):
        errors["message"] = "Message must be 10-5000 characters."
    if not consent:
        errors["consent"] = "You must acknowledge the privacy notice."
    if errors:
        return jsonify({"error": "Invalid input", "details": errors}), 400

    user_id = None
    if not anonymous:
        user_id = _current_user_id_optional()
        if not user_id:
            return jsonify({"error": "Log in to include your contact details, or submit anonymously"}), 401

    access_code = secrets.token_hex(6) if anonymous else None
    submission = PigeonholeSubmission(
        user_id=user_id, submission_type=submission_type, subject=subject, message=message,
        department_id=department_id, anonymous_submission=anonymous,
        access_code_hash=_hash_code(access_code) if access_code else None,
    )
    db.session.add(submission)
    db.session.flush()
    submission.reference_number = make_reference("PG", submission.id)

    notify(user_id, "Feedback received", f"Your submission {submission.reference_number} was received.",
           "PG_RECEIVED", pigeonhole_id=submission.id)
    # The IP address below is retained for audit purposes even for anonymous
    # submissions; document this in the privacy policy rather than claiming
    # complete anonymity.
    log_action(request, user_id, "PIGEONHOLE_SUBMITTED", "Pigeonhole", submission.id)
    db.session.commit()

    resp = {"referenceNumber": submission.reference_number}
    if access_code:
        resp["accessCode"] = access_code  # shown once; store this to check status later
    return jsonify(resp), 201


@bp.get("/track/pigeonhole")
def track_pigeonhole():
    ref = request.args.get("ref", "")
    code = request.args.get("code", "")
    submission = PigeonholeSubmission.query.filter_by(reference_number=ref).first()
    valid = (submission and submission.access_code_hash
             and hmac.compare_digest(submission.access_code_hash, _hash_code(code)))
    if not valid:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "referenceNumber": submission.reference_number,
        "status": submission.status.value,
        "response": submission.response,
        "respondedAt": submission.responded_at.isoformat() if submission.responded_at else None,
    })


@bp.get("/pigeonhole")
@require_roles()
def list_pigeonhole():
    rows = _scoped_query(g.user) \
        .order_by(PigeonholeSubmission.submitted_at.desc()).limit(100).all()
    # Officers never receive author identity, even for non-anonymous submissions,
    # unless the deployment's privacy policy is changed to explicitly allow it.
    reveal = g.user.role == Role.ADMIN
    citizen_view = g.user.role == Role.CITIZEN
    return jsonify([r.public_dict(reveal_identity=reveal, citizen_view=citizen_view) for r in rows])


@bp.get("/pigeonhole/<int:pg_id>")
@require_roles()
def get_pigeonhole(pg_id):
    submission = _scoped_get(g.user, pg_id)
    if not submission:
        return jsonify({"error": "Not found"}), 404
    reveal = g.user.role == Role.ADMIN
    citizen_view = g.user.role == Role.CITIZEN
    return jsonify(submission.public_dict(reveal_identity=reveal, citizen_view=citizen_view))


@bp.put("/pigeonhole/<int:pg_id>/status")
@require_roles(Role.OFFICER, Role.ADMIN)
def update_pg_status(pg_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in VALID_STATUSES:
        return jsonify({"error": "Invalid status"}), 400

    submission = _scoped_get(g.user, pg_id)
    if not submission:
        return jsonify({"error": "Not found"}), 404

    submission.status = status
    if status == PgStatus.CLOSED.value:
        submission.closed_at = datetime.utcnow()

    db.session.add(PigeonholeUpdate(
        pigeonhole_id=submission.id, user_id=g.user.id, status=status,
        comment=body.get("comment") or None,  # internal note, never shown to the citizen
    ))
    notify(submission.user_id, "Submission status changed",
           f"{submission.reference_number} is now {status.replace('_', ' ').title()}.",
           "PG_STATUS", pigeonhole_id=submission.id)
    log_action(request, g.user.id, "PIGEONHOLE_STATUS_CHANGED", "Pigeonhole", submission.id, status)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/pigeonhole/<int:pg_id>/response")
@require_roles(Role.OFFICER, Role.ADMIN)
def respond_pigeonhole(pg_id):
    body = request.get_json(silent=True) or {}
    response_text = str(body.get("response", "")).strip()
    if not (2 <= len(response_text) <= 5000):
        return jsonify({"error": "Response must be 2-5000 characters."}), 400

    submission = _scoped_get(g.user, pg_id)
    if not submission:
        return jsonify({"error": "Not found"}), 404

    submission.response = response_text
    submission.status = PgStatus.RESPONSE_PROVIDED
    submission.responded_at = datetime.utcnow()
    if not submission.assigned_officer_id and g.user.role == Role.OFFICER:
        submission.assigned_officer_id = g.user.id

    db.session.add(PigeonholeUpdate(
        pigeonhole_id=submission.id, user_id=g.user.id,
        status=PgStatus.RESPONSE_PROVIDED, response=response_text,
    ))
    # No-op for anonymous submissions since user_id is None.
    notify(submission.user_id, "Response provided",
           f"A response is available for {submission.reference_number}.",
           "PG_RESPONSE", pigeonhole_id=submission.id)
    log_action(request, g.user.id, "PIGEONHOLE_RESPONSE_CREATED", "Pigeonhole", submission.id)
    db.session.commit()
    return jsonify({"ok": True})


@bp.put("/pigeonhole/<int:pg_id>/assign")
@require_roles(Role.ADMIN)
def assign_pigeonhole(pg_id):
    body = request.get_json(silent=True) or {}
    officer_id = body.get("officerId")
    submission = PigeonholeSubmission.query.get(pg_id)
    if not submission:
        return jsonify({"error": "Not found"}), 404
    officer = User.query.filter_by(id=officer_id, role=Role.OFFICER).first()
    if not officer:
        return jsonify({"error": "Unknown officer"}), 400
    submission.assigned_officer_id = officer.id
    if submission.status == PgStatus.SUBMITTED:
        submission.status = PgStatus.ASSIGNED
    log_action(request, g.user.id, "PIGEONHOLE_ASSIGNED", "Pigeonhole", submission.id,
               f"officer={officer.id}")
    db.session.commit()
    return jsonify({"ok": True})
