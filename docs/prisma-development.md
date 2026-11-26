# Prisma / PostgreSQL — daily local development

Use this for **local Prisma-only development**.  
Do **not** point this workflow at Supabase, Atlas, or Render.

Mongo mode (`DATABASE_MODE=mongo`) still exists and remains the default for production-like Mongo work. This guide is for:

```
Frontend (Vite :5200)
  → Express API (:4002)
    → Prisma repositories
      → Local Docker PostgreSQL (:5434)
```

No MongoDB required for normal Prisma-mode requests.

---

## One-time setup

1. Docker Desktop running
2. In `backend/config.env` (gitignored), set at least:

```env
DATABASE_URL=postgresql://visit:visit_dev_only@127.0.0.1:5434/visit_ethiopia_prisma?schema=public
DIRECT_URL=postgresql://visit:visit_dev_only@127.0.0.1:5434/visit_ethiopia_prisma?schema=public
JWT_SECRET=your_local_jwt_secret
```

`npm run dev:prisma` forces:

- `DATABASE_MODE=prisma`
- `CATALOG_DB=prisma`
- `SKIP_MONGO=true`
- `NODE_ENV=development` (even if `config.env` says `production`)
- `PORT=4002` (override with `VISIT_ETHIOPIA_PORT` if needed)

Frontend `frontend/.env` should be:

```env
VITE_API_BASE_URL=http://localhost:4002/api/v1
```

---

## Daily start

```bash
# Terminal 1 — Postgres
docker compose -f docker-compose.prisma.yml up -d

# Terminal 2 — API
cd backend
npm run prisma:seed          # safe to re-run (idempotent)
npm run dev:prisma

# Terminal 3 — Frontend
cd frontend
npm run dev -- --port 5200
```

Open:

- API: http://localhost:4002
- App: http://localhost:5200

Confirm API log shows:

- `Starting Prisma-only API (SKIP_MONGO=true, DATABASE_MODE=prisma)`
- `PostgreSQL (Prisma) connectivity OK`
- **no** Mongo connection message

---

## Migrations / first empty DB

```bash
docker compose -f docker-compose.prisma.yml up -d
cd backend
# shell needs DATABASE_URL/DIRECT_URL (or rely on config.env via seed scripts)
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run prisma:seed
npm run dev:prisma
```

---

## Seed logins (local fake only)

Password: `SEED_LOCAL_PASSWORD` or default `Phase3LocalSeedOnly!x`

| Email | Role |
|-------|------|
| `prisma.admin@visitethiopia.test` | admin |
| `prisma.catalog.owner@visitethiopia.test` | org owner |
| `prisma.catalog.visitor@visitethiopia.test` | customer |
| `prisma.member@visitethiopia.test` | org member |

Never use these credentials in production.

---

## Tests

```bash
cd backend
npm run prisma:phase3    # identity
npm run prisma:phase4    # booking/inventory concurrency
npm run prisma:phase5    # Prisma-only smoke (starts its own server)
npm run prisma:phase6    # live QA against running :4002
npm run prisma:ownership
npm run prisma:workspace
npm run prisma:hotel           # hotel lifecycle + daily inventory
npm run prisma:hotel-booking   # hotel booking + multi-night CAS
npm run prisma:hotel-fulfillment  # hotel provider check-in/check-out/no-show
npm run prisma:transport       # transport lifecycle + seat inventory + booking
npm run prisma:transport-fulfillment  # transport provider check-in/complete/no-show

# Mongo regression (uses memory Mongo — keep DATABASE_MODE unset)
node scripts/run-full-test-battery.js
node scripts/phase4g-regression-runner.js

cd ../frontend
npm test
npm run build
```

Hotel booking (Prisma): authenticated `POST /api/v1/bookings/hotels` with `Idempotency-Key`, then mock `POST /api/v1/payments/:id/confirm`. See `docs/hotel-marketplace.md`.

Transport booking (Prisma): authenticated `POST /api/v1/bookings/transports` with `Idempotency-Key`. See `docs/transport-marketplace.md`.

`prisma:phase6` expects `npm run dev:prisma` already running.

---

## Reset local PostgreSQL (safe for local only)

```bash
docker compose -f docker-compose.prisma.yml down -v
docker compose -f docker-compose.prisma.yml up -d
cd backend
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run prisma:seed
```

Never run this against Supabase / production.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `DATABASE_URL required` | Set Postgres URLs in `backend/config.env` |
| Port mismatch FE↔API | FE expects **4002**; `dev:prisma` defaults to 4002 |
| Signup fails / deletes user | Ensure you used `dev:prisma` (forces `NODE_ENV=development`). A trailing `NODE_ENV=production` in `config.env` breaks plain `node server.js` local signup |
| SMTP errors in logs | Expected with invalid email creds; development auto-verifies / returns reset tokens |
| Mongo battery fails oddly | Unset `DATABASE_MODE` / `CATALOG_DB` / `SKIP_MONGO` in the shell first |
| Broken catalog images | Re-run `npm run prisma:seed` (refreshes HTTPS Unsplash URLs) |
| Prisma CLI missing env | Export `DATABASE_URL` and `DIRECT_URL` in the shell before `prisma validate` / `migrate deploy` |
| Docker not healthy | `docker compose -f docker-compose.prisma.yml ps` — wait until healthy |

---

## Related docs

- `docs/prisma-phase5.md` — Phase 5 parity
- `docs/prisma-phase5-audit.md` — remaining Mongo map
- `docs/prisma-phase3.md` / `docs/prisma-phase4.md` — earlier phases
- `docs/provider-workspace.md` — provider org dashboard, scoping, permissions
- `docs/hotel-marketplace.md` — hotel lifecycle, visibility, room inventory
- `docs/hotel-fulfillment.md` — hotel provider check-in / check-out / no-show
- `docs/transport-marketplace.md` — transport lifecycle, seat inventory, booking
- `docs/transport-fulfillment.md` — provider check-in / complete / no-show

**Stop here for local Prisma QA.** Supabase / Atlas / Render cutover is a separate approved phase.
