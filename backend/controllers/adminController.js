import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import * as admin from '../services/adminService.js'
import { verifyChapaPayment } from '../services/chapaCheckoutService.js'

const ok = (res, data, status = 200) => res.status(status).json({ status: 'success', data })

export const getOverview = catchAsync(async (req, res) => {
  ok(res, await admin.getOverview({ days: req.query.days }))
})

export const listBookings = catchAsync(async (req, res) => {
  ok(res, await admin.listBookings(req.query))
})

export const getBooking = catchAsync(async (req, res) => {
  ok(res, { booking: await admin.getBookingDetail(req.params.id) })
})

export const listPayments = catchAsync(async (req, res) => {
  ok(res, await admin.listPayments(req.query))
})

export const resolvePaymentReview = catchAsync(async (req, res) => {
  ok(res, await admin.resolveFlaggedPayment(req.user, req.params.id, req.body || {}))
})

/** Re-check a Chapa payment with the provider (same verification path as callbacks). */
export const verifyPayment = catchAsync(async (req, res) => {
  admin.assertPrismaAdmin()
  const result = await verifyChapaPayment({
    paymentId: req.params.id,
    user: req.user,
    source: 'reconciliation',
  })
  await admin.logAdminAction(req.user._id || req.user.id, 'payment.verified', 'payment', req.params.id, {
    outcome: result.outcome,
  })
  ok(res, {
    outcome: result.outcome,
    paymentStatus: result.payment?.status,
    bookingStatus: result.booking?.status,
  })
})

export const listUsers = catchAsync(async (req, res) => {
  ok(res, await admin.listUsers(req.query))
})

export const updateUser = catchAsync(async (req, res) => {
  const body = req.body || {}
  const allowed = Object.keys(body).filter((k) => !['role', 'active'].includes(k))
  if (allowed.length) throw new AppError(`Unsupported fields: ${allowed.join(', ')}`, 400)
  ok(res, { user: await admin.updateUserByAdmin(req.user, req.params.id, body) })
})

export const listAuditLog = catchAsync(async (req, res) => {
  ok(res, await admin.listAuditLog(req.query))
})

export const getAssistantInsights = catchAsync(async (req, res) => {
  ok(res, await admin.getAssistantInsights({ days: req.query.days }))
})
