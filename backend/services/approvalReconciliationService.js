import Organization from '../models/Organization.js'
import ProviderVersion from '../models/ProviderVersion.js'
import ApprovalRequest from '../models/ApprovalRequest.js'
import { syncOrganizationProfileFromApprovedVersion } from './organizationVersionService.js'
import { checkApprovedVersionInvariants } from './approvalStateMachine.js'

/**
 * Repair incomplete or inconsistent approval promotion state.
 * Safe to call repeatedly (idempotent).
 */
export async function reconcileOrganizationApprovalState(organizationId) {
  const repairs = []
  let organization = await Organization.findById(organizationId)
  if (!organization) return { repairs, organization: null }

  // 1. Stuck "processing" requests — crash during approve/reject
  const processing = await ApprovalRequest.find({
    organizationId,
    status: 'processing',
  })

  for (const request of processing) {
    const version = await ProviderVersion.findById(request.providerVersionId)

    if (version?.status === 'approved') {
      if (organization.approvedVersionId?.toString() !== version._id.toString()) {
        organization = await syncOrganizationProfileFromApprovedVersion(
          organization,
          version
        )
        repairs.push(`synced org to approved version ${version._id}`)
      }
      await ApprovalRequest.findByIdAndUpdate(request._id, { status: 'approved' })
      repairs.push(`finalized processing request ${request._id} → approved`)
    } else if (version?.status === 'rejected') {
      await ApprovalRequest.findByIdAndUpdate(request._id, {
        status: 'rejected',
      })
      repairs.push(`finalized processing request ${request._id} → rejected`)
    } else if (version?.status === 'submitted') {
      await ApprovalRequest.findByIdAndUpdate(request._id, {
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
      })
      repairs.push(`rolled back stuck processing request ${request._id} → pending`)
    }
  }

  // 2. Request approved but org not promoted — complete promotion
  const approvedRequests = await ApprovalRequest.find({
    organizationId,
    status: 'approved',
  }).sort({ reviewedAt: -1 })

  for (const request of approvedRequests) {
    const version = await ProviderVersion.findById(request.providerVersionId)
    if (!version || version.status !== 'approved') continue

    if (organization.approvedVersionId?.toString() !== version._id.toString()) {
      const previousApprovedId = organization.approvedVersionId
      organization = await syncOrganizationProfileFromApprovedVersion(
        organization,
        version
      )
      repairs.push(`promoted org to version ${version._id}`)

      if (
        previousApprovedId &&
        previousApprovedId.toString() !== version._id.toString()
      ) {
        await ProviderVersion.findOneAndUpdate(
          { _id: previousApprovedId, status: 'approved' },
          { status: 'superseded' }
        )
        repairs.push(`superseded previous version ${previousApprovedId}`)
      }
    }
  }

  // 3. Org points to superseded version — restore latest approved
  if (organization.approvedVersionId) {
    const pointed = await ProviderVersion.findById(organization.approvedVersionId)
    if (pointed?.status === 'superseded') {
      const latestApproved = await ProviderVersion.findOne({
        organizationId,
        status: 'approved',
      }).sort({ versionNumber: -1 })

      if (latestApproved) {
        organization = await syncOrganizationProfileFromApprovedVersion(
          organization,
          latestApproved
        )
        repairs.push(`repointed org from superseded to ${latestApproved._id}`)
      }
    }
  }

  // 4. Version approved with matching approved request but request still pending (shouldn't happen)
  const pendingWithApprovedVersion = await ApprovalRequest.find({
    organizationId,
    status: 'pending',
  })
  for (const request of pendingWithApprovedVersion) {
    const version = await ProviderVersion.findById(request.providerVersionId)
    if (version?.status === 'approved') {
      await ApprovalRequest.findByIdAndUpdate(request._id, {
        status: 'approved',
        reviewedAt: version.approvedAt || new Date(),
      })
      repairs.push(`aligned pending request ${request._id} with approved version`)
    }
  }

  organization = await Organization.findById(organizationId)
  return { repairs, organization }
}

/**
 * Build idempotent approve result if promotion already completed.
 */
export async function tryGetIdempotentApproveResult(approvalRequestId) {
  const approvalRequest = await ApprovalRequest.findById(approvalRequestId)
  if (!approvalRequest || approvalRequest.status !== 'approved') return null

  const version = await ProviderVersion.findById(approvalRequest.providerVersionId)
  const organization = await Organization.findById(approvalRequest.organizationId)

  if (
    version?.status === 'approved' &&
    organization?.approvedVersionId?.toString() === version._id.toString()
  ) {
    return { approvalRequest, version, organization, idempotent: true }
  }

  return null
}

export async function verifyOrganizationInvariants(organizationId) {
  const organization = await Organization.findById(organizationId)
  if (!organization) return { ok: false, violations: ['organization not found'] }

  const approvedVersion = organization.approvedVersionId
    ? await ProviderVersion.findById(organization.approvedVersionId)
    : null

  const violations = checkApprovedVersionInvariants(organization, approvedVersion)
  return { ok: violations.length === 0, violations, organization, approvedVersion }
}

export default {
  reconcileOrganizationApprovalState,
  tryGetIdempotentApproveResult,
  verifyOrganizationInvariants,
}
