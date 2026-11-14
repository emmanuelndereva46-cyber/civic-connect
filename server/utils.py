import re
from datetime import datetime

from extensions import db
from models import AuditLog, Notification

EMAIL_RE = re.compile(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
STRONG_PASSWORD_RE = re.compile(r"^(?=.*[A-Z])(?=.*[0-9]).{8,}$")


def is_valid_email(value: str) -> bool:
    return bool(value) and bool(EMAIL_RE.match(value)) and len(value) <= 191


def is_strong_password(value: str) -> bool:
    return bool(value) and bool(STRONG_PASSWORD_RE.match(value))


def make_reference(prefix: str, record_id: int) -> str:
    return f"{prefix}-{datetime.utcnow().year}-{record_id:06d}"


def client_ip(req) -> str | None:
    return req.remote_addr


def log_action(req, user_id, action, entity_type, entity_id=None, description=None):
    entry = AuditLog(user_id=user_id, action=action, entity_type=entity_type,
                     entity_id=str(entity_id) if entity_id is not None else None,
                     description=description, ip_address=client_ip(req))
    db.session.add(entry)


def notify(user_id, title, message, type_=None, report_id=None, pigeonhole_id=None):
    # The current TiDB notifications table only supports report_id, not
    # pigeonhole_id or a notification type. Ignore those legacy API arguments.
    if not user_id:
        return
    db.session.add(Notification(user_id=user_id, title=title, message=message,
                                report_id=report_id))
