# Phase 5 — Complete Prisma / PostgreSQL application parity (local)

**Status:** Complete for local PostgreSQL-only development.  
**Constraint:** No Supabase / Atlas / Render / commit / push.

See also: [prisma-phase5-audit.md](./prisma-phase5-audit.md)

---

## Goal

`DATABASE_MODE=prisma` runs the backend against **local Docker PostgreSQL** for normal application operations **without MongoDB**.

`DATABASE_MODE=mongo` remains fully supported (default).

---

## How to run Prisma-only locally

```bash
# 1. Start local Postgres (host port 5434)
docker compose -f docker-compose.prisma.yml up -d

# 2. Ensure backend/config.env has DATABASE_URL / DIRECT_URL pointing at 5434

# 3. Migrate + seed (from repo root or backend)
cd backend
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run prisma:seed

# 4. Start API (sets DATABASE_MODE=prisma, CATALOG_DB=prisma, SKIP_MONGO=true)
npm run dev:prisma
```

API: `http://localhost:4002` (override with `VISIT_ETHIOPIA_PORT` / `PORT`).

### Reset local PostgreSQL safely (dev only)

```bash
docker compose -f docker-compose.prisma.yml down -v
docker compose -f docker-compose.prisma.yml up -d
cd backend
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run prisma:seed
```

Never run these against Supabase / production.

---

## Seed credentials (local fake only)

| Email | Role | Password |
|-------|------|----------|
| `prisma.admin@visitethiopia.test` | admin | `SEED_LOCAL_PASSWORD` or `Phase3LocalSeedOnly!x` |
| `prisma.catalog.owner@visitethiopia.test` | org owner | same |
| `prisma.catalog.visitor@visitethiopia.test` | customer | same |

Seed is idempotent (upserts; no `deleteMany` / drop).

---

## What Phase 5 added

| Area | Notes |
|------|--------|
| Startup | `requireDb` accepts Prisma readiness; `DATABASE_MODE=prisma` skips Mongo by default; `npm run dev:prisma` |
| Booking / payment / refund / webhook / fulfillment | Prisma HTTP + domain services |
| Catalog writes | Destinations, tours (+ guides), hotels, transports, restaurants, news, reviews, contacts |
| Admin | Users, stats, bookings list, approvals list/detail/suspend |
| Ownership middleware | Prisma-aware for tour/hotel/transport mutations |
| Approval reconciliation | Prisma branch |
| Tests | `npm run prisma:phase5` smoke |

---

## Mode matrix

| Mode | Env | Mongo | Postgres |
|------|-----|-------|----------|
| Mongo (default) | `DATABASE_MODE=mongo` | required | optional |
| Prisma-only | `DATABASE_MODE=prisma` (+ `dev:prisma`) | **not required** | required |
| Dual (rare) | `DATABASE_MODE=prisma` + `SKIP_MONGO=false` | both | both |

When `DATABASE_MODE=prisma` and `CATALOG_DB` is unset, catalog reads use Prisma.

---

## Middleware decisions (confirmed)

| Item | Decision |
|------|----------|
| `express-mongo-sanitize` | Remains for mongo; skipped when `DATABASE_MODE=prisma` |
| `requireObjectId` | Uses `isObjectIdCompatible` (shared) |
| `requireDb` | Mongo ready **or** Prisma `SELECT 1` |
| Mongoose error handler | Remains for mongo mode |

---

## Remaining Mongo (intentional until Phase 6+)

- All `models/**` and Mongo repositories (fallback when `DATABASE_MODE=mongo`)
- Memory Mongo harness / Phase 1–4 regression runners
- CLI scripts that still `mongoose.connect` for Mongo ops
- Optional dual-connect when `SKIP_MONGO=false`

---

## Test matrix (local run)

| Check | Result |
|-------|--------|
| `prisma validate` | OK |
| `prisma generate` | OK |
| Clean DB `migrate deploy` (2 migrations) | OK |
| `prisma:seed` | OK |
| `prisma:connectivity` | OK |
| `prisma:phase3` | **31/31** |
| `prisma:phase4` (incl. concurrency 20→10) | **26/26** |
| `prisma:phase5` (Prisma-only HTTP smoke) | **19/19** |
| Mongo `run-full-test-battery` (11 suites) | **all passed** (integration 53/53) |
| Mongo `phase4g-regression-runner` (4A–4I) | **all passed** |
| Frontend `vitest` | **17/17** |
| Frontend `vite build` | OK |

SMTP auth failures in logs are expected with invalid local email credentials; development auto-verify / reset-token paths still succeed.

---

## Recommended Phase 6

Local parity is proven. **Do not** connect Supabase yet until explicitly planned.

Suggested Phase 6: staging Postgres (still non-production), dual-run soak, cutover checklist — still no Atlas/Render/Supabase production changes until approved.

