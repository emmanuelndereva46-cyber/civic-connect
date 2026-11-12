from datetime import datetime

from flask import Blueprint, g, jsonify, request

from auth import require_roles
from extensions import db
from models import Category, Report, ReportStatus, ReportUpdate, Role, User
from utils import log_action, make_reference, notify

bp = Blueprint("reports", __name__, url_prefix="/api")

VALID_STATUSES = {s.value for s in ReportStatus}
VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "URGENT"}


def _scope_filter(user):
    """Citizens see only their own reports; officers only their department's;
    admins see everything. Returns None when no extra filter is needed."""
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
    category_id = body.get("categoryId")
    priority = body.get("priority", "MEDIUM")

    errors = {}
    if not (3 <= len(title) <= 150):
        errors["title"] = "Title must be 3-150 characters."
    if not (10 <= len(description) <= 5000):
        errors["description"] = "Description must be 10-5000 characters."
    if not isinstance(category_id, int):
        errors["categoryId"] = "Select a category."
    if priority not in VALID_PRIORITIES:
        errors["priority"] = "Invalid priority."
    if errors:
        return jsonify({"error": "Invalid input", "details": errors}), 400

    category = Category.query.get(category_id)
    if not category:
        return jsonify({"error": "Unknown category"}), 400

    # Database-driven automatic routing: category determines department.
    report = Report(
        citizen_id=g.user.id, category_id=category.id, department_id=category.department_id,
        title=title, description=description, priority=priority,
        county=body.get("county") or None, sub_county=body.get("subCounty") or None,
        ward=body.get("ward") or None, location=body.get("location") or None,
        latitude=body.get("latitude"), longitude=body.get("longitude"),
    )
    db.session.add(report)
    db.session.flush()
    report.reference_number = make_reference("CC", report.id)

    notify(g.user.id, "Report submitted", f"Your report {report.reference_number} was received.",
           "REPORT_SUBMITTED", report_id=report.id)
    log_action(request, g.user.id, "REPORT_SUBMITTED", "Report", report.id, report.reference_number)
    db.session.commit()

    return jsonify({
        "id": report.id, "referenceNumber": report.reference_number,
        "department": category.department.name, "status": report.status.value,
    }), 201


@bp.get("/reports")
@require_roles()
def list_reports():
    q = (request.args.get("q") or "").strip()[:100]
    status = request.args.get("status")
    query = _scoped_query(g.user)
    if status and status in VALID_STATUSES:
        query = query.filter(Report.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(
            Report.reference_number.ilike(like), Report.title.ilike(like),
            Report.location.ilike(like),
        ))
    rows = query.order_by(Report.submitted_at.desc()).limit(100).all()
    include_citizen = g.user.role != Role.CITIZEN
    return jsonify([r.public_dict(include_citizen=include_citizen) for r in rows])


@bp.get("/reports/<int:report_id>")
@require_roles()
def get_report(report_id):
    report = _scoped_get(g.user, report_id)
    if not report:
        # 404 rather than 403 so citizens can't confirm another citizen's report ID exists.
        return jsonify({"error": "Not found"}), 404
    return jsonify(report.public_dict(include_citizen=g.user.role != Role.CITIZEN))


@bp.get("/track/report/<ref>")
def track_report(ref):
    report = Report.query.filter_by(reference_number=ref).first()
    if not report:
        return jsonify({"error": "Not found"}), 404
    # Public endpoint: no citizen-identifying information is included.
    return jsonify({
        "referenceNumber": report.reference_number,
        "status": report.status.value,
        "department": report.department.name if report.department else None,
        "submittedAt": report.submitted_at.isoformat() if report.submitted_at else None,
        "resolvedAt": report.resolved_at.isoformat() if report.resolved_at else None,
        "updates": [
            {"status": u.status.value if u.status else None, "comment": u.comment,
             "createdAt": u.created_at.isoformat() if u.created_at else None}
            for u in report.updates
        ],
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
    if status == ReportStatus.CLOSED.value:
        report.closed_at = datetime.utcnow()

    db.session.add(ReportUpdate(
        report_id=report.id, user_id=g.user.id, status=status,
        comment=body.get("comment") or None, action_taken=body.get("actionTaken") or None,
    ))
    notify(report.citizen_id, "Report status changed",
           f"{report.reference_number} is now {status.replace('_', ' ').title()}.",
           "REPORT_STATUS", report_id=report.id)
    log_action(request, g.user.id, "REPORT_STATUS_CHANGED", "Report", report.id, status)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/reports/<int:report_id>/updates")
@require_roles(Role.OFFICER, Role.ADMIN)
def add_update(report_id):
    body = request.get_json(silent=True) or {}
    comment = str(body.get("comment", "")).strip()
    if not (1 <= len(comment) <= 2000):
        return jsonify({"error": "Comment must be 1-2000 characters."}), 400

    report = _scoped_get(g.user, report_id)
    if not report:
        return jsonify({"error": "Not found"}), 404

    db.session.add(ReportUpdate(
        report_id=report.id, user_id=g.user.id, comment=comment,
        action_taken=body.get("actionTaken") or None,
    ))
    notify(report.citizen_id, "New comment on your report", report.reference_number, "REPORT_COMMENT",
           report_id=report.id)
    db.session.commit()
    return jsonify({"ok": True}), 201


@bp.put("/reports/<int:report_id>/assign")
@require_roles(Role.ADMIN)
def assign_report(report_id):
    body = request.get_json(silent=True) or {}
    officer_id = body.get("officerId")
    report = Report.query.get(report_id)
    if not report:
        return jsonify({"error": "Not found"}), 404
    officer = User.query.filter_by(id=officer_id, role=Role.OFFICER).first()
    if not officer:
        return jsonify({"error": "Unknown officer"}), 400
    report.assigned_officer_id = officer.id
    if report.status == ReportStatus.SUBMITTED:
        report.status = ReportStatus.ASSIGNED
    log_action(request, g.user.id, "REPORT_ASSIGNED", "Report", report.id, f"officer={officer.id}")
    db.session.commit()
    return jsonify({"ok": True})
