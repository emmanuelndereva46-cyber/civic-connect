import logging

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from extensions import db, limiter, migrate


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, supports_credentials=True, origins=[app.config["CLIENT_ORIGIN"]])

    from routes.auth_routes import bp as auth_bp
    from routes.report_routes import bp as report_bp
    from routes.pigeonhole_routes import bp as pigeonhole_bp
    from routes.department_routes import bp as department_bp
    from routes.notification_routes import bp as notification_bp
    from routes.admin_routes import bp as admin_bp

    for bp in (auth_bp, report_bp, pigeonhole_bp, department_bp, notification_bp, admin_bp):
        app.register_blueprint(bp)

    @app.after_request
    def set_security_headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return resp

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(429)
    def rate_limited(_e):
        return jsonify({"error": "Too many requests, please try again shortly"}), 429

    @app.errorhandler(Exception)
    def handle_error(e):
        code = getattr(e, "code", 500)
        if code == 500:
            logging.exception(e)
            db.session.rollback()
            return jsonify({"error": "Internal server error"}), 500
        return jsonify({"error": getattr(e, "description", "Request error")}), code

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


if __name__ == "__main__":
    import os
    application = create_app()
    application.run(port=int(os.environ.get("PORT", 4000)), debug=Config.ENV != "production")
