import Organization from '../models/Organization.js'
import { isPublicTourStatus } from '../config/tourLifecycle.js'

/**
 * Legacy tours (no organizationId) remain public when status is active/published.
 * Organization tours require approved + public org.
 */
export async function isOrganizationPubliclyVisible(organizationId) {
  if (!organizationId) return true
  const org = await Organization.findById(organizationId).select(
    'approvalStatus visibility approvedVersionId'
  )
  if (!org) return false
  return (
    org.approvalStatus === 'approved' &&
    org.visibility === 'public' &&
    Boolean(org.approvedVersionId)
  )
}

export async function filterPubliclyVisibleTours(tours) {
  const results = []
  const orgCache = new Map()

  for (const tour of tours) {
    if (!isPublicTourStatus(tour.status)) continue
    if (!tour.organizationId) {
      results.push(tour)
      continue
    }
    const orgId = tour.organizationId.toString()
    if (!orgCache.has(orgId)) {
      orgCache.set(orgId, await isOrganizationPubliclyVisible(tour.organizationId))
    }
    if (orgCache.get(orgId)) results.push(tour)
  }
  return results
}

export function buildPublicTourQuery(extra = {}) {
  return {
    secretTour: { $ne: true },
    status: { $in: ['published', 'active'] },
    ...extra,
  }
}

export async function organizationIdsPubliclyVisible() {
  const orgs = await Organization.find({
    ...Organization.publicMarketplaceFilter(),
    approvedVersionId: { $ne: null },
  }).select('_id')
  return orgs.map((o) => o._id)
}

export default {
  isOrganizationPubliclyVisible,
  filterPubliclyVisibleTours,
  buildPublicTourQuery,
  organizationIdsPubliclyVisible,
}
