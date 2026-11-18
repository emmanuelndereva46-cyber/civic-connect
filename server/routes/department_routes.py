from flask import Blueprint, g, jsonify, request

from auth import require_roles
from extensions import db
from models import Category, Department, Role
from utils import log_action

bp = Blueprint("departments", __name__, url_prefix="/api")


@bp.get("/departments")
def list_departments():
    rows = Department.query.filter_by(is_active=True).order_by(Department.name).all()
    return jsonify([d.public_dict() for d in rows])


@bp.post("/departments")
@require_roles(Role.ADMIN)
def create_department():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    if not (2 <= len(name) <= 120):
        return jsonify({"error": "Name must be 2-120 characters."}), 400
    if Department.query.filter_by(name=name).first():
        return jsonify({"error": "Department already exists"}), 409
    dept = Department(name=name, description=body.get("description"),
                      contact_email=body.get("contactEmail"), contact_phone=body.get("contactPhone"))
    db.session.add(dept)
    db.session.flush()
    log_action(request, g.user.id, "DEPARTMENT_CREATED", "Department", dept.id, dept.name)
    db.session.commit()
    return jsonify(dept.public_dict()), 201


@bp.put("/departments/<int:dept_id>")
@require_roles(Role.ADMIN)
def update_department(dept_id):
    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Not found"}), 404
    body = request.get_json(silent=True) or {}
    if "name" in body:
        name = str(body["name"]).strip()
        if not (2 <= len(name) <= 120):
            return jsonify({"error": "Name must be 2-120 characters."}), 400
        dept.name = name
    if "description" in body:
        dept.description = body["description"]
    if "contactEmail" in body:
        dept.contact_email = body["contactEmail"] or None
    if "contactPhone" in body:
        dept.contact_phone = body["contactPhone"] or None
    if "status" in body:
        dept.status = body["status"]
    log_action(request, g.user.id, "DEPARTMENT_UPDATED", "Department", dept.id)
    db.session.commit()
    return jsonify(dept.public_dict())


@bp.get("/categories")
def list_categories():
    rows = Category.query.filter_by(is_active=True).order_by(Category.name).all()
    return jsonify([c.public_dict() for c in rows])


@bp.post("/categories")
@require_roles(Role.ADMIN)
def create_category():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    department_id = body.get("departmentId")
    if not (2 <= len(name) <= 100):
        return jsonify({"error": "Name must be 2-100 characters."}), 400
    if department_id is not None and (not isinstance(department_id, int) or not Department.query.get(department_id)):
        return jsonify({"error": "Unknown department"}), 400
    if Category.query.filter_by(name=name).first():
        return jsonify({"error": "Category already exists"}), 409
    category = Category(name=name, description=body.get("description"), department_id=department_id)
    db.session.add(category)
    db.session.flush()
    log_action(request, g.user.id, "CATEGORY_CHANGED", "Category", category.id, name)
    db.session.commit()
    return jsonify(category.public_dict()), 201


@bp.put("/categories/<int:cat_id>")
@require_roles(Role.ADMIN)
def update_category(cat_id):
    category = Category.query.get(cat_id)
    if not category:
        return jsonify({"error": "Not found"}), 404
    body = request.get_json(silent=True) or {}
    if "departmentId" in body:
        department_id = body["departmentId"]
        if department_id is not None and not Department.query.get(department_id):
            return jsonify({"error": "Unknown department"}), 400
        category.department_id = department_id
    if "name" in body:
        name = str(body["name"]).strip()
        if not (2 <= len(name) <= 100):
            return jsonify({"error": "Name must be 2-100 characters."}), 400
        category.name = name
    if "description" in body:
        category.description = body["description"]
    if "isActive" in body:
        category.is_active = bool(body["isActive"])
    log_action(request, g.user.id, "CATEGORY_CHANGED", "Category", category.id, "category updated")
    db.session.commit()
    return jsonify(category.public_dict())
