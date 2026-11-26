import api from '../services/api'
import type { PaymentRecord, V2Booking } from '../types'

export async function getPaymentById(id: string) {
  const res = await api.get(`/payments/${id}`)
  return res.data.data as { payment: PaymentRecord; booking: V2Booking }
}

export async function confirmPayment(
  id: string,
  opts: { idempotencyKey?: string; mockOutcome?: 'success' | 'fail' } = {}
) {
  const headers: Record<string, string> = {}
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  if (opts.mockOutcome === 'fail') headers['X-Mock-Payment-Outcome'] = 'fail'

  const res = await api.post(
    `/payments/${id}/confirm`,
    {},
    { headers }
  )
  return {
    idempotent: Boolean(res.data.idempotent),
    failed: Boolean(res.data.failed),
    payment: res.data.data.payment as PaymentRecord,
    booking: res.data.data.booking as V2Booking,
  }
}

export interface CheckoutResult {
  checkoutUrl: string | null
  alreadyPaid: boolean
  reused: boolean
  payment: PaymentRecord
  booking: V2Booking
}

/** Start (or resume) a hosted Chapa checkout. Amount is set by the server. */
export async function startCheckout(id: string) {
  const res = await api.post(`/payments/${id}/checkout`, {})
  return res.data.data as CheckoutResult
}

export type VerifyOutcome = 'success' | 'pending' | 'failed_retryable' | 'flagged'

/** Ask the server to verify the payment with Chapa (never trusts the redirect). */
export async function verifyPayment(id: string) {
  const res = await api.post(`/payments/${id}/verify`, {})
  return res.data.data as { outcome: VerifyOutcome; payment: PaymentRecord; booking: V2Booking }
}

export interface PaymentConfig {
  provider: 'chapa' | 'mock'
  mockAllowed: boolean
  testMode: boolean
  configured: boolean
}

export async function getPaymentConfig() {
  const res = await api.get('/payments/config')
  return res.data.data as PaymentConfig
}
