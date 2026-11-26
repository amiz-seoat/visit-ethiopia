-- Phase 4: partial unique indexes for booking idempotency / inventory (LOCAL Docker only)
-- Matches Mongo partial unique indexes documented in prisma schema comments.

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_user_idempotency_v2_uidx"
  ON "bookings" ("user", "idempotencyKey")
  WHERE "bookingFlowVersion" = 'v2' AND "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_booking_idempotency_uidx"
  ON "payments" ("bookingId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "refunds_user_booking_idempotency_uidx"
  ON "refunds" ("userId", "bookingId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_holds_active_booking_uidx"
  ON "inventory_holds" ("bookingId")
  WHERE status IN ('pending', 'held', 'consumed');
