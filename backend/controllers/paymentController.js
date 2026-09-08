import catchAsync from '../utils/catchAsync.js'
import {
  confirmPaymentForUser,
  getPaymentForUser,
  serializePayment,
} from '../services/paymentService.js'
import { serializeV2Booking } from '../services/bookingLifecycleService.js'
import { ingestPaymentWebhook } from '../services/paymentWebhookService.js'

export const getPaymentById = catchAsync(async (req, res, next) => {
  const { payment, booking } = await getPaymentForUser(req.params.id, req.user)

  res.status(200).json({
    status: 'success',
    data: {
      payment: serializePayment(payment),
      booking: serializeV2Booking(booking),
    },
  })
})

export const confirmPayment = catchAsync(async (req, res, next) => {
  const idempotencyKey =
    req.headers['idempotency-key'] || req.headers['Idempotency-Key']
  const mockOutcomeHeader =
    req.headers['x-mock-payment-outcome'] ||
    req.headers['X-Mock-Payment-Outcome']
  const mockOutcome =
    mockOutcomeHeader === 'fail' || req.body?.mockOutcome === 'fail'
      ? 'fail'
      : 'success'

  const result = await confirmPaymentForUser({
    paymentId: req.params.id,
    user: req.user,
    body: req.body,
    idempotencyKey,
    mockOutcome,
  })

  const statusCode = result.idempotent ? 200 : 200
  res.status(statusCode).json({
    status: 'success',
    idempotent: result.idempotent,
    failed: Boolean(result.failed),
    data: {
      payment: serializePayment(result.payment),
      booking: serializeV2Booking(result.booking),
    },
  })
})

export const createRefund = catchAsync(async (req, res) => {
  const idempotencyKey =
    req.headers['idempotency-key'] || req.headers['Idempotency-Key']
  const mockOutcomeHeader =
    req.headers['x-mock-refund-outcome'] ||
    req.headers['X-Mock-Refund-Outcome']
  const mockOutcome =
    mockOutcomeHeader === 'fail' || req.body?.mockOutcome === 'fail'
      ? 'fail'
      : 'success'

  const {
    createRefundForPayment,
    serializeRefund,
  } = await import('../services/refundService.js')

  const result = await createRefundForPayment({
    paymentId: req.params.id,
    user: req.user,
    body: req.body || {},
    idempotencyKey,
    mockOutcome,
    reason: req.body?.reason,
  })

  res.status(200).json({
    status: 'success',
    idempotent: result.idempotent,
    failed: Boolean(result.failed),
    data: {
      refund: result.refund ? serializeRefund(result.refund) : null,
      payment: serializePayment(result.payment),
      booking: serializeV2Booking(result.booking),
    },
  })
})

export const handlePaymentWebhook = catchAsync(async (req, res) => {
  const provider = req.params.provider
  const rawBody = req.rawBody || JSON.stringify(req.body ?? {})
  const payload = req.body ?? {}

  const result = await ingestPaymentWebhook({
    provider,
    rawBody,
    headers: req.headers,
    payload,
  })

  res.status(200).json({
    status: 'success',
    idempotent: Boolean(result.idempotent),
    processed: Boolean(result.processed),
    flagged: Boolean(result.flagged),
    eventId: result.eventId,
  })
})

export default { getPaymentById, confirmPayment, createRefund, handlePaymentWebhook }
