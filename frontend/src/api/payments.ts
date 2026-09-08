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
