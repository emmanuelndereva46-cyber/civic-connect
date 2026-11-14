from datetime import datetime

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
    return jsonify([item.public_dict() for item in rows])


@bp.put("/<int:note_id>/read")
@require_roles()
def mark_read(note_id):
    note = Notification.query.filter_by(id=note_id, user_id=g.user.id).first()
    if not note:
        return jsonify({"error": "Not found"}), 404
    if not note.is_read:
        note.is_read = True
        note.read_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True})


@bp.put("/read-all")
@require_roles()
def mark_all_read():
    rows = Notification.query.filter_by(user_id=g.user.id, is_read=False).all()
    now = datetime.utcnow()
    for note in rows:
        note.is_read = True
        note.read_at = now
    db.session.commit()
    return jsonify({"ok": True})
