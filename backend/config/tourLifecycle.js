/** Tour lifecycle states (includes legacy aliases for backward compatibility). */
export const TOUR_STATUSES = [
  'draft',
  'published',
  'unpublished',
  'archived',
  'active', // legacy — treated as published
  'inactive', // legacy — treated as unpublished
]

export const PUBLIC_TOUR_STATUSES = ['published', 'active']

export const TOUR_TRANSITIONS = {
  draft: ['published', 'archived'],
  published: ['unpublished', 'archived'],
  unpublished: ['published', 'archived'],
  archived: [],
  active: ['inactive', 'archived', 'unpublished'],
  inactive: ['active', 'published', 'archived'],
}

export function assertTourTransition(fromStatus, toStatus) {
  const allowed = TOUR_TRANSITIONS[fromStatus] || []
  if (!allowed.includes(toStatus)) {
    const err = new Error(`Invalid tour status transition: ${fromStatus} → ${toStatus}`)
    err.statusCode = 409
    throw err
  }
}

export function isPublicTourStatus(status) {
  return PUBLIC_TOUR_STATUSES.includes(status)
}

export default {
  TOUR_STATUSES,
  PUBLIC_TOUR_STATUSES,
  TOUR_TRANSITIONS,
  assertTourTransition,
  isPublicTourStatus,
}
