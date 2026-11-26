# Hotel Marketplace Lifecycle + Room Inventory + Booking

Prisma-first hotel visibility, publish lifecycle, room-type keys, date-based inventory, and customer booking (local Docker PostgreSQL).

## Lifecycle (no second approval system)

Organization marketplace approval remains on `ProviderVersion` / `ApprovalRequest`.

Hotel resource status uses existing `CatalogStatus`:

| Status | Meaning |
|---|---|
| `draft` | Provider CMS only; never public |
| `active` | Published by provider; public **only if** org is approved + `visibility=public` + `approvedVersionId` |
| `inactive` | Unpublished / suspended hotel; not public |

Transitions (provider, `hotels:write`):

- `POST /organizations/:organizationId/hotels/:id/publish` → `active`
- `POST /organizations/:organizationId/hotels/:id/unpublish` → `inactive`

Client cannot set `status` via PATCH body on org hotel routes.

## Public visibility

Public list/detail/availability/booking require:

1. `hotel.status === 'active'`
2. Legacy `organizationId == null` **or** org publicly visible (`approvalStatus=approved`, `visibility=public`, `approvedVersionId` set)

`GET /api/v1/hotels/:id` and hotel booking use public visibility — knowing a draft ID returns **404**.

## Room types

Still embedded JSON on `Hotel.roomTypes`. On create/update, entries are normalized with:

- stable `key` (slug)
- `name` / legacy `type`
- `capacity`, `price` / `priceMinor`, `currency`
- `amenities`, `images`, `active`, `availableRooms` (legacy)

Inventory rows and bookings reference `roomTypeKey`, not a separate room-type table.
Inactive room types cannot be booked.

## Daily inventory

Table: `hotel_daily_inventories` (`HotelDailyInventory`)

- Unique `(hotelId, roomTypeKey, date)`
- Fields: `totalRooms`, `reservedRooms`, `availableRooms`, optional `priceOverrideMinor`
- CAS reserve/release via conditional SQL `UPDATE … RETURNING` (same pattern as tour departures)
- Multi-night reserve runs in one Prisma transaction; any night failure rolls back all nights

Provider (org-scoped):

- `GET|POST /organizations/:organizationId/hotels/:hotelId/inventory`
- `PATCH /organizations/:organizationId/hotels/:hotelId/inventory/:inventoryId`

Public:

- `GET /hotels/:hotelId/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomTypeKey=`

Checkout night is **not** inventory-gated for a stay (nights = `[checkIn … checkOut)`).

## Booking flow

Reuses the polymorphic `Booking` model (`bookingType: hotel`, `bookingFlowVersion: v2`) — no separate `HotelBooking` table.

```http
POST /api/v1/bookings/hotels
Authorization: Bearer …
Idempotency-Key: <unique key>
```

```json
{
  "hotelId": "…",
  "roomTypeKey": "standard",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "quantity": 1,
  "contactInfo": { "fullName": "…", "email": "…", "phone": "…" }
}
```

Server-side:

1. Validate public bookability, room type, dates, quantity
2. Build immutable `priceSnapshot` from base room price + per-night `priceOverrideMinor`
3. Create booking `payment_pending`
4. Create `InventoryHold` (hotel fields: `hotelId`, `roomTypeKey`, `nights[]`)
5. Atomic multi-night CAS reserve
6. Create mock `Payment` (organizationId nullable for legacy null-org hotels)

Legacy `POST /bookings` still exists for older clients but does **not** reserve hotel inventory.

## Holds / payment / cancellation

| Event | Booking | Hold | Inventory |
|---|---|---|---|
| Create | `payment_pending` | `held` | reserved for stay nights |
| Payment success | `confirmed` | `consumed` | stays reserved |
| Payment failure | `failed` | released | nights released |
| Customer cancel (pending) | `cancelled` | released | nights released |
| Hold expire | `expired` | expired | nights released |

Cancellation is idempotent: a second cancel returns `idempotent: true` and does not double-release.

Paid confirmed bookings still use the existing refund cancellation path (same as tours).

## Price snapshots

`unitPriceMinor` = sum of nightly rates for **one** room across reserved nights.  
`totalMinor` = `unitPriceMinor × quantity`.

Nightly rate = inventory `priceOverrideMinor` when set, else room type base (`priceMinor` / `price × 100`).

Do not recompute totals from live hotel prices after booking creation.

## Idempotency

Same `Idempotency-Key` + same fingerprint → `200` with original booking.  
Same key + different payload → `409`.

Fingerprint includes hotelId, roomTypeKey, checkIn/out, quantity, contactInfo.

## Concurrency

CAS: `UPDATE … WHERE availableRooms >= quantity`. Concurrent oversell is rejected at the database level. Multi-night failures leave all nights unchanged (transaction rollback).

## Authorization

| Actor | Allowed |
|---|---|
| Customer | Book publicly visible hotels only |
| Provider | Manage inventory for own org hotels; cannot bypass public visibility when booking as customer |
| Other org | Cannot mutate another org’s inventory (403) |
| Admin | Existing admin booking semantics |

## Workspace summary extras

`GET …/workspace` `summary` may include:

- `activeRoomTypeCount`
- `inventoryDayCount`
- `lowAvailabilityDayCount` (availableRooms ≤ 2)

## Tests

```bash
cd backend
npm run prisma:hotel
npm run prisma:hotel-booking
```

## Out of scope

- Real Chapa / external payment credentials
- Transport inventory
- Per-hotel ApprovalRequest workflow
- Production cutover
