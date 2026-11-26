import { isPublicHotelStatus } from '../config/hotelLifecycle.js'
import { isOrganizationPubliclyVisible } from './tourVisibilityService.js'

/**
 * Legacy hotels (no organizationId) are public when status is active.
 * Org hotels require approved + public org with approvedVersionId.
 */
export async function isHotelPubliclyVisible(hotel) {
  if (!hotel) return false
  if (!isPublicHotelStatus(hotel.status)) return false
  if (!hotel.organizationId) return true
  return isOrganizationPubliclyVisible(hotel.organizationId)
}

export async function filterPubliclyVisibleHotels(hotels) {
  const results = []
  const orgCache = new Map()

  for (const hotel of hotels) {
    if (!isPublicHotelStatus(hotel.status)) continue
    if (!hotel.organizationId) {
      results.push(hotel)
      continue
    }
    const orgId = hotel.organizationId.toString()
    if (!orgCache.has(orgId)) {
      orgCache.set(
        orgId,
        await isOrganizationPubliclyVisible(hotel.organizationId)
      )
    }
    if (orgCache.get(orgId)) results.push(hotel)
  }
  return results
}

export default {
  isHotelPubliclyVisible,
  filterPubliclyVisibleHotels,
}
