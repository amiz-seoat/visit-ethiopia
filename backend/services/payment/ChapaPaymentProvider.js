import crypto from 'crypto'
import PaymentProvider from './PaymentProvider.js'
import AppError from '../../utils/appError.js'
import { getChapaConfig } from '../../config/payments.js'

/**
 * Chapa hosted-checkout provider (https://developer.chapa.co).
 *
 * Trust model:
 * - Initialization is server-side; amount/currency come from the payment row,
 *   never from the browser.
 * - The ONLY source of truth for "paid" is GET /transaction/verify/:tx_ref,
 *   checked against our own amount, currency and tx_ref.
 * - Browser redirects (return_url) and callback query params are never trusted.
 * - Webhook signatures are checked (HMAC-SHA256 with the dashboard secret hash),
 *   and even signed webhooks are re-verified through the verify API.
 */

const TX_REF_PATTERN = /^ve-([a-f0-9]{24})-(\d{1,4})$/

export function buildTxRef(paymentId, attemptNumber) {
  return `ve-${paymentId}-${attemptNumber}`
}

export function parseTxRef(txRef) {
  const match = TX_REF_PATTERN.exec(String(txRef || '').trim())
  if (!match) return null
  return { paymentId: match[1], attemptNumber: Number(match[2]) }
}

export function minorToChapaAmount(amountMinor) {
  return (amountMinor / 100).toFixed(2)
}

export function chapaAmountToMinor(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a.trim().toLowerCase(), 'utf8')
  const bb = Buffer.from(b.trim().toLowerCase(), 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function hmacHex(secret, content) {
  return crypto.createHmac('sha256', secret).update(content).digest('hex')
}

export default class ChapaPaymentProvider extends PaymentProvider {
  constructor({ fetchImpl } = {}) {
    super()
    this.name = 'chapa'
    this.fetchImpl = fetchImpl || ((...args) => globalThis.fetch(...args))
  }

  /** Allow tests to swap the HTTP layer. */
  setFetch(fetchImpl) {
    this.fetchImpl = fetchImpl
  }

  async request(method, path, body) {
    const { secretKey, apiBase, timeoutMs } = getChapaConfig()
    if (!secretKey) {
      throw new AppError('Chapa is not configured (CHAPA_SECRET_KEY missing)', 503)
    }
    let res
    try {
      res = await this.fetchImpl(`${apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw new AppError(`Payment provider unreachable: ${err.name || 'error'}`, 502)
    }
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    return { httpStatus: res.status, ok: res.ok, data }
  }

  /**
   * Initialize a hosted checkout. Returns the checkout URL.
   * POST /transaction/initialize
   */
  async initializeCheckout({
    txRef,
    amountMinor,
    currency,
    email,
    firstName,
    lastName,
    callbackUrl,
    returnUrl,
    title,
    description,
  }) {
    if (!['ETB', 'USD'].includes(currency)) {
      throw new AppError(`Currency ${currency} is not supported by Chapa`, 400)
    }
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new AppError('Payment amount must be positive', 400)
    }
    const body = {
      amount: minorToChapaAmount(amountMinor),
      currency,
      email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        // Chapa limits title length; keep it short and ASCII.
        title: String(title || 'Visit Ethiopia').slice(0, 16),
        description: String(description || 'Booking payment')
          .replace(/[^\w\s.-]/g, '')
          .slice(0, 50),
      },
    }
    const { ok, httpStatus, data } = await this.request(
      'POST',
      '/transaction/initialize',
      body
    )
    const checkoutUrl = data?.data?.checkout_url
    if (!ok || data?.status !== 'success' || !checkoutUrl) {
      const message =
        typeof data?.message === 'string'
          ? data.message
          : 'Chapa could not initialize the payment'
      const err = new AppError(`Payment initialization failed: ${message}`, 502)
      err.providerHttpStatus = httpStatus
      throw err
    }
    return {
      checkoutUrl,
      raw: { stage: 'initialized', httpStatus, message: data?.message || null },
    }
  }

  /**
   * Verify a transaction by tx_ref. Never throws for "not found" — returns pending.
   * GET /transaction/verify/:tx_ref
   *
   * @returns {{ outcome: 'success'|'failure'|'pending', amountMinor?, currency?, reference?, raw }}
   */
  async verifyTransaction(txRef) {
    const { ok, httpStatus, data } = await this.request(
      'GET',
      `/transaction/verify/${encodeURIComponent(txRef)}`
    )
    const tx = data?.data || null
    const raw = {
      stage: 'verify',
      httpStatus,
      apiStatus: data?.status ?? null,
      txStatus: tx?.status ?? null,
      reference: tx?.reference ?? null,
      mode: tx?.mode ?? null,
    }
    if (!ok || !tx) {
      // Unknown / not-yet-created transaction (customer abandoned checkout)
      if (httpStatus >= 500) {
        throw new AppError('Payment provider verification unavailable', 502)
      }
      return { outcome: 'pending', raw }
    }
    const txStatus = String(tx.status || '').toLowerCase()
    const result = {
      amountMinor: chapaAmountToMinor(tx.amount),
      currency: tx.currency ? String(tx.currency).toUpperCase() : null,
      txRef: tx.tx_ref || null,
      reference: tx.reference || null,
      raw,
    }
    if (txStatus === 'success') return { ...result, outcome: 'success' }
    if (['failed', 'cancelled', 'canceled', 'reversed'].includes(txStatus)) {
      return { ...result, outcome: 'failure' }
    }
    return { ...result, outcome: 'pending' }
  }

  // Generic PaymentProvider contract -------------------------------------

  async initiatePayment({ payment }) {
    // Checkout is initialized lazily (see chapaCheckoutService) because it
    // needs customer details and return URLs.
    return {
      providerReference: null,
      raw: { stage: 'created', paymentId: String(payment._id), provider: 'chapa' },
    }
  }

  async confirmPayment() {
    throw new AppError('Chapa payments are confirmed via checkout + verification', 409)
  }

  async cancelPayment({ payment }) {
    return {
      success: true,
      providerReference: payment.providerPaymentId || null,
      raw: { provider: 'chapa', outcome: 'cancelled_locally' },
    }
  }

  /**
   * Refund via POST /refund/:tx_ref. Chapa processes refunds asynchronously;
   * an accepted request is recorded as success with the Chapa ref_id.
   */
  async refundPayment({ payment, refund }) {
    const txRef = payment.providerPaymentId
    if (!txRef) {
      return {
        success: false,
        failureCode: 'CHAPA_NO_TX_REF',
        failureMessage: 'Payment has no Chapa transaction reference',
        raw: { provider: 'chapa' },
      }
    }
    const { ok, httpStatus, data } = await this.request(
      'POST',
      `/refund/${encodeURIComponent(txRef)}`,
      {
        amount: minorToChapaAmount(refund.amountMinor),
        reason: String(refund.reason || 'customer_cancelled').slice(0, 100),
        reference: `ve-refund-${refund._id}`,
      }
    )
    if (!ok || data?.status !== 'success') {
      return {
        success: false,
        failureCode: 'CHAPA_REFUND_REJECTED',
        failureMessage:
          typeof data?.message === 'string' ? data.message : 'Chapa refund rejected',
        raw: { provider: 'chapa', httpStatus },
      }
    }
    return {
      success: true,
      providerRefundId: data?.data?.ref_id || `chapa_refund_${refund._id}`,
      raw: {
        provider: 'chapa',
        httpStatus,
        refundStatus: data?.data?.status || null,
      },
    }
  }

  /**
   * Chapa sends `chapa-signature` and/or `x-chapa-signature` (HMAC-SHA256,
   * hex) using the webhook secret hash configured in the Chapa dashboard.
   * The docs describe signing the payload; we accept the raw body or its
   * JSON re-serialization. One valid header is sufficient.
   */
  verifyWebhookSignature({ rawBody, headers = {} }) {
    const { webhookSecret } = getChapaConfig()
    if (!webhookSecret || !rawBody) return false
    const candidates = [headers['x-chapa-signature'], headers['chapa-signature']].filter(
      (v) => typeof v === 'string' && v.length > 0
    )
    if (candidates.length === 0) return false

    const expected = new Set([hmacHex(webhookSecret, rawBody)])
    try {
      expected.add(hmacHex(webhookSecret, JSON.stringify(JSON.parse(rawBody))))
    } catch {
      /* non-JSON body — raw comparison only */
    }
    return candidates.some((sig) => [...expected].some((exp) => safeEqualHex(exp, sig)))
  }

  /**
   * Parse a Chapa webhook. The outcome here is a HINT only — the webhook
   * service re-verifies via the API before changing any state.
   */
  parseWebhookEvent({ payload }) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Webhook payload must be a JSON object')
    }
    const txRef = payload.tx_ref || payload.trx_ref
    const parsedRef = parseTxRef(txRef)
    const eventType = String(payload.event || payload.status || 'unknown')
    if (!txRef) throw new Error('tx_ref is required')

    let outcome = 'verify'
    if (/^payout\./.test(eventType)) outcome = 'unknown'
    if (/refund/.test(eventType)) outcome = 'unknown'

    return {
      eventId: `${txRef}:${eventType}:${payload.reference || ''}`.slice(0, 200),
      eventType,
      paymentId: parsedRef?.paymentId || null,
      refundId: null,
      providerReference: String(txRef),
      outcome,
      sanitizedPayload: {
        provider: 'chapa',
        event: eventType,
        tx_ref: String(txRef),
        reference: payload.reference || null,
        status: payload.status || null,
      },
    }
  }
}
