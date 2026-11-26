/**
 * Build public profile snapshot from organization + optional overrides.
 */
export function buildPublicProfileSnapshot(organization, overrides = {}) {
  return {
    name: overrides.name ?? organization.name,
    legalName: overrides.legalName ?? organization.legalName,
    providerTypes: overrides.providerTypes ?? organization.providerTypes,
    logo: overrides.logo ?? organization.logo,
    coverImage: overrides.coverImage ?? organization.coverImage,
    gallery: overrides.gallery ?? organization.gallery ?? [],
    portfolioPhotos: overrides.portfolioPhotos ?? organization.portfolioPhotos ?? [],
    description: overrides.description ?? organization.description ?? '',
    shortDescription:
      overrides.shortDescription ?? organization.shortDescription ?? '',
    uniqueSellingPoints:
      overrides.uniqueSellingPoints ?? organization.uniqueSellingPoints ?? [],
    services: overrides.services ?? organization.services ?? [],
    yearsInBusiness: overrides.yearsInBusiness ?? organization.yearsInBusiness,
    location: overrides.location ?? organization.location,
    contact: overrides.contact ?? organization.contact,
    proposedSlug: overrides.proposedSlug ?? organization.slug,
  }
}

export function stripPrivateOrganizationFields(org) {
  if (!org) return null
  const obj = org.toObject ? org.toObject({ virtuals: true }) : { ...org }
  delete obj.verification
  delete obj.ownerUserId
  delete obj.legacyCreatedByUserId
  delete obj.approvedVersionId
  delete obj.latestVersionId
  delete obj.previousSlugs
  delete obj.suspendedBy
  delete obj.suspensionReason
  delete obj.suspendedAt
  return obj
}

/**
 * Serialize organization for public marketplace from approved version snapshot.
 */
export function serializePublicOrganization(organization, approvedVersion) {
  if (!organization || !approvedVersion?.snapshot) return null

  const snapshot = approvedVersion.snapshot
  return {
    _id: organization._id,
    slug: organization.slug,
    name: snapshot.name,
    legalName: snapshot.legalName,
    providerTypes: snapshot.providerTypes,
    logo: snapshot.logo,
    coverImage: snapshot.coverImage,
    gallery: snapshot.gallery,
    portfolioPhotos: snapshot.portfolioPhotos,
    description: snapshot.description,
    shortDescription: snapshot.shortDescription,
    uniqueSellingPoints: snapshot.uniqueSellingPoints,
    services: snapshot.services,
    yearsInBusiness: snapshot.yearsInBusiness,
    location: snapshot.location,
    contact: snapshot.contact,
    averageRating: organization.averageRating,
    reviewCount: organization.reviewCount,
    approvedVersionNumber: approvedVersion.versionNumber,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  }
}

export function serializeProviderWorkspace(
  organization,
  latestVersion,
  approvedVersion,
  summary = null
) {
  return {
    organization: stripPrivateOrganizationFields(organization),
    latestVersion: latestVersion
      ? {
          _id: latestVersion._id,
          versionNumber: latestVersion.versionNumber,
          status: latestVersion.status,
          snapshot: latestVersion.snapshot,
          changedFields: latestVersion.changedFields,
          requiresReapproval: latestVersion.requiresReapproval,
          submittedAt: latestVersion.submittedAt,
          approvedAt: latestVersion.approvedAt,
          rejectedAt: latestVersion.rejectedAt,
          rejectionReason: latestVersion.rejectionReason,
        }
      : null,
    approvedVersion: approvedVersion
      ? {
          _id: approvedVersion._id,
          versionNumber: approvedVersion.versionNumber,
          status: approvedVersion.status,
          snapshot: approvedVersion.snapshot,
          approvedAt: approvedVersion.approvedAt,
        }
      : null,
    canEdit: latestVersion?.status === 'draft',
    isPublic:
      organization.approvalStatus === 'approved' &&
      organization.visibility === 'public',
    ...(summary
      ? {
          summary: {
            memberCount: summary.memberCount ?? 0,
            tourCount: summary.tourCount ?? 0,
            hotelCount: summary.hotelCount ?? 0,
            transportCount: summary.transportCount ?? 0,
            pendingApprovalCount: summary.pendingApprovalCount ?? 0,
            openDepartureCount: summary.openDepartureCount ?? 0,
            bookingCount: summary.bookingCount ?? 0,
            activeRoomTypeCount: summary.activeRoomTypeCount ?? 0,
            inventoryDayCount: summary.inventoryDayCount ?? 0,
            lowAvailabilityDayCount: summary.lowAvailabilityDayCount ?? 0,
          },
        }
      : {}),
  }
}

export default {
  buildPublicProfileSnapshot,
  serializePublicOrganization,
  serializeProviderWorkspace,
}
