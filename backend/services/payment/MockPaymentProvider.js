import crypto from 'crypto'
import PaymentProvider from './PaymentProvider.js'

/**
 * Deterministic mock provider — no external calls, no PCI data.
 *
 * Webhook verification uses HMAC-SHA256 with MOCK_WEBHOOK_SECRET.
 * This is a test/dev boundary only — real providers replace this in later phases.
 */
export default class MockPaymentProvider extends PaymentProvider {
  constructor() {
    super()
    this.name = 'mock'
  }

  getWebhookSecret() {
    return process.env.MOCK_WEBHOOK_SECRET || 'mock-webhook-dev-secret'
  }

  async initiatePayment({ payment }) {
    const providerReference = `mock_init_${payment._id}_${Date.now()}`
    return {
      providerReference,
      raw: { mock: true, stage: 'initiated', paymentId: String(payment._id) },
    }
  }

  async confirmPayment({ payment, mockOutcome = 'success' }) {
    if (mockOutcome === 'fail') {
      return {
        success: false,
        providerReference: `mock_fail_${payment._id}`,
        failureCode: 'MOCK_DECLINED',
        failureMessage: 'Mock payment declined for testing',
        raw: { mock: true, outcome: 'fail' },
      }
    }

    return {
      success: true,
      providerReference: `mock_ok_${payment._id}_${Date.now()}`,
      raw: { mock: true, outcome: 'success' },
    }
  }

  async cancelPayment({ payment }) {
    return {
      success: true,
      providerReference: `mock_cancel_${payment._id}`,
      raw: { mock: true, outcome: 'cancelled' },
    }
  }

  /**
   * Deterministic mock refund — no external calls.
   * mockOutcome: 'success' | 'fail'
   */
  async refundPayment({ payment, refund, mockOutcome = 'success' }) {
    if (mockOutcome === 'fail') {
      return {
        success: false,
        providerRefundId: `mock_refund_fail_${refund._id}`,
        failureCode: 'MOCK_REFUND_DECLINED',
        failureMessage: 'Mock refund declined for testing',
        raw: { mock: true, outcome: 'fail', stage: 'refund' },
      }
    }

    return {
      success: true,
      providerRefundId: `mock_refund_ok_${refund._id}_${Date.now()}`,
      raw: {
        mock: true,
        outcome: 'success',
        stage: 'refund',
        paymentId: String(payment._id),
        refundId: String(refund._id),
        amountMinor: refund.amountMinor,
      },
    }
  }

  /**
   * Mock webhook signature: hex HMAC-SHA256 of raw body using MOCK_WEBHOOK_SECRET.
   * Not production-grade — explicit test boundary for Phase 4E.
   */
  verifyWebhookSignature({ rawBody, signature }) {
    if (!rawBody || typeof signature !== 'string') return false
    const secret = this.getWebhookSecret()
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))
    } catch {
      return false
    }
  }

  /**
   * Parse mock webhook payload. Amount/currency in payload are ignored by callers.
   */
  parseWebhookEvent({ payload }) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Webhook payload must be a JSON object')
    }
    const eventId = payload.eventId
    const eventType = payload.eventType
    const paymentId = payload.paymentId
    const refundId = payload.refundId

    if (!eventId || typeof eventId !== 'string') {
      throw new Error('eventId is required')
    }
    if (!eventType || typeof eventType !== 'string') {
      throw new Error('eventType is required')
    }

    let outcome = 'unknown'
    if (eventType === 'payment.completed') outcome = 'success'
    else if (eventType === 'payment.failed') outcome = 'failure'
    else if (eventType === 'refund.completed') outcome = 'refund_success'
    else if (eventType === 'refund.failed') outcome = 'refund_failure'

    return {
      eventId: eventId.trim(),
      eventType: eventType.trim(),
      paymentId: paymentId ? String(paymentId).trim() : null,
      refundId: refundId ? String(refundId).trim() : null,
      providerReference: payload.providerReference
        ? String(payload.providerReference).trim()
        : `mock_wh_${eventId}`,
      outcome,
      sanitizedPayload: {
        mock: true,
        eventId,
        eventType,
        paymentId: paymentId || null,
        refundId: refundId || null,
      },
    }
  }
}

/** Test helper — sign webhook body for mock provider tests. */
export function signMockWebhookBody(rawBody, secret = process.env.MOCK_WEBHOOK_SECRET || 'mock-webhook-dev-secret') {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
}
