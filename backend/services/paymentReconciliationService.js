import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'
import InventoryHold from '../models/InventoryHold.js'
import { isLegacyBookingFlow, isV2BookingFlow } from '../config/booking.js'
import { releaseForBooking } from './bookingInventoryService.js'
import { expireV2Booking, markV2BookingFailed } from './bookingLifecycleService.js'
import { applyProviderPaymentSuccess, cancelStalePayment } from './paymentService.js'
import { isPrismaBooking } from '../repositories/booking/index.js'
import prisma from '../config/prisma.js'
import { toApiPayment, toApiBooking, toApiRefund } from '../repositories/booking/bookingSerialize.js'

function emptySummary() {
  return {
    scanned: 0,
    repaired: 0,
    expired: 0,
    inventoryReleased: 0,
    bookingsConfirmed: 0,
    flagged: 0,
    errors: 0,
    dryRun: false,
    details: [],
  }
}

function isBookingExpired(booking, now = new Date()) {
  return Boolean(booking.expiresAt && booking.expiresAt <= now)
}

async function reconcileCompletedPaymentPendingBooking({ payment, booking, dryRun, summary }) {
  summary.scanned++

  if (isBookingExpired(booking)) {
    summary.flagged++
    summary.details.push({
      type: 'flag',
      reason: 'completed_payment_expired_booking',
      bookingId: booking._id,
      paymentId: payment._id,
    })
    return
  }

  if (dryRun) {
    summary.repaired++
    summary.bookingsConfirmed++
    summary.details.push({
      type: 'would_confirm',
      bookingId: booking._id,
      paymentId: payment._id,
    })
    return
  }

  try {
    const result = await applyProviderPaymentSuccess({
      payment,
      booking,
      providerReference: payment.providerPaymentId,
      source: 'reconciliation',
    })

    if (result.flagged) {
      summary.flagged++
      summary.details.push({
        type: 'flag',
        reason: result.flagReason,
        bookingId: booking._id,
        paymentId: payment._id,
      })
      return
    }

    summary.repaired++
    if (!result.idempotent) summary.bookingsConfirmed++
    summary.details.push({
      type: 'confirmed',
      bookingId: booking._id,
      paymentId: payment._id,
      idempotent: result.idempotent,
    })
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      bookingId: booking._id,
      paymentId: payment._id,
      message: err.message,
    })
  }
}

async function reconcileFailedPaymentPendingBooking({ payment, booking, dryRun, summary }) {
  summary.scanned++

  if (dryRun) {
    summary.repaired++
    summary.inventoryReleased++
    summary.details.push({
      type: 'would_fail',
      bookingId: booking._id,
      paymentId: payment._id,
    })
    return
  }

  try {
    if (booking.status === 'payment_pending') {
      const releaseResult = await releaseForBooking({
        bookingId: booking._id,
        reason: 'reconciliation_payment_failed',
        targetStatus: 'released',
      })
      if (releaseResult.released) summary.inventoryReleased++
      await markV2BookingFailed(booking, 'reconciliation_payment_failed')
      summary.repaired++
      summary.details.push({
        type: 'booking_failed',
        bookingId: booking._id,
        paymentId: payment._id,
      })
    }
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      bookingId: booking._id,
      paymentId: payment._id,
      message: err.message,
    })
  }
}

async function reconcileStalePaymentPending({ payment, booking, now, dryRun, summary }) {
  summary.scanned++

  if (!isBookingExpired(booking, now) && !(payment.expiresAt && payment.expiresAt <= now)) {
    return
  }

  if (dryRun) {
    summary.expired++
    summary.inventoryReleased++
    summary.details.push({
      type: 'would_expire',
      bookingId: booking._id,
      paymentId: payment._id,
    })
    return
  }

  try {
    await cancelStalePayment(payment, { reason: 'expired' })

    const refreshed = isPrismaBooking()
      ? toApiBooking(await prisma.booking.findUnique({ where: { id: String(booking._id) } }))
      : await Booking.findById(booking._id).setOptions({
          skipUserPopulate: true,
          skipBookingItemPopulate: true,
        })

    if (refreshed?.status === 'payment_pending') {
      const expireResult = await expireV2Booking(refreshed)
      if (expireResult.released) summary.inventoryReleased++
      summary.expired++
      summary.repaired++
      summary.details.push({
        type: 'expired',
        bookingId: booking._id,
        paymentId: payment._id,
      })
    }
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      bookingId: booking._id,
      paymentId: payment._id,
      message: err.message,
    })
  }
}

async function reconcileTerminalBookingHeldInventory({ booking, dryRun, summary }) {
  summary.scanned++

  const hold = await InventoryHold.findOne({
    bookingId: booking._id,
    status: 'held',
  })
  if (!hold) return

  if (dryRun) {
    summary.inventoryReleased++
    summary.repaired++
    summary.details.push({
      type: 'would_release_hold',
      bookingId: booking._id,
      holdId: hold._id,
    })
    return
  }

  try {
    const targetStatus = booking.status === 'expired' ? 'expired' : 'released'
    const releaseResult = await releaseForBooking({
      bookingId: booking._id,
      reason: 'reconciliation_terminal_booking',
      targetStatus,
    })
    if (releaseResult.released) summary.inventoryReleased++
    summary.repaired++
    summary.details.push({
      type: 'released_hold',
      bookingId: booking._id,
      holdId: hold._id,
    })
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      bookingId: booking._id,
      message: err.message,
    })
  }
}

async function flagConfirmedBookingIncompletePayment({ booking, payment, summary }) {
  summary.scanned++
  summary.flagged++
  summary.details.push({
    type: 'flag',
    reason: 'confirmed_booking_incomplete_payment',
    bookingId: booking._id,
    paymentId: payment?._id || booking.paymentId,
    paymentStatus: payment?.status || 'missing',
  })
}

async function flagConsumedHoldUnconfirmedBooking({ booking, hold, summary }) {
  summary.scanned++
  summary.flagged++
  summary.details.push({
    type: 'flag',
    reason: 'consumed_hold_unconfirmed_booking',
    bookingId: booking._id,
    holdId: hold._id,
    bookingStatus: booking.status,
  })
}

async function reconcileCompletedRefund({ refund, dryRun, summary }) {
  summary.scanned++
  if (dryRun) {
    summary.repaired++
    summary.details.push({
      type: 'would_repair_refund',
      refundId: refund._id,
      bookingId: refund.bookingId,
    })
    return
  }

  try {
    const { applyProviderRefundSuccess } = await import('./refundService.js')
    await applyProviderRefundSuccess({
      refundId: refund._id,
      providerRefundId: refund.providerRefundId,
    })
    summary.repaired++
    summary.details.push({
      type: 'refund_repaired',
      refundId: refund._id,
      bookingId: refund.bookingId,
    })
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      refundId: refund._id,
      message: err.message,
    })
  }
}

async function reconcileRefundedPaymentConfirmedBooking({
  payment,
  booking,
  dryRun,
  summary,
}) {
  summary.scanned++
  if (dryRun) {
    summary.repaired++
    summary.details.push({
      type: 'would_cancel_after_refund',
      bookingId: booking._id,
      paymentId: payment._id,
    })
    return
  }

  try {
    const { applyProviderRefundSuccess } = await import('./refundService.js')
    let refund
    if (isPrismaBooking()) {
      refund = toApiRefund(
        await prisma.refund.findFirst({
          where: { paymentId: String(payment._id), status: 'completed' },
          orderBy: { completedAt: 'desc' },
        })
      )
    } else {
      const Refund = (await import('../models/Refund.js')).default
      refund = await Refund.findOne({
        paymentId: payment._id,
        status: 'completed',
      }).sort('-completedAt')
    }

    if (refund) {
      await applyProviderRefundSuccess({
        refundId: refund._id,
        providerRefundId: refund.providerRefundId,
      })
      summary.repaired++
      return
    }

    summary.flagged++
    summary.details.push({
      type: 'flag',
      reason: 'refunded_payment_confirmed_booking_no_refund_row',
      bookingId: booking._id,
      paymentId: payment._id,
    })
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      bookingId: booking._id,
      message: err.message,
    })
  }
}

async function reconcileCancelledConsumedHold({ booking, dryRun, summary }) {
  const hold = await InventoryHold.findOne({
    bookingId: booking._id,
    status: 'consumed',
  })
  if (!hold) return

  summary.scanned++
  if (dryRun) {
    summary.inventoryReleased++
    summary.repaired++
    summary.details.push({
      type: 'would_restore_consumed',
      bookingId: booking._id,
      holdId: hold._id,
    })
    return
  }

  try {
    const { restoreConsumedForBooking } = await import('./bookingInventoryService.js')
    const result = await restoreConsumedForBooking({
      bookingId: booking._id,
      reason: 'reconciliation_cancelled_consumed',
    })
    if (result.restored) summary.inventoryReleased++
    summary.repaired++
    summary.details.push({
      type: 'restored_consumed',
      bookingId: booking._id,
      holdId: hold._id,
    })
  } catch (err) {
    summary.errors++
    summary.details.push({
      type: 'error',
      bookingId: booking._id,
      message: err.message,
    })
  }
}

/**
 * Scan and repair recoverable v2 payment/booking/inventory inconsistencies.
 */
export async function runPaymentReconciliation({ dryRun = false, limit = 100 } = {}) {
  if (isPrismaBooking()) {
    return runPaymentReconciliationPrisma({ dryRun, limit })
  }

  const summary = emptySummary()
  summary.dryRun = dryRun
  const batchLimit = Math.max(1, Math.min(Number(limit) || 100, 1000))
  const now = new Date()

  const payments = await Payment.find({
    provider: 'mock',
  })
    .sort('updatedAt')
    .limit(batchLimit)

  for (const payment of payments) {
    const booking = await Booking.findById(payment.bookingId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (!booking || isLegacyBookingFlow(booking)) continue

    if (payment.status === 'completed' && booking.status === 'payment_pending') {
      await reconcileCompletedPaymentPendingBooking({ payment, booking, dryRun, summary })
      continue
    }

    if (payment.status === 'failed' && booking.status === 'payment_pending') {
      await reconcileFailedPaymentPendingBooking({ payment, booking, dryRun, summary })
      continue
    }

    if (
      payment.status === 'refunded' &&
      ['confirmed', 'partially_refunded'].includes(booking.status)
    ) {
      await reconcileRefundedPaymentConfirmedBooking({
        payment,
        booking,
        dryRun,
        summary,
      })
      continue
    }

    if (
      ['pending', 'processing'].includes(payment.status) &&
      booking.status === 'payment_pending' &&
      (isBookingExpired(booking, now) || (payment.expiresAt && payment.expiresAt <= now))
    ) {
      await reconcileStalePaymentPending({ payment, booking, now, dryRun, summary })
    }
  }

  const Refund = (await import('../models/Refund.js')).default
  const completedRefunds = await Refund.find({ status: 'completed' })
    .sort('updatedAt')
    .limit(batchLimit)

  for (const refund of completedRefunds) {
    const payment = await Payment.findById(refund.paymentId)
    const booking = await Booking.findById(refund.bookingId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (!payment || !booking) continue

    const paymentNeedsRepair =
      (payment.amountRefundedMinor || 0) < refund.amountMinor ||
      (payment.status === 'completed' && refund.amountMinor > 0)
    const bookingNeedsRepair =
      payment.status === 'refunded' &&
      ['confirmed', 'partially_refunded'].includes(booking.status)

    if (paymentNeedsRepair || bookingNeedsRepair) {
      await reconcileCompletedRefund({ refund, dryRun, summary })
    }
  }

  const terminalBookings = await Booking.find({
    bookingFlowVersion: 'v2',
    status: { $in: ['cancelled', 'expired', 'failed'] },
  })
    .sort('updatedAt')
    .limit(batchLimit)
    .setOptions({ skipUserPopulate: true, skipBookingItemPopulate: true })

  for (const booking of terminalBookings) {
    await reconcileTerminalBookingHeldInventory({ booking, dryRun, summary })
    if (booking.status === 'cancelled') {
      await reconcileCancelledConsumedHold({ booking, dryRun, summary })
    }
  }

  const confirmedBookings = await Booking.find({
    bookingFlowVersion: 'v2',
    status: 'confirmed',
    paymentId: { $ne: null },
  })
    .sort('updatedAt')
    .limit(batchLimit)
    .setOptions({ skipUserPopulate: true, skipBookingItemPopulate: true })

  for (const booking of confirmedBookings) {
    const payment = await Payment.findById(booking.paymentId)
    if (
      !payment ||
      !['completed', 'partially_refunded', 'refunded'].includes(payment.status)
    ) {
      await flagConfirmedBookingIncompletePayment({ booking, payment, summary })
    } else if (payment.status === 'refunded') {
      await reconcileRefundedPaymentConfirmedBooking({
        payment,
        booking,
        dryRun,
        summary,
      })
    }
  }

  const consumedHolds = await InventoryHold.find({ status: 'consumed' })
    .sort('updatedAt')
    .limit(batchLimit)

  for (const hold of consumedHolds) {
    const booking = await Booking.findById(hold.bookingId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (!booking || !isV2BookingFlow(booking)) continue
    if (
      booking.status !== 'confirmed' &&
      booking.status !== 'completed' &&
      booking.status !== 'partially_refunded' &&
      booking.status !== 'cancelled'
    ) {
      await flagConsumedHoldUnconfirmedBooking({ booking, hold, summary })
    }
  }

  return summary
}

/** Prisma-mode reconciliation — same repair helpers, Postgres queries. */
async function runPaymentReconciliationPrisma({ dryRun = false, limit = 100 } = {}) {
  const summary = emptySummary()
  summary.dryRun = dryRun
  const batchLimit = Math.max(1, Math.min(Number(limit) || 100, 1000))
  const now = new Date()

  const paymentRows = await prisma.payment.findMany({
    where: { provider: { in: ['mock', 'chapa'] } },
    orderBy: { updatedAt: 'asc' },
    take: batchLimit,
  })

  for (const row of paymentRows) {
    const payment = toApiPayment(row)
    const bookingRow = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
    })
    if (!bookingRow || bookingRow.bookingFlowVersion !== 'v2') continue
    const booking = toApiBooking(bookingRow)

    if (payment.status === 'completed' && booking.status === 'payment_pending') {
      await reconcileCompletedPaymentPendingBooking({
        payment,
        booking,
        dryRun,
        summary,
      })
      continue
    }

    if (payment.status === 'failed' && booking.status === 'payment_pending') {
      await reconcileFailedPaymentPendingBooking({
        payment,
        booking,
        dryRun,
        summary,
      })
      continue
    }

    if (
      payment.status === 'refunded' &&
      ['confirmed', 'partially_refunded'].includes(booking.status)
    ) {
      await reconcileRefundedPaymentConfirmedBooking({
        payment,
        booking,
        dryRun,
        summary,
      })
      continue
    }

    if (
      ['pending', 'processing'].includes(payment.status) &&
      booking.status === 'payment_pending' &&
      (isBookingExpired(booking, now) ||
        (payment.expiresAt && payment.expiresAt <= now))
    ) {
      await reconcileStalePaymentPending({
        payment,
        booking,
        now,
        dryRun,
        summary,
      })
    }
  }

  const refundRows = await prisma.refund.findMany({
    where: { status: 'completed' },
    orderBy: { updatedAt: 'asc' },
    take: batchLimit,
  })

  for (const row of refundRows) {
    const refund = toApiRefund(row)
    const payment = toApiPayment(
      await prisma.payment.findUnique({ where: { id: refund.paymentId } })
    )
    const booking = toApiBooking(
      await prisma.booking.findUnique({ where: { id: refund.bookingId } })
    )
    if (!payment || !booking) continue

    const paymentNeedsRepair =
      (payment.amountRefundedMinor || 0) < refund.amountMinor ||
      (payment.status === 'completed' && refund.amountMinor > 0)
    const bookingNeedsRepair =
      payment.status === 'refunded' &&
      ['confirmed', 'partially_refunded'].includes(booking.status)

    if (paymentNeedsRepair || bookingNeedsRepair) {
      await reconcileCompletedRefund({ refund, dryRun, summary })
    }
  }

  const pendingBookings = await prisma.booking.findMany({
    where: {
      bookingFlowVersion: 'v2',
      status: 'confirmed',
    },
    orderBy: { updatedAt: 'asc' },
    take: batchLimit,
  })

  for (const row of pendingBookings) {
    const booking = toApiBooking(row)
    const payment = booking.paymentId
      ? toApiPayment(
          await prisma.payment.findUnique({ where: { id: booking.paymentId } })
        )
      : null
    if (
      !payment ||
      !['completed', 'partially_refunded', 'refunded'].includes(payment.status)
    ) {
      await flagConfirmedBookingIncompletePayment({ booking, payment, summary })
    } else if (payment.status === 'refunded') {
      await reconcileRefundedPaymentConfirmedBooking({
        payment,
        booking,
        dryRun,
        summary,
      })
    }
  }

  const consumedHolds = await prisma.inventoryHold.findMany({
    where: { status: 'consumed' },
    orderBy: { updatedAt: 'asc' },
    take: batchLimit,
  })

  for (const holdRow of consumedHolds) {
    const booking = toApiBooking(
      await prisma.booking.findUnique({ where: { id: holdRow.bookingId } })
    )
    if (!booking || booking.bookingFlowVersion !== 'v2') continue
    if (
      booking.status !== 'confirmed' &&
      booking.status !== 'completed' &&
      booking.status !== 'partially_refunded' &&
      booking.status !== 'cancelled'
    ) {
      await flagConsumedHoldUnconfirmedBooking({
        booking,
        hold: {
          _id: holdRow.id,
          bookingId: holdRow.bookingId,
          status: holdRow.status,
        },
        summary,
      })
    }
  }

  return summary
}

export default { runPaymentReconciliation }
