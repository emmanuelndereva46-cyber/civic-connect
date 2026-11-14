from datetime import datetime

from flask import Blueprint, g, jsonify, request

from auth import require_roles
from extensions import db
from models import Category, Report, ReportStatus, ReportUpdate, Role, User
from utils import log_action, make_reference, notify

bp = Blueprint("reports", __name__, url_prefix="/api")
VALID_STATUSES = {s.value for s in ReportStatus}


def _scope_filter(user):
    if user.role == Role.ADMIN:
        return None
    if user.role == Role.OFFICER:
        return Report.department_id == (user.department_id or -1)
    return Report.citizen_id == user.id


def _scoped_query(user):
    query = Report.query
    scope = _scope_filter(user)
    return query.filter(scope) if scope is not None else query


def _scoped_get(user, report_id):
    return _scoped_query(user).filter(Report.id == report_id).first()


@bp.post("/reports")
@require_roles(Role.CITIZEN)
def create_report():
    body = request.get_json(silent=True) or {}
    title = str(body.get("title", "")).strip()
    description = str(body.get("description", "")).strip()
    location = str(body.get("location", "")).strip()
    category_id = body.get("categoryId")
    errors = {}
    if not (3 <= len(title) <= 200):
        errors["title"] = "Title must be 3-200 characters."
    if not (10 <= len(description) <= 5000):
        errors["description"] = "Description must be 10-5000 characters."
    if not (1 <= len(location) <= 255):
        errors["location"] = "Provide a location (maximum 255 characters)."
    if not isinstance(category_id, int):
        errors["categoryId"] = "Select a category."
    if errors:
        return jsonify({"error": "Invalid input", "details": errors}), 400
    category = Category.query.filter_by(id=category_id, is_active=True).first()
    if not category:
        return jsonify({"error": "Unknown or inactive category"}), 400
    report = Report(reference_number=make_reference("CC"), citizen_id=g.user.id, category_id=category.id,
                    department_id=category.department_id, title=title,
                    description=description, location=location,
                    latitude=body.get("latitude"), longitude=body.get("longitude"))
    db.session.add(report)
    db.session.flush()
    notify(g.user.id, "Report submitted",
           f"Your report {report.reference_number} was received.", report_id=report.id)
    log_action(request, g.user.id, "REPORT_SUBMITTED", "Report", report.id, report.reference_number)
    db.session.commit()
    return jsonify({"id": report.id, "referenceNumber": report.reference_number,
                    "department": category.department.name if category.department else None,
                    "status": report.status.value}), 201


@bp.get("/reports")
@require_roles()
def list_reports():
    q = (request.args.get("q") or "").strip()[:100]
    status = request.args.get("status")
    query = _scoped_query(g.user)
    if status in VALID_STATUSES:
        query = query.filter(Report.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Report.reference_number.ilike(like),
                                    Report.title.ilike(like), Report.location.ilike(like)))
    rows = query.order_by(Report.created_at.desc()).limit(100).all()
    return jsonify([r.public_dict(include_citizen=g.user.role != Role.CITIZEN) for r in rows])


@bp.get("/reports/<int:report_id>")
@require_roles()
def get_report(report_id):
    report = _scoped_get(g.user, report_id)
    if not report:
        return jsonify({"error": "Not found"}), 404
    return jsonify(report.public_dict(include_citizen=g.user.role != Role.CITIZEN))


@bp.get("/track/report/<ref>")
def track_report(ref):
    report = Report.query.filter_by(reference_number=ref).first()
    if not report:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "referenceNumber": report.reference_number, "status": report.status.value,
        "department": report.department.name if report.department else None,
        "submittedAt": report.created_at.isoformat() if report.created_at else None,
        "resolvedAt": report.resolved_at.isoformat() if report.resolved_at else None,
        "updates": [{"status": u.status.value if u.status else None, "comment": u.comment,
                     "createdAt": u.created_at.isoformat() if u.created_at else None}
                    for u in report.updates if u.is_public],
    })


@bp.put("/reports/<int:report_id>/status")
@require_roles(Role.OFFICER, Role.ADMIN)
def update_status(report_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in VALID_STATUSES:
        return jsonify({"error": "Invalid status"}), 400
    report = _scoped_get(g.user, report_id)
    if not report:
        return jsonify({"error": "Not found"}), 404
    report.status = status
    if g.user.role == Role.OFFICER and not report.assigned_officer_id:
        report.assigned_officer_id = g.user.id
    if status == ReportStatus.RESOLVED.value:
        report.resolved_at = datetime.utcnow()
    comment = str(body.get("comment") or f"Status changed to {status.replace('_', ' ').lower()}.").strip()
    db.session.add(ReportUpdate(report_id=report.id, user_id=g.user.id,
                                status=status, comment=comment, is_public=True))
    notify(report.citizen_id, "Report status changed",
           f"{report.reference_number} is now {status.replace('_', ' ').title()}.",
           report_id=report.id)
    log_action(request, g.user.id, "REPORT_STATUS_CHANGED", "Report", report.id, status)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/reports/<int:report_id>/updates")
@require_roles(Role.OFFICER, Role.ADMIN)
def add_update(report_id):
    body = request.get_json(silent=True) or {}
    comment = str(body.get("comment", "")).strip()
    if not (1 <= len(comment) <= 5000):
        return jsonify({"error": "Comment must be 1-5000 characters."}), 400
    report = _scoped_get(g.user, report_id)
    if not report:
        return jsonify({"error": "Not found"}), 404
    db.session.add(ReportUpdate(report_id=report.id, user_id=g.user.id,
                                comment=comment, is_public=bool(body.get("isPublic", True))))
    if bool(body.get("isPublic", True)):
        notify(report.citizen_id, "New comment on your report", report.reference_number,
               report_id=report.id)
    db.session.commit()
    return jsonify({"ok": True}), 201


@bp.put("/reports/<int:report_id>/assign")
@require_roles(Role.ADMIN)
def assign_report(report_id):
    body = request.get_json(silent=True) or {}
    officer = User.query.filter_by(id=body.get("officerId"), role=Role.OFFICER,
                                   status="ACTIVE").first()
    report = Report.query.get(report_id)
    if not report:
        return jsonify({"error": "Not found"}), 404
    if not officer:
        return jsonify({"error": "Unknown or inactive officer"}), 400
    if report.department_id and officer.department_id != report.department_id:
        return jsonify({"error": "Officer must belong to the report department."}), 400
    report.assigned_officer_id = officer.id
    if report.status == ReportStatus.SUBMITTED:
        report.status = ReportStatus.ASSIGNED
    log_action(request, g.user.id, "REPORT_ASSIGNED", "Report", report.id, f"officer={officer.id}")
    db.session.commit()
    return jsonify({"ok": True})
