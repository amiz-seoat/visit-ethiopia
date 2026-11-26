# Transport Provider Fulfillment + Booking Operations

Prisma-first operational workflow for paid transport bookings. Reuses the existing polymorphic provider booking / fulfillment architecture (same as tours).

## Provider booking access

Routes (unchanged paths):

- `GET /api/v1/provider/bookings`
- `GET /api/v1/provider/bookings/:id`
- `POST /api/v1/provider/bookings/:id/check-in`
- `POST /api/v1/provider/bookings/:id/complete`
- `POST /api/v1/provider/bookings/:id/no-show`
- `POST /api/v1/provider/bookings/:id/notes`
- `GET /api/v1/provider/bookings/:id/audits`

Admin:

- `GET /api/v1/admin/bookings`
- `GET /api/v1/admin/bookings/:id`

Organization scope comes from validated `X-Org-Context` (or admin org bypass). Client-supplied `organizationId` is stripped.

## Authorization

| Actor | Permission | Notes |
|---|---|---|
| Travel company | `bookings:read` / `bookings:manage` | Existing |
| Tour bus / bus company | `bookings:read` / `bookings:manage` | Added for transport ops |
| Customer | none | Fulfillment endpoints → 403 |
| Other org | — | Detail/ops → 404 (no existence leak) |
| Admin | platform admin + optional org bypass | Can inspect/operate |

Prisma fulfillment booking types: `tour`, `transport`.

Mongo remains tour-only for v2 (schema validation) — legacy regression unchanged.

## Status transitions

Financial booking must be `confirmed` (paid).

Fulfillment (`fulfillmentStatus`):

| From | Allowed |
|---|---|
| `confirmed` | `checked_in`, `completed`, `no_show` |
| `checked_in` | `completed` |
| `completed` / `no_show` | terminal |

Repeated check-in / complete / no-show on the same terminal state returns `idempotent: true`.

Invalid transitions → `409`.

## Check-in / complete / no-show

- Check-in: `confirmed` → `checked_in` (+ `checkedInAt`)
- Complete: `confirmed` or `checked_in` → `completed` (+ `fulfillmentCompletedAt`)
- No-show: `confirmed` → `no_show` (+ `noShowAt`); blocked from `checked_in` / `completed`

Actions append `BookingOperationAudit` records (`check_in`, `complete`, `no_show`).

Mass-assignment of financial/inventory fields is rejected.

## Cancellation interaction

Provider cancel remains deferred (`405`). Customer/admin refund cancel paths are unchanged.

Unpaid `payment_pending` cancel releases transport seat inventory via the existing hold release path.

## Inventory interaction

- Booking + payment reserves seats.
- Check-in / complete / no-show **do not** change `TransportRouteInventory`.
- Cancel / payment failure / refund release inventory only when the existing booking lifecycle says so.

## Filters (provider list)

Useful query params:

- `bookingType=tour|transport`
- `status`
- `transportId`
- `routeKey`
- `travelDate`
- `paymentStatus`
- `customerSearch`
- pagination (`page`, `limit`)

## Frontend

- Provider bookings list supports type filter and transport service columns.
- Booking detail shows transport/route block when `bookingType=transport`.
- Workspace shows a compact transport bookings panel with link to manage ops.

## Tests

```bash
cd backend
npm run prisma:transport-fulfillment
```

## Known limitations

- No provider-initiated financial cancellation (deferred by design).
- Hotel v2 fulfillment not enabled in this phase.
- Mongo cannot create transport v2 bookings (schema); Prisma is the development path.
- No Chapa; mock payments only.
