from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from models import AccountStatus, User

COOKIE_NAME = "token"


def issue_token(user_id: int) -> str:
    from datetime import datetime, timedelta, timezone
    payload = {
        "id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def _load_user_from_cookie():
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        data = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    user = User.query.get(data.get("id"))
    if not user or user.status != AccountStatus.ACTIVE:
        return None
    return user


def require_roles(*roles):
    """Use with no args to require any authenticated, active user."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _load_user_from_cookie()
            if not user:
                return jsonify({"error": "Not authenticated"}), 401
            if roles and user.role not in roles:
                return jsonify({"error": "Forbidden"}), 403
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def optional_user():
    """Attach g.user if a valid session cookie is present, else g.user = None."""
    g.user = _load_user_from_cookie()
