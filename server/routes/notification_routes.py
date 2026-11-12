from flask import Blueprint, g, jsonify

from auth import require_roles
from extensions import db
from models import Notification

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@bp.get("")
@require_roles()
def list_notifications():
    rows = Notification.query.filter_by(user_id=g.user.id) \
        .order_by(Notification.created_at.desc()).limit(50).all()
    return jsonify([n.public_dict() for n in rows])


@bp.put("/<int:note_id>/read")
@require_roles()
def mark_read(note_id):
    Notification.query.filter_by(id=note_id, user_id=g.user.id).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})


@bp.put("/read-all")
@require_roles()
def mark_all_read():
    Notification.query.filter_by(user_id=g.user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})
