# Testing report

Date: 2026-11-27. Every number below comes from a run that was actually executed. Anything not executed is marked **MANUAL VERIFICATION REQUIRED**.

## Summary

| Area | Result |
|---|---|
| Backend: Prisma/PostgreSQL integration suites (`npm test`) | **12 / 12 suites, 317 / 317 checks passed** |
| Backend: legacy MongoDB regression battery | **11 / 11 suites, 319 / 319 checks passed** |
| Frontend: unit tests (`vitest run`) | **17 / 17 passed** |
| Frontend: production build (`vite build`) | **Passes** |
| Frontend: TypeScript type-check (`tsc --noEmit`) | **63 errors, all pre-existing.** Unused imports and loose union types; none were introduced by this work. Vite doesn't type-check, so the build is unaffected. |
| Local browser end-to-end (tour booking) | **Passed** (see below) |
| Deployed API | **Not yet verifiable.** The Render service needs the database URLs (owner action). |
| Deployed frontend | Root and SPA deep links return 200 |

## Backend: Prisma suites

`cd backend && npm test` runs every suite against the **local** Docker PostgreSQL in `config.env`. Each suite starts the real Express app on its own port and calls it over HTTP. Suites create their own fixtures and clean them up.

| Suite | Checks | What it covers |
|---|---|---|
| identity | 31 | Signup, login, JWT cookie and bearer, password change and reset, role restrictions, inactive users |
| booking | 26 | Tour booking, server-side pricing, inventory holds, payment-pending expiry, cancellation and refunds |
| parity | 19 | API responses match the legacy Mongo shapes |
| ownership | 11 | Cross-organization access is denied on every provider resource |
| workspace | 24 | Provider workspace: members, permissions, tour and departure management |
| hotel | 25 | Hotel marketplace, room types, daily inventory, visibility rules |
| hotel-booking | 28 | Hotel booking across nights, inventory consumption and release |
| hotel-fulfillment | 28 | Check-in, check-out, no-show, provider booking views |
| transport | 35 | Transport marketplace, routes, per-date seat inventory |
| transport-fulfillment | 25 | Boarding, no-show, provider booking views |
| chapa | 44 | Chapa payments against a **fake Chapa API** (no network calls): config and provider selection, `/confirm` rejected for Chapa payments, owner-only checkout, checkout-link reuse, forged browser callback does **not** confirm, missing or invalid webhook signature rejected, failed payment is retryable, amount mismatch flagged, signed webhook confirms after verify, inventory consumed exactly once, duplicate webhook idempotent, late payment after hold expiry flagged (not confirmed), production guards (mock disabled when not allowed, 503 when no provider), refunds: other users can't cancel; a refund rejected by Chapa leaves the booking confirmed with seats held; a successful refund calls Chapa `/refund/{verified tx_ref}` with the server-computed amount, cancels the booking and releases seats |
| tour-visibility | 21 | Organization tours listed only when the org is approved, public and has an approved version; drafts, secret tours and non-approved orgs hidden from list, detail and departures; `?status=` and `?secretTour=` can't override visibility; org snapshot omits private fields; hiding an org hides its tours immediately |
| **Total** | **317** | |

Bugs found and fixed while building these suites:
- Reconciliation in Prisma mode called Mongoose (`Booking.findById`, `Refund.findOne`), so stale bookings were never expired.
- Prisma public tour queries were hard-coded to legacy tours, so provider tours never appeared. Separately, `?status=draft` and `?secretTour=true` could widen public results.
- The error handler hung requests when `NODE_ENV` was unset.

## Backend: legacy MongoDB battery

Run against an in-memory MongoDB with `DATABASE_MODE=mongo`. Production doesn't use this path. The battery was run to confirm the shared code changes (payments, error handling, app setup) didn't break it.

| Suite | Checks |
|---|---|
| full-integration-suite | 53 |
| e2e-new-features | 24 |
| ownership-security | 15 |
| org-membership-security | 22 |
| approval-versioning | 38 |
| phase2-hardening | 34 |
| phase2-audit | 52 |
| phase3-tour-marketplace | 22 |
| phase3-hardening | 31 |
| phase3-final-audit | 10 |
| phase3-production-gate | 18 |
| **Total** | **319** |

The battery ran before the final tour-visibility fix. That fix only touches `repositories/prisma/catalogRepository.js`, which the Mongo path never loads.

## Frontend

- `vitest run`: 17 / 17 tests pass. They cover booking request building and validation (`src/api/__tests__/bookings.test.ts`, `src/utils/__tests__/bookingValidation.test.ts`).
- `vite build` passes. The production build refuses to run without `VITE_API_URL` or `VITE_API_BASE_URL`.

## Local browser end-to-end

This ran in Chrome against the local stack: API on `localhost:4002` with PostgreSQL, frontend on `localhost:5200`, local seed traveler account.

| Step | Result |
|---|---|
| `/tours` lists the demo provider tours with images and ETB prices | ✅ |
| Tour detail shows provider name, itinerary, 8 departures, packages | ✅ |
| Sign in redirects back to the tour | ✅ |
| Select departure, package, quantity and contact, then "Continue to checkout" | ✅ Booking created, status *payment pending*, 15-min hold, server total 9,500 ETB |
| "Confirm demo payment" | ✅ Booking *Confirmed*, payment *Completed* |
| Inventory | ✅ Departure seats went from 12 to 11 |

Issues found and fixed in this pass:
- Prices showed a hard-coded `$`.
- Departure dates showed "03:00 AM" and could shift by a day west of UTC.
- The quantity field said "Sold out" before a departure was chosen.
- The browser tab title was "Vite + React + TS".

Hotel booking, transport booking, provider workspace and admin approval were **not** clicked through in the browser in this pass. Their API behaviour is covered by the suites above. Browser walk-throughs of those flows: **MANUAL VERIFICATION REQUIRED**.

## Deployed environment

| Check | Result |
|---|---|
| `https://visit-ethiopia-rw9b.vercel.app/` | 200 |
| `https://visit-ethiopia-rw9b.vercel.app/tours` (deep link) | 200 |
| `https://visit-ethiopia-api.onrender.com/health` | Timed out. The service can't deploy until the owner adds `DATABASE_URL` and `DIRECT_URL` (see PRODUCTION_DEPLOYMENT.md §2). |
| Neon production database | Migrations applied (7). Demo content seeded and counts checked by query. |

Once the API is live, run the curl checks in PRODUCTION_DEPLOYMENT.md §2.5. The following are **MANUAL VERIFICATION REQUIRED**, because the production API isn't reachable and an agent must not sign in to production accounts:
- browsing from the deployed frontend;
- signup and login;
- booking with demo payment;
- CORS from the Vercel origin;
- a Chapa test-mode payment (needs test keys).

## Re-running

```bash
docker compose -f docker-compose.prisma.yml up -d
cd backend && npm test                      # all Prisma suites
npm test -- chapa                           # one suite by name
cd ../frontend && npm test && npm run build
```
