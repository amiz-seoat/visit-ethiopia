import express from 'express'
import { protect } from '../controllers/authController.js'
import {
  requireOrganizationContext,
  requireOrganizationPermission,
} from '../middlewares/organizationContext.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import {
  listOrganizationTours,
  getOrganizationTour,
  createOrganizationTour,
  updateOrganizationTour,
  publishOrganizationTour,
  unpublishOrganizationTour,
  archiveOrganizationTour,
} from '../controllers/organizationTourController.js'
import {
  listTourDepartures,
  createTourDeparture,
  updateTourDeparture,
} from '../controllers/tourDepartureController.js'

const router = express.Router({ mergeParams: true })

const requireParamOrgMatch = catchAsync(async (req, res, next) => {
  if (req.organizationId.toString() !== req.params.organizationId) {
    return next(new AppError('Organization context mismatch', 403))
  }
  next()
})

router.use(
  protect,
  requireObjectIdParam('organizationId'),
  requireOrganizationContext(),
  requireParamOrgMatch,
)

router
  .route('/')
  .get(requireOrganizationPermission('tours:read'), listOrganizationTours)
  .post(requireOrganizationPermission('tours:write'), createOrganizationTour)

router
  .route('/:id')
  .get(
    requireObjectIdParam('id'),
    requireOrganizationPermission('tours:read'),
    getOrganizationTour
  )
  .patch(
    requireObjectIdParam('id'),
    requireOrganizationPermission('tours:write'),
    updateOrganizationTour
  )

router.post(
  '/:id/publish',
  requireObjectIdParam('id'),
  requireOrganizationPermission('tours:write'),
  publishOrganizationTour
)
router.post(
  '/:id/unpublish',
  requireObjectIdParam('id'),
  requireOrganizationPermission('tours:write'),
  unpublishOrganizationTour
)
router.post(
  '/:id/archive',
  requireObjectIdParam('id'),
  requireOrganizationPermission('tours:write'),
  archiveOrganizationTour
)

router
  .route('/:tourId/departures')
  .get(
    requireObjectIdParam('tourId'),
    requireOrganizationPermission('tours:read'),
    listTourDepartures
  )
  .post(
    requireObjectIdParam('tourId'),
    requireOrganizationPermission('tours:write'),
    createTourDeparture
  )

router.patch(
  '/:tourId/departures/:departureId',
  requireObjectIdParam('tourId'),
  requireObjectIdParam('departureId'),
  requireOrganizationPermission('tours:write'),
  updateTourDeparture
)

export default router
