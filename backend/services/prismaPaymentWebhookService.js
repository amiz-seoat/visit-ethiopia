/**
 * Prisma payment webhook ingest (DATABASE_MODE=prisma).
 */
import crypto from 'crypto'
import AppError from '../utils/appError.js'
import { PAYMENT_PROVIDERS, isV2BookingFlow } from '../config/booking.js'
import { isObjectIdCompatible } from '../utils/objectId.js'
import * as bookRepo from '../repositories/booking/prismaBookingRepository.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'
import { isMockPaymentAllowed } from '../config/payments.js'
import {
  applyProviderPaymentFailure,
  applyProviderPaymentSuccess,
} from './paymentService.js'

function hashPayload(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex')
}

function getWebhookSignature(headers = {}) {
  return (
    headers['x-mock-webhook-signature'] ||
    headers['X-Mock-Webhook-Signature'] ||
    headers['x-webhook-signature'] ||
    headers['X-Webhook-Signature'] ||
    null
  )
}

async function persistWebhookEventPrisma({
  provider,
  parsed,
  payloadHash,
  paymentId = null,
}) {
  try {
    const event = await bookRepo.createWebhookEvent({
      provider,
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      status: 'pending',
      paymentId,
      payloadHash,
      metadata: { sanitized: parsed.sanitizedPayload },
    })
    return { event, idempotent: false, duplicate: false }
  } catch (err) {
    if (err?.code !== 'P2002' && !err.existing) throw err
    const existing =
      err.existing ||
      (await bookRepo.findWebhookByProviderEvent(provider, parsed.eventId))
    if (!existing) throw err
    return {
      event: existing,
      idempotent: existing.status === 'processed',
      duplicate: true,
    }
  }
}

async function markWebhookProcessedPrisma(event, { flagged = false, flagReason = null } = {}) {
  const metadata = {
    ...(event.metadata || {}),
    ...(flagged ? { flagged: true, flagReason } : {}),
  }
  return bookRepo.updateWebhookEvent(event._id, {
    status: 'processed',
    processedAt: new Date(),
    metadata,
  })
}

async function markWebhookFailedPrisma(event, { failureCode, failureMessage }) {
  return bookRepo.updateWebhookEvent(event._id, {
    status: 'failed',
    processedAt: new Date(),
    failureCode,
    failureMessage,
  })
}

async function loadV2PaymentContextPrisma(paymentId, provider) {
  if (!isObjectIdCompatible(String(paymentId))) {
    throw new AppError('Invalid webhook payment reference', 400)
  }

  const payment = await bookRepo.findPaymentById(paymentId)
  if (!payment) throw new AppError('Payment not found for webhook', 404)
  if (payment.provider !== provider) {
    throw new AppError('Payment provider mismatch', 400)
  }

  const booking = await bookRepo.findBookingById(payment.bookingId)
  if (!booking || !isV2BookingFlow(booking)) {
    throw new AppError('Payment not found for webhook', 404)
  }

  return { payment, booking }
}

async function processParsedWebhookEventPrisma({ provider, parsed, webhookEvent }) {
  // Real providers (Chapa): the webhook is only a trigger. State changes come
  // from server-side verification against the provider API.
  if (parsed.outcome === 'verify') {
    if (!parsed.paymentId) {
      await markWebhookProcessedPrisma(webhookEvent, {
        flagged: true,
        flagReason: 'unknown_tx_ref',
      })
      return { idempotent: false, processed: true, flagged: true, flagReason: 'unknown_tx_ref' }
    }
    const { verifyChapaPayment } = await import('./chapaCheckoutService.js')
    const result = await verifyChapaPayment({
      paymentId: parsed.paymentId,
      source: 'webhook',
      onlyTxRef: parsed.providerReference,
    })
    await bookRepo.updateWebhookEvent(webhookEvent._id, { paymentId: parsed.paymentId })
    const flagged = result.outcome === 'flagged'
    await markWebhookProcessedPrisma(webhookEvent, {
      flagged,
      flagReason: flagged ? result.flagReason : null,
    })
    return {
      idempotent: Boolean(result.idempotent),
      processed: true,
      flagged,
      verifiedOutcome: result.outcome,
    }
  }

  if (parsed.outcome === 'unknown') {
    await markWebhookProcessedPrisma(webhookEvent, {
      flagged: true,
      flagReason: 'unknown_event_type',
    })
    return {
      idempotent: false,
      processed: true,
      flagged: true,
      flagReason: 'unknown_event_type',
    }
  }

  if (parsed.outcome === 'refund_success' || parsed.outcome === 'refund_failure') {
    if (!parsed.refundId) {
      await markWebhookFailedPrisma(webhookEvent, {
        failureCode: 'MISSING_REFUND_ID',
        failureMessage: 'Webhook missing refundId',
      })
      throw new AppError('Webhook missing refundId', 400)
    }

    const { applyProviderRefundSuccess } = await import('./refundService.js')
    const refund = await bookRepo.findRefundById(parsed.refundId)
    if (!refund) {
      await markWebhookFailedPrisma(webhookEvent, {
        failureCode: 'REFUND_NOT_FOUND',
        failureMessage: 'Refund not found',
      })
      throw new AppError('Refund not found', 404)
    }

    if (parsed.paymentId && String(refund.paymentId) !== String(parsed.paymentId)) {
      await markWebhookFailedPrisma(webhookEvent, {
        failureCode: 'REFUND_PAYMENT_MISMATCH',
        failureMessage: 'Refund payment mismatch',
      })
      throw new AppError('Refund payment mismatch', 400)
    }

    webhookEvent = await bookRepo.updateWebhookEvent(webhookEvent._id, {
      paymentId: refund.paymentId,
    })

    if (parsed.outcome === 'refund_failure') {
      if (refund.status === 'completed') {
        await markWebhookProcessedPrisma(webhookEvent, {
          flagged: true,
          flagReason: 'refund_failure_after_completion',
        })
        return {
          idempotent: true,
          processed: true,
          flagged: true,
          flagReason: 'refund_failure_after_completion',
        }
      }
      await bookRepo.updateRefundIfStatus(
        refund._id,
        ['pending', 'processing'],
        {
          status: 'failed',
          failedAt: new Date(),
          failureCode: 'WEBHOOK_REFUND_FAILED',
          failureMessage: 'Refund failed via webhook',
        }
      )
      await markWebhookProcessedPrisma(webhookEvent)
      return { idempotent: false, processed: true, failed: true, flagged: false }
    }

    const result = await applyProviderRefundSuccess({
      refundId: refund._id,
      providerRefundId: parsed.providerReference,
    })
    await markWebhookProcessedPrisma(webhookEvent)
    return {
      idempotent: result.idempotent,
      processed: true,
      flagged: false,
    }
  }

  if (!parsed.paymentId) {
    await markWebhookFailedPrisma(webhookEvent, {
      failureCode: 'MISSING_PAYMENT_ID',
      failureMessage: 'Webhook missing paymentId',
    })
    throw new AppError('Webhook missing paymentId', 400)
  }

  const { payment, booking } = await loadV2PaymentContextPrisma(
    parsed.paymentId,
    provider
  )

  if (String(webhookEvent.paymentId || '') !== String(payment._id)) {
    webhookEvent = await bookRepo.updateWebhookEvent(webhookEvent._id, {
      paymentId: payment._id,
    })
  }

  if (parsed.outcome === 'success') {
    const result = await applyProviderPaymentSuccess({
      payment,
      booking,
      providerReference: parsed.providerReference,
      source: 'webhook',
    })

    if (result.flagged) {
      await markWebhookProcessedPrisma(webhookEvent, {
        flagged: true,
        flagReason: result.flagReason,
      })
      return {
        idempotent: result.idempotent,
        processed: true,
        flagged: true,
        flagReason: result.flagReason,
      }
    }

    await markWebhookProcessedPrisma(webhookEvent)
    return { idempotent: result.idempotent, processed: true, flagged: false }
  }

  const failResult = await applyProviderPaymentFailure({
    payment,
    booking,
    providerReference: parsed.providerReference,
    failureCode: 'WEBHOOK_FAILED',
    failureMessage: 'Payment failed via webhook',
    source: 'webhook',
  })

  if (failResult.flagged) {
    await markWebhookProcessedPrisma(webhookEvent, {
      flagged: true,
      flagReason: failResult.flagReason,
    })
    return {
      idempotent: failResult.idempotent,
      processed: true,
      flagged: true,
      flagReason: failResult.flagReason,
    }
  }

  await markWebhookProcessedPrisma(webhookEvent)
  return {
    idempotent: failResult.idempotent,
    processed: true,
    failed: failResult.failed,
    flagged: false,
  }
}

/**
 * Ingest and process a provider webhook against Prisma.
 */
export async function ingestPaymentWebhookPrisma({
  provider,
  rawBody,
  headers = {},
  payload,
}) {
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    throw new AppError('Unsupported payment provider', 400)
  }
  if (provider === 'mock' && !isMockPaymentAllowed()) {
    throw new AppError('Demo payment webhooks are disabled on this server', 403)
  }

  const paymentProvider = getPaymentProvider(provider)
  const signature = getWebhookSignature(headers)

  if (!paymentProvider.verifyWebhookSignature({ rawBody, signature, headers })) {
    throw new AppError('Invalid webhook signature', 401)
  }

  let parsed
  try {
    parsed = paymentProvider.parseWebhookEvent({ payload, rawBody, headers })
  } catch (err) {
    throw new AppError(err.message || 'Malformed webhook payload', 400)
  }

  const payloadHash = hashPayload(rawBody)
  const paymentObjectId =
    parsed.paymentId && isObjectIdCompatible(String(parsed.paymentId))
      ? parsed.paymentId
      : null

  const persisted = await persistWebhookEventPrisma({
    provider,
    parsed,
    payloadHash,
    paymentId: paymentObjectId,
  })

  if (persisted.duplicate && persisted.idempotent) {
    return {
      idempotent: true,
      processed: true,
      eventId: parsed.eventId,
    }
  }

  if (persisted.duplicate && persisted.event.status === 'processed') {
    return {
      idempotent: true,
      processed: true,
      eventId: parsed.eventId,
    }
  }

  if (persisted.duplicate && persisted.event.status === 'pending') {
    return {
      idempotent: true,
      processed: false,
      eventId: parsed.eventId,
      inProgress: true,
    }
  }

  if (persisted.duplicate && persisted.event.status === 'failed') {
    throw new AppError('Webhook event previously failed', 409)
  }

  try {
    const result = await processParsedWebhookEventPrisma({
      provider,
      parsed,
      webhookEvent: persisted.event,
    })
    return { ...result, eventId: parsed.eventId }
  } catch (err) {
    const current = await bookRepo.findWebhookByProviderEvent(
      provider,
      parsed.eventId
    )
    if (current?.status === 'pending') {
      await markWebhookFailedPrisma(current, {
        failureCode: String(err.statusCode || 'PROCESSING_ERROR'),
        failureMessage: err.message || 'Webhook processing failed',
      })
    }
    throw err
  }
}

export default { ingestPaymentWebhookPrisma }
