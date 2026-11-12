import secrets

from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from auth import require_roles
from extensions import db
from models import (AccountStatus, AuditLog, Category, Notification,
                     PigeonholeSubmission, Report, Role, User)
from utils import is_valid_email, log_action

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@bp.get("/stats")
@require_roles(Role.ADMIN)
def stats():
    # Every figure below comes from a live database query - nothing here is hard-coded.
    def counts_by(model, column):
        rows = db.session.query(column, db.func.count(model.id)).group_by(column).all()
        return [{"key": (k.value if hasattr(k, "value") else k), "count": c} for k, c in rows]

    reports_by_category = (
        db.session.query(Category.name, db.func.count(Report.id))
        .join(Report, Report.category_id == Category.id)
        .group_by(Category.name).all()
    )

    return jsonify({
        "totalUsers": User.query.count(),
        "totalCitizens": User.query.filter_by(role=Role.CITIZEN).count(),
        "totalOfficers": User.query.filter_by(role=Role.OFFICER).count(),
        "totalReports": Report.query.count(),
        "reportsByStatus": counts_by(Report, Report.status),
        "reportsByCategory": [{"key": name, "count": c} for name, c in reports_by_category],
        "reportsByDepartment": counts_by(Report, Report.department_id),
        "totalPigeonhole": PigeonholeSubmission.query.count(),
        "pigeonholeByStatus": counts_by(PigeonholeSubmission, PigeonholeSubmission.status),
        "pigeonholeByType": counts_by(PigeonholeSubmission, PigeonholeSubmission.submission_type),
        "pigeonholeAnonymous": PigeonholeSubmission.query.filter_by(anonymous_submission=True).count(),
    })


@bp.get("/audit-logs")
@require_roles(Role.ADMIN)
def audit_logs():
    rows = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return jsonify([a.public_dict() for a in rows])


@bp.get("/users")
@require_roles(Role.ADMIN)
def list_users():
    q = (request.args.get("search") or "").strip()[:100]
    role = request.args.get("role")
    query = User.query
    if role in {r.value for r in Role}:
        query = query.filter(User.role == role)
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(User.full_name.ilike(like), User.email.ilike(like)))
    rows = query.order_by(User.created_at.desc()).limit(200).all()
    return jsonify([u.public_dict() for u in rows])


@bp.post("/users")
@require_roles(Role.ADMIN)
def create_user():
    """Administrators create officer (or admin) accounts here. Citizens can
    only ever create their own CITIZEN account through /api/auth/register,
    so there is no path for a citizen to elevate their own privileges."""
    body = request.get_json(silent=True) or {}
    full_name = str(body.get("fullName", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    role = body.get("role")
    department_id = body.get("departmentId")

    if not (2 <= len(full_name) <= 100) or not is_valid_email(email):
        return jsonify({"error": "Provide a valid name and email."}), 400
    if role not in ("OFFICER", "ADMIN"):
        return jsonify({"error": "role must be OFFICER or ADMIN"}), 400
    if role == "OFFICER" and not department_id:
        return jsonify({"error": "Officers must be assigned a department."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    temp_password = secrets.token_urlsafe(9)
    user = User(full_name=full_name, email=email, role=role, department_id=department_id,
                password_hash=generate_password_hash(temp_password))
    db.session.add(user)
    db.session.flush()
    log_action(request, g.user.id, "USER_CREATED", "User", user.id, role)
    db.session.commit()
    # Returned once so the admin can hand it to the new officer; no email
    # provider is configured to deliver it automatically in this demo.
    return jsonify({**user.public_dict(), "temporaryPassword": temp_password}), 201


@bp.put("/users/<int:user_id>/status")
@require_roles(Role.ADMIN)
def set_user_status(user_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in {s.value for s in AccountStatus}:
        return jsonify({"error": "Invalid status"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    user.status = status
    log_action(request, g.user.id, "USER_STATUS_CHANGED", "User", user.id, status)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/officers")
@require_roles(Role.ADMIN)
def list_officers():
    """For assignment dropdowns."""
    rows = User.query.filter_by(role=Role.OFFICER, status=AccountStatus.ACTIVE).all()
    return jsonify([{"id": u.id, "fullName": u.full_name, "departmentId": u.department_id} for u in rows])
