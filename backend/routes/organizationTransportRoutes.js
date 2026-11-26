import express from 'express'
import { protect } from '../controllers/authController.js'
import {
  requireOrganizationContext,
  requireAnyOrganizationPermission,
} from '../middlewares/organizationContext.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import {
  listOrganizationTransports,
  getOrganizationTransport,
  createOrganizationTransport,
  updateOrganizationTransport,
  deleteOrganizationTransport,
  publishOrganizationTransport,
  unpublishOrganizationTransport,
  listOrganizationTransportInventory,
  upsertOrganizationTransportInventory,
  updateOrganizationTransportInventory,
} from '../controllers/organizationTransportController.js'

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

const transportRead = requireAnyOrganizationPermission(
  'tour_buses:read',
  'bus:read'
)
const transportWrite = requireAnyOrganizationPermission(
  'tour_buses:write',
  'bus:write'
)

router
  .route('/')
  .get(transportRead, listOrganizationTransports)
  .post(transportWrite, createOrganizationTransport)

router.post(
  '/:id/publish',
  requireObjectIdParam('id'),
  transportWrite,
  publishOrganizationTransport
)
router.post(
  '/:id/unpublish',
  requireObjectIdParam('id'),
  transportWrite,
  unpublishOrganizationTransport
)

router
  .route('/:transportId/inventory')
  .get(
    requireObjectIdParam('transportId'),
    transportRead,
    listOrganizationTransportInventory
  )
  .post(
    requireObjectIdParam('transportId'),
    transportWrite,
    upsertOrganizationTransportInventory
  )

router.patch(
  '/:transportId/inventory/:inventoryId',
  requireObjectIdParam('transportId'),
  requireObjectIdParam('inventoryId'),
  transportWrite,
  updateOrganizationTransportInventory
)

router
  .route('/:id')
  .get(requireObjectIdParam('id'), transportRead, getOrganizationTransport)
  .patch(requireObjectIdParam('id'), transportWrite, updateOrganizationTransport)
  .delete(
    requireObjectIdParam('id'),
    transportWrite,
    deleteOrganizationTransport
  )

export default router
