import AppError from '../utils/appError.js'

/** Allowed ProviderVersion status transitions. */
export const VERSION_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['superseded'],
  rejected: [],
  superseded: [],
}

/** Allowed ApprovalRequest status transitions. */
export const REQUEST_TRANSITIONS = {
  pending: ['processing', 'rejected'],
  processing: ['approved', 'pending', 'rejected'],
  approved: [],
  rejected: [],
  cancelled: [],
}

export function assertVersionTransition(fromStatus, toStatus) {
  const allowed = VERSION_TRANSITIONS[fromStatus] || []
  if (!allowed.includes(toStatus)) {
    throw new AppError(
      `Invalid version status transition: ${fromStatus} → ${toStatus}`,
      409
    )
  }
}

export function assertRequestTransition(fromStatus, toStatus) {
  const allowed = REQUEST_TRANSITIONS[fromStatus] || []
  if (!allowed.includes(toStatus)) {
    throw new AppError(
      `Invalid approval request transition: ${fromStatus} → ${toStatus}`,
      409
    )
  }
}

/**
 * Verify organization ↔ approved version invariants.
 * Returns array of violation messages (empty = OK).
 */
export function checkApprovedVersionInvariants(organization, approvedVersion) {
  const violations = []

  if (!organization) {
    violations.push('organization missing')
    return violations
  }

  if (organization.approvalStatus === 'approved' && organization.visibility === 'public') {
    if (!organization.approvedVersionId) {
      violations.push('public org missing approvedVersionId')
    }
    if (!approvedVersion) {
      violations.push('public org approvedVersionId references missing version')
    } else {
      if (approvedVersion.status !== 'approved') {
        violations.push(
          `approvedVersionId points to version with status ${approvedVersion.status}`
        )
      }
      if (
        approvedVersion.organizationId?.toString() !== organization._id?.toString()
      ) {
        violations.push('approved version organizationId mismatch')
      }
    }
  }

  if (organization.approvedVersionId && approvedVersion) {
    if (organization.approvedVersionId.toString() !== approvedVersion._id.toString()) {
      violations.push('approvedVersionId does not match supplied version')
    }
  }

  return violations
}

export default {
  VERSION_TRANSITIONS,
  REQUEST_TRANSITIONS,
  assertVersionTransition,
  assertRequestTransition,
  checkApprovedVersionInvariants,
}
