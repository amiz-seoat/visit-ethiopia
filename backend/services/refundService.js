import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'
import Refund from '../models/Refund.js'
import AppError from '../utils/appError.js'
import {
  getCancellationCutoffHours,
  getRefundPercentInsideCutoff,
  getRefundPercentOutsideCutoff,
  isLegacyBookingFlow,
  isV2BookingFlow,
} from '../config/booking.js'
import { restoreConsumedForBooking } from './bookingInventoryService.js'
import {
  assertV2Transition,
  cancelV2Booking,
} from './bookingLifecycleService.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'
import { cancelStalePayment } from './paymentService.js'

const REFUND_BLOCKED_BODY = [
  'amount',
  'amountMinor',
  'refundAmount',
  'currency',
  'total',
  'price',
  'status',
  'provider',
  'bookingId',
  'paymentId',
  'organizationId',
  'providerRefundId',
  'userId',
]

const IDEMPOTENCY_KEY_MIN = 8
const IDEMPOTENCY_KEY_MAX = 128
const IDEMPOTENCY_KEY_PATTERN = /^[\w-]+$/

export function serializeRefund(refund) {
  const doc = refund.toObject ? refund.toObject() : { ...refund }
  return {
    _id: doc._id,
    bookingId: doc.bookingId,
    paymentId: doc.paymentId,
    organizationId: doc.organizationId,
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    provider: doc.provider,
    status: doc.status,
    reason: doc.reason,
    providerRefundId: doc.providerRefundId,
    requestedAt: doc.requestedAt,
    processingAt: doc.processingAt,
    completedAt: doc.completedAt,
    failedAt: doc.failedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function rejectRefundBodyFields(body = {}) {
  for (const field of REFUND_BLOCKED_BODY) {
    if (body[field] !== undefined) {
      throw new AppError(`Field ${field} is not allowed in refund request`, 400)
    }
  }
}

export function validateRefundIdempotencyKey(key, { required = false } = {}) {
  if (key == null || key === '') {
    if (required) throw new AppError('Idempotency-Key is required', 400)
    return null
  }
  if (typeof key !== 'string') {
    throw new AppError('Idempotency-Key must be a string', 400)
  }
  const trimmed = key.trim()
  if (
    trimmed.length < IDEMPOTENCY_KEY_MIN ||
    trimmed.length > IDEMPOTENCY_KEY_MAX ||
    !IDEMPOTENCY_KEY_PATTERN.test(trimmed)
  ) {
    throw new AppError(
      'Idempotency-Key must be 8–128 characters (letters, numbers, underscore, hyphen)',
      400
    )
  }
  return trimmed
}

function getDepartureDate(booking) {
  const raw = booking.priceSnapshot?.departureDate
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Server-side cancellation/refund eligibility for a paid v2 booking.
 */
export function evaluateRefundEligibility(booking, payment, { isAdmin = false } = {}) {
  if (!isV2BookingFlow(booking)) {
    return { eligible: false, code: 'NOT_V2', message: 'Refunds apply only to v2 bookings' }
  }

  if (!['confirmed', 'partially_refunded'].includes(booking.status)) {
    return {
      eligible: false,
      code: 'INVALID_BOOKING_STATUS',
      message: `Cannot refund booking in status ${booking.status}`,
    }
  }

  if (!payment) {
    return { eligible: false, code: 'NO_PAYMENT', message: 'Booking has no payment' }
  }

  if (!['completed', 'partially_refunded'].includes(payment.status)) {
    return {
      eligible: false,
      code: 'PAYMENT_NOT_REFUNDABLE',
      message: `Payment status ${payment.status} is not refundable`,
    }
  }

  const amountRefunded = payment.amountRefundedMinor || 0
  const remaining = payment.amountMinor - amountRefunded
  if (remaining <= 0 || payment.status === 'refunded') {
    return {
      eligible: false,
      code: 'ALREADY_REFUNDED',
      message: 'Payment has already been fully refunded',
    }
  }

  const departureDate = getDepartureDate(booking)
  const cutoffHours = getCancellationCutoffHours()
  const now = new Date()
  let insideCutoff = false
  if (departureDate) {
    const cutoffMs = cutoffHours * 60 * 60 * 1000
    insideCutoff = departureDate.getTime() - now.getTime() < cutoffMs
  }

  const percent = insideCutoff
    ? getRefundPercentInsideCutoff()
    : getRefundPercentOutsideCutoff()

  if (percent <= 0 && !isAdmin) {
    return {
      eligible: false,
      code: 'NON_REFUNDABLE',
      message: insideCutoff
        ? 'Booking is inside the cancellation cutoff and is non-refundable'
        : 'Booking is not eligible for refund under current policy',
      insideCutoff,
      remainingMinor: remaining,
      eligibleRefundMinor: 0,
    }
  }

  // Admin may force 100% of remaining when customer policy is 0.
  const effectivePercent = percent <= 0 && isAdmin ? 100 : percent
  const eligibleRefundMinor = Math.floor((remaining * effectivePercent) / 100)

  if (eligibleRefundMinor <= 0) {
    return {
      eligible: false,
      code: 'ZERO_REFUND',
      message: 'Eligible refund amount is zero',
      insideCutoff,
      remainingMinor: remaining,
      eligibleRefundMinor: 0,
    }
  }

  return {
    eligible: true,
    insideCutoff,
    remainingMinor: remaining,
    eligibleRefundMinor,
    percent: effectivePercent,
    currency: payment.currency,
  }
}

async function applyPaymentRefundTotals(payment, refundAmountMinor) {
  const nextRefunded = (payment.amountRefundedMinor || 0) + refundAmountMinor
  if (nextRefunded > payment.amountMinor) {
    throw new AppError('Refund would exceed payment amount', 409)
  }

  const nextStatus =
    nextRefunded >= payment.amountMinor ? 'refunded' : 'partially_refunded'

  const updated = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: { $in: ['completed', 'partially_refunded'] },
      amountRefundedMinor: payment.amountRefundedMinor || 0,
    },
    {
      amountRefundedMinor: nextRefunded,
      status: nextStatus,
    },
    { new: true }
  )

  if (!updated) {
    const current = await Payment.findById(payment._id)
    if (
      current &&
      (current.amountRefundedMinor || 0) >= (payment.amountRefundedMinor || 0) + refundAmountMinor
    ) {
      return { payment: current, idempotent: true }
    }
    throw new AppError('Payment refund update conflict', 409)
  }

  return { payment: updated, idempotent: false }
}

async function finalizeBookingAfterRefund({ booking, payment, reason }) {
  const fullyRefunded =
    payment.status === 'refunded' ||
    (payment.amountRefundedMinor || 0) >= payment.amountMinor

  if (fullyRefunded) {
    if (booking.status === 'cancelled') {
      await restoreConsumedForBooking({
        bookingId: booking._id,
        reason: reason || 'refund_cancelled',
      })
      return { booking, inventoryRestored: false, idempotent: true }
    }

    if (!['confirmed', 'partially_refunded'].includes(booking.status)) {
      throw new AppError(`Cannot cancel booking in status ${booking.status}`, 409)
    }

    assertV2Transition(booking.status, 'cancelled')

    const inventoryResult = await restoreConsumedForBooking({
      bookingId: booking._id,
      reason: reason || 'refund_cancelled',
    })

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: { $in: ['confirmed', 'partially_refunded'] } },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason || 'refunded',
        inventoryReserved: false,
      },
      { new: true }
    ).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })

    if (!updated) {
      const current = await Booking.findById(booking._id).setOptions({
        skipUserPopulate: true,
        skipBookingItemPopulate: true,
      })
      if (current?.status === 'cancelled') {
        return {
          booking: current,
          inventoryRestored: inventoryResult.restored,
          idempotent: true,
        }
      }
      throw new AppError('Booking cancellation after refund conflict', 409)
    }

    return {
      booking: updated,
      inventoryRestored: inventoryResult.restored,
      idempotent: false,
    }
  }

  // Partial refund: mark booking partially_refunded, keep inventory consumed.
  if (booking.status === 'confirmed') {
    assertV2Transition(booking.status, 'partially_refunded')
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: 'confirmed' },
      { status: 'partially_refunded' },
      { new: true }
    ).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    return {
      booking: updated || booking,
      inventoryRestored: false,
      idempotent: !updated,
    }
  }

  return { booking, inventoryRestored: false, idempotent: true }
}

async function completeRefundRecord(refund, providerRefundId) {
  const completed = await Refund.findOneAndUpdate(
    { _id: refund._id, status: 'processing' },
    {
      status: 'completed',
      providerRefundId,
      completedAt: new Date(),
      failureCode: null,
      failureMessage: null,
    },
    { new: true }
  )
  if (completed) return completed

  const current = await Refund.findById(refund._id)
  if (current?.status === 'completed') return current
  throw new AppError('Refund completion conflict', 409)
}

async function failRefundRecord(refund, { failureCode, failureMessage, providerRefundId }) {
  const failed = await Refund.findOneAndUpdate(
    { _id: refund._id, status: { $in: ['pending', 'processing'] } },
    {
      status: 'failed',
      failedAt: new Date(),
      failureCode,
      failureMessage,
      providerRefundId: providerRefundId || refund.providerRefundId,
    },
    { new: true }
  )
  if (failed) return failed
  const current = await Refund.findById(refund._id)
  if (current?.status === 'failed') return current
  throw new AppError('Refund failure transition conflict', 409)
}

/**
 * Process an already-created refund through the provider and finalize state.
 */
export async function processRefund({
  refund,
  payment,
  booking,
  mockOutcome = 'success',
}) {
  const processing = await Refund.findOneAndUpdate(
    { _id: refund._id, status: { $in: ['pending', 'failed'] } },
    {
      status: 'processing',
      processingAt: new Date(),
      failedAt: null,
      failureCode: null,
      failureMessage: null,
    },
    { new: true }
  )

  if (!processing) {
    const current = await Refund.findById(refund._id)
    if (current?.status === 'completed') {
      return {
        refund: current,
        payment,
        booking,
        idempotent: true,
        failed: false,
      }
    }
    if (current?.status === 'processing') {
      throw new AppError('Refund is already processing', 409)
    }
    throw new AppError('Refund cannot be processed', 409)
  }

  const provider = getPaymentProvider(payment.provider || 'mock')
  const providerResult = await provider.refundPayment({
    payment,
    refund: processing,
    mockOutcome,
  })

  if (!providerResult.success) {
    const failed = await failRefundRecord(processing, {
      failureCode: providerResult.failureCode || 'REFUND_FAILED',
      failureMessage: providerResult.failureMessage || 'Refund failed',
      providerRefundId: providerResult.providerRefundId,
    })
    const refreshedBooking = await Booking.findById(booking._id).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    return {
      refund: failed,
      payment,
      booking: refreshedBooking,
      idempotent: false,
      failed: true,
    }
  }

  const completedRefund = await completeRefundRecord(
    processing,
    providerResult.providerRefundId
  )

  let updatedPayment
  try {
    const paymentResult = await applyPaymentRefundTotals(
      payment,
      completedRefund.amountMinor
    )
    updatedPayment = paymentResult.payment
  } catch (err) {
    // Provider succeeded — leave refund completed; reconciliation can finish payment.
    throw new AppError(
      err.message || 'Refund completed but payment update failed; retry reconciliation',
      409
    )
  }

  let bookingResult
  try {
    bookingResult = await finalizeBookingAfterRefund({
      booking,
      payment: updatedPayment,
      reason: completedRefund.reason,
    })
  } catch (err) {
    throw new AppError(
      err.message || 'Refund completed but booking finalization failed; retry',
      409
    )
  }

  return {
    refund: completedRefund,
    payment: updatedPayment,
    booking: bookingResult.booking,
    inventoryRestored: bookingResult.inventoryRestored,
    idempotent: false,
    failed: false,
  }
}

/**
 * Create and process a refund for a paid v2 booking cancellation.
 */
export async function refundAndCancelBookingForUser({
  booking,
  user,
  body = {},
  idempotencyKey = null,
  mockOutcome = 'success',
  reason = null,
}) {
  rejectRefundBodyFields(body)
  const confirmKey = validateRefundIdempotencyKey(idempotencyKey, { required: true })

  if (isLegacyBookingFlow(booking)) {
    throw new AppError('Use legacy cancel for this booking', 400)
  }
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Refunds apply only to v2 bookings', 400)
  }

  const ownerId = booking.user?.toString?.() ?? String(booking.user)
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'
  if (!isOwner && !isAdmin) {
    throw new AppError('Booking not found', 404)
  }

  if (booking.status === 'cancelled') {
    const existing = await Refund.findOne({
      bookingId: booking._id,
      status: 'completed',
    }).sort('-completedAt')
    return {
      booking,
      payment: booking.paymentId ? await Payment.findById(booking.paymentId) : null,
      refund: existing,
      idempotent: true,
      failed: false,
    }
  }

  if (!booking.paymentId) {
    throw new AppError('Confirmed booking is missing payment', 500)
  }

  const payment = await Payment.findById(booking.paymentId)
  if (!payment) throw new AppError('Payment not found', 404)

  const eligibility = evaluateRefundEligibility(booking, payment, { isAdmin })
  if (!eligibility.eligible) {
    throw new AppError(eligibility.message, 409)
  }

  const existingByKey = await Refund.findOne({
    userId: user.id,
    bookingId: booking._id,
    idempotencyKey: confirmKey,
  })

  if (existingByKey) {
    if (existingByKey.amountMinor !== eligibility.eligibleRefundMinor) {
      throw new AppError(
        'Idempotency-Key was already used with a different refund request',
        409
      )
    }
    if (existingByKey.status === 'completed') {
      const refreshedPayment = await Payment.findById(payment._id)
      const refreshedBooking = await Booking.findById(booking._id).setOptions({
        skipUserPopulate: true,
        skipBookingItemPopulate: true,
      })
      // Repair incomplete saga if needed.
      if (
        refreshedPayment &&
        (refreshedPayment.amountRefundedMinor || 0) < existingByKey.amountMinor
      ) {
        return processRefund({
          refund: existingByKey,
          payment: refreshedPayment,
          booking: refreshedBooking,
          mockOutcome,
        })
      }
      if (
        refreshedBooking &&
        ['confirmed', 'partially_refunded'].includes(refreshedBooking.status) &&
        refreshedPayment?.status === 'refunded'
      ) {
        const repaired = await finalizeBookingAfterRefund({
          booking: refreshedBooking,
          payment: refreshedPayment,
          reason: existingByKey.reason,
        })
        return {
          refund: existingByKey,
          payment: refreshedPayment,
          booking: repaired.booking,
          idempotent: true,
          failed: false,
        }
      }
      return {
        refund: existingByKey,
        payment: refreshedPayment,
        booking: refreshedBooking,
        idempotent: true,
        failed: false,
      }
    }
    if (existingByKey.status === 'processing') {
      throw new AppError('Refund is already processing', 409)
    }
    // pending or failed → retry with same record
    return processRefund({
      refund: existingByKey,
      payment,
      booking,
      mockOutcome,
    })
  }

  let refund
  try {
    refund = await Refund.create({
      bookingId: booking._id,
      paymentId: payment._id,
      userId: user.id,
      organizationId: booking.organizationId,
      amountMinor: eligibility.eligibleRefundMinor,
      currency: payment.currency,
      provider: payment.provider || 'mock',
      status: 'pending',
      reason: reason || (isAdmin ? 'admin_cancelled' : 'customer_cancelled'),
      idempotencyKey: confirmKey,
      requestedAt: new Date(),
      metadata: {
        insideCutoff: eligibility.insideCutoff,
        percent: eligibility.percent,
      },
    })
  } catch (err) {
    if (err?.code === 11000) {
      const raced = await Refund.findOne({
        userId: user.id,
        bookingId: booking._id,
        idempotencyKey: confirmKey,
      })
      if (raced) {
        return processRefund({
          refund: raced,
          payment,
          booking,
          mockOutcome,
        })
      }
    }
    throw err
  }

  return processRefund({
    refund,
    payment,
    booking,
    mockOutcome,
  })
}

/**
 * Admin/explicit refund against a payment (server computes amount).
 */
export async function createRefundForPayment({
  paymentId,
  user,
  body = {},
  idempotencyKey = null,
  mockOutcome = 'success',
  reason = null,
}) {
  rejectRefundBodyFields(body)
  const confirmKey = validateRefundIdempotencyKey(idempotencyKey, { required: true })

  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError('Payment not found', 404)
  }

  const payment = await Payment.findById(paymentId)
  if (!payment) throw new AppError('Payment not found', 404)

  if (payment.status === 'refunded') {
    throw new AppError('Payment has already been fully refunded', 409)
  }

  const booking = await Booking.findById(payment.bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (!booking || isLegacyBookingFlow(booking)) {
    throw new AppError('Payment not found', 404)
  }

  if (booking.status === 'cancelled') {
    throw new AppError('Booking is already cancelled', 409)
  }

  return refundAndCancelBookingForUser({
    booking,
    user,
    body: {},
    idempotencyKey: confirmKey,
    mockOutcome,
    reason: reason || body.reason || 'refund_requested',
  })
}

/**
 * Extend cancelBookingForUser for confirmed paid bookings.
 * payment_pending path remains in bookingLifecycleService.
 */
export async function cancelOrRefundBookingForUser(
  booking,
  user,
  { reason, idempotencyKey, mockOutcome = 'success', body = {} } = {}
) {
  if (isLegacyBookingFlow(booking)) {
    const { cancelBookingForUser } = await import('./bookingLifecycleService.js')
    return cancelBookingForUser(booking, user, { reason })
  }

  const ownerId = booking.user?.toString?.() ?? String(booking.user)
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'
  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to cancel this booking', 403)
  }

  if (booking.status === 'payment_pending') {
    const { cancelBookingForUser } = await import('./bookingLifecycleService.js')
    const result = await cancelBookingForUser(booking, user, { reason })
    if (booking.paymentId) {
      const payment = await Payment.findById(booking.paymentId)
      if (payment) {
        await cancelStalePayment(payment, { reason: 'booking_cancelled' })
      }
    }
    return { ...result, refund: null }
  }

  if (['confirmed', 'partially_refunded'].includes(booking.status)) {
    return refundAndCancelBookingForUser({
      booking,
      user,
      body,
      idempotencyKey,
      mockOutcome,
      reason,
    })
  }

  if (booking.status === 'cancelled') {
    return { booking, idempotent: true, refund: null }
  }

  throw new AppError(`Cannot cancel booking in status ${booking.status}`, 409)
}

/**
 * Apply a provider-reported refund completion (webhook/reconciliation).
 * Never trusts client/webhook amounts — uses Refund.amountMinor.
 */
export async function applyProviderRefundSuccess({ refundId, providerRefundId }) {
  const refund = await Refund.findById(refundId)
  if (!refund) throw new AppError('Refund not found', 404)

  const payment = await Payment.findById(refund.paymentId)
  const booking = await Booking.findById(refund.bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (!payment || !booking) throw new AppError('Refund context missing', 404)

  async function syncPaymentToCompletedRefunds(currentPayment) {
    const completed = await Refund.find({
      paymentId: currentPayment._id,
      status: 'completed',
    }).select('amountMinor')
    const expected = completed.reduce((sum, r) => sum + r.amountMinor, 0)
    const current = currentPayment.amountRefundedMinor || 0
    if (expected <= current) return { payment: currentPayment, idempotent: true }
    const delta = expected - current
    return applyPaymentRefundTotals(currentPayment, delta)
  }

  if (refund.status === 'completed') {
    const payResult = await syncPaymentToCompletedRefunds(payment)
    if (['confirmed', 'partially_refunded'].includes(booking.status)) {
      const bookResult = await finalizeBookingAfterRefund({
        booking,
        payment: payResult.payment,
        reason: refund.reason,
      })
      return {
        refund,
        payment: payResult.payment,
        booking: bookResult.booking,
        idempotent: true,
      }
    }
    return { refund, payment: payResult.payment, booking, idempotent: true }
  }

  if (refund.status === 'failed') {
    throw new AppError('Failed refund cannot be completed via webhook', 409)
  }

  await Refund.findOneAndUpdate(
    { _id: refund._id, status: 'pending' },
    { status: 'processing', processingAt: new Date() }
  )

  const completed = await Refund.findOneAndUpdate(
    { _id: refund._id, status: { $in: ['pending', 'processing'] } },
    {
      status: 'completed',
      providerRefundId: providerRefundId || refund.providerRefundId,
      completedAt: new Date(),
    },
    { new: true }
  )

  if (!completed) {
    const current = await Refund.findById(refund._id)
    if (current?.status === 'completed') {
      return applyProviderRefundSuccess({ refundId, providerRefundId })
    }
    throw new AppError('Refund completion conflict', 409)
  }

  const payResult = await syncPaymentToCompletedRefunds(payment)
  const bookResult = await finalizeBookingAfterRefund({
    booking,
    payment: payResult.payment,
    reason: completed.reason,
  })

  return {
    refund: completed,
    payment: payResult.payment,
    booking: bookResult.booking,
    idempotent: false,
  }
}

export default {
  serializeRefund,
  evaluateRefundEligibility,
  refundAndCancelBookingForUser,
  createRefundForPayment,
  cancelOrRefundBookingForUser,
  processRefund,
  applyProviderRefundSuccess,
  validateRefundIdempotencyKey,
}
