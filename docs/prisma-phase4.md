# Phase 4 — Booking / Departure / Inventory / Payment (Prisma)

**Status:** local development only.  
**Default:** MongoDB (`DATABASE_MODE=mongo`).  
**Opt-in:** `DATABASE_MODE=prisma` uses PostgreSQL for booking-domain flows (same switch as Phase 3 identity).  
**Production:** Atlas / Supabase / Render untouched.

## Migrated models (Prisma path)

| Model | Behavior |
|-------|----------|
| TourDeparture | CRUD + list; public departure listing |
| InventoryHold | Create / activate / release / consume / restore |
| Booking | v2 tour booking create + lifecycle fields |
| Payment | Create for booking; status transitions |
| PaymentAttempt | Attempt numbering |
| Refund | Repository ready (full HTTP refund path still mostly Mongo services) |
| WebhookEvent | Repository + create with `(provider, eventId)` uniqueness |
| BookingOperationAudit | Append-only create + list |
| BookingProviderNote | Normalized notes table (API still array-shaped) |

## Architecture

```
Controller
  → existing services (tourDepartureService, bookingInventoryService,
     tourBookingService, paymentService, …)
       → if DATABASE_MODE=prisma
            → prismaBookingDomainService / prisma repositories
            → local PostgreSQL
       → else
            → Mongoose models (unchanged)
```

Shared request helpers: `backend/services/bookingRequestUtils.js`  
Repositories: `backend/repositories/booking/*`

## Transaction / concurrency strategy

**Inventory CAS (critical):**

```sql
UPDATE tour_departures
SET "availableSpots" = "availableSpots" - $qty
WHERE id = $id
  AND status = 'open'
  AND "availableSpots" >= $qty
RETURNING *
```

Wrapped in `prisma.$transaction`. Never read-then-write spots.

**Release:** `LEAST(availableSpots + qty, capacity)` then reopen `full` → `open` when spots > 0.

**Booking create:** booking row → reserve hold (pending → CAS → held) → payment row (same semantics as Mongo compensate path).

**Payment success:** consume hold + confirm booking + mark payment completed.

**Payment failure:** fail payment + release hold + fail booking.

## Idempotency

Partial unique indexes (local migration `20260912190000_phase4_booking_partial_uniques`):

- `bookings (user, idempotencyKey)` where v2 + key present
- `payments (bookingId, idempotencyKey)` where key present
- `refunds (userId, bookingId, idempotencyKey)` where key present
- `inventory_holds (bookingId)` where status ∈ pending|held|consumed

Webhook uniqueness: `@@unique([provider, eventId])`.

## DATABASE_MODE behavior

| Mode | Departures / inventory / v2 booking / payment core |
|------|-----------------------------------------------------|
| `mongo` (default) | Mongoose — all existing Phase 4A–4I scripts |
| `prisma` | Prisma + Docker Postgres; requires identity data also in PG |

Do **not** mix PG users with Mongo bookings.

## Tests

```bash
cd backend
npm run prisma:phase4          # 26 focused Prisma checks
node scripts/phase4g-regression-runner.js   # Mongo 4A–4I
```

## Known limitations

- Full refund HTTP orchestration / webhook reconciliation / provider fulfillment still primarily Mongo service code; Prisma repos exist and payment success/fail + inventory restore are wired for Prisma mode.
- Admin booking reconciliation jobs remain Mongo-oriented.
- Org-scoped tour **writes** still expect Mongo Tour documents unless tours also exist in PG (Prisma mode tests create tours in PG).
- No production dual-write; no Supabase migrate deploy from this phase.

## Rollback

Unset `DATABASE_MODE` or set `DATABASE_MODE=mongo` and restart. Local PG booking rows become unused.

## Next recommended phase

Complete Prisma paths for refunds, webhooks, provider fulfillment/audits end-to-end; then catalog **writes**; then staged data copy — still not production cutover.
