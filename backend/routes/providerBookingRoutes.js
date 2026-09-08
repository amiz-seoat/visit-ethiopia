import express from 'express'
import { protect } from '../controllers/authController.js'
import {
  requireOrganizationContext,
  requireOrganizationPermission,
} from '../middlewares/organizationContext.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import AppError from '../utils/appError.js'
import {
  listProviderBookings,
  getProviderBooking,
  checkInBooking,
  completeBooking,
  noShowBooking,
  addBookingNote,
  listBookingAudits,
} from '../controllers/providerBookingController.js'

const router = express.Router()

/** Provider financial cancellation remains deferred — no product policy beyond customer/admin refund path. */
const cancelDeferred = (req, res, next) =>
  next(
    new AppError(
      'Provider booking cancellation is not enabled. Use customer/admin refund flows where applicable.',
      405
    )
  )

router.use(protect)
router.use(requireOrganizationContext())

router
  .route('/')
  .get(requireOrganizationPermission('bookings:read'), listProviderBookings)

router
  .route('/:id')
  .get(
    requireObjectIdParam('id'),
    requireOrganizationPermission('bookings:read'),
    getProviderBooking
  )
  .patch(
    requireObjectIdParam('id'),
    requireOrganizationPermission('bookings:manage'),
    cancelDeferred
  )

router.post(
  '/:id/check-in',
  requireObjectIdParam('id'),
  requireOrganizationPermission('bookings:manage'),
  checkInBooking
)

router.post(
  '/:id/complete',
  requireObjectIdParam('id'),
  requireOrganizationPermission('bookings:manage'),
  completeBooking
)

router.post(
  '/:id/no-show',
  requireObjectIdParam('id'),
  requireOrganizationPermission('bookings:manage'),
  noShowBooking
)

router.post(
  '/:id/notes',
  requireObjectIdParam('id'),
  requireOrganizationPermission('bookings:manage'),
  addBookingNote
)

router.get(
  '/:id/audits',
  requireObjectIdParam('id'),
  requireOrganizationPermission('bookings:read'),
  listBookingAudits
)

router.post(
  '/:id/cancel',
  requireObjectIdParam('id'),
  requireOrganizationPermission('bookings:manage'),
  cancelDeferred
)

export default router
