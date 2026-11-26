/**
 * Prisma-backed approval / version flows (DATABASE_MODE=prisma).
 * Mirrors Mongo approvalService semantics without Atlas reconciliation jobs.
 */
import AppError from '../utils/appError.js'
import { validateVerification } from './verificationService.js'
import { analyzeVersionChanges } from '../utils/versionDiff.js'
import {
  assertVersionTransition,
  assertRequestTransition,
} from './approvalStateMachine.js'
import { serializePublicOrganization } from './publicOrganizationService.js'
import * as orgRepo from '../repositories/organizations/prismaOrganizationRepository.js'

export async function submitVersionForApprovalPrisma({
  organization,
  versionId,
  submittedBy,
}) {
  const version = await orgRepo.findProviderVersionById(versionId)
  if (!version) throw new AppError('Version not found', 404)

  if (String(version.organizationId) !== String(organization._id)) {
    throw new AppError('Version does not belong to this organization', 403)
  }

  if (String(organization.latestVersionId) !== String(version._id)) {
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

  const approved = await orgRepo.getApprovedVersion(organization)
  const analysis = analyzeVersionChanges({
    approvedSnapshot: approved?.snapshot,
    submittedSnapshot: version.snapshot,
  })

  assertVersionTransition(version.status, 'submitted')

  const submittedAt = new Date()
  const updatedVersion = await orgRepo.updateProviderVersion(version._id, {
    changedFields: analysis.changedFields,
    requiresReapproval: analysis.requiresReapproval,
    reapprovalFields: analysis.reapprovalFields,
    status: 'submitted',
    submittedBy,
    submittedAt,
    frozenAt: submittedAt,
    snapshot: JSON.parse(JSON.stringify(version.snapshot)),
    verificationSnapshot: JSON.parse(
      JSON.stringify(version.verificationSnapshot || {})
    ),
  })

  await orgRepo.updateOrganizationFields(organization._id, {
    verification: version.verificationSnapshot || {},
    ...(!organization.approvedVersionId
      ? { approvalStatus: 'submitted', visibility: 'private' }
      : { approvalStatus: 'approved', visibility: 'public' }),
  })

  const existingPending = await orgRepo.findPendingApprovalForVersion(version._id)
  if (existingPending) {
    throw new AppError('An approval request already exists for this version', 400)
  }

  const approvalRequest = await orgRepo.createApprovalRequest({
    organizationId: organization._id,
    providerVersionId: version._id,
    requestType: approved ? 'reapproval' : 'initial_approval',
    status: 'pending',
    submittedBy,
    submittedAt,
    verificationChecklist: checklist,
    providerTypes,
    changedFields: analysis.changedFields,
    requiresReapproval: analysis.requiresReapproval,
  })

  return { version: updatedVersion, approvalRequest }
}

export async function approveRequestPrisma({
  approvalRequestId,
  adminUserId,
  adminNotes,
}) {
  const approvalRequest = await orgRepo.findApprovalRequestById(approvalRequestId)
  if (!approvalRequest) throw new AppError('Approval request not found', 404)

  if (approvalRequest.status === 'approved') {
    const version = await orgRepo.findProviderVersionById(
      approvalRequest.providerVersionId
    )
    const organization = await orgRepo.findOrganizationById(
      approvalRequest.organizationId
    )
    return { approvalRequest, version, organization, idempotent: true }
  }

  if (approvalRequest.status !== 'pending') {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const version = await orgRepo.findProviderVersionById(
    approvalRequest.providerVersionId
  )
  if (!version) throw new AppError('Provider version not found', 404)
  if (version.status !== 'submitted') {
    throw new AppError('Provider version is not in submitted state', 409)
  }

  const organization = await orgRepo.findOrganizationById(
    approvalRequest.organizationId
  )
  if (!organization) throw new AppError('Organization not found', 404)

  if (String(organization.latestVersionId) !== String(version._id)) {
    throw new AppError('Stale approval request — version is no longer current', 409)
  }

  assertRequestTransition(approvalRequest.status, 'processing')
  assertVersionTransition(version.status, 'approved')

  const previousApprovedId = organization.approvedVersionId

  const claimed = await orgRepo.claimPendingApproval(approvalRequestId, {
    status: 'processing',
    reviewedBy: adminUserId,
    reviewedAt: new Date(),
    ...(adminNotes ? { adminNotes } : {}),
  })
  if (!claimed) {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const updatedVersion = await orgRepo.claimSubmittedVersion(version._id, {
    status: 'approved',
    approvedBy: adminUserId,
    approvedAt: new Date(),
  })
  if (!updatedVersion) {
    await orgRepo.updateApprovalRequest(approvalRequestId, {
      status: 'pending',
      reviewedById: null,
      reviewedAt: null,
      adminNotes: approvalRequest.adminNotes,
    })
    throw new AppError('Provider version is not in submitted state', 409)
  }

  return orgRepo.applyApprovalTransaction({
    organizationId: organization._id,
    versionId: updatedVersion._id,
    approvalRequestId,
    previousApprovedId,
    snapshot: updatedVersion.snapshot,
  })
}

export async function rejectRequestPrisma({
  approvalRequestId,
  adminUserId,
  rejectionReason,
  adminNotes,
}) {
  if (!rejectionReason?.trim()) {
    throw new AppError('Rejection reason is required', 400)
  }

  const approvalRequest = await orgRepo.findApprovalRequestById(approvalRequestId)
  if (!approvalRequest) throw new AppError('Approval request not found', 404)

  if (approvalRequest.status === 'rejected') {
    return {
      approvalRequest,
      version: await orgRepo.findProviderVersionById(
        approvalRequest.providerVersionId
      ),
      organization: await orgRepo.findOrganizationById(
        approvalRequest.organizationId
      ),
      idempotent: true,
    }
  }

  if (approvalRequest.status !== 'pending') {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const version = await orgRepo.findProviderVersionById(
    approvalRequest.providerVersionId
  )
  if (!version) throw new AppError('Provider version not found', 404)
  if (version.status !== 'submitted') {
    throw new AppError('Provider version is not in submitted state', 409)
  }

  const organization = await orgRepo.findOrganizationById(
    approvalRequest.organizationId
  )
  if (!organization) throw new AppError('Organization not found', 404)

  assertRequestTransition(approvalRequest.status, 'processing')
  assertVersionTransition(version.status, 'rejected')

  const claimed = await orgRepo.claimPendingApproval(approvalRequestId, {
    status: 'processing',
    reviewedBy: adminUserId,
    reviewedAt: new Date(),
    rejectionReason: rejectionReason.trim(),
    ...(adminNotes ? { adminNotes } : {}),
  })
  if (!claimed) {
    throw new AppError('Approval request is no longer pending', 409)
  }

  const updatedVersion = await orgRepo.claimSubmittedVersion(version._id, {
    status: 'rejected',
    rejectedBy: adminUserId,
    rejectedAt: new Date(),
    rejectionReason: rejectionReason.trim(),
  })
  if (!updatedVersion) {
    await orgRepo.updateApprovalRequest(approvalRequestId, {
      status: 'pending',
      reviewedById: null,
      reviewedAt: null,
    })
    throw new AppError('Provider version is not in submitted state', 409)
  }

  const finalizedRequest = await orgRepo.updateApprovalRequest(approvalRequestId, {
    status: 'rejected',
  })

  const orgUpdate = organization.approvedVersionId
    ? { approvalStatus: 'approved', visibility: 'public' }
    : { approvalStatus: 'rejected', visibility: 'private' }

  const updatedOrg = await orgRepo.updateOrganizationFields(
    organization._id,
    orgUpdate
  )

  return {
    approvalRequest: finalizedRequest,
    version: updatedVersion,
    organization: updatedOrg,
  }
}

export async function loadPublicOrganizationBySlugPrisma(slug) {
  const found = await orgRepo.findPublicOrganizationBySlug(slug)
  if (!found) return null
  return {
    organization: serializePublicOrganization(
      found.organization,
      found.approvedVersion
    ),
    canonicalSlug: found.canonicalSlug,
    requestedSlug: String(slug).toLowerCase(),
    redirected: found.redirected,
  }
}

export default {
  submitVersionForApprovalPrisma,
  approveRequestPrisma,
  rejectRequestPrisma,
  loadPublicOrganizationBySlugPrisma,
}
