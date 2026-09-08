import express from 'express'
import mongoose from 'mongoose'
import { protect, restrict } from '../controllers/authController.js'
import {
  registerOrganization,
  getMyOrganizations,
  listPublicOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  getOrganizationResource,
  getProviderWorkspace,
  updateOrganizationDraft,
  listVersions,
  submitVersion,
} from '../controllers/organizationController.js'
import {
  requireOrganizationContext,
  requireOrganizationPermission,
} from '../middlewares/organizationContext.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import {
  listPendingApprovals,
  getApprovalDetail,
  approveApprovalRequest,
  rejectApprovalRequest,
  suspendOrg,
  reactivateOrg,
} from '../controllers/approvalController.js'
import { listOrganizationPublicTours } from '../controllers/marketplaceTourController.js'
import organizationTourRoutes from './organizationTourRoutes.js'

const router = express.Router()

// --- Public ---
router.get('/', listPublicOrganizations)

// Public organization tours by slug (must be before protected /:organizationId/tours)
router.get('/:slug/tours', (req, res, next) => {
  if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
    return next()
  }
  return listOrganizationPublicTours(req, res, next)
})

// --- Provider registration & self-service ---
router.post('/register', protect, registerOrganization)
router.get('/me', protect, getMyOrganizations)

router.get(
  '/context/:organizationId',
  protect,
  requireObjectIdParam('organizationId'),
  requireOrganizationContext(),
  requireOrganizationPermission('org:read'),
  getOrganizationResource
)

router.get(
  '/:organizationId/workspace',
  protect,
  requireObjectIdParam('organizationId'),
  requireOrganizationContext(),
  requireOrganizationPermission('org:read'),
  getProviderWorkspace
)

router.patch(
  '/:organizationId/draft',
  protect,
  requireObjectIdParam('organizationId'),
  requireOrganizationContext(),
  requireOrganizationPermission('org:write'),
  updateOrganizationDraft
)

router.get(
  '/:organizationId/versions',
  protect,
  requireObjectIdParam('organizationId'),
  requireOrganizationContext(),
  requireOrganizationPermission('org:read'),
  listVersions
)

router.post(
  '/:organizationId/versions/:versionId/submit',
  protect,
  requireObjectIdParam('organizationId'),
  requireObjectIdParam('versionId'),
  requireOrganizationContext(),
  requireOrganizationPermission('org:submit'),
  submitVersion
)

router.use(
  '/:organizationId/tours',
  organizationTourRoutes
)

// Legacy PATCH /:id — version-aware draft update
router.patch(
  '/:id',
  protect,
  requireObjectIdParam('id'),
  requireOrganizationContext(),
  requireOrganizationPermission('org:write'),
  updateOrganization
)

// --- Admin approval (mounted under /organizations/admin) ---
const adminRouter = express.Router()
adminRouter.use(protect, restrict('admin'))
adminRouter.get('/approvals', listPendingApprovals)
adminRouter.get('/approvals/:id', requireObjectIdParam('id'), getApprovalDetail)
adminRouter.patch('/approvals/:id/approve', requireObjectIdParam('id'), approveApprovalRequest)
adminRouter.patch('/approvals/:id/reject', requireObjectIdParam('id'), rejectApprovalRequest)
adminRouter.patch(
  '/organizations/:organizationId/suspend',
  requireObjectIdParam('organizationId'),
  suspendOrg
)
adminRouter.patch(
  '/organizations/:organizationId/reactivate',
  requireObjectIdParam('organizationId'),
  reactivateOrg
)
router.use('/admin', adminRouter)

// Public slug lookup — must be last
router.get('/:slug', getOrganizationBySlug)

export default router
