/**
 * Booking configuration and status constants (Phase 4).
 * Values are read from environment with safe defaults.
 */

export const BOOKING_FLOW_VERSIONS = ['legacy', 'v2']

/** Statuses used by pre-Phase-4 bookings and non-tour flows. */
export const LEGACY_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
]

/** Statuses for v2 tour departure bookings. */
export const V2_BOOKING_STATUSES = [
  'pending',
  'payment_pending',
  'confirmed',
  'failed',
  'expired',
  'cancelled',
  'completed',
  'partially_refunded',
]

export const ALL_BOOKING_STATUSES = [
  ...new Set([...LEGACY_BOOKING_STATUSES, ...V2_BOOKING_STATUSES]),
]

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]

export const PAYMENT_ATTEMPT_STATUSES = ['pending', 'succeeded', 'failed']

export const REFUND_STATUSES = ['pending', 'processing', 'completed', 'failed']

export const PAYMENT_PROVIDERS = ['mock']

/**
 * Operational fulfillment state (Phase 4I) — separate from financial booking.status.
 * Only meaningful for v2 tour bookings.
 */
export const FULFILLMENT_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'cancelled',
]

/** Allowed fulfillmentStatus transitions (server-controlled). */
export const FULFILLMENT_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'completed', 'no_show', 'cancelled'],
  checked_in: ['completed', 'cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
}

export function canTransitionFulfillment(fromStatus, toStatus) {
  const allowed = FULFILLMENT_TRANSITIONS[fromStatus] || []
  return allowed.includes(toStatus)
}

/** Default hold window before payment_pending bookings expire. */
export function getPaymentPendingMinutes() {
  const value = Number(process.env.BOOKING_PAYMENT_PENDING_MINUTES)
  if (!Number.isFinite(value) || value < 1) return 15
  return Math.floor(value)
}

/** Maximum quantity per v2 tour booking request. */
export function getMaxBookingQuantity() {
  const value = Number(process.env.BOOKING_MAX_QUANTITY)
  if (!Number.isFinite(value) || value < 1) return 50
  return Math.floor(value)
}

/** Hours before departure when paid bookings can no longer be cancelled by customer. */
export function getCancellationCutoffHours() {
  const value = Number(process.env.BOOKING_CANCELLATION_CUTOFF_HOURS)
  if (!Number.isFinite(value) || value < 0) return 48
  return value
}

/**
 * Refund percent of remaining payment when cancel is outside the cutoff window.
 * Default 100 (full refund). Integer 0–100 only.
 */
export function getRefundPercentOutsideCutoff() {
  const value = Number(process.env.BOOKING_REFUND_PERCENT_OUTSIDE_CUTOFF)
  if (!Number.isFinite(value) || value < 0 || value > 100) return 100
  return Math.floor(value)
}

/**
 * Refund percent when cancel is inside the cutoff window.
 * Default 0 (non-refundable / reject for customers). Integer 0–100 only.
 */
export function getRefundPercentInsideCutoff() {
  const value = Number(process.env.BOOKING_REFUND_PERCENT_INSIDE_CUTOFF)
  if (!Number.isFinite(value) || value < 0 || value > 100) return 0
  return Math.floor(value)
}

export function isLegacyBookingFlow(booking) {
  return !booking?.bookingFlowVersion || booking.bookingFlowVersion === 'legacy'
}

export function isV2BookingFlow(booking) {
  return booking?.bookingFlowVersion === 'v2'
}

export default {
  BOOKING_FLOW_VERSIONS,
  LEGACY_BOOKING_STATUSES,
  V2_BOOKING_STATUSES,
  ALL_BOOKING_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_ATTEMPT_STATUSES,
  REFUND_STATUSES,
  PAYMENT_PROVIDERS,
  getPaymentPendingMinutes,
  getCancellationCutoffHours,
  getRefundPercentOutsideCutoff,
  getRefundPercentInsideCutoff,
  getMaxBookingQuantity,
  isLegacyBookingFlow,
  isV2BookingFlow,
  FULFILLMENT_STATUSES,
  FULFILLMENT_TRANSITIONS,
  canTransitionFulfillment,
}
