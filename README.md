# CivicConnect

CivicConnect is a citizen-reporting, Pigeonhole feedback and government-service
response demo application. It is an academic demonstration, **not an official
government service**. Use test accounts and test data only.

## Architecture

- **Frontend:** React, Vite, JavaScript and Tailwind CSS.
- **Backend:** Node.js, Express 5 and TypeScript.
- **ORM:** Prisma 7 with the MariaDB adapter.
- **Database:** existing TiDB Cloud MySQL-compatible database.
- **Hosting:** Vercel Services for the frontend and backend.
- **Authentication:** signed JWT held in an HttpOnly, Secure, SameSite=Lax cookie.

The deployed application uses a same-origin `/api` path. The Vite development
server proxies `/api` to the local Express server.

## Features

### Citizen
- Register and sign in as a citizen.
- Submit reports with category and location.
- View own reports and public status updates.
- Track reports using a high-entropy reference number.
- Submit suggestions, complaints, feedback, concerns and compliments through
  Pigeonhole, anonymously or with an account.
- Track a Pigeonhole submission using its private high-entropy reference.
- View and mark notifications as read.
- Update name, phone number and password.

### Officer
- View reports routed to the officer's department.
- Update report status and add public remarks.
- Review the shared Pigeonhole queue.
- Update Pigeonhole status and send a response.
- View personal notifications.

### Administrator
- View aggregate statistics and charts.
- Create officer and administrator accounts.
- Activate and deactivate accounts, with safeguards against disabling the
  last active administrator.
- Create departments and report categories and route categories to departments.
- Review audit logs.

## Existing TiDB schema constraints

The application is deliberately aligned to the existing TiDB schema. It does
not automatically run migrations against the live database.

- The database has 12 application tables (plus Prisma's migration metadata
  table). The current Pigeonhole schema has no department or assigned-officer
  columns, so officers share one review queue.
- There is no separate Pigeonhole access-code hash column. A 104-bit random
  reference number is used as the private tracking credential. Keep it secret.
- Report priority and date-observed fields are not persisted.
- County and residential-address profile fields are not persisted.
- Anonymous Pigeonhole submissions do not store a submitter ID, but security
  audit metadata such as the request IP may still be recorded. Do not describe
  this as complete anonymity.

Do not run `prisma migrate deploy`, `prisma db push`, or destructive schema
commands against the existing TiDB database without a reviewed migration plan
and backup. The Vercel build only generates the Prisma client.

## Known functionality gaps

- **Evidence uploads are not yet persisted.** The report form currently
  previews selected images in the browser only. No file is uploaded or saved
  in the `report_attachments` table.
- **Password-reset email is unavailable.** No email delivery provider is
  configured. The API explicitly returns a service-unavailable response rather
  than claiming that a reset email was sent. Users can change their password
  after signing in.
- **Initial administrator setup is a one-time manual step.** Set
  `ADMIN_BOOTSTRAP_TOKEN` in the Vercel environment, call
  `POST /api/admin/bootstrap` with a bearer token and an administrator
  password of at least 12 characters, then remove the environment variable.
  Bootstrap refuses to run if an administrator already exists.
- Departments and report categories must be created by the administrator
  before citizens can submit reports.
- Automated end-to-end tests with disposable users and a test database still
  need to be completed. CI checks linting and production builds.

## Local development

Requirements: Node.js 22+ and npm.

1. Install the backend dependencies:

   ```bash
   cd server
   npm ci
   ```

2. Create `server/.env` from `server/.env.example`. Configure:
   - `DATABASE_URL` — TiDB connection URL.
   - `TIDB_CA_CERT_PATH` — path to the TiDB CA certificate.
   - `JWT_SECRET` — a random secret of at least 32 characters.
   - `CLIENT_URL` — local frontend origin, normally
     `http://localhost:5173`.

3. Start the API:

   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:5000`.

4. In another terminal, install and start the frontend:

   ```bash
   cd client
   npm ci
   npm run dev
   ```

   Open `http://localhost:5173`.

## Build checks

From `client/`:

```bash
npm run lint
npm run build
```

From `server/`:

```bash
npm run typecheck
npm run build
```

The GitHub Actions workflow runs the frontend lint/build and backend Prisma
generation/TypeScript build on the integration branch and pull requests.

## API overview

All paths are under `/api`.

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/register` | Public; creates citizen |
| POST | `/auth/login` | Public, rate-limited |
| POST | `/auth/logout` | Authenticated |
| GET | `/auth/me` | Authenticated |
| PUT | `/auth/me` | Authenticated |
| PUT | `/auth/password` | Authenticated |
| POST | `/auth/forgot-password` | Public; currently unavailable until email is configured |
| GET | `/reports/categories` | Public |
| POST | `/reports` | Citizen |
| GET | `/reports` | Citizen-owned, officer department-scoped, or admin-wide |
| GET | `/reports/:id` | Same report scope as above |
| PUT | `/reports/:id/status` | Officer in department or administrator |
| GET | `/track/report/:referenceNumber` | Public, rate-limited; reference required |
| POST | `/pigeonhole` | Public; anonymous or authenticated |
| GET | `/pigeonhole` | Authenticated; own citizen items or staff queue |
| PUT | `/pigeonhole/:id/status` | Officer or administrator |
| POST | `/pigeonhole/:id/response` | Officer or administrator |
| GET | `/track/pigeonhole?ref=` | Public, rate-limited; private reference required |
| GET | `/departments` | Public |
| POST | `/departments` | Administrator |
| GET | `/categories` | Public |
| POST | `/categories` | Administrator |
| GET | `/notifications` | Authenticated |
| PUT | `/notifications/:id/read` | Authenticated owner |
| PUT | `/notifications/read-all` | Authenticated |
| POST | `/admin/bootstrap` | One-time token; only before first admin exists |
| GET | `/admin/stats` | Administrator |
| GET | `/admin/users` | Administrator |
| POST | `/admin/users` | Administrator |
| PUT | `/admin/users/:id/status` | Administrator |
| GET | `/admin/audit-logs` | Administrator |
| GET | `/health` | Public service/database health |

## Security

- Passwords are hashed with bcrypt.
- Session cookies are HttpOnly and Secure in production.
- Authenticated requests re-check account status and role in TiDB.
- Role checks and department scoping are enforced on the server.
- Public tracking endpoints are rate-limited and expose only public status data.
- Important account and workflow actions are recorded in the audit log.
- Never commit `.env` files or expose database URLs, JWT secrets, bootstrap
  tokens or passwords.
