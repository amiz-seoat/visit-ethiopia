# Hotel Provider Fulfillment + Guest Operations

Prisma-first operational workflow for paid hotel bookings. Reuses the shared polymorphic provider booking / fulfillment architecture with **hotel-specific** stay semantics.

## Hotel booking operations

Lifecycle (fulfillment):

```
confirmed  →  checked_in  →  completed   (check-out)
confirmed  →  no_show
```

Financial `Booking.status` stays `confirmed` through check-in / check-out / no-show. Cancellation and refunds remain on the existing customer/admin paths.

## Check-in / check-out lifecycle

| Action | From | To | Notes |
|---|---|---|---|
| Check-in | `confirmed` | `checked_in` | Arrival day (UTC `YYYY-MM-DD`) must have started |
| Check-out | `checked_in` | `completed` | Hotels cannot skip check-in |
| No-show | `confirmed` | `no_show` | Arrival day must have started; blocked after check-in |

Repeated check-in / check-out / no-show on the same terminal state returns `idempotent: true`. Invalid transitions → `409`.

Stay dates come from `priceSnapshot` / `bookingDetails` (`checkIn`, `checkOut`) as UTC calendar dates — same convention as `HotelDailyInventory`.

## No-show behavior

- Does **not** refund payment (no invented policy).
- Does **not** release reserved room inventory (conservative; inventory release remains cancel/fail/refund only).
- Records `BookingOperationAudit` with action `no_show`.

## Provider authorization

| Actor | Permission | Notes |
|---|---|---|
| Hotel org | `bookings:read` / `bookings:manage` | Added for hotel provider types |
| Customer | none | Fulfillment → 403 |
| Other org | — | Detail/ops → 404 (anti-leak) |
| Admin | platform admin + optional org bypass | Can inspect/operate |

Prisma fulfillment booking types: `tour`, `transport`, `hotel`.

Mongo remains tour-only for v2 fulfillment (legacy).

## Admin operations

Existing admin endpoints:

- `GET /api/v1/admin/bookings`
- `GET /api/v1/admin/bookings/:id`

Admin may also use provider fulfillment routes with validated org bypass.

## Inventory interaction

- Booking + payment reserves every night in `[checkIn, checkOut)`.
- Check-in / check-out / no-show **do not** change `HotelDailyInventory`.
- Cancel / payment failure / refund release inventory via the existing lifecycle only.

## Cancellation / refund interaction

Provider cancel remains deferred (`405`). Customer/admin refund cancel paths are unchanged and continue to release nights when applicable.

## API endpoints

Unchanged paths (hotel now included on Prisma):

- `GET /api/v1/provider/bookings` — filters: `bookingType=hotel`, `hotelId`, `checkIn`, `checkOut`, `status`, …
- `GET /api/v1/provider/bookings/:id`
- `POST /api/v1/provider/bookings/:id/check-in`
- `POST /api/v1/provider/bookings/:id/check-out` — hotel alias → `completed` (audit action `check_out`)
- `POST /api/v1/provider/bookings/:id/complete` — same transition; hotel still requires prior check-in
- `POST /api/v1/provider/bookings/:id/no-show`
- `POST /api/v1/provider/bookings/:id/notes`
- `GET /api/v1/provider/bookings/:id/audits`

## Frontend

- Provider bookings list supports hotel type filter and stay columns.
- Booking detail shows hotel stay block + Check in / Check out / No-show.
- Workspace shows a compact hotel bookings panel.

## Tests

```bash
cd backend
npm run prisma:hotel-fulfillment
```

## Schema note

Local migration `20261105105804_hotel_fulfillment_check_out_audit` adds `BookingAuditAction.check_out` (applied only to Docker PostgreSQL `:5434`).

## Known limitations

- No provider-initiated financial cancellation (deferred).
- No-show does not auto-refund or release inventory (documenting ambiguity: product may later define a paid no-show release policy).
- Arrival/no-show day gates use UTC calendar dates (inventory convention), not a hotel-local timezone.
- Mongo cannot create hotel v2 bookings for fulfillment.
- No Chapa; mock payments only.
