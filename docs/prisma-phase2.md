# Phase 2 — Public catalog reads (Prisma)

**Status:** local development only. Default API still uses MongoDB (`CATALOG_DB=mongoose`).

## Migrated READ endpoints (when `CATALOG_DB=prisma`)

| Method | Path |
|--------|------|
| GET | `/api/v1/destinations`, `/featured`, `/:id`, `/:id/tours` |
| GET | `/api/v1/tours`, `/featured`, `/marketplace`, `/:id` (id or slug), `/:id/reviews` |
| GET | `/api/v1/hotels`, `/featured`, `/:id`, `/:id/reviews` |
| GET | `/api/v1/transports`, `/routes`, `/:id`, `/:id/reviews` |
| GET | `/api/v1/restaurants`, `/featured`, `/:id`, `/:id/reviews` |
| GET | `/api/v1/news`, `/featured`, `/:id` (still increments `views`) |

## Still MongoDB (always)

- All writes (POST/PATCH/DELETE) for catalog
- Auth, users, organizations, approvals **unless** `DATABASE_MODE=prisma` (Phase 3)
- Bookings, payments, refunds, inventory, departures
- `GET /tours/:id/departures` (departures not in Phase 2 PG seed)
- Org public tours by slug (`/organizations/:slug/tours`)
- Admin/provider booking routes

## Architecture

```
Controller (CATALOG_DB branch)
  → repositories/prisma/*
  → backend/config/prisma.js
  → local PostgreSQL
```

Serialization: Prisma `id` → API `_id` via `utils/prismaSerialize.js`.

## Compatibility decisions

- Phase 2 PG seed is **legacy catalog only** (`organizationId: null`). Org marketplace tours are empty on Prisma until Phase 3.
- Hotel/restaurant/transport detail `reviews` arrays stay empty on Prisma (Mongo used denormalized arrays); nested `/:id/reviews` uses `reviews` table.
- Destination `nearbyAccommodations` populated from join table.
- News detail increments `views` on Prisma (parity with Mongo `$inc`).

## Local commands

```bash
docker compose -f docker-compose.prisma.yml up -d
cd backend
# set DATABASE_URL + DIRECT_URL (see config.env.example)
npm run prisma:seed
# run API with Mongo still connected for requireDb, but catalog from Prisma:
# CATALOG_DB=prisma npm run dev
# default remains:
# CATALOG_DB=mongoose  (or unset)
```

## Seed IDs (deterministic)

| Entity | id |
|--------|-----|
| Owner user | `a10000000000000000000001` |
| Visitor user | `a10000000000000000000002` |
| Destination | `a20000000000000000000001` |
| Tour | `a20000000000000000000002` |
| Hotel | `a20000000000000000000003` |
| Transport | `a20000000000000000000004` |
| Restaurant | `a20000000000000000000005` |
| News | `a20000000000000000000006` |
| Review | `a20000000000000000000007` |

## Remaining work (later phases)

- Org-linked public tours / approvals on Prisma
- Departures on Prisma
- Catalog writes
- Data migration from Atlas
- Production cutover
