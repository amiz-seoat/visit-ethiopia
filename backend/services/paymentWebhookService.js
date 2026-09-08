import crypto from 'crypto'
import mongoose from 'mongoose'
import WebhookEvent from '../models/WebhookEvent.js'
import Payment from '../models/Payment.js'
import Booking from '../models/Booking.js'
import AppError from '../utils/appError.js'
import { PAYMENT_PROVIDERS } from '../config/booking.js'
import { isV2BookingFlow } from '../config/booking.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'
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

async function persistWebhookEvent({
  provider,
  parsed,
  payloadHash,
  paymentId = null,
}) {
  try {
    const event = await WebhookEvent.create({
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
    if (err?.code !== 11000) throw err
    const existing = await WebhookEvent.findOne({ provider, eventId: parsed.eventId })
    if (!existing) throw err
    return { event: existing, idempotent: existing.status === 'processed', duplicate: true }
  }
}

async function markWebhookProcessed(event, { flagged = false, flagReason = null } = {}) {
  event.status = 'processed'
  event.processedAt = new Date()
  if (flagged) {
    event.metadata = {
      ...(event.metadata || {}),
      flagged: true,
      flagReason,
    }
  }
  await event.save()
}

async function markWebhookFailed(event, { failureCode, failureMessage }) {
  event.status = 'failed'
  event.processedAt = new Date()
  event.failureCode = failureCode
  event.failureMessage = failureMessage
  await event.save()
}

async function loadV2PaymentContext(paymentId, provider) {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError('Invalid webhook payment reference', 400)
  }

  const payment = await Payment.findById(paymentId)
  if (!payment) throw new AppError('Payment not found for webhook', 404)
  if (payment.provider !== provider) {
    throw new AppError('Payment provider mismatch', 400)
  }

  const booking = await Booking.findById(payment.bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (!booking || !isV2BookingFlow(booking)) {
    throw new AppError('Payment not found for webhook', 404)
  }

  return { payment, booking }
}

async function processParsedWebhookEvent({ provider, parsed, webhookEvent }) {
  if (parsed.outcome === 'unknown') {
    await markWebhookProcessed(webhookEvent, { flagged: true, flagReason: 'unknown_event_type' })
    return {
      idempotent: false,
      processed: true,
      flagged: true,
      flagReason: 'unknown_event_type',
    }
  }

  if (parsed.outcome === 'refund_success' || parsed.outcome === 'refund_failure') {
    if (!parsed.refundId) {
      await markWebhookFailed(webhookEvent, {
        failureCode: 'MISSING_REFUND_ID',
        failureMessage: 'Webhook missing refundId',
      })
      throw new AppError('Webhook missing refundId', 400)
    }

    const { applyProviderRefundSuccess } = await import('./refundService.js')
    const Refund = (await import('../models/Refund.js')).default
    const refund = await Refund.findById(parsed.refundId)
    if (!refund) {
      await markWebhookFailed(webhookEvent, {
        failureCode: 'REFUND_NOT_FOUND',
        failureMessage: 'Refund not found',
      })
      throw new AppError('Refund not found', 404)
    }

    if (parsed.paymentId && String(refund.paymentId) !== String(parsed.paymentId)) {
      await markWebhookFailed(webhookEvent, {
        failureCode: 'REFUND_PAYMENT_MISMATCH',
        failureMessage: 'Refund payment mismatch',
      })
      throw new AppError('Refund payment mismatch', 400)
    }

    webhookEvent.paymentId = refund.paymentId
    await webhookEvent.save()

    if (parsed.outcome === 'refund_failure') {
      if (refund.status === 'completed') {
        await markWebhookProcessed(webhookEvent, {
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
      await Refund.findOneAndUpdate(
        { _id: refund._id, status: { $in: ['pending', 'processing'] } },
        {
          status: 'failed',
          failedAt: new Date(),
          failureCode: 'WEBHOOK_REFUND_FAILED',
          failureMessage: 'Refund failed via webhook',
        }
      )
      await markWebhookProcessed(webhookEvent)
      return { idempotent: false, processed: true, failed: true, flagged: false }
    }

    const result = await applyProviderRefundSuccess({
      refundId: refund._id,
      providerRefundId: parsed.providerReference,
    })
    await markWebhookProcessed(webhookEvent)
    return {
      idempotent: result.idempotent,
      processed: true,
      flagged: false,
    }
  }

  if (!parsed.paymentId) {
    await markWebhookFailed(webhookEvent, {
      failureCode: 'MISSING_PAYMENT_ID',
      failureMessage: 'Webhook missing paymentId',
    })
    throw new AppError('Webhook missing paymentId', 400)
  }

  const { payment, booking } = await loadV2PaymentContext(parsed.paymentId, provider)

  if (webhookEvent.paymentId?.toString() !== payment._id.toString()) {
    webhookEvent.paymentId = payment._id
    await webhookEvent.save()
  }

  if (parsed.outcome === 'success') {
    const result = await applyProviderPaymentSuccess({
      payment,
      booking,
      providerReference: parsed.providerReference,
      source: 'webhook',
    })

    if (result.flagged) {
      await markWebhookProcessed(webhookEvent, {
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

    await markWebhookProcessed(webhookEvent)
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
    await markWebhookProcessed(webhookEvent, {
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

  await markWebhookProcessed(webhookEvent)
  return {
    idempotent: failResult.idempotent,
    processed: true,
    failed: failResult.failed,
    flagged: false,
  }
}

/**
 * Ingest and process a provider webhook. Idempotent on duplicate eventId.
 */
export async function ingestPaymentWebhook({ provider, rawBody, headers = {}, payload }) {
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    throw new AppError('Unsupported payment provider', 400)
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
    parsed.paymentId && mongoose.Types.ObjectId.isValid(parsed.paymentId)
      ? parsed.paymentId
      : null

  const persisted = await persistWebhookEvent({
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
    const result = await processParsedWebhookEvent({
      provider,
      parsed,
      webhookEvent: persisted.event,
    })
    return { ...result, eventId: parsed.eventId }
  } catch (err) {
    if (persisted.event.status === 'pending') {
      await markWebhookFailed(persisted.event, {
        failureCode: String(err.statusCode || 'PROCESSING_ERROR'),
        failureMessage: err.message || 'Webhook processing failed',
      })
    }
    throw err
  }
}

export default { ingestPaymentWebhook }
