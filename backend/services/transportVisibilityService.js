import { isPublicTransportStatus } from '../config/transportLifecycle.js'
import { isOrganizationPubliclyVisible } from './tourVisibilityService.js'

/**
 * Legacy transports (no organizationId) are public when status is active.
 * Org transports require approved + public org with approvedVersionId.
 */
export async function isTransportPubliclyVisible(transport) {
  if (!transport) return false
  if (!isPublicTransportStatus(transport.status)) return false
  if (!transport.organizationId) return true
  return isOrganizationPubliclyVisible(transport.organizationId)
}

export async function filterPubliclyVisibleTransports(transports) {
  const results = []
  const orgCache = new Map()

  for (const transport of transports) {
    if (!isPublicTransportStatus(transport.status)) continue
    if (!transport.organizationId) {
      results.push(transport)
      continue
    }
    const orgId = transport.organizationId.toString()
    if (!orgCache.has(orgId)) {
      orgCache.set(
        orgId,
        await isOrganizationPubliclyVisible(transport.organizationId)
      )
    }
    if (orgCache.get(orgId)) results.push(transport)
  }
  return results
}

export default {
  isTransportPubliclyVisible,
  filterPubliclyVisibleTransports,
}
