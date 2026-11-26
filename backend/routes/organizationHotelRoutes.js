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
  listOrganizationHotels,
  getOrganizationHotel,
  createOrganizationHotel,
  updateOrganizationHotel,
  deleteOrganizationHotel,
  publishOrganizationHotel,
  unpublishOrganizationHotel,
  listOrganizationHotelInventory,
  upsertOrganizationHotelInventory,
  updateOrganizationHotelInventory,
} from '../controllers/organizationHotelController.js'

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
  requireParamOrgMatch
)

router
  .route('/')
  .get(requireOrganizationPermission('hotels:read'), listOrganizationHotels)
  .post(requireOrganizationPermission('hotels:write'), createOrganizationHotel)

router.post(
  '/:id/publish',
  requireObjectIdParam('id'),
  requireOrganizationPermission('hotels:write'),
  publishOrganizationHotel
)
router.post(
  '/:id/unpublish',
  requireObjectIdParam('id'),
  requireOrganizationPermission('hotels:write'),
  unpublishOrganizationHotel
)

router
  .route('/:hotelId/inventory')
  .get(
    requireObjectIdParam('hotelId'),
    requireOrganizationPermission('hotels:read'),
    listOrganizationHotelInventory
  )
  .post(
    requireObjectIdParam('hotelId'),
    requireOrganizationPermission('hotels:write'),
    upsertOrganizationHotelInventory
  )

router.patch(
  '/:hotelId/inventory/:inventoryId',
  requireObjectIdParam('hotelId'),
  requireObjectIdParam('inventoryId'),
  requireOrganizationPermission('hotels:write'),
  updateOrganizationHotelInventory
)

router
  .route('/:id')
  .get(
    requireObjectIdParam('id'),
    requireOrganizationPermission('hotels:read'),
    getOrganizationHotel
  )
  .patch(
    requireObjectIdParam('id'),
    requireOrganizationPermission('hotels:write'),
    updateOrganizationHotel
  )
  .delete(
    requireObjectIdParam('id'),
    requireOrganizationPermission('hotels:write'),
    deleteOrganizationHotel
  )

export default router
