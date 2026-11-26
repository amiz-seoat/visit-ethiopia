# Phase 0 — Prisma / Supabase PostgreSQL Migration Audit

**Status:** DESIGN ONLY — no database connections, no migrations applied, no production changes.  
**Date:** 2026-09-12  
**Source of truth:** current Visit Ethiopia backend codebase (not prior planning notes alone).

---

## 1. Files inspected

### Models
- `backend/models/*.js` (22 registered models)
- `backend/models/schemas/{geoPoint,mediaItem,contactInfo,tourPackage,bookingPriceSnapshot}.js`

### Application layer
- `backend/app.js`, `backend/routes/**`, `backend/controllers/**`, `backend/services/**`
- `backend/middlewares/{requireObjectId,organizationContext,upload}.js`
- `backend/utils/{apiFeatures,organizationPermissions,appError}.js`
- `backend/config/{booking,tourLifecycle,cloudinary}.js`
- `backend/controllers/handlerFactory.js`

### Scripts / tests / docs
- `backend/scripts/startWithMemoryDb.js`, `bootstrapProdAdmin.js`, `seedProductionMarketplace.js`
- Phase 1–4 regression scripts (`run-full-test-battery.js`, `phase4g-regression-runner.js`, phase3/4*)
- `backend/docs/phase2-api.md`

### Frontend contract samples
- `frontend/src/api/**`, `frontend/src/types/index.ts`, `frontend/src/services/api.ts`
- `frontend/src/utils/bookingHelpers.ts`, booking tests

---

## 2. Every Mongoose model found

| Model | File | Default collection |
|-------|------|--------------------|
| User | `User.js` | `users` |
| Organization | `Organization.js` | `organizations` |
| OrganizationMember | `OrganizationMember.js` | `organizationmembers` |
| UserOrganizationPreference | `UserOrganizationPreference.js` | `userorganizationpreferences` |
| ProviderVersion | `ProviderVersion.js` | `providerversions` |
| ApprovalRequest | `ApprovalRequest.js` | `approvalrequests` |
| Tour | `Tour.js` | `tours` |
| TourDeparture | `TourDeparture.js` | `tourdepartures` |
| Hotel | `Hotel.js` | `hotels` |
| Transport | `Transport.js` | `transports` |
| Restaurant | `Restaurants.js` | `restaurants` |
| Destination | `Destination.js` | `destinations` |
| News | `News.js` | `news` |
| Review | `Review.js` | `reviews` |
| Contact | `Contact.js` | `contacts` |
| Booking | `Booking.js` | `bookings` |
| Payment | `Payment.js` | `payments` |
| PaymentAttempt | `PaymentAttempt.js` | `paymentattempts` |
| Refund | `Refund.js` | `refunds` |
| InventoryHold | `InventoryHold.js` | `inventoryholds` |
| WebhookEvent | `WebhookEvent.js` | `webhookevents` |
| BookingOperationAudit | `BookingOperationAudit.js` | `bookingoperationaudits` |

No Mongoose discriminators. No custom `collection:` overrides.

---

## 3. Shared / embedded schemas

| Schema | Used by | PG recommendation |
|--------|---------|-------------------|
| `geoPointSchema` | Tour.startingLocation, Tour.destinationLocations[], Organization.location | **JSONB** (no `$near` usage in app) |
| `mediaItemSchema` | Tour/Organization gallery & portfolioPhotos | **JSONB** arrays |
| `contactInfoSchema` | Organization.contact | **JSONB** |
| `tourPackageSchema` | Tour.packages[] | **JSONB** (pricing reads in-memory by key) |
| `bookingPriceSnapshotSchema` | Booking.priceSnapshot | **JSONB** (immutable audit blob) |
| departure packages (inline) | TourDeparture.packages[] | **JSONB** |
| providerVerification + docs | Organization.verification | **JSONB** |
| approval checklist | ApprovalRequest.verificationChecklist | **JSONB** |
| hotel roomTypes / transport routes / restaurant menu | Hotel, Transport, Restaurant | **JSONB** |
| bookingDetails, contactInfo, legacy payment | Booking | **JSONB** |
| providerNotes (had `_id: true`) | Booking | **normalized table** `booking_provider_notes` |
| Mixed metadata / snapshots | Payment, Refund, Webhook, Audit, ProviderVersion, PaymentAttempt | **JSONB** |

---

## 4. Mongo → PostgreSQL table mapping

| Mongo | PostgreSQL table(s) | Notes |
|-------|---------------------|-------|
| User | `users` | `FirstName`/`LastName` columns via `@map` |
| User.favorites[] | `user_favorites` | M2M |
| Organization | `organizations` | verification/gallery/contact JSONB |
| Organization.previousSlugs[] | `organization_previous_slugs` | unique slug for redirects |
| OrganizationMember | `organization_members` | |
| UserOrganizationPreference | `user_organization_preferences` | |
| ProviderVersion | `provider_versions` | |
| ApprovalRequest | `approval_requests` | |
| Tour | `tours` | duration flattened to days/nights columns |
| Tour.guides[] | `tour_guides` | M2M |
| TourDeparture | `tour_departures` | |
| Hotel | `hotels` | drop denormalized `reviews[]` |
| Transport | `transports` | drop denormalized `reviews[]` |
| Restaurant | `restaurants` | drop denormalized `reviews[]`; no org FK today |
| Destination | `destinations` | |
| Destination.tours[] | `destination_tours` | |
| Destination.nearbyAccommodations[] | `destination_hotels` | |
| News | `news` | |
| Review | `reviews` | polymorphic itemType/itemId |
| Contact | `contacts` | |
| Booking | `bookings` | `bookingItem` → column `bookingItem` |
| Booking.providerNotes[] | `booking_provider_notes` | |
| Payment | `payments` | |
| PaymentAttempt | `payment_attempts` | |
| Refund | `refunds` | |
| InventoryHold | `inventory_holds` | |
| WebhookEvent | `webhook_events` | |
| BookingOperationAudit | `booking_operation_audits` | |

Draft schema path: `prisma/schema.prisma` (DRAFT ONLY).

---

## 5. Relationship diagram

```
User
 ├── UserFavorite → Tour
 ├── Organization (owner)
 ├── OrganizationMember
 ├── UserOrganizationPreference → Organization
 ├── Review, Booking, News(author), Contact(responder)
 ├── Tour/Hotel/Transport/Restaurant (createdBy)
 ├── ProviderVersion / ApprovalRequest actors
 └── BookingOperationAudit / BookingProviderNote

Organization
 ├── OrganizationMember, previousSlugs
 ├── ProviderVersion ←→ approvedVersionId (1:1 optional)
 ├── ApprovalRequest
 ├── Tour, Hotel, Transport, TourDeparture
 └── Booking, Payment, Refund, InventoryHold, Audit

Tour
 ├── TourGuide → User
 ├── TourDeparture
 ├── DestinationTour ← Destination
 └── (virtual reviews via Review.itemType=tour)

TourDeparture
 ├── Booking (v2)
 └── InventoryHold

Booking
 ├── User, Organization?, TourDeparture?
 ├── Payment (bookingId FK; Booking.paymentId denormalized)
 ├── Refund, InventoryHold, BookingProviderNote, Audit
 └── bookingItemId polymorphic (tour|hotel|transport|restaurant)

Review
 └── user + (itemType, itemId) polymorphic
```

---

## 6. Enum mapping

Exact Mongo string values preserved. Prefer Prisma `enum` for closed sets; use **String** where `$` price ranges or open permission strings apply.

| Domain | Values | PG |
|--------|--------|-----|
| User.role | user, customer, admin, guide, tour_operator, hotel_manager, transport_manager | ENUM |
| Org visibility / approvalStatus | private/public; draft…inactive | ENUM |
| PROVIDER_TYPES | travel_company, hotel, tour_bus_provider, bus_company | ENUM[] |
| ORG_ROLES / MEMBERSHIP_ROLES / member status | from `organizationPermissions.js` | ENUM |
| ProviderVersion.status | draft, submitted, approved, rejected, superseded | ENUM |
| Approval type/status | initial_approval…; pending…cancelled | ENUM |
| Tour categories/difficulty/status | as in Tour.js | ENUM |
| Departure status | scheduled, open, full, cancelled, completed | ENUM |
| Hotel/Transport/Restaurant status | active, inactive, draft | ENUM |
| Destination status | active, inactive | ENUM |
| Transport type | air, bus, train, private_vehicle, boat | ENUM |
| News category/status | tourism…; published/draft/archived | ENUM |
| Review itemType/status | tour…; approved/pending/rejected | ENUM |
| Contact status | new, in_progress, resolved, spam | ENUM |
| Booking flow/type/status | from Booking + `config/booking.js` | ENUM |
| FulfillmentStatus | pending…cancelled | ENUM |
| Payment/Attempt/Refund/Hold/Webhook | from config + models | ENUM |
| Payment provider | **mock only** | ENUM |
| Restaurant priceRange | `$` `$$` `$$$` `$$$$` | **String** (API parity) |
| Org member permissions | free-form strings | `String[]` |

CHECK vs ENUM: Prisma enums are fine for app-owned closed sets. Open-ended or awkward identifiers → String + optional CHECK in raw SQL later.

---

## 7. Index / unique constraint mapping

### Expressible in Prisma draft
- `users.email` UNIQUE
- `organizations.slug` UNIQUE
- `destinations.name` UNIQUE
- `organization_members (organizationId, userId)` UNIQUE
- `user_organization_preferences.userId` UNIQUE
- `provider_versions (organizationId, versionNumber)` UNIQUE
- `payment_attempts (paymentId, attemptNumber)` UNIQUE
- `webhook_events (provider, eventId)` UNIQUE
- `organization_previous_slugs.slug` UNIQUE
- Various BTREE indexes on status, org, departure, expiresAt, etc.

### Partial uniques — **NOT expressible in Prisma schema** (require raw SQL in Phase 1+)

| Mongo partial unique | PostgreSQL equivalent |
|----------------------|------------------------|
| Tour `(organizationId, slug)` where org≠null & slug string | `CREATE UNIQUE INDEX … ON tours (organization_id, slug) WHERE organization_id IS NOT NULL AND slug IS NOT NULL` |
| Tour `(slug)` where slug string | `CREATE UNIQUE INDEX … ON tours (slug) WHERE slug IS NOT NULL` |
| Booking `(user, idempotencyKey)` where v2 & key string | `UNIQUE (user_id, idempotency_key) WHERE booking_flow_version = 'v2' AND idempotency_key IS NOT NULL` |
| Payment `(bookingId, idempotencyKey)` where key string | `UNIQUE (booking_id, idempotency_key) WHERE idempotency_key IS NOT NULL` |
| Refund `(userId, bookingId, idempotencyKey)` where key string | same pattern |
| InventoryHold `(bookingId)` where status ∈ pending\|held\|consumed | `UNIQUE (booking_id) WHERE status IN ('pending','held','consumed')` |
| ApprovalRequest `(providerVersionId, status)` where pending\|processing | `UNIQUE (provider_version_id) WHERE status IN ('pending','processing')` |

### Geo indexes (Mongo 2dsphere)
- Tour.startingLocation, Organization.location — **indexes only; no `$near` / `$geoWithin` in app code**
- Recommendation: **do not enable PostGIS in Phase 0–1**; store JSONB. Revisit if distance search is added.

---

## 8. Polymorphic relationship strategy

### Current usage
- **Review:** `itemType` ∈ tour\|hotel\|transport\|restaurant + `itemId` ObjectId (no schema `ref`). Tour exposes virtual `reviews`. Hotel/Transport/Restaurant store denormalized `reviews[]` arrays (inconsistent).
- **Booking:** `bookingType` + `bookingItem` ObjectId (no schema `ref`). Auto-populate `bookingItem` on find. v2 always `bookingType=tour` and also sets `departureId` / `organizationId`.

### Recommended PG approach (Phase 1+ — not implemented now)
1. Keep `item_type` / `booking_type` + `item_id` / `booking_item` **TEXT** columns for API compatibility.
2. **Do not** add DB FKs on polymorphic columns (Prisma cannot model exclusive arcs cleanly).
3. Enforce integrity in services (already the case).
4. Optional later: nullable typed FKs (`tour_id`, `hotel_id`, …) + CHECK exactly one matches type — stronger but larger rewrite.
5. Drop denormalized `reviews[]` on Hotel/Transport/Restaurant; always query `reviews` table (matches Tour virtual).

Draft schema uses option (1)+(5).

---

## 9. ID compatibility findings

### Where ObjectId validation is used
- `backend/middlewares/requireObjectId.js` → 404 if `mongoose.Types.ObjectId.isValid` fails (bookings, payments, org IDs, versions, approvals, provider/admin booking routes, org tours).
- `organizationContext.js` — treats invalid org header as null.
- `organizationRoutes.js` — if `slug` param is valid ObjectId, skip slug-tour branch.
- `marketplaceTourController.js` — **`ObjectId.isValid(param) && length === 24`** to choose id vs slug lookup.
- Services: `bookingInventoryService`, `providerBookingService`, `providerFulfillmentService`, `paymentService`, `paymentWebhookService` validate ObjectIds.

### Where new ObjectIds are generated
- Implicitly by Mongo on `Model.create`.
- Explicit `new mongoose.Types.ObjectId()` in phase scripts, seed dry-run fakes, forged IDs in security tests.

### Serialization as `_id`
- Mongoose documents expose `_id`; factory responses return docs as-is.
- Frontend types: `_id: string` everywhere (`frontend/src/types`, api modules).
- Booking UI “Ref” uses last 8 chars of `_id` (display only).

### Frontend 24-char assumptions
- No frontend hard-coded `length === 24` found.
- Backend marketplace **does** require length 24 for id-vs-slug disambiguation.
- `localStorage.activeOrganizationId` stores string IDs from API.

### What must change later (document only)
1. App-level `generateId()` producing 24-char hex (or keep BSON ObjectId generator without Mongo).
2. Replace `requireObjectId` with shared `isObjectIdCompatible(id)` helper (same rules).
3. Prisma serializers: map `id` → `_id` on every response.
4. Keep TEXT PKs — **do not switch to UUID** without dual-lookup layer.

---

## 10. Authentication migration considerations

**Keep custom auth (NOT Supabase Auth).**

Current behavior (`User` + `authController`):
- bcrypt cost 12 in `pre('save')` when password modified; strips `passwordConfirm`
- JWT payload `{ id }` only; cookie + Bearer
- `protect` checks user exists, `active !== false`, `changedPasswordAfter(iat)`
- Email verify JWT → `isVerified`
- Reset token SHA-256 hashed, 10 min expiry
- Soft-delete via `active: false` + `pre(/^find/)` filter
- Roles + org RBAC unchanged

**Prisma implication:** move hashing / reset-token creation / soft-delete default filters into repository/service helpers (no middleware hooks).  
**Known gap (unchanged):** `passwordChangedAt` is read but never set on password change in current hooks — do not “fix” during migration unless explicitly requested.

---

## 11. Booking / inventory transaction strategy

### Current behavior (code)
1. **v2 create** (`tourBookingService`): validate Idempotency-Key; fingerprint; create Booking `payment_pending`; `reserveForBooking` → create InventoryHold then `reserveDepartureSpots` (`findOneAndUpdate` with `availableSpots ≥ qty` + `$inc -qty`); create Payment.
2. **Idempotency:** partial unique on `(user, idempotencyKey)` for v2; returns existing booking if fingerprint matches.
3. **Reserve spots:** conditional atomic update; set status `full` when spots hit 0.
4. **Release:** pipeline `$min($add(spots, qty), capacity)`; reopen if was full.
5. **Holds:** partial unique one active hold per booking; idempotent reserve; consume on payment success; release on fail/expire/cancel.
6. **No Mongo multi-doc transactions** — compensating `compensateDepartureRelease` on failure.
7. **Payments/refunds:** CAS via `findOneAndUpdate` status transitions; webhook `(provider, eventId)` unique.

### Future Prisma / Postgres (design)
Use `prisma.$transaction` (+ interactive transactions):

```sql
UPDATE tour_departures
SET available_spots = available_spots - $qty,
    status = CASE WHEN available_spots - $qty = 0 THEN 'full' ELSE status END
WHERE id = $id AND status = 'open' AND available_spots >= $qty
RETURNING *;
```

Inside same TX: insert booking + hold + payment. Rely on partial unique indexes for idempotency races. Prefer real transactions over compensate-only (keep compensate as safety net).

---

## 12. Geo / location strategy

| Shape | Models | App queries |
|-------|--------|-------------|
| GeoJSON `[lng,lat]` + 2dsphere index | Tour, Organization | **None** (index only) |
| `{ lat, lng }` nested | Destination, Hotel, Restaurant | filter/display only |

**Recommendation:** JSONB / scalar lat-lng columns. **No PostGIS** until product needs distance search.

---

## 13. Image / storage strategy

- Catalog/org fields store **HTTPS URL strings** (Unsplash in prod seed; Cloudinary IDs optional on mediaItem).
- `middlewares/upload.js` + Cloudinary config exist but upload middleware is **not wired into routes**; `utils/cloudinary` path appears broken/incomplete.
- **Preserve URL strings.** Do not migrate blobs. Supabase Storage optional later. Keep Cloudinary as-is for now.

---

## 14. Test / development database strategy

Today: `MongoMemoryServer` via `startWithMemoryDb.js` + HTTP phase scripts.

Future (not now):
- Local Postgres (Supabase local or Docker)
- `prisma migrate` (Phase 1+)
- Idempotent seeds replacing memory seed content
- Point `run-full-test-battery.js` / `phase4g-regression-runner.js` at Express + Postgres
- Keep HTTP assertions; rewrite direct mongoose writes to Prisma

---

## 15. API contract that must be preserved

### Mounts (`/api/v1`)
users, organizations (+ nested tours), bookings, payments, admin/bookings, provider/bookings, contacts, destinations, hotels, news, restaurants, reviews, tours, transports, stats, api-docs.

### Envelopes
- Factory lists: `{ status, results, data: { data: T[] } }`
- Factory one: `{ status, data: { data: T } }`
- Auth: `{ token, data: { user } }`
- Provider/admin bookings: `{ status, results, total, page, limit, data }`
- Payments: `{ status, idempotent?, failed?, data: { payment, booking } }`

### Query (APIFeatures)
`page`, `limit` (cap 100), `sort`, `fields`, `search`, `minPrice`, `maxPrice`, plus resource filters.

### Headers
`Authorization: Bearer`, cookie `jwt`, `X-Org-Context`, `Idempotency-Key`, mock webhook signature headers / `X-Mock-Payment-Outcome`.

### Lookups
Tours/orgs: **ObjectId (24 hex) OR slug**. Public marketplace filters: org approved + public + approvedVersionId; tours `organizationId null` + status active/published OR approved org tours.

---

## 16. Risks discovered

1. Partial unique indexes critical for money path — easy to miss in Prisma-only migrate.
2. ObjectId validators / length-24 slug disambiguation break if UUIDs introduced.
3. Circular Booking.paymentId ↔ Payment.bookingId — draft keeps paymentId denormalized + Payment.bookingId FK.
4. Populate middleware must become explicit `include` — response shape regressions likely.
5. Tour dual slug uniqueness (global + per-org partial) is subtle.
6. Soft-delete User filter easy to forget.
7. Inventory currently non-transactional across docs — races possible under load; PG TX is improvement but must be carefully ported.
8. Hotel/Transport/Restaurant `reviews[]` vs Review table inconsistency.
9. `Restaurant.priceRange` `$` values awkward as Prisma enum identifiers.
10. Upload/Cloudinary incomplete — unrelated but don’t “fix” via Supabase Storage silently.

---

## 17. Anything that cannot safely be mapped yet / open questions

- Exact ETL mapping of existing Atlas ObjectIds → TEXT (should be 1:1 string copy).
- Whether `latestVersionId` should gain a Prisma relation (Mongo is loose pointer).
- Whether to introduce typed nullable FKs for polymorphic booking/review in Phase 2+.
- PostGIS deferred.
- Whether legacy bookings with embedded `payment` need a compatibility view for analytics.
- Prisma cannot represent Mongo `pre(/^find/)` secretTour hiding — must stay in query helpers.

---

## 18. Files created / modified (Phase 0)

| Path | Action |
|------|--------|
| `prisma/schema.prisma` | **Created** (DRAFT; not applied) |
| `docs/prisma-migration-audit.md` | **Created** |

**Not modified:** backend app code, frontend, Render, env secrets, Mongo, Supabase, Mongoose.

---

## 19. Prisma validation

```text
Command: npm exec --yes --package=prisma@6.19.0 -- prisma validate --schema=prisma/schema.prisma
DATABASE_URL: dummy local placeholder only (no connection attempted by validate)
Result: The schema at prisma\schema.prisma is valid
Exit code: 0
```

No `migrate` / `db push` / `db pull` was run. No Atlas or Supabase writes.

---

## 20. Stop line

**Phase 0 complete.** Await explicit approval before Phase 1 (scaffolding, local Postgres, Prisma migrate against non-production only).
