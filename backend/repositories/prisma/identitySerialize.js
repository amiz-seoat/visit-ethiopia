import { changedPasswordAfter, comparePassword } from '../../services/passwordService.js'

/**
 * Shape a Prisma User row like a Mongoose user for auth controllers.
 * Exposes both `_id` and `id` (Mongoose virtual).
 */
export function toAuthUser(row, { withPassword = false } = {}) {
  if (!row) return null
  const user = {
    _id: row.id,
    id: row.id,
    FirstName: row.firstName,
    LastName: row.lastName,
    email: row.email,
    role: row.role,
    isVerified: row.isVerified,
    active: row.active !== false,
    passwordChangedAt: row.passwordChangedAt || undefined,
    passwordResetToken: row.passwordResetToken || undefined,
    passwordResetExpires: row.passwordResetExpires || undefined,
    favorites: (row.favorites || []).map((f) => f.tourId || f),
    createdAt: row.createdAt,
    correctPassword: async (candidate, hash) =>
      comparePassword(candidate, hash || row.password),
    changedPasswordAfter: (iat) =>
      changedPasswordAfter(row.passwordChangedAt, iat),
  }
  if (withPassword) {
    user.password = row.password
  }
  return user
}

export function toPublicUser(row) {
  const u = toAuthUser(row, { withPassword: false })
  if (!u) return null
  delete u.password
  delete u.passwordResetToken
  delete u.passwordResetExpires
  delete u.correctPassword
  delete u.changedPasswordAfter
  return u
}

export function toApiOrganization(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    slug: row.slug,
    name: row.name,
    legalName: row.legalName,
    providerTypes: row.providerTypes,
    logo: row.logo,
    coverImage: row.coverImage,
    gallery: row.gallery,
    portfolioPhotos: row.portfolioPhotos,
    description: row.description,
    shortDescription: row.shortDescription,
    uniqueSellingPoints: row.uniqueSellingPoints,
    services: row.services,
    yearsInBusiness: row.yearsInBusiness,
    location: row.location,
    contact: row.contact,
    averageRating: row.averageRating,
    reviewCount: row.reviewCount,
    visibility: row.visibility,
    approvalStatus: row.approvalStatus,
    approvedVersionId: row.approvedVersionId,
    latestVersionId: row.latestVersionId,
    ownerUserId: row.ownerUserId,
    verification: row.verification,
    suspendedAt: row.suspendedAt,
    suspendedBy: row.suspendedById,
    suspensionReason: row.suspensionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiMember(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    orgRole: row.orgRole,
    permissions: row.permissions,
    membershipRoles: row.membershipRoles,
    status: row.status,
    invitedBy: row.invitedById,
    joinedAt: row.joinedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiProviderVersion(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    organizationId: row.organizationId,
    versionNumber: row.versionNumber,
    status: row.status,
    snapshot: row.snapshot,
    verificationSnapshot: row.verificationSnapshot,
    changedFields: row.changedFields,
    requiresReapproval: row.requiresReapproval,
    reapprovalFields: row.reapprovalFields,
    submittedBy: row.submittedById,
    submittedAt: row.submittedAt,
    approvedBy: row.approvedById,
    approvedAt: row.approvedAt,
    rejectedBy: row.rejectedById,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
    frozenAt: row.frozenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiApprovalRequest(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    organizationId: row.organizationId,
    providerVersionId: row.providerVersionId,
    requestType: row.requestType,
    status: row.status,
    submittedBy: row.submittedById,
    submittedAt: row.submittedAt,
    reviewedBy: row.reviewedById,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    adminNotes: row.adminNotes,
    verificationChecklist: row.verificationChecklist,
    providerTypes: row.providerTypes,
    changedFields: row.changedFields,
    requiresReapproval: row.requiresReapproval,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export default {
  toAuthUser,
  toPublicUser,
  toApiOrganization,
  toApiMember,
  toApiProviderVersion,
  toApiApprovalRequest,
}
