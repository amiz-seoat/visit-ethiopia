/** Hotel lifecycle states (CatalogStatus + marketplace semantics). */
export const HOTEL_STATUSES = ['draft', 'active', 'inactive']

/** Public marketplace hotel status. */
export const PUBLIC_HOTEL_STATUSES = ['active']

/**
 * draft|inactive → active (publish)
 * active → inactive (unpublish / suspend)
 */
export const HOTEL_TRANSITIONS = {
  draft: ['active'],
  active: ['inactive'],
  inactive: ['active'],
}

export function assertHotelTransition(fromStatus, toStatus) {
  const allowed = HOTEL_TRANSITIONS[fromStatus] || []
  if (!allowed.includes(toStatus)) {
    const err = new Error(
      `Invalid hotel status transition: ${fromStatus} → ${toStatus}`
    )
    err.statusCode = 409
    throw err
  }
}

export function isPublicHotelStatus(status) {
  return PUBLIC_HOTEL_STATUSES.includes(status)
}

export default {
  HOTEL_STATUSES,
  PUBLIC_HOTEL_STATUSES,
  HOTEL_TRANSITIONS,
  assertHotelTransition,
  isPublicHotelStatus,
}
