import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'
import PaymentAttempt from '../models/PaymentAttempt.js'
import AppError from '../utils/appError.js'
import { isLegacyBookingFlow, isV2BookingFlow } from '../config/booking.js'
import {
  finalizeForBooking,
  releaseForBooking,
} from './bookingInventoryService.js'
import {
  confirmV2Booking,
  markV2BookingFailed,
} from './bookingLifecycleService.js'
import MockPaymentProvider from './payment/MockPaymentProvider.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'

const mockProvider = new MockPaymentProvider()

const PAYMENT_CONFIRM_BLOCKED_BODY = [
  'amount',
  'amountMinor',
  'currency',
  'total',
  'price',
  'unitPrice',
  'status',
  'provider',
  'bookingId',
  'organizationId',
  'providerPaymentId',
  'paymentId',
]

const IDEMPOTENCY_KEY_MIN = 8
const IDEMPOTENCY_KEY_MAX = 128
const IDEMPOTENCY_KEY_PATTERN = /^[\w-]+$/

export function serializePayment(payment) {
  const doc = payment.toObject ? payment.toObject() : { ...payment }
  return {
    _id: doc._id,
    bookingId: doc.bookingId,
    organizationId: doc.organizationId,
    amountMinor: doc.amountMinor,
    amountRefundedMinor: doc.amountRefundedMinor || 0,
    currency: doc.currency,
    status: doc.status,
    provider: doc.provider,
    providerPaymentId: doc.providerPaymentId,
    expiresAt: doc.expiresAt,
    completedAt: doc.completedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function rejectConfirmBodyFields(body = {}) {
  for (const field of PAYMENT_CONFIRM_BLOCKED_BODY) {
    if (body[field] !== undefined) {
      throw new AppError(`Field ${field} is not allowed in payment confirmation`, 400)
    }
  }
}

export function validatePaymentIdempotencyKey(key) {
  if (key == null) return null
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

function assertBookingPaymentIntegrity(booking, payment) {
  if (payment.amountMinor !== booking.priceSnapshot.totalMinor) {
    throw new AppError('Payment amount does not match booking snapshot', 500)
  }
  if (payment.currency !== booking.priceSnapshot.currency) {
    throw new AppError('Payment currency does not match booking snapshot', 500)
  }
  if (payment.bookingId.toString() !== booking._id.toString()) {
    throw new AppError('Payment booking mismatch', 500)
  }
}

async function nextAttemptNumber(paymentId) {
  const last = await PaymentAttempt.findOne({ paymentId })
    .sort('-attemptNumber')
    .select('attemptNumber')
  return (last?.attemptNumber || 0) + 1
}

async function loadPaymentContext(paymentId) {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError('Payment not found', 404)
  }

  const payment = await Payment.findById(paymentId)
  if (!payment) throw new AppError('Payment not found', 404)

  const booking = await Booking.findById(payment.bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (!booking) throw new AppError('Payment not found', 404)

  return { payment, booking }
}

export function assertUserCanAccessPayment({ payment, booking, user, notFound = true }) {
  if (isLegacyBookingFlow(booking)) {
    throw new AppError('Payment not found', notFound ? 404 : 403)
  }

  const ownerId = booking.user?.toString?.() ?? String(booking.user)
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'

  if (!isOwner && !isAdmin) {
    throw new AppError('Payment not found', notFound ? 404 : 403)
  }

  return { isOwner, isAdmin }
}

function assertBookingPayable(booking) {
  if (booking.status === 'expired') {
    throw new AppError('Booking has expired', 409)
  }
  if (booking.status === 'cancelled') {
    throw new AppError('Booking is cancelled', 409)
  }
  if (booking.status === 'failed') {
    throw new AppError('Booking payment has failed', 409)
  }
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    return 'already_confirmed'
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot pay booking in status ${booking.status}`, 409)
  }
  if (booking.expiresAt && booking.expiresAt <= new Date()) {
    throw new AppError('Booking has expired', 409)
  }
  return 'payable'
}

/**
 * Create Payment + initiation attempt for a v2 payment_pending booking.
 */
export async function createPaymentForBooking(booking) {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Payments apply only to v2 bookings', 400)
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError('Payment can only be created for payment_pending bookings', 409)
  }
  if (!booking.priceSnapshot) {
    throw new AppError('Booking price snapshot is required', 500)
  }

  if (booking.paymentId) {
    const existing = await Payment.findById(booking.paymentId)
    if (existing) {
      assertBookingPaymentIntegrity(booking, existing)
      return { payment: existing, idempotent: true }
    }
  }

  const amountMinor = booking.priceSnapshot.totalMinor
  const currency = booking.priceSnapshot.currency

  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new AppError('Invalid booking price snapshot amount', 500)
  }

  let payment
  try {
    payment = await Payment.create({
      bookingId: booking._id,
      organizationId: booking.organizationId,
      amountMinor,
      currency,
      provider: 'mock',
      status: 'pending',
      expiresAt: booking.expiresAt,
    })
  } catch (err) {
    if (err?.code === 11000 && booking.paymentId) {
      const raced = await Payment.findById(booking.paymentId)
      if (raced) return { payment: raced, idempotent: true }
    }
    throw err
  }

  const initResult = await mockProvider.initiatePayment({ payment })
  const attemptNumber = await nextAttemptNumber(payment._id)
  await PaymentAttempt.create({
    paymentId: payment._id,
    attemptNumber,
    status: 'pending',
    providerReference: initResult.providerReference,
    rawProviderResponse: initResult.raw,
  })

  payment.providerPaymentId = initResult.providerReference
  await payment.save()

  await Booking.updateOne({ _id: booking._id }, { paymentId: payment._id })

  return { payment, idempotent: false }
}

async function recordAttempt({
  payment,
  attemptNumber,
  status,
  providerReference,
  failureCode = null,
  failureMessage = null,
  raw = null,
}) {
  return PaymentAttempt.findOneAndUpdate(
    { paymentId: payment._id, attemptNumber },
    {
      paymentId: payment._id,
      attemptNumber,
      status,
      providerReference,
      failureCode,
      failureMessage,
      rawProviderResponse: raw,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}

export async function finalizeSuccessfulPayment({ payment, booking }) {
  await finalizeForBooking({ bookingId: booking._id })

  const confirmedBooking = await confirmV2Booking(booking)

  if (!payment.completedAt) {
    payment.completedAt = new Date()
    await payment.save()
  }

  return { payment, booking: confirmedBooking.booking, idempotent: confirmedBooking.idempotent }
}

export async function handlePaymentFailure({ payment, booking, providerResult, attemptNumber }) {
  const failedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'processing'] } },
    {
      status: 'failed',
      providerPaymentId: providerResult.providerReference || payment.providerPaymentId,
    },
    { new: true }
  )

  if (!failedPayment) {
    const current = await Payment.findById(payment._id)
    if (current?.status === 'failed') {
      return { payment: current, booking, idempotent: true, failed: true }
    }
    throw new AppError('Payment failure transition conflict', 409)
  }

  await recordAttempt({
    payment: failedPayment,
    attemptNumber,
    status: 'failed',
    providerReference: providerResult.providerReference,
    failureCode: providerResult.failureCode,
    failureMessage: providerResult.failureMessage,
    raw: providerResult.raw,
  })

  if (booking.status === 'payment_pending') {
    await releaseForBooking({
      bookingId: booking._id,
      reason: 'payment_failed',
      targetStatus: 'released',
    })
    await markV2BookingFailed(booking, 'payment_failed')
  }

  const refreshedBooking = await Booking.findById(booking._id).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  return {
    payment: failedPayment,
    booking: refreshedBooking,
    idempotent: false,
    failed: true,
  }
}

/**
 * Confirm a mock payment — idempotent, owner/admin only.
 */
export async function confirmPaymentForUser({
  paymentId,
  user,
  body = {},
  idempotencyKey = null,
  mockOutcome = 'success',
}) {
  rejectConfirmBodyFields(body)
  const confirmKey = validatePaymentIdempotencyKey(idempotencyKey)

  const { payment, booking } = await loadPaymentContext(paymentId)
  assertUserCanAccessPayment({ payment, booking, user })
  assertBookingPaymentIntegrity(booking, payment)

  if (confirmKey && payment.idempotencyKey && payment.idempotencyKey !== confirmKey) {
    throw new AppError(
      'Idempotency-Key was already used with a different confirmation request',
      409
    )
  }

  if (payment.status === 'completed') {
    if (booking.status === 'payment_pending') {
      const reconciled = await finalizeSuccessfulPayment({ payment, booking })
      return { ...reconciled, idempotent: true }
    }
    const refreshed = await Booking.findById(booking._id).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    return { payment, booking: refreshed, idempotent: true, failed: false }
  }

  if (payment.status === 'failed') {
    throw new AppError('Payment has failed and cannot be confirmed', 409)
  }

  const payableState = assertBookingPayable(booking)
  if (payableState === 'already_confirmed') {
    throw new AppError('Booking is already confirmed', 409)
  }

  const processing = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    { status: 'processing', ...(confirmKey ? { idempotencyKey: confirmKey } : {}) },
    { new: true }
  )

  if (!processing) {
    const current = await Payment.findById(payment._id)
    if (current?.status === 'completed') {
      return confirmPaymentForUser({ paymentId, user, body, idempotencyKey, mockOutcome })
    }
    if (current?.status === 'processing') {
      throw new AppError('Payment confirmation already in progress', 409)
    }
    throw new AppError('Payment cannot be confirmed', 409)
  }

  const attemptNumber = await nextAttemptNumber(processing._id)
  const providerResult = await mockProvider.confirmPayment({
    payment: processing,
    mockOutcome,
  })

  if (!providerResult.success) {
    return handlePaymentFailure({
      payment: processing,
      booking,
      providerResult,
      attemptNumber,
    })
  }

  const completed = await Payment.findOneAndUpdate(
    { _id: processing._id, status: 'processing' },
    {
      status: 'completed',
      providerPaymentId: providerResult.providerReference,
      completedAt: new Date(),
    },
    { new: true }
  )

  if (!completed) {
    const current = await Payment.findById(processing._id)
    if (current?.status === 'completed') {
      return confirmPaymentForUser({ paymentId, user, body, idempotencyKey, mockOutcome })
    }
    throw new AppError('Payment completion conflict', 409)
  }

  await recordAttempt({
    payment: completed,
    attemptNumber,
    status: 'succeeded',
    providerReference: providerResult.providerReference,
    raw: providerResult.raw,
  })

  try {
    const result = await finalizeSuccessfulPayment({ payment: completed, booking })
    return { ...result, idempotent: false, failed: false }
  } catch (err) {
    // Payment completed but booking/inventory finalization failed — recoverable in retry.
    throw new AppError(
      err.message || 'Payment completed but booking confirmation failed; retry confirmation',
      409
    )
  }
}

export async function getPaymentForUser(paymentId, user) {
  const { payment, booking } = await loadPaymentContext(paymentId)
  assertUserCanAccessPayment({ payment, booking, user })
  assertBookingPaymentIntegrity(booking, payment)
  return { payment, booking }
}

export async function applyProviderPaymentSuccess({
  payment,
  booking,
  providerReference,
  source = 'provider',
}) {
  assertBookingPaymentIntegrity(booking, payment)

  if (booking.status === 'expired' || booking.status === 'cancelled') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_completed_after_booking_terminal',
    }
  }

  if (booking.expiresAt && booking.expiresAt <= new Date() && booking.status === 'payment_pending') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_completed_after_booking_expired',
    }
  }

  if (payment.status === 'completed') {
    if (booking.status === 'payment_pending') {
      const reconciled = await finalizeSuccessfulPayment({ payment, booking })
      return { ...reconciled, idempotent: reconciled.idempotent, flagged: false }
    }
    return { payment, booking, idempotent: true, flagged: false }
  }

  if (payment.status === 'failed' || payment.status === 'cancelled') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_completed_while_payment_terminal',
    }
  }

  if (booking.status !== 'payment_pending') {
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      return { payment, booking, idempotent: true, flagged: false }
    }
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: `payment_success_booking_${booking.status}`,
    }
  }

  let completed = payment
  if (payment.status === 'pending' || payment.status === 'processing') {
    const fromStatus = payment.status
    completed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: fromStatus },
      {
        status: 'completed',
        providerPaymentId: providerReference || payment.providerPaymentId,
        completedAt: new Date(),
      },
      { new: true }
    )

    if (!completed) {
      const current = await Payment.findById(payment._id)
      if (current?.status === 'completed') {
        return applyProviderPaymentSuccess({
          payment: current,
          booking,
          providerReference,
          source,
        })
      }
      throw new AppError('Payment completion conflict', 409)
    }

    const attemptNumber = await nextAttemptNumber(completed._id)
    await recordAttempt({
      payment: completed,
      attemptNumber,
      status: 'succeeded',
      providerReference: providerReference || completed.providerPaymentId,
      raw: { mock: true, source, outcome: 'success' },
    })
  }

  const result = await finalizeSuccessfulPayment({ payment: completed, booking })
  return { ...result, idempotent: false, flagged: false }
}

export async function applyProviderPaymentFailure({
  payment,
  booking,
  providerReference,
  failureCode = 'PROVIDER_DECLINED',
  failureMessage = 'Payment failed',
  source = 'provider',
}) {
  if (payment.status === 'failed') {
    if (booking.status === 'payment_pending') {
      await releaseForBooking({
        bookingId: booking._id,
        reason: 'payment_failed',
        targetStatus: 'released',
      })
      await markV2BookingFailed(booking, 'payment_failed')
      const refreshed = await Booking.findById(booking._id).setOptions({
        skipUserPopulate: true,
        skipBookingItemPopulate: true,
      })
      return { payment, booking: refreshed, idempotent: true, failed: true }
    }
    return { payment, booking, idempotent: true, failed: true }
  }

  if (payment.status === 'completed') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_failure_after_completion',
    }
  }

  const attemptNumber = await nextAttemptNumber(payment._id)
  return handlePaymentFailure({
    payment,
    booking,
    providerResult: {
      success: false,
      providerReference,
      failureCode,
      failureMessage,
      raw: { mock: true, source, outcome: 'fail' },
    },
    attemptNumber,
  })
}

export async function cancelStalePayment(payment, { reason = 'expired' } = {}) {
  if (payment.status === 'completed' || payment.status === 'failed' || payment.status === 'cancelled') {
    return { payment, idempotent: true }
  }

  const cancelled = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'processing'] } },
    { status: 'cancelled' },
    { new: true }
  )

  if (cancelled) return { payment: cancelled, idempotent: false, reason }

  const current = await Payment.findById(payment._id)
  return { payment: current, idempotent: true, reason }
}

export { getPaymentProvider }

export default {
  serializePayment,
  createPaymentForBooking,
  confirmPaymentForUser,
  getPaymentForUser,
  assertUserCanAccessPayment,
  finalizeSuccessfulPayment,
  applyProviderPaymentSuccess,
  applyProviderPaymentFailure,
  cancelStalePayment,
  handlePaymentFailure,
  getPaymentProvider,
}
