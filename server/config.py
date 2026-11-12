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
    SQLALCHEMY_DATABASE_URI = _require("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = _require("JWT_SECRET")
    CLIENT_ORIGIN = os.environ.get("CLIENT_ORIGIN", "http://localhost:5173")
    JWT_EXPIRES_HOURS = 8
    ENV = os.environ.get("FLASK_ENV", "production")
