/** Transport lifecycle states (CatalogStatus + marketplace semantics). */
export const TRANSPORT_STATUSES = ['draft', 'active', 'inactive']

/** Public marketplace transport status. */
export const PUBLIC_TRANSPORT_STATUSES = ['active']

/**
 * draft|inactive → active (publish)
 * active → inactive (unpublish / suspend)
 */
export const TRANSPORT_TRANSITIONS = {
  draft: ['active'],
  active: ['inactive'],
  inactive: ['active'],
}

export function assertTransportTransition(fromStatus, toStatus) {
  const allowed = TRANSPORT_TRANSITIONS[fromStatus] || []
  if (!allowed.includes(toStatus)) {
    const err = new Error(
      `Invalid transport status transition: ${fromStatus} → ${toStatus}`
    )
    err.statusCode = 409
    throw err
  }
}

export function isPublicTransportStatus(status) {
  return PUBLIC_TRANSPORT_STATUSES.includes(status)
}

export default {
  TRANSPORT_STATUSES,
  PUBLIC_TRANSPORT_STATUSES,
  TRANSPORT_TRANSITIONS,
  assertTransportTransition,
  isPublicTransportStatus,
}
