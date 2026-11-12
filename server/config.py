import os
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            "Copy .env.example to .env and fill it in."
        )
    return value


class Config:
    DATABASE_URL = _require("DATABASE_URL")
    # TiDB uses the MySQL protocol. Force SQLAlchemy to use the
    # PyMySQL driver installed in requirements.txt, not MySQLdb.
    if DATABASE_URL.startswith("mysql://"):
        DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = _require("JWT_SECRET")
    CLIENT_ORIGIN = os.environ.get("CLIENT_ORIGIN", "http://localhost:5173")
    JWT_EXPIRES_HOURS = 8
    ENV = os.environ.get("FLASK_ENV", "production")
