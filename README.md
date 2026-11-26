# Visit Ethiopia

A full-stack travel marketplace for Ethiopia: travelers browse and book **tours**, **hotels** and **intercity transport** from verified local providers; providers run their listings, inventory and bookings from a workspace; admins approve providers and moderate content.

| | |
|---|---|
| **Frontend** | https://visit-ethiopia-rw9b.vercel.app (Vercel) |
| **API** | https://visit-ethiopia-api.onrender.com (Render, free tier — first request after idle can take ~50 s) |
| **Database** | PostgreSQL on Neon (Prisma ORM, versioned migrations) |
| **Payments** | Chapa (Ethiopian payment gateway) — server-side initialize + verify, signed webhooks; demo payment mode when no Chapa keys are configured |

> **Payments are demo/test only.** No live payment credentials are configured. The deployed site uses either clearly-labelled demo payments or Chapa *test mode*. See [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

## Features

**Travelers**
- Browse and search tours, hotels, transport routes, destinations, restaurants and news
- Tour departures with live seat availability and packages; hotel room types with per-night inventory; transport routes with per-date seat inventory
- Book with a server-calculated price snapshot and a short inventory hold (15 min) while payment is pending
- Pay with Chapa (hosted checkout) — booking is confirmed **only** after server-side verification with Chapa, never on a browser redirect
- Booking history, booking detail, cancellation with server-computed refund amounts; reviews
- Email verification, password reset and booking-confirmation emails (when an email provider is configured)

**Providers (organizations)**
- Organization profiles with versioned, admin-approved public snapshots
- Team membership with permissions per provider type (travel company, hotel, tour bus provider)
- Workspace: create/publish/archive tours and departures, hotels and room inventory, transport routes and seat inventory; view and fulfil bookings (check-in, no-show, boarding)

**Admins**
- Provider approval queue (approve / reject / request changes), suspensions
- Content management and moderation

**Platform**
- Idempotent payment state machine: compare-and-set status transitions, attempt records, de-duplicated webhook events, late-payment detection (paid after hold expiry → flagged for refund review instead of overbooking)
- Background reconciliation: re-verifies pending Chapa checkouts and expires stale holds so inventory is released
- Security: helmet, CORS allow-list, rate limiting (stricter on auth), JWT in httpOnly cookies, input sanitisation, org-scoped authorization on every provider route

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, Vitest
- **Backend:** Node.js 22, Express (ESM), Prisma 6, JWT, Nodemailer
- **Database:** PostgreSQL (Neon in production, Docker locally). A legacy MongoDB/Mongoose code path still exists behind `DATABASE_MODE=mongo` and is kept passing its regression battery, but production runs PostgreSQL only.
- **Hosting:** Vercel (frontend), Render Blueprint (`render.yaml`, API), Neon (database)

```
frontend/   React SPA (Vite)            → Vercel
backend/    Express API                  → Render (rootDir: backend)
prisma/     schema.prisma + migrations   → applied with `prisma migrate deploy`
docs/       audit, deployment, env vars, testing, limitations
```

## Running locally

Prerequisites: Node.js ≥ 20, Docker (for local PostgreSQL).

```bash
# 1. Database
docker compose -f docker-compose.prisma.yml up -d      # Postgres on localhost:5434

# 2. API
cd backend
cp config.env.example config.env                         # local values only
npm ci
npm run build                                            # prisma generate
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run prisma:seed                                      # local test users + catalog
npm run seed:demo                                        # demo marketplace content (optional)
npm run dev:prisma                                       # http://localhost:4002

# 3. Frontend
cd ../frontend
npm ci
echo "VITE_API_URL=http://localhost:4002/api/v1" > .env.local
npm run dev -- --port 5200                               # http://localhost:5200
```

`npm run prisma:seed` prints the local-only test logins (traveler, provider owner, admin). They exist only in your local database.

## Tests

```bash
cd backend && npm test          # 12 Prisma/PostgreSQL integration suites (local DB only)
cd frontend && npm test
```

Latest results and what is/isn't covered: [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md).

## Documentation

- [docs/PROJECT_COMPLETION_AUDIT.md](docs/PROJECT_COMPLETION_AUDIT.md) — audit of the codebase and what was completed
- [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) — deploying Neon + Render + Vercel, Chapa setup, operations
- [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) — every variable, where it lives, secret or not
- [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md) — automated and manual test results
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) — honest list of gaps
- [docs/IMAGE_CREDITS.md](docs/IMAGE_CREDITS.md) — attribution for demo images

## License and credits

Code © the project authors. Demo images are from Wikimedia Commons and Unsplash under their respective licenses — see [docs/IMAGE_CREDITS.md](docs/IMAGE_CREDITS.md).
