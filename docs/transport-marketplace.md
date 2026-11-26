# Transport Marketplace Lifecycle + Route Inventory + Booking

Prisma-first transport visibility, publish lifecycle, route keys, date-based seat inventory, and customer booking (local Docker PostgreSQL).

## Domain model

Transport is a **scheduled route / seat** catalog offering (bus, air, train, boat, private_vehicle).

It is **not** a separate vehicle-hire request system. `private_vehicle` still uses the same routes + seats model.

```
Transport (routes[] with stable routeKey)
  → TransportRouteInventory (transportId, routeKey, date, seats…)
  → Booking (bookingType=transport, v2)
  → InventoryHold (transportId, routeKey, travelDate)
  → Payment (existing mock flow)
```

## Lifecycle

Organization marketplace approval remains on `ProviderVersion` / `ApprovalRequest`.

Transport resource status uses existing `CatalogStatus`:

| Status | Meaning |
|---|---|
| `draft` | Provider CMS only; never public |
| `active` | Published; public **only if** org is approved + `visibility=public` + `approvedVersionId` (or legacy null-org) |
| `inactive` | Unpublished / suspended; not public |

Transitions (provider, `tour_buses:write` / `bus:write`):

- `POST /organizations/:organizationId/transports/:id/publish` → `active`
- `POST /organizations/:organizationId/transports/:id/unpublish` → `inactive`

Client cannot set `status` via PATCH on org transport routes.

## Public visibility

Public list/detail/routes/availability/booking require:

1. `transport.status === 'active'`
2. Legacy `organizationId == null` **or** org publicly visible

Knowing a draft ID returns **404**.

## Routes

Still embedded JSON on `Transport.routes`. On org create/update, entries are normalized with:

- stable `key` (slug from from/to/departureTime)
- `from`, `to`, `departureTime`, `arrivalTime`, `duration`
- `price` / `priceMinor`, `currency`
- `availableSeats` (template/default — not live stock)
- `active`

Inventory rows reference `routeKey`, not a separate route table.

## Inventory

Table: `transport_route_inventories` (`TransportRouteInventory`)

- Unique `(transportId, routeKey, date)`
- Fields: `totalSeats`, `reservedSeats`, `availableSeats`, optional `priceOverrideMinor`
- CAS reserve/release via conditional SQL `UPDATE … RETURNING`

Provider:

- `GET|POST /organizations/:organizationId/transports/:transportId/inventory`
- `PATCH /organizations/:organizationId/transports/:transportId/inventory/:inventoryId`

Public:

- `GET /transports/:id/availability?travelDate=YYYY-MM-DD&routeKey=`

## Booking flow

```http
POST /api/v1/bookings/transports
Authorization: Bearer …
Idempotency-Key: <unique key>
```

```json
{
  "transportId": "…",
  "routeKey": "addis-bahir-07-00",
  "travelDate": "YYYY-MM-DD",
  "quantity": 1,
  "contactInfo": { "fullName": "…", "email": "…", "phone": "…" }
}
```

Server-side: public bookability → route active → inventory exists → immutable price snapshot → booking `payment_pending` → hold → CAS reserve → mock payment.

Legacy `POST /bookings` still exists but does **not** reserve transport inventory.

## Holds / payment / cancellation

| Event | Booking | Hold | Inventory |
|---|---|---|---|
| Create | `payment_pending` | `held` | seats reserved |
| Payment success | `confirmed` | `consumed` | stays reserved |
| Payment failure | `failed` | released | seats released |
| Customer cancel (pending) | `cancelled` | released | seats released |

Cancellation is idempotent. Paid confirmed cancel uses the existing refund path.

## Idempotency & concurrency

Same key + same fingerprint → `200`. Same key + different payload → `409`.

CAS: `UPDATE … WHERE availableSeats >= quantity`. Concurrent oversell is rejected at the database.

## Authorization

| Actor | Allowed |
|---|---|
| Customer | Book publicly visible transports only |
| Provider (`tour_bus_provider` / `bus_company`) | Manage own org transports + inventory |
| Other org | 403 |
| Admin | Existing admin semantics |

## Tests

```bash
cd backend
npm run prisma:transport
```

## Local development

```bash
docker compose -f docker-compose.prisma.yml up -d
cd backend
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run prisma:generate
# or: node scripts/syncPrismaClient.js
npm run dev:prisma
```

## Known limitations

- No real Chapa / external payment
- No vehicle-hire / calendar-less private charter model
- `routes[].availableSeats` is template capacity, not live stock
- Legacy `POST /bookings` does not reserve seats
- No transport fulfillment check-in ops in this phase
