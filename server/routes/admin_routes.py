import secrets

from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from auth import require_roles
from extensions import db
from models import AccountStatus, AuditLog, Category, PigeonholeSubmission, Report, Role, User
from utils import is_valid_email, log_action

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _api_role(value):
    return {"GOVERNMENT_OFFICER": "OFFICER", "SYSTEM_ADMINISTRATOR": "ADMIN"}.get(
        value.value if hasattr(value, "value") else value,
        value.value if hasattr(value, "value") else value)


@bp.get("/stats")
@require_roles(Role.ADMIN)
def stats():
    def counts_by(model, column):
        rows = db.session.query(column, db.func.count(model.id)).group_by(column).all()
        return [{"key": (k.value if hasattr(k, "value") else k), "count": count} for k, count in rows]
    reports_by_category = (db.session.query(Category.name, db.func.count(Report.id))
                           .join(Report, Report.category_id == Category.id)
                           .group_by(Category.name).all())
    return jsonify({
        "totalUsers": User.query.count(),
        "totalCitizens": User.query.filter_by(role=Role.CITIZEN).count(),
        "totalOfficers": User.query.filter_by(role=Role.OFFICER).count(),
        "totalReports": Report.query.count(),
        "reportsByStatus": counts_by(Report, Report.status),
        "reportsByCategory": [{"key": name, "count": count} for name, count in reports_by_category],
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
    role_map = {"CITIZEN": Role.CITIZEN, "OFFICER": Role.OFFICER, "ADMIN": Role.ADMIN,
                "GOVERNMENT_OFFICER": Role.OFFICER, "SYSTEM_ADMINISTRATOR": Role.ADMIN}
    if role in role_map:
        query = query.filter(User.role == role_map[role])
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(User.full_name.ilike(like), User.email.ilike(like)))
    rows = query.order_by(User.created_at.desc()).limit(200).all()
    return jsonify([u.public_dict() for u in rows])


@bp.post("/users")
@require_roles(Role.ADMIN)
def create_user():
    body = request.get_json(silent=True) or {}
    full_name = str(body.get("fullName", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    requested_role = body.get("role")
    role_map = {"OFFICER": Role.OFFICER, "ADMIN": Role.ADMIN}
    department_id = body.get("departmentId")
    if not (2 <= len(full_name) <= 150) or not is_valid_email(email):
        return jsonify({"error": "Provide a valid name and email."}), 400
    if requested_role not in role_map:
        return jsonify({"error": "role must be OFFICER or ADMIN"}), 400
    if requested_role == "OFFICER" and not department_id:
        return jsonify({"error": "Officers must be assigned a department."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409
    temp_password = secrets.token_urlsafe(9)
    user = User(full_name=full_name, email=email, role=role_map[requested_role],
                department_id=department_id, password_hash=generate_password_hash(temp_password))
    db.session.add(user)
    db.session.flush()
    log_action(request, g.user.id, "USER_CREATED", "User", user.id, requested_role)
    db.session.commit()
    return jsonify({**user.public_dict(), "temporaryPassword": temp_password}), 201


@bp.put("/users/<int:user_id>/status")
@require_roles(Role.ADMIN)
def set_user_status(user_id):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in {s.value for s in AccountStatus}:
        return jsonify({"error": "Invalid status"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    user.status = AccountStatus(status)
    log_action(request, g.user.id, "USER_STATUS_CHANGED", "User", user.id, status)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/officers")
@require_roles(Role.ADMIN)
def list_officers():
    rows = User.query.filter_by(role=Role.OFFICER, status=AccountStatus.ACTIVE).all()
    return jsonify([{"id": u.id, "fullName": u.full_name, "departmentId": u.department_id} for u in rows])
