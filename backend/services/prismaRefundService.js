/**
 * Prisma refund flows (DATABASE_MODE=prisma).
 * Mirrors Mongo refundService behavior with bookRepo CAS helpers.
 */
import AppError from '../utils/appError.js'
import {
  isLegacyBookingFlow,
  isV2BookingFlow,
} from '../config/booking.js'
import { isObjectIdCompatible } from '../utils/objectId.js'
import * as bookRepo from '../repositories/booking/prismaBookingRepository.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'
import { cancelStalePayment } from './paymentService.js'
import {
  restoreConsumedForBookingPrisma,
  cancelBookingForUserPrisma,
} from './prismaBookingDomainService.js'
import {
  evaluateRefundEligibility,
  rejectRefundBodyFields,
  validateRefundIdempotencyKey,
} from './refundService.js'

function assertV2Transition(fromStatus, toStatus) {
  const allowed = {
    payment_pending: ['cancelled', 'expired', 'failed', 'confirmed'],
    failed: [],
    expired: [],
    cancelled: [],
    confirmed: ['cancelled', 'partially_refunded'],
    partially_refunded: ['cancelled'],
    completed: [],
  }
  if (!(allowed[fromStatus] || []).includes(toStatus)) {
    throw new AppError(
      `Invalid booking transition from ${fromStatus} to ${toStatus}`,
      409
    )
  }
}

async function applyPaymentRefundTotalsPrisma(payment, refundAmountMinor) {
  const expected = payment.amountRefundedMinor || 0
  const nextRefunded = expected + refundAmountMinor
  if (nextRefunded > payment.amountMinor) {
    throw new AppError('Refund would exceed payment amount', 409)
  }

  const nextStatus =
    nextRefunded >= payment.amountMinor ? 'refunded' : 'partially_refunded'

  const updated = await bookRepo.updatePaymentRefundCas(
    payment._id,
    expected,
    nextRefunded,
    nextStatus
  )

  if (!updated) {
    const current = await bookRepo.findPaymentById(payment._id)
    if (
      current &&
      (current.amountRefundedMinor || 0) >= expected + refundAmountMinor
    ) {
      return { payment: current, idempotent: true }
    }
    throw new AppError('Payment refund update conflict', 409)
  }

  return { payment: updated, idempotent: false }
}

async function finalizeBookingAfterRefundPrisma({ booking, payment, reason }) {
  const fullyRefunded =
    payment.status === 'refunded' ||
    (payment.amountRefundedMinor || 0) >= payment.amountMinor

  if (fullyRefunded) {
    if (booking.status === 'cancelled') {
      await restoreConsumedForBookingPrisma({
        bookingId: booking._id,
        reason: reason || 'refund_cancelled',
      })
      return { booking, inventoryRestored: false, idempotent: true }
    }

    if (!['confirmed', 'partially_refunded'].includes(booking.status)) {
      throw new AppError(`Cannot cancel booking in status ${booking.status}`, 409)
    }

    assertV2Transition(booking.status, 'cancelled')

    const inventoryResult = await restoreConsumedForBookingPrisma({
      bookingId: booking._id,
      reason: reason || 'refund_cancelled',
    })

    const updated = await bookRepo.updateBookingIfStatus(
      booking._id,
      ['confirmed', 'partially_refunded'],
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason || 'refunded',
        inventoryReserved: false,
      }
    )

    if (!updated) {
      const current = await bookRepo.findBookingById(booking._id)
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

  if (booking.status === 'confirmed') {
    assertV2Transition(booking.status, 'partially_refunded')
    const updated = await bookRepo.updateBookingIfStatus(
      booking._id,
      'confirmed',
      { status: 'partially_refunded' }
    )
    return {
      booking: updated || booking,
      inventoryRestored: false,
      idempotent: !updated,
    }
  }

  return { booking, inventoryRestored: false, idempotent: true }
}

async function completeRefundRecordPrisma(refund, providerRefundId) {
  const completed = await bookRepo.updateRefundIfStatus(refund._id, 'processing', {
    status: 'completed',
    providerRefundId,
    completedAt: new Date(),
    failureCode: null,
    failureMessage: null,
  })
  if (completed) return completed

  const current = await bookRepo.findRefundById(refund._id)
  if (current?.status === 'completed') return current
  throw new AppError('Refund completion conflict', 409)
}

async function failRefundRecordPrisma(refund, { failureCode, failureMessage, providerRefundId }) {
  const failed = await bookRepo.updateRefundIfStatus(
    refund._id,
    ['pending', 'processing'],
    {
      status: 'failed',
      failedAt: new Date(),
      failureCode,
      failureMessage,
      providerRefundId: providerRefundId || refund.providerRefundId,
    }
  )
  if (failed) return failed
  const current = await bookRepo.findRefundById(refund._id)
  if (current?.status === 'failed') return current
  throw new AppError('Refund failure transition conflict', 409)
}

export async function processRefundPrisma({
  refund,
  payment,
  booking,
  mockOutcome = 'success',
}) {
  const processing = await bookRepo.updateRefundIfStatus(
    refund._id,
    ['pending', 'failed'],
    {
      status: 'processing',
      processingAt: new Date(),
      failedAt: null,
      failureCode: null,
      failureMessage: null,
    }
  )

  if (!processing) {
    const current = await bookRepo.findRefundById(refund._id)
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
    const failed = await failRefundRecordPrisma(processing, {
      failureCode: providerResult.failureCode || 'REFUND_FAILED',
      failureMessage: providerResult.failureMessage || 'Refund failed',
      providerRefundId: providerResult.providerRefundId,
    })
    const refreshedBooking = await bookRepo.findBookingById(booking._id)
    return {
      refund: failed,
      payment,
      booking: refreshedBooking,
      idempotent: false,
      failed: true,
    }
  }

  const completedRefund = await completeRefundRecordPrisma(
    processing,
    providerResult.providerRefundId
  )

  let updatedPayment
  try {
    const paymentResult = await applyPaymentRefundTotalsPrisma(
      payment,
      completedRefund.amountMinor
    )
    updatedPayment = paymentResult.payment
  } catch (err) {
    throw new AppError(
      err.message || 'Refund completed but payment update failed; retry reconciliation',
      409
    )
  }

  let bookingResult
  try {
    bookingResult = await finalizeBookingAfterRefundPrisma({
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

export async function refundAndCancelBookingForUserPrisma({
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
    const existing = await bookRepo.findLatestCompletedRefundByBooking(booking._id)
    return {
      booking,
      payment: booking.paymentId
        ? await bookRepo.findPaymentById(booking.paymentId)
        : null,
      refund: existing,
      idempotent: true,
      failed: false,
    }
  }

  if (!booking.paymentId) {
    throw new AppError('Confirmed booking is missing payment', 500)
  }

  const payment = await bookRepo.findPaymentById(booking.paymentId)
  if (!payment) throw new AppError('Payment not found', 404)

  const eligibility = evaluateRefundEligibility(booking, payment, { isAdmin })
  if (!eligibility.eligible) {
    throw new AppError(eligibility.message, 409)
  }

  const existingByKey = await bookRepo.findRefundByIdempotency(
    user.id,
    booking._id,
    confirmKey
  )

  if (existingByKey) {
    if (existingByKey.amountMinor !== eligibility.eligibleRefundMinor) {
      throw new AppError(
        'Idempotency-Key was already used with a different refund request',
        409
      )
    }
    if (existingByKey.status === 'completed') {
      const refreshedPayment = await bookRepo.findPaymentById(payment._id)
      const refreshedBooking = await bookRepo.findBookingById(booking._id)
      if (
        refreshedPayment &&
        (refreshedPayment.amountRefundedMinor || 0) < existingByKey.amountMinor
      ) {
        return processRefundPrisma({
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
        const repaired = await finalizeBookingAfterRefundPrisma({
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
    return processRefundPrisma({
      refund: existingByKey,
      payment,
      booking,
      mockOutcome,
    })
  }

  let refund
  try {
    refund = await bookRepo.createRefund({
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
    if (err?.isIdempotencyConflict) {
      const raced = await bookRepo.findRefundByIdempotency(
        user.id,
        booking._id,
        confirmKey
      )
      if (raced) {
        return processRefundPrisma({
          refund: raced,
          payment,
          booking,
          mockOutcome,
        })
      }
    }
    throw err
  }

  return processRefundPrisma({
    refund,
    payment,
    booking,
    mockOutcome,
  })
}

export async function createRefundForPaymentPrisma({
  paymentId,
  user,
  body = {},
  idempotencyKey = null,
  mockOutcome = 'success',
  reason = null,
}) {
  rejectRefundBodyFields(body)
  const confirmKey = validateRefundIdempotencyKey(idempotencyKey, { required: true })

  if (!isObjectIdCompatible(String(paymentId))) {
    throw new AppError('Payment not found', 404)
  }

  const payment = await bookRepo.findPaymentById(paymentId)
  if (!payment) throw new AppError('Payment not found', 404)

  if (payment.status === 'refunded') {
    throw new AppError('Payment has already been fully refunded', 409)
  }

  const booking = await bookRepo.findBookingById(payment.bookingId)
  if (!booking || isLegacyBookingFlow(booking)) {
    throw new AppError('Payment not found', 404)
  }

  if (booking.status === 'cancelled') {
    throw new AppError('Booking is already cancelled', 409)
  }

  return refundAndCancelBookingForUserPrisma({
    booking,
    user,
    body: {},
    idempotencyKey: confirmKey,
    mockOutcome,
    reason: reason || body.reason || 'refund_requested',
  })
}

export async function cancelOrRefundBookingForUserPrisma(
  booking,
  user,
  { reason, idempotencyKey, mockOutcome = 'success', body = {} } = {}
) {
  if (isLegacyBookingFlow(booking)) {
    return cancelBookingForUserPrisma(booking, user, { reason })
  }

  const ownerId = booking.user?.toString?.() ?? String(booking.user)
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'
  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to cancel this booking', 403)
  }

  if (booking.status === 'payment_pending') {
    const result = await cancelBookingForUserPrisma(booking, user, { reason })
    if (booking.paymentId) {
      const payment = await bookRepo.findPaymentById(booking.paymentId)
      if (payment) {
        await cancelStalePayment(payment, { reason: 'booking_cancelled' })
      }
    }
    return { ...result, refund: null }
  }

  if (['confirmed', 'partially_refunded'].includes(booking.status)) {
    return refundAndCancelBookingForUserPrisma({
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

export async function applyProviderRefundSuccessPrisma({ refundId, providerRefundId }) {
  const refund = await bookRepo.findRefundById(refundId)
  if (!refund) throw new AppError('Refund not found', 404)

  const payment = await bookRepo.findPaymentById(refund.paymentId)
  const booking = await bookRepo.findBookingById(refund.bookingId)
  if (!payment || !booking) throw new AppError('Refund context missing', 404)

  async function syncPaymentToCompletedRefunds(currentPayment) {
    const completed = await bookRepo.listCompletedRefundsByPayment(currentPayment._id)
    const expected = completed.reduce((sum, r) => sum + r.amountMinor, 0)
    const current = currentPayment.amountRefundedMinor || 0
    if (expected <= current) return { payment: currentPayment, idempotent: true }
    const delta = expected - current
    return applyPaymentRefundTotalsPrisma(currentPayment, delta)
  }

  if (refund.status === 'completed') {
    const payResult = await syncPaymentToCompletedRefunds(payment)
    if (['confirmed', 'partially_refunded'].includes(booking.status)) {
      const bookResult = await finalizeBookingAfterRefundPrisma({
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

  await bookRepo.updateRefundIfStatus(refund._id, 'pending', {
    status: 'processing',
    processingAt: new Date(),
  })

  const completed = await bookRepo.updateRefundIfStatus(
    refund._id,
    ['pending', 'processing'],
    {
      status: 'completed',
      providerRefundId: providerRefundId || refund.providerRefundId,
      completedAt: new Date(),
    }
  )

  if (!completed) {
    const current = await bookRepo.findRefundById(refund._id)
    if (current?.status === 'completed') {
      return applyProviderRefundSuccessPrisma({ refundId, providerRefundId })
    }
    throw new AppError('Refund completion conflict', 409)
  }

  const payResult = await syncPaymentToCompletedRefunds(payment)
  const bookResult = await finalizeBookingAfterRefundPrisma({
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
  processRefundPrisma,
  refundAndCancelBookingForUserPrisma,
  createRefundForPaymentPrisma,
  cancelOrRefundBookingForUserPrisma,
  applyProviderRefundSuccessPrisma,
}
