import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
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
    # TiDB uses the MySQL protocol. Use the installed PyMySQL driver.
    if DATABASE_URL.startswith("mysql://"):
        DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)

    # TiDB connection examples may include sslaccept, which is not a
    # PyMySQL connection option. Replace it with PyMySQL's TLS verification
    # options while preserving the rest of the connection URL.
    parsed_url = urlsplit(DATABASE_URL)
    query_items = parse_qsl(parsed_url.query, keep_blank_values=True)
    if any(key.lower() == "sslaccept" for key, _ in query_items):
        query_items = [
            (key, value) for key, value in query_items
            if key.lower() != "sslaccept"
        ]
        existing_keys = {key.lower() for key, _ in query_items}
        if "ssl_verify_cert" not in existing_keys:
            query_items.append(("ssl_verify_cert", "true"))
        if "ssl_verify_identity" not in existing_keys:
            query_items.append(("ssl_verify_identity", "true"))
        DATABASE_URL = urlunsplit((
            parsed_url.scheme,
            parsed_url.netloc,
            parsed_url.path,
            urlencode(query_items),
            parsed_url.fragment,
        ))

    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = _require("JWT_SECRET")
    CLIENT_ORIGIN = os.environ.get("CLIENT_ORIGIN", "http://localhost:5173")
    JWT_EXPIRES_HOURS = 8
    ENV = os.environ.get("FLASK_ENV", "production")
