from datetime import datetime

from flask import Blueprint, g, jsonify, request

from auth import require_roles
from extensions import db
from models import PgStatus, PgType, PigeonholeCategory, PigeonholeSubmission, PigeonholeUpdate, Role, User
from utils import log_action, make_reference, notify

bp = Blueprint("pigeonhole", __name__, url_prefix="/api")
VALID_TYPES = {item.value for item in PgType}
VALID_STATUSES = {item.value for item in PgStatus}


def _current_user():
    from auth import _load_user_from_cookie
    return _load_user_from_cookie()


def _scope_query(user):
    query = PigeonholeSubmission.query
    # The live schema has no department or assigned-officer columns for
    # pigeonhole submissions. Admins and authorized officers share this queue;
    # citizens can only see their own non-anonymous submissions.
    if user.role == Role.CITIZEN:
        query = query.filter(PigeonholeSubmission.user_id == user.id)
    return query


@bp.post("/pigeonhole")
def submit_pigeonhole():
    body = request.get_json(silent=True) or {}
    submission_type = body.get("submissionType")
    subject = str(body.get("subject", "")).strip()
    message = str(body.get("message", "")).strip()
    anonymous = bool(body.get("anonymous"))
    consent = bool(body.get("consent"))
    errors = {}
    if submission_type not in VALID_TYPES:
        errors["submissionType"] = "Select a valid submission type."
    if not (3 <= len(subject) <= 200):
        errors["subject"] = "Subject must be 3-200 characters."
    if not (10 <= len(message) <= 5000):
        errors["message"] = "Message must be 10-5000 characters."
    if not consent:
        errors["consent"] = "You must acknowledge the privacy notice."
    if errors:
        return jsonify({"error": "Invalid input", "details": errors}), 400

    user = _current_user()
    if not anonymous and not user:
        return jsonify({"error": "Log in to submit with your account, or choose anonymous submission."}), 401

    # category_id is mandatory in TiDB. Ensure the category matching the
    # submission type exists, creating that enum-backed category if necessary.
    category = PigeonholeCategory.query.filter_by(name=PgType(submission_type)).first()
    if not category:
        category = PigeonholeCategory(name=PgType(submission_type),
                                      description=f"Default category for {submission_type.lower()}.")
        db.session.add(category)
        db.session.flush()

    submission = PigeonholeSubmission(
        reference_number=make_reference("PG"),
        submission_type=PgType(submission_type),
        subject=subject,
        message=message,
        anonymous_submission=anonymous,
        user_id=None if anonymous else user.id,
        category_id=category.id,
    )
    db.session.add(submission)
    db.session.flush()
    if submission.user_id:
        notify(submission.user_id, "Feedback received",
               f"Your submission {submission.reference_number} was received.")
    log_action(request, user.id if user else None, "PIGEONHOLE_SUBMITTED",
               "Pigeonhole", submission.id, submission.reference_number)
    db.session.commit()
    return jsonify({"referenceNumber": submission.reference_number}), 201


@bp.get("/track/pigeonhole")
def track_pigeonhole():
    # The deployed schema has no access-code hash column. The reference is
    # therefore used as a tracking key; this endpoint exposes only status and
    # the public response, never the submitter's identity or private notes.
    ref = request.args.get("ref", "").strip()
    submission = PigeonholeSubmission.query.filter_by(reference_number=ref).first()
    if not submission:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"referenceNumber": submission.reference_number,
                    "status": submission.status.value,
                    "response": submission.response,
                    "respondedAt": None})


@bp.get("/pigeonhole")
@require_roles()
def list_pigeonhole():
    rows = _scope_query(g.user).order_by(PigeonholeSubmission.created_at.desc()).limit(100).all()
    return jsonify([row.public_dict(reveal_identity=g.user.role == Role.ADMIN,
                                    citizen_view=g.user.role == Role.CITIZEN) for row in rows])


@bp.get("/pigeonhole/<int:pg_id>")
@require_roles()
def get_pigeonhole(pg_id):
    submission = _scope_query(g.user).filter_by(id=pg_id).first()
    if not submission:
        return jsonify({"error": "Not found"}), 404
    return jsonify(submission.public_dict(reveal_identity=g.user.role == Role.ADMIN,
                                          citizen_view=g.user.role == Role.CITIZEN))


@bp.put("/pigeonhole/<int:pg_id>/status")
@require_roles(Role.OFFICER, Role.ADMIN)
def update_pg_status(pg_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in VALID_STATUSES:
        return jsonify({"error": "Invalid status"}), 400
    submission = PigeonholeSubmission.query.get(pg_id)
    if not submission:
        return jsonify({"error": "Not found"}), 404
    submission.status = PgStatus(status)
    if status == PgStatus.CLOSED.value:
        submission.closed_at = datetime.utcnow()
    comment = str(body.get("comment") or f"Status changed to {status.replace('_', ' ').lower()}.").strip()
    db.session.add(PigeonholeUpdate(submission_id=submission.id, user_id=g.user.id,
                                    status=PgStatus(status), comment=comment))
    if submission.user_id:
        notify(submission.user_id, "Submission status changed",
               f"{submission.reference_number} is now {status.replace('_', ' ').title()}.")
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
    submission = PigeonholeSubmission.query.get(pg_id)
    if not submission:
        return jsonify({"error": "Not found"}), 404
    submission.response = response_text
    submission.status = PgStatus.RESPONSE_PROVIDED
    db.session.add(PigeonholeUpdate(
        submission_id=submission.id, user_id=g.user.id,
        status=PgStatus.RESPONSE_PROVIDED, comment=response_text))
    if submission.user_id:
        notify(submission.user_id, "Response provided",
               f"A response is available for {submission.reference_number}.")
    log_action(request, g.user.id, "PIGEONHOLE_RESPONSE_CREATED", "Pigeonhole", submission.id)
    db.session.commit()
    return jsonify({"ok": True})


@bp.put("/pigeonhole/<int:pg_id>/assign")
@require_roles(Role.ADMIN)
def assign_pigeonhole(pg_id):
    # Assignment is not representable in the existing TiDB schema.
    if not PigeonholeSubmission.query.get(pg_id):
        return jsonify({"error": "Not found"}), 404
    return jsonify({"error": "Pigeonhole assignment is not supported by the current database schema."}), 409
