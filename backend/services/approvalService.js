import Organization from '../models/Organization.js'
import ProviderVersion from '../models/ProviderVersion.js'
import ApprovalRequest from '../models/ApprovalRequest.js'
import AppError from '../utils/appError.js'
import { validateVerification } from './verificationService.js'
import { analyzeVersionChanges } from '../utils/versionDiff.js'
import {
  freezeVersionForSubmission,
  getApprovedVersion,
  syncOrganizationProfileFromApprovedVersion,
} from './organizationVersionService.js'
import {
  assertVersionTransition,
  assertRequestTransition,
} from './approvalStateMachine.js'
import {
  reconcileOrganizationApprovalState,
  tryGetIdempotentApproveResult,
} from './approvalReconciliationService.js'

function assertVersionBelongsToOrg(version, organizationId) {
  if (version.organizationId.toString() !== organizationId.toString()) {
    throw new AppError('Version does not belong to this organization', 403)
  }
}

async function rollbackProcessingRequest(approvalRequestId, previousAdminNotes) {
  await ApprovalRequest.findByIdAndUpdate(approvalRequestId, {
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    adminNotes: previousAdminNotes,
  })
}

export async function submitVersionForApproval({
  organization,
  versionId,
  submittedBy,
}) {
  const version = await ProviderVersion.findById(versionId)
  if (!version) throw new AppError('Version not found', 404)

  assertVersionBelongsToOrg(version, organization._id)

  if (organization.latestVersionId?.toString() !== version._id.toString()) {
    throw new AppError('Only the current draft version can be submitted', 400)
  }

  if (version.status !== 'draft') {
    throw new AppError('Only draft versions can be submitted', 400)
  }

  const providerTypes =
    version.snapshot?.providerTypes || organization.providerTypes

  if (!version.snapshot?.name?.trim()) {
    throw new AppError('Organization name is required before submission', 400)
  }

  const checklist = validateVerification(
    providerTypes,
    version.verificationSnapshot || organization.verification
  )

  const approved = await getApprovedVersion(organization)
  const analysis = analyzeVersionChanges({
    approvedSnapshot: approved?.snapshot,
    submittedSnapshot: version.snapshot,
  })

  assertVersionTransition(version.status, 'submitted')

  version.changedFields = analysis.changedFields
  version.requiresReapproval = analysis.requiresReapproval
  version.reapprovalFields = analysis.reapprovalFields
  version.status = 'submitted'
  version.submittedBy = submittedBy
  version.submittedAt = new Date()

  await freezeVersionForSubmission(version)

  organization.verification = JSON.parse(
    JSON.stringify(version.verificationSnapshot || {})
  )
  organization.markModified('verification')

  const existingPending = await ApprovalRequest.findOne({
    providerVersionId: version._id,
    status: { $in: ['pending', 'processing'] },
  })
  if (existingPending) {
    throw new AppError('An approval request already exists for this version', 400)
  }

  const approvalRequest = await ApprovalRequest.create({
    organizationId: organization._id,
    providerVersionId: version._id,
    requestType: approved ? 'reapproval' : 'initial_approval',
    status: 'pending',
    submittedBy,
    submittedAt: version.submittedAt,
    verificationChecklist: checklist,
    providerTypes,
    changedFields: analysis.changedFields,
    requiresReapproval: analysis.requiresReapproval,
  })

  if (!organization.approvedVersionId) {
    organization.approvalStatus = 'submitted'
    organization.visibility = 'private'
  } else {
    organization.approvalStatus = 'approved'
    organization.visibility = 'public'
  }
  await organization.save({ validateBeforeSave: false })

  return { version, approvalRequest }
}

export async function approveRequest({ approvalRequestId, adminUserId, adminNotes }) {
  const approvalRequest = await ApprovalRequest.findById(approvalRequestId)
  if (!approvalRequest) throw new AppError('Approval request not found', 404)

  await reconcileOrganizationApprovalState(approvalRequest.organizationId)

  const idempotent = await tryGetIdempotentApproveResult(approvalRequestId)
  if (idempotent) return idempotent

  if (approvalRequest.status !== 'pending') {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const version = await ProviderVersion.findById(approvalRequest.providerVersionId)
  if (!version) throw new AppError('Provider version not found', 404)
  if (version.status !== 'submitted') {
    throw new AppError('Provider version is not in submitted state', 409)
  }

  const organization = await Organization.findById(approvalRequest.organizationId)
  if (!organization) throw new AppError('Organization not found', 404)

  if (organization.latestVersionId?.toString() !== version._id.toString()) {
    throw new AppError('Stale approval request — version is no longer current', 409)
  }

  assertRequestTransition(approvalRequest.status, 'processing')
  assertVersionTransition(version.status, 'approved')

  const previousApprovedId = organization.approvedVersionId
  const previousAdminNotes = approvalRequest.adminNotes

  const claimedRequest = await ApprovalRequest.findOneAndUpdate(
    { _id: approvalRequestId, status: 'pending' },
    {
      status: 'processing',
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      ...(adminNotes ? { adminNotes } : {}),
    },
    { new: true }
  )
  if (!claimedRequest) {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const updatedVersion = await ProviderVersion.findOneAndUpdate(
    { _id: version._id, status: 'submitted' },
    {
      status: 'approved',
      approvedBy: adminUserId,
      approvedAt: new Date(),
    },
    { new: true }
  )
  if (!updatedVersion) {
    await rollbackProcessingRequest(approvalRequestId, previousAdminNotes)
    throw new AppError('Provider version is not in submitted state', 409)
  }

  let updatedOrganization
  try {
    updatedOrganization = await syncOrganizationProfileFromApprovedVersion(
      organization,
      updatedVersion
    )

    if (
      previousApprovedId &&
      previousApprovedId.toString() !== updatedVersion._id.toString()
    ) {
      await ProviderVersion.findOneAndUpdate(
        { _id: previousApprovedId, status: 'approved' },
        { status: 'superseded' }
      )
    }

    const finalizedRequest = await ApprovalRequest.findOneAndUpdate(
      { _id: approvalRequestId, status: 'processing' },
      { status: 'approved' },
      { new: true }
    )
    if (!finalizedRequest) {
      throw new AppError('Approval finalization failed', 500)
    }

    return {
      approvalRequest: finalizedRequest,
      version: updatedVersion,
      organization: updatedOrganization,
    }
  } catch (err) {
    await ProviderVersion.findByIdAndUpdate(version._id, {
      status: 'submitted',
      approvedBy: null,
      approvedAt: null,
    })
    await rollbackProcessingRequest(approvalRequestId, previousAdminNotes)
    throw err
  }
}

export async function rejectRequest({
  approvalRequestId,
  adminUserId,
  rejectionReason,
  adminNotes,
}) {
  if (!rejectionReason?.trim()) {
    throw new AppError('Rejection reason is required', 400)
  }

  const approvalRequest = await ApprovalRequest.findById(approvalRequestId)
  if (!approvalRequest) throw new AppError('Approval request not found', 404)

  await reconcileOrganizationApprovalState(approvalRequest.organizationId)

  if (approvalRequest.status === 'rejected') {
    return {
      approvalRequest,
      version: await ProviderVersion.findById(approvalRequest.providerVersionId),
      organization: await Organization.findById(approvalRequest.organizationId),
      idempotent: true,
    }
  }

  if (approvalRequest.status !== 'pending') {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const version = await ProviderVersion.findById(approvalRequest.providerVersionId)
  if (!version) throw new AppError('Provider version not found', 404)
  if (version.status !== 'submitted') {
    throw new AppError('Provider version is not in submitted state', 409)
  }

  const organization = await Organization.findById(approvalRequest.organizationId)
  if (!organization) throw new AppError('Organization not found', 404)

  assertRequestTransition(approvalRequest.status, 'processing')
  assertVersionTransition(version.status, 'rejected')

  const claimedRequest = await ApprovalRequest.findOneAndUpdate(
    { _id: approvalRequestId, status: 'pending' },
    {
      status: 'processing',
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      rejectionReason: rejectionReason.trim(),
      ...(adminNotes ? { adminNotes } : {}),
    },
    { new: true }
  )
  if (!claimedRequest) {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const updatedVersion = await ProviderVersion.findOneAndUpdate(
    { _id: version._id, status: 'submitted' },
    {
      status: 'rejected',
      rejectedBy: adminUserId,
      rejectedAt: new Date(),
      rejectionReason: rejectionReason.trim(),
    },
    { new: true }
  )

  if (!updatedVersion) {
    await rollbackProcessingRequest(approvalRequestId, approvalRequest.adminNotes)
    throw new AppError('Provider version is not in submitted state', 409)
  }

  const finalizedRequest = await ApprovalRequest.findOneAndUpdate(
    { _id: approvalRequestId, status: 'processing' },
    { status: 'rejected' },
    { new: true }
  )

  if (organization.approvedVersionId) {
    organization.approvalStatus = 'approved'
    organization.visibility = 'public'
  } else {
    organization.approvalStatus = 'rejected'
    organization.visibility = 'private'
  }
  await organization.save({ validateBeforeSave: false })

  return {
    approvalRequest: finalizedRequest,
    version: updatedVersion,
    organization,
  }
}

export async function suspendOrganization({
  organizationId,
  adminUserId,
  reason,
}) {
  const organization = await Organization.findById(organizationId)
  if (!organization) throw new AppError('Organization not found', 404)

  organization.approvalStatus = 'suspended'
  organization.visibility = 'private'
  organization.suspendedAt = new Date()
  organization.suspendedBy = adminUserId
  organization.suspensionReason = reason || ''
  await organization.save({ validateBeforeSave: false })

  return organization
}

export async function reactivateOrganization({ organizationId, adminUserId }) {
  const organization = await Organization.findById(organizationId)
  if (!organization) throw new AppError('Organization not found', 404)

  if (!organization.approvedVersionId) {
    throw new AppError(
      'Organization cannot be reactivated without an approved version',
      400
    )
  }

  organization.approvalStatus = 'approved'
  organization.visibility = 'public'
  organization.suspendedAt = null
  organization.suspendedBy = null
  organization.suspensionReason = ''
  await organization.save({ validateBeforeSave: false })

  return organization
}

export async function getApprovalRequestDetail(approvalRequestId) {
  const approvalRequest = await ApprovalRequest.findById(approvalRequestId)
    .populate('submittedBy', 'FirstName LastName email')
    .populate('reviewedBy', 'FirstName LastName email')

  if (!approvalRequest) throw new AppError('Approval request not found', 404)

  if (approvalRequest.organizationId) {
    await reconcileOrganizationApprovalState(approvalRequest.organizationId)
  }

  const version = await ProviderVersion.findById(approvalRequest.providerVersionId)
  const organization = await Organization.findById(approvalRequest.organizationId)
  let currentApprovedVersion = null
  if (
    organization?.approvedVersionId &&
    version &&
    organization.approvedVersionId.toString() !== version._id.toString()
  ) {
    currentApprovedVersion = await ProviderVersion.findById(
      organization.approvedVersionId
    )
  }

  return {
    approvalRequest: await ApprovalRequest.findById(approvalRequestId)
      .populate('submittedBy', 'FirstName LastName email')
      .populate('reviewedBy', 'FirstName LastName email'),
    submittedVersion: version,
    currentApprovedVersion,
    organization: organization
      ? {
          _id: organization._id,
          slug: organization.slug,
          approvalStatus: organization.approvalStatus,
          visibility: organization.visibility,
          providerTypes: organization.providerTypes,
        }
      : null,
    diff: version
      ? analyzeVersionChanges({
          approvedSnapshot: currentApprovedVersion?.snapshot,
          submittedSnapshot: version.snapshot,
        })
      : null,
    verificationChecklist: approvalRequest.verificationChecklist || [],
  }
}

export async function listApprovalRequests(filters = {}) {
  const query = {}
  if (filters.status) query.status = filters.status
  if (filters.providerType) query.providerTypes = filters.providerType

  return ApprovalRequest.find(query)
    .sort({ submittedAt: -1 })
    .populate('organizationId', 'name slug providerTypes approvalStatus visibility')
    .populate('submittedBy', 'FirstName LastName email')
}

export { reconcileOrganizationApprovalState } from './approvalReconciliationService.js'

export default {
  submitVersionForApproval,
  approveRequest,
  rejectRequest,
  suspendOrganization,
  reactivateOrganization,
  getApprovalRequestDetail,
  listApprovalRequests,
}
