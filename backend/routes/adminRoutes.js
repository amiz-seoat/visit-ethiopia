import express from 'express'
import { protect, restrict } from '../controllers/authController.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import * as c from '../controllers/adminController.js'

// Admin console API, mounted at /api/v1/admin (after /api/v1/admin/bookings,
// which keeps the reconciliation endpoints).
const router = express.Router()
router.use(protect)
router.use(restrict('admin'))

router.get('/overview', c.getOverview)
router.get('/console/bookings', c.listBookings)
router.get('/console/bookings/:id', requireObjectIdParam('id'), c.getBooking)
router.get('/payments', c.listPayments)
router.post('/payments/:id/resolve-review', requireObjectIdParam('id'), c.resolvePaymentReview)
router.post('/payments/:id/verify', requireObjectIdParam('id'), c.verifyPayment)
router.get('/users', c.listUsers)
router.patch('/users/:id', requireObjectIdParam('id'), c.updateUser)
router.get('/audit-log', c.listAuditLog)
router.get('/assistant-insights', c.getAssistantInsights)

export default router
