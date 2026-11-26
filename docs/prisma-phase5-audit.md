# Phase 5 Audit — Complete Prisma/PostgreSQL Parity (Local)

**Date:** 2026-09-13  
**Status:** AUDIT COMPLETE — Phase 5 implementation finished; see `docs/prisma-phase5.md`.  
**Constraint:** Local Docker PostgreSQL only. No Supabase / Atlas / Render / commit / push.

---

## Current switches (unchanged)

| Env | Default | Scope |
|-----|---------|--------|
| `DATABASE` | Mongo URI | Mongoose (default app DB) |
| `DATABASE_URL` / `DIRECT_URL` | Postgres | Prisma |
| `CATALOG_DB` | `mongoose` | Phase 2 public catalog **reads** |
| `DATABASE_MODE` | `mongo` | Phase 3 identity + Phase 4 booking domain |

`isPrismaBooking()` ≡ `isPrismaIdentity()` (`DATABASE_MODE=prisma`).

---

## A. Remaining Mongo dependencies

### A1. Startup / middleware (blocks Prisma-only)

| Dependency | Path | Notes |
|------------|------|-------|
| Always `connectDB()` | `server.js` → `config/db.js` | Mongo always connected |
| `requireDb` | `middlewares/requireDb.js`, `app.js` | 503 unless `mongoose.connection.readyState === 1` |
| `express-mongo-sanitize` | `app.js` | Mongo query sanitizer |
| ObjectId middleware | `middlewares/requireObjectId.js` | Uses `mongoose.Types.ObjectId` |
| Memory harness | `scripts/startWithMemoryDb.js` | Regression base |

### A2. Auth / users

| Still Mongo | Path |
|-------------|------|
| Admin factory user list/get/delete | `userController.js` |
| Stats user counts | `statsController.js` |

(Profile/auth flows already Prisma when `DATABASE_MODE=prisma`.)

### A3. Catalog

| Reads | Writes |
|-------|--------|
| Prisma when `CATALOG_DB=prisma` | Always Mongo: destinations, tours, hotels, transports, restaurants, news, reviews (`*Controller.js` + `handlerFactory`) |

### A4. Organizations / marketplace

| Prisma (partial) | Still Mongo |
|------------------|-------------|
| Register, members, preference, context, submit/approve/reject, public slug | Org tour CRUD (`organizationTourController`), public org tours by slug, approval **list/detail**, suspend/reactivate, `approvalReconciliationService` |

### A5. Bookings / payments / refunds / webhooks / fulfillment

| Prisma domain helpers | Still Mongo HTTP/services |
|-----------------------|---------------------------|
| Create tour booking, inventory CAS, payment create/finalize/fail helpers, departures | Booking get/list/cancel/lifecycle; payment confirm/get/cancel; refunds; webhooks; reconciliation; provider bookings; fulfillment |

**Critical hole:** Prisma booking create writes PG payment; `POST /payments/:id/confirm` loads Mongo → broken E2E.

### A6. Admin / contacts / stats

All Mongo: contacts, stats counts, admin factory CRUD for catalog, admin booking reconcile.

---

## B. Already Prisma-compatible

- **Phase 2 reads:** `repositories/prisma/*`, catalog controller branches  
- **Phase 3 identity:** users repos, auth, org register/context, approval submit/approve/reject  
- **Phase 4 domain:** `prismaBookingDomainService`, departure/inventory repos, booking create, payment create/finalize helpers  
- **Utils:** `databaseMode.js`, `objectId.js`, `passwordService.js`, `prismaSerialize.js`

---

## C. Needs adapters (priority)

1. Dual `requireDb` + optional skip Mongo connect when prisma  
2. Payment HTTP: load/confirm/get/attempts/cancel  
3. Booking lifecycle + customer get/list/cancel  
4. Refunds  
5. Webhooks + payment reconciliation  
6. Provider bookings + fulfillment  
7. Org tour writes + public org tours  
8. Catalog writes + reviews  
9. Admin users, approval list/detail/suspend, contacts, stats  
10. Middleware hygiene (`requireObjectId` → `objectId.js`)

---

## D. Safe to remove later (after Mongo retirement)

- `models/**`, Mongo user repo, `config/db.js` Mongo-only path  
- `express-mongo-sanitize`, mongoose deps, memory-server as primary CI  
- Migrate one-offs that only touch Atlas/Mongo  

**Do not remove in Phase 5.**

---

## E. API compatibility risks

- 503 without Mongo today even if Postgres healthy  
- Payment confirm/get/refund against wrong DB  
- Customer booking list empty under Prisma  
- Org tour CMS writes Mongo while bookings read PG  
- Mixing `CATALOG_DB` / `DATABASE_MODE` across DBs  
- Factory pagination vs Prisma list semantics  

**Mitigation:** keep envelopes, `_id`, status enums, status codes; serializers always emit `_id`.

---

## F. Frontend compatibility risks

No intentional FE rewrite. Risks only if backend parity incomplete (empty admin tabs, stuck payments, empty provider bookings).  
If a FE change is required → smallest fix + document.

---

## G. Transaction / concurrency risks

**Keep:** conditional `UPDATE availableSpots WHERE >= qty`, hold state machine, partial unique indexes, payment/refund CAS.  

**Port carefully:** payment pending→processing→completed, refund amount increments, approval claim, reconciliation idempotency.  

**Never** mix PG identity with Mongo bookings.

---

## H. Exact implementation order

1. Audit doc (this file)  
2. Startup: `requireDb` dual-mode + `dev:prisma` without Mongo  
3. Payment HTTP confirm/get  
4. Booking lifecycle + customer APIs  
5. Refunds  
6. Webhooks + reconciliation  
7. Provider booking + fulfillment  
8. Org tour writes + public org tours  
9. Catalog writes + reviews  
10. Admin users / approvals list / contacts / stats  
11. Full seed + clean migrate test  
12. Full test matrix + `docs/prisma-phase5.md`

---

## Middleware decision matrix

| Item | Decision |
|------|----------|
| `express-mongo-sanitize` | **A** remain for mongo; skip or no-op when prisma |
| `requireObjectId` | **B** abstract to `isObjectIdCompatible` |
| `requireDb` | **B** accept mongo **or** prisma readiness |
| Mongoose error handler | **A** remain for mongo mode |

---

## Definition of Phase 5 done

`DATABASE_MODE=prisma` (+ typically `CATALOG_DB=prisma`) runs major app flows on **local PostgreSQL only** without requiring Mongo for those flows.  
`DATABASE_MODE=mongo` remains fully green.  
No Supabase / Atlas / Render / commit / push.
