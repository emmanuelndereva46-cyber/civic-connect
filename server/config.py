import os
from urllib.parse import (
    parse_qsl,
    quote,
    unquote,
    urlencode,
    urlsplit,
    urlunsplit,
)
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


def _normalise_database_url(value: str) -> str:
    # Vercel environment variables should not need quotes, but tolerate
    # accidental wrapping quotes or whitespace when they are pasted in.
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1].strip()

    if value.startswith("mysql://"):
        value = value.replace("mysql://", "mysql+pymysql://", 1)

    # Percent-encode username/password so reserved characters in a newly
    # generated TiDB password cannot make SQLAlchemy reject the URL.
    scheme, separator, remainder = value.partition("://")
    if not separator:
        raise RuntimeError(
            "DATABASE_URL must be a valid MySQL URL beginning with "
            "mysql:// or mysql+pymysql://."
        )

    credentials, at, host_and_path = remainder.rpartition("@")
    if not at or ":" not in credentials:
        raise RuntimeError(
            "DATABASE_URL must include a username and password before the host."
        )

    username, password = credentials.split(":", 1)
    encoded_credentials = (
        quote(unquote(username), safe="")
        + ":"
        + quote(unquote(password), safe="")
    )
    value = f"{scheme}://{encoded_credentials}@{host_and_path}"

    # TiDB Cloud Serverless public endpoints require TLS. PyMySQL accepts
    # these SQLAlchemy URL options and verifies both the certificate chain
    # and the server hostname. Force them on even if DATABASE_URL omitted
    # them or supplied weaker values.
    parsed_url = urlsplit(value)
    query_items = parse_qsl(parsed_url.query, keep_blank_values=True)
    query_items = [
        (key, item) for key, item in query_items
        if key.lower() not in ("sslaccept", "ssl_verify_cert", "ssl_verify_identity")
    ]
    query_items.extend([
        ("ssl_verify_cert", "true"),
        ("ssl_verify_identity", "true"),
    ])
    value = urlunsplit((
        parsed_url.scheme,
        parsed_url.netloc,
        parsed_url.path,
        urlencode(query_items),
        parsed_url.fragment,
    ))

    return value


class Config:
    DATABASE_URL = _normalise_database_url(_require("DATABASE_URL"))
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = _require("JWT_SECRET")
    CLIENT_ORIGIN = os.environ.get("CLIENT_ORIGIN", "http://localhost:5173")
    JWT_EXPIRES_HOURS = 8
    ENV = os.environ.get("FLASK_ENV", "production")
