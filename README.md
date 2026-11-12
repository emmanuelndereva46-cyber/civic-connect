# CivicConnect

Citizen Reporting, Pigeonhole & Government Service Response System — a diploma
system-development demo project. **Not an official government system.** All
seed data is demo/test data; no real citizen information is used.

## What's here

- `server/` — Python (Flask) REST API, MySQL via SQLAlchemy + Flask-Migrate
- `client/` — React (Vite, plain JavaScript) frontend, Tailwind CSS

This replaces the earlier Node.js/Express/Prisma backend from this project's
first draft with a Python/Flask backend, per your request. The database
design and API shape are the same; only the backend language changed.

## Features implemented

- Registration, login, logout, session cookie, role-based access control
- Citizen: multi-step report form, dashboard, report tracking, profile
- Pigeonhole: suggestions/complaints/feedback, anonymous mode with a
  one-time access code, department routing (or "not sure" → general queue)
- Officer: dashboard with Reports and Pigeonhole tabs, status updates,
  comments/responses, department-scoped access
- Admin: live stats and charts, user management (create/activate/deactivate),
  department & category (routing) management, audit log viewer
- Notifications, public report/Pigeonhole tracking, audit logging throughout

## Known limitations (be upfront about these in your write-up)

- **File uploads are not wired to storage.** The report and Pigeonhole forms
  preview images client-side only; nothing is persisted server-side yet. Add
  a `POST /api/reports/:id/attachments` (and Pigeonhole equivalent) endpoint
  that saves to disk or S3-compatible storage and writes to the
  `report_attachments` / `pigeonhole_attachments` tables.
- **No email provider is configured.** Password reset and account-creation
  emails are not actually sent; the API responds as if they might be, per
  the "don't confirm which emails exist" security practice, but nothing is
  delivered. Wire up an SMTP provider (e.g. Flask-Mail) to complete this.
- **No automated tests yet.** Section 37 of the original brief (auth,
  authorization, reports, Pigeonhole, security tests) is not implemented.
- **Cross-origin cookies:** the session cookie is `SameSite=Strict`, which
  works cleanly in local dev (the Vite proxy makes requests same-site) and
  in a production deployment where the frontend and API share a domain. If
  you deploy them on different domains, switch to `SameSite=None; Secure`
  over HTTPS instead.
- Officers never see the identity of anonymous Pigeonhole submissions; only
  administrators can see the author of non-anonymous ones (change this in
  `pigeonhole_routes.py` if your privacy policy calls for something else).
  Anonymous submissions still retain the submitter's IP address in the audit
  log — document this in your privacy policy rather than claiming complete
  anonymity.

## Prerequisites

- Python 3.11+ and `pip`
- Node.js 18+ and `npm`
- MySQL 8+ running locally

## 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE civicconnect CHARACTER SET utf8mb4;"
```

## 2. Backend setup

```bash
cd server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then edit DATABASE_URL and JWT_SECRET
flask --app app:create_app db init
flask --app app:create_app db migrate -m "init"
flask --app app:create_app db upgrade
python seed.py
python app.py                    # API on http://localhost:4000
```

If `flask db init` complains that migrations already exist, skip it and go
straight to `migrate`/`upgrade`.

## 3. Frontend setup

```bash
cd client
npm install
npm run dev                      # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so open only
`http://localhost:5173` in your browser.

## Demo accounts

Password for all three: `Demo@12345`

| Role  | Email |
|-------|-------|
| Admin | admin@demo.civicconnect.test |
| Officer (Roads & Transport) | officer@demo.civicconnect.test |
| Citizen | citizen@demo.civicconnect.test |

## API overview

All endpoints are under `/api`. Session auth uses an httpOnly cookie set on
login; there is no bearer token to attach manually.

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/me
POST   /api/auth/forgot-password

POST   /api/reports                     (citizen)
GET    /api/reports                     (scoped by role)
GET    /api/reports/:id
PUT    /api/reports/:id/status          (officer/admin)
POST   /api/reports/:id/updates         (officer/admin)
PUT    /api/reports/:id/assign          (admin)
GET    /api/track/report/:ref           (public)

POST   /api/pigeonhole                  (public; anonymous or logged-in)
GET    /api/pigeonhole                  (scoped by role)
GET    /api/pigeonhole/:id
PUT    /api/pigeonhole/:id/status       (officer/admin)
POST   /api/pigeonhole/:id/response     (officer/admin)
PUT    /api/pigeonhole/:id/assign       (admin)
GET    /api/track/pigeonhole?ref=&code= (public, anonymous submissions)

GET    /api/departments
POST   /api/departments                 (admin)
PUT    /api/departments/:id             (admin)
GET    /api/categories
POST   /api/categories                  (admin — sets routing)
PUT    /api/categories/:id              (admin)

GET    /api/notifications
PUT    /api/notifications/:id/read
PUT    /api/notifications/read-all

GET    /api/admin/stats                 (admin)
GET    /api/admin/audit-logs            (admin)
GET    /api/admin/users                 (admin)
POST   /api/admin/users                 (admin — create officer/admin)
PUT    /api/admin/users/:id/status      (admin)
GET    /api/admin/officers              (admin)
```

## Security notes

Password hashing via Werkzeug's PBKDF2-SHA256; httpOnly session cookie;
SQLAlchemy ORM (no raw SQL string interpolation); server-side validation on
every write endpoint; role- and department-scoped queries so a citizen or
officer can't read another party's records by guessing an ID (a foreign ID
returns 404, not 403, so it can't be used to confirm existence); rate
limiting on auth endpoints; audit log on all key actions; security response
headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).

## Testing (not yet implemented)

Recommended next step: add `pytest` with `pytest-flask`, an in-memory or
disposable test database, and cover at minimum: registration/login,
cross-role access denial, cross-citizen report access denial, report and
Pigeonhole submission + routing, status transitions, and anonymous
Pigeonhole tracking.

## Deployment

This is set up for local demonstration. For a real deployment: run the
Flask app under `gunicorn -w 4 -b 0.0.0.0:4000 wsgi:app`, build the frontend
with `npm run build` and serve `client/dist` from a static host or the same
reverse proxy as the API (so cookies stay same-site), use a managed MySQL
instance, and set real secrets via environment variables — never commit
`.env`.
