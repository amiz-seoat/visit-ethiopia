/**
 * Chapa hosted checkout orchestration (Prisma / PostgreSQL mode).
 *
 * Flow:
 *   1. Customer creates a booking → Payment(provider=chapa, status=pending).
 *   2. POST /payments/:id/checkout → server initializes a Chapa transaction with
 *      the server-side amount/currency and a unique tx_ref (ve-<paymentId>-<n>),
 *      returns checkout_url.
 *   3. Customer pays on Chapa and is redirected to the frontend return_url.
 *   4. Payment state changes ONLY after GET /transaction/verify/:tx_ref says
 *      success AND amount, currency and tx_ref match our records. Triggers:
 *      - POST /payments/:id/verify (frontend after redirect, owner only)
 *      - GET  /payments/chapa/callback?trx_ref=… (Chapa callback_url)
 *      - POST /payments/webhooks/chapa (signed webhook)
 *      - background reconciliation before expiring stale bookings
 *
 * A failed Chapa attempt does NOT fail the booking: the customer may retry
 * with a new tx_ref until the booking's payment hold expires, at which point
 * reconciliation releases the inventory.
 */
import AppError from '../utils/appError.js'
import { isPrismaBooking } from '../repositories/booking/index.js'
import * as bookRepo from '../repositories/booking/prismaBookingRepository.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'
import { buildTxRef, parseTxRef } from './payment/ChapaPaymentProvider.js'
import {
  applyProviderPaymentSuccessPrisma,
  loadPaymentContextPrisma,
} from './prismaBookingDomainService.js'
import {
  getPublicBackendUrl,
  getPublicFrontendUrl,
} from '../config/payments.js'
import prisma from '../config/prisma.js'

/** Reuse an unexpired checkout link instead of creating duplicate transactions. */
const CHECKOUT_REUSE_MS = 10 * 60 * 1000

function assertPrisma() {
  if (!isPrismaBooking()) {
    throw new AppError('Chapa checkout requires DATABASE_MODE=prisma', 501)
  }
}

function assertOwnerOrAdmin(booking, user) {
  if (!user) throw new AppError('Payment not found', 404)
  const ownerId = String(booking.user?._id || booking.user || '')
  const isOwner = ownerId !== '' && ownerId === String(user.id || user._id)
  if (!isOwner && user.role !== 'admin') {
    throw new AppError('Payment not found', 404)
  }
}

function assertIntegrity(booking, payment) {
  if (String(booking.paymentId || '') !== String(payment._id)) {
    throw new AppError('Payment does not belong to this booking', 409)
  }
  if (booking.priceSnapshot) {
    if (payment.amountMinor !== booking.priceSnapshot.totalMinor) {
      throw new AppError('Payment amount does not match booking', 409)
    }
    if (payment.currency !== booking.priceSnapshot.currency) {
      throw new AppError('Payment currency does not match booking', 409)
    }
  }
}

async function listChapaAttempts(paymentId) {
  const rows = await prisma.paymentAttempt.findMany({
    where: { paymentId: String(paymentId), providerReference: { startsWith: 've-' } },
    orderBy: { attemptNumber: 'desc' },
  })
  return rows
}

async function nextAttemptNumber(paymentId) {
  const agg = await prisma.paymentAttempt.aggregate({
    where: { paymentId: String(paymentId) },
    _max: { attemptNumber: true },
  })
  return (agg._max.attemptNumber || 0) + 1
}

function splitName(user) {
  const first = String(user.firstName || user.FirstName || '').trim() || 'Visit'
  const last = String(user.lastName || user.LastName || '').trim() || 'Ethiopia'
  return { firstName: first.slice(0, 50), lastName: last.slice(0, 50) }
}

/**
 * Start (or resume) a Chapa checkout for the payment. Owner/admin only.
 */
export async function startChapaCheckout({ paymentId, user }) {
  assertPrisma()
  const { payment, booking } = await loadPaymentContextPrisma(paymentId)
  assertOwnerOrAdmin(booking, user)
  assertIntegrity(booking, payment)

  if (payment.provider !== 'chapa') {
    throw new AppError('This payment does not use Chapa checkout', 409)
  }
  if (payment.status === 'completed') {
    return { alreadyPaid: true, payment, booking, checkoutUrl: null }
  }
  if (!['pending', 'processing'].includes(payment.status)) {
    throw new AppError(`Payment is ${payment.status} and cannot be paid`, 409)
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Booking is ${booking.status} and cannot be paid`, 409)
  }
  const now = Date.now()
  if (booking.expiresAt && new Date(booking.expiresAt).getTime() <= now) {
    throw new AppError('The payment window for this booking has expired', 409)
  }

  // Idempotent resume: reuse a recent pending checkout link.
  const attempts = await listChapaAttempts(payment._id)
  const recent = attempts.find(
    (a) =>
      a.status === 'pending' &&
      a.rawProviderResponse?.checkoutUrl &&
      now - new Date(a.createdAt).getTime() < CHECKOUT_REUSE_MS
  )
  if (recent) {
    return {
      alreadyPaid: false,
      payment,
      booking,
      checkoutUrl: recent.rawProviderResponse.checkoutUrl,
      txRef: recent.providerReference,
      reused: true,
    }
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: String(booking.user?._id || booking.user) },
    select: { email: true, firstName: true, lastName: true },
  })
  if (!userRecord?.email) {
    throw new AppError('Customer email is required for payment', 400)
  }

  const attemptNumber = await nextAttemptNumber(payment._id)
  const txRef = buildTxRef(payment._id, attemptNumber)
  const provider = getPaymentProvider('chapa')
  const { firstName, lastName } = splitName(userRecord)

  const init = await provider.initializeCheckout({
    txRef,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    email: userRecord.email,
    firstName,
    lastName,
    callbackUrl: `${getPublicBackendUrl()}/api/v1/payments/chapa/callback`,
    returnUrl: `${getPublicFrontendUrl()}/bookings/${booking._id}?payment=return`,
    title: 'Visit Ethiopia',
    description: `Booking ${String(booking._id).slice(-8)}`,
  })

  await bookRepo.createPaymentAttempt({
    paymentId: payment._id,
    attemptNumber,
    status: 'pending',
    providerReference: txRef,
    rawProviderResponse: { ...init.raw, checkoutUrl: init.checkoutUrl },
  })
  const updated = await bookRepo.updatePayment(payment._id, {
    providerPaymentId: txRef,
  })

  return {
    alreadyPaid: false,
    payment: updated,
    booking,
    checkoutUrl: init.checkoutUrl,
    txRef,
    reused: false,
  }
}

/**
 * Verify all known Chapa transactions for a payment against the Chapa API and
 * apply the verified result. Safe to call repeatedly (idempotent).
 *
 * @param {object} opts
 * @param {string} opts.paymentId
 * @param {object|null} opts.user  — when set, enforces owner/admin access
 * @param {string} opts.source     — 'customer' | 'callback' | 'webhook' | 'reconciliation'
 * @param {string|null} opts.onlyTxRef — restrict to one tx_ref (callback/webhook)
 */
export async function verifyChapaPayment({
  paymentId,
  user = null,
  source = 'customer',
  onlyTxRef = null,
}) {
  assertPrisma()
  const { payment, booking } = await loadPaymentContextPrisma(paymentId)
  if (user) assertOwnerOrAdmin(booking, user)
  assertIntegrity(booking, payment)

  if (payment.provider !== 'chapa') {
    throw new AppError('This payment does not use Chapa', 409)
  }
  if (payment.status === 'completed') {
    return { outcome: 'success', idempotent: true, payment, booking }
  }

  const provider = getPaymentProvider('chapa')
  let attempts = await listChapaAttempts(payment._id)
  if (onlyTxRef) attempts = attempts.filter((a) => a.providerReference === onlyTxRef)
  if (attempts.length === 0) {
    return { outcome: 'pending', idempotent: true, payment, booking }
  }

  let sawFailure = false
  for (const attempt of attempts) {
    const txRef = attempt.providerReference
    const result = await provider.verifyTransaction(txRef)

    if (result.outcome === 'success') {
      const amountOk = result.amountMinor === payment.amountMinor
      const currencyOk = result.currency === payment.currency
      const refOk = !result.txRef || result.txRef === txRef
      if (!amountOk || !currencyOk || !refOk) {
        await bookRepo.upsertPaymentAttempt({
          paymentId: payment._id,
          attemptNumber: attempt.attemptNumber,
          status: 'failed',
          providerReference: txRef,
          failureCode: 'CHAPA_VERIFY_MISMATCH',
          failureMessage: 'Verified amount, currency or reference did not match',
          rawProviderResponse: {
            ...result.raw,
            expectedAmountMinor: payment.amountMinor,
            verifiedAmountMinor: result.amountMinor,
            expectedCurrency: payment.currency,
            verifiedCurrency: result.currency,
          },
        })
        await bookRepo.updatePayment(payment._id, {
          metadata: {
            ...(payment.metadata || {}),
            flagged: 'chapa_verify_mismatch',
            flaggedTxRef: txRef,
          },
        })
        return { outcome: 'flagged', flagReason: 'verify_mismatch', payment, booking }
      }

      await bookRepo.upsertPaymentAttempt({
        paymentId: payment._id,
        attemptNumber: attempt.attemptNumber,
        status: 'succeeded',
        providerReference: txRef,
        rawProviderResponse: { ...result.raw, source },
      })
      const applied = await applyProviderPaymentSuccessPrisma({
        payment,
        booking,
        providerReference: txRef,
        source: `chapa_${source}`,
      })
      if (applied.flagged) {
        // Paid after the booking expired/cancelled — needs manual refund review.
        await bookRepo.updatePayment(payment._id, {
          metadata: {
            ...(payment.metadata || {}),
            flagged: applied.flagReason,
            flaggedTxRef: txRef,
            needsRefundReview: true,
          },
        })
        return {
          outcome: 'flagged',
          flagReason: applied.flagReason,
          payment: await bookRepo.findPaymentById(payment._id),
          booking: await bookRepo.findBookingById(booking._id),
        }
      }
      return {
        outcome: 'success',
        idempotent: Boolean(applied.idempotent),
        payment: applied.payment,
        booking: applied.booking,
      }
    }

    if (result.outcome === 'failure') {
      sawFailure = true
      if (attempt.status === 'pending') {
        await bookRepo.upsertPaymentAttempt({
          paymentId: payment._id,
          attemptNumber: attempt.attemptNumber,
          status: 'failed',
          providerReference: txRef,
          failureCode: 'CHAPA_FAILED',
          failureMessage: 'Chapa reported the transaction as failed or cancelled',
          rawProviderResponse: { ...result.raw, source },
        })
      }
    }
  }

  return {
    outcome: sawFailure ? 'failed_retryable' : 'pending',
    idempotent: false,
    payment: await bookRepo.findPaymentById(payment._id),
    booking: await bookRepo.findBookingById(booking._id),
  }
}

/** Chapa callback_url handler — trusts nothing in the query except as a lookup key. */
export async function handleChapaCallback(txRef) {
  const parsed = parseTxRef(txRef)
  if (!parsed) throw new AppError('Unknown transaction reference', 400)
  return verifyChapaPayment({
    paymentId: parsed.paymentId,
    source: 'callback',
    onlyTxRef: String(txRef),
  })
}

/**
 * Before reconciliation expires stale Chapa payments, ask Chapa whether any of
 * them were actually paid (covers missed webhooks / closed browser tabs).
 */
export async function verifyStaleChapaPayments({ limit = 50 } = {}) {
  if (!isPrismaBooking() || !process.env.CHAPA_SECRET_KEY) return { checked: 0 }
  const rows = await prisma.payment.findMany({
    where: {
      provider: 'chapa',
      status: { in: ['pending', 'processing'] },
      providerPaymentId: { not: null },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  let checked = 0
  let confirmed = 0
  for (const row of rows) {
    try {
      const r = await verifyChapaPayment({ paymentId: row.id, source: 'reconciliation' })
      checked += 1
      if (r.outcome === 'success') confirmed += 1
    } catch (err) {
      console.error('[chapa] stale verify failed', row.id, err.message)
    }
  }
  return { checked, confirmed }
}

export default {
  startChapaCheckout,
  verifyChapaPayment,
  handleChapaCallback,
  verifyStaleChapaPayments,
}
