/** Default permissions granted to organization owners by provider type. */
export const PROVIDER_TYPE_PERMISSIONS = {
  travel_company: [
    'org:read',
    'org:write',
    'org:members:manage',
    'tours:read',
    'tours:write',
    'bookings:read',
    'bookings:manage',
  ],
  hotel: ['org:read', 'org:write', 'org:members:manage', 'hotels:read', 'hotels:write'],
  tour_bus_provider: [
    'org:read',
    'org:write',
    'org:members:manage',
    'tour_buses:read',
    'tour_buses:write',
  ],
  bus_company: [
    'org:read',
    'org:write',
    'org:members:manage',
    'bus:read',
    'bus:write',
  ],
}

export const ORG_ROLES = ['owner', 'admin', 'manager', 'staff', 'viewer']

export const MEMBERSHIP_ROLES = [
  'tour_operator',
  'hotel_manager',
  'tour_bus_provider',
  'bus_company_manager',
]

export const PROVIDER_TYPES = [
  'travel_company',
  'hotel',
  'tour_bus_provider',
  'bus_company',
]

/** Map provider type to default membership role label. */
export const PROVIDER_TO_MEMBERSHIP_ROLE = {
  travel_company: 'tour_operator',
  hotel: 'hotel_manager',
  tour_bus_provider: 'tour_bus_provider',
  bus_company: 'bus_company_manager',
}

/**
 * Build default permission set for an owner from provider types.
 */
export function permissionsForProviderTypes(providerTypes = []) {
  const set = new Set([
    'org:read',
    'org:write',
    'org:submit',
    'org:members:manage',
  ])
  for (const pt of providerTypes) {
    for (const p of PROVIDER_TYPE_PERMISSIONS[pt] || []) {
      set.add(p)
    }
  }
  return [...set]
}

export function membershipRolesForProviderTypes(providerTypes = []) {
  return providerTypes
    .map((pt) => PROVIDER_TO_MEMBERSHIP_ROLE[pt])
    .filter(Boolean)
}

export function memberHasPermission(member, permission) {
  if (!member || member.status !== 'active') return false
  if (member.orgRole === 'owner' || member.orgRole === 'admin') return true
  return (member.permissions || []).includes(permission)
}

export function isOrganizationOwner(member) {
  return member?.status === 'active' && member.orgRole === 'owner'
}

export function isOrganizationAdmin(member) {
  return (
    member?.status === 'active' &&
    (member.orgRole === 'owner' || member.orgRole === 'admin')
  )
}

export function memberHasOrgRole(member, ...roles) {
  if (!member || member.status !== 'active') return false
  return roles.includes(member.orgRole)
}
