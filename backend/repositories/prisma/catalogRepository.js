import prisma from '../../config/prisma.js'
import { buildPrismaListArgs } from '../../utils/prismaApiFeatures.js'
import { toApiDoc } from '../../utils/prismaSerialize.js'

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
}

export async function findDestinations(query = {}) {
  const args = buildPrismaListArgs(query, {}, {
    searchableFields: ['name', 'shortDescription', 'description'],
  })
  const rows = await prisma.destination.findMany({
    ...args,
    include: {
      tours: { include: { tour: true } },
      nearbyAccommodations: { include: { hotel: true } },
    },
  })
  return rows.map((row) => {
    const doc = toApiDoc(row)
    doc.tours = (row.tours || []).map((link) => toApiDoc(link.tour))
    doc.nearbyAccommodations = (row.nearbyAccommodations || []).map((link) =>
      toApiDoc(link.hotel)
    )
    return doc
  })
}

export async function findDestinationById(id) {
  const row = await prisma.destination.findUnique({
    where: { id },
    include: {
      tours: { include: { tour: true } },
      nearbyAccommodations: { include: { hotel: true } },
    },
  })
  if (!row) return null
  const doc = toApiDoc(row)
  doc.tours = (row.tours || []).map((link) => toApiDoc(link.tour))
  doc.nearbyAccommodations = (row.nearbyAccommodations || []).map((link) =>
    toApiDoc(link.hotel)
  )
  return doc
}

export async function findToursForDestination(id) {
  const dest = await findDestinationById(id)
  if (!dest) return null
  return dest.tours || []
}

async function publicOrganizationIds() {
  const orgs = await prisma.organization.findMany({
    where: {
      approvalStatus: 'approved',
      visibility: 'public',
      approvedVersionId: { not: null },
    },
    select: { id: true },
  })
  return orgs.map((o) => o.id)
}

/**
 * Public marketplace hotel list.
 * Default: status=active AND (legacy null-org OR publicly visible org).
 * Explicit ?status= still applies but org visibility always enforced for org hotels.
 */
export async function findHotels(query = {}) {
  const publicOrgIds = await publicOrganizationIds()
  const statusFilter = query.status ? String(query.status) : 'active'
  const base = {
    status: statusFilter,
    OR: [
      { organizationId: null },
      ...(publicOrgIds.length
        ? [{ organizationId: { in: publicOrgIds } }]
        : []),
    ],
  }
  const listQuery = { ...query }
  delete listQuery.status
  const args = buildPrismaListArgs(listQuery, base, {
    searchableFields: ['name', 'shortDescription', 'description'],
  })
  const rows = await prisma.hotel.findMany({
    ...args,
    include: { createdBy: { select: userSelect } },
  })
  return rows.map((row) => {
    const doc = toApiDoc(row)
    doc.reviews = []
    return doc
  })
}

/** Raw find by id (provider/admin). Does not apply public visibility. */
export async function findHotelById(id) {
  const row = await prisma.hotel.findUnique({
    where: { id: String(id) },
    include: { createdBy: { select: userSelect } },
  })
  if (!row) return null
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

/** Public detail — draft/inactive/unapproved-org hotels return null (404). */
export async function findPublicHotelById(id) {
  const row = await prisma.hotel.findUnique({
    where: { id: String(id) },
    include: { createdBy: { select: userSelect } },
  })
  if (!row) return null
  if (row.status !== 'active') return null
  if (row.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: row.organizationId },
      select: {
        approvalStatus: true,
        visibility: true,
        approvedVersionId: true,
      },
    })
    if (
      !org ||
      org.approvalStatus !== 'approved' ||
      org.visibility !== 'public' ||
      !org.approvedVersionId
    ) {
      return null
    }
  }
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

export async function findTransports(query = {}) {
  // Public marketplace list: status=active AND (legacy null-org OR publicly visible org).
  const publicOrgIds = await publicOrganizationIds()
  const statusFilter = query.status ? String(query.status) : 'active'
  const base = {
    status: statusFilter,
    OR: [
      { organizationId: null },
      ...(publicOrgIds.length
        ? [{ organizationId: { in: publicOrgIds } }]
        : []),
    ],
  }
  const listQuery = { ...query }
  delete listQuery.status
  const args = buildPrismaListArgs(listQuery, base, {
    searchableFields: ['name', 'description'],
  })
  const rows = await prisma.transport.findMany({
    ...args,
    include: { createdBy: { select: userSelect } },
  })
  return rows.map((row) => {
    const doc = toApiDoc(row)
    doc.reviews = []
    return doc
  })
}

/** Raw find by id (provider/admin). Does not apply public visibility. */
export async function findTransportById(id) {
  const row = await prisma.transport.findUnique({
    where: { id: String(id) },
    include: { createdBy: { select: userSelect } },
  })
  if (!row) return null
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

/** Public detail — draft/inactive/unapproved-org transports return null (404). */
export async function findPublicTransportById(id) {
  const row = await prisma.transport.findUnique({
    where: { id: String(id) },
    include: { createdBy: { select: userSelect } },
  })
  if (!row) return null
  if (row.status !== 'active') return null
  if (row.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: row.organizationId },
      select: {
        approvalStatus: true,
        visibility: true,
        approvedVersionId: true,
      },
    })
    if (
      !org ||
      org.approvalStatus !== 'approved' ||
      org.visibility !== 'public' ||
      !org.approvedVersionId
    ) {
      return null
    }
  }
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

export async function findAllRoutes() {
  const publicOrgIds = await publicOrganizationIds()
  const transports = await prisma.transport.findMany({
    where: {
      status: 'active',
      OR: [
        { organizationId: null },
        ...(publicOrgIds.length
          ? [{ organizationId: { in: publicOrgIds } }]
          : []),
      ],
    },
  })
  const flattened = []
  for (const t of transports) {
    const routes = Array.isArray(t.routes) ? t.routes : []
    for (const route of routes) {
      if (route && route.active === false) continue
      flattened.push({
        ...route,
        transportId: t.id,
        transportName: t.name,
        transportType: t.type,
      })
    }
  }
  return flattened.map((r) => {
    const doc = { ...r }
    if (doc.transportId) {
      doc.transportId = doc.transportId
    }
    return doc
  })
}

export async function findRestaurants(query = {}) {
  const args = buildPrismaListArgs(query, {}, {
    searchableFields: ['name', 'shortDescription', 'description'],
    priceField: 'priceRange',
    sortAliases: { price: 'priceRange' },
  })
  const rows = await prisma.restaurant.findMany({
    ...args,
    include: { createdBy: { select: userSelect } },
  })
  return rows.map((row) => {
    const doc = toApiDoc(row)
    doc.reviews = []
    return doc
  })
}

export async function findRestaurantById(id) {
  const row = await prisma.restaurant.findUnique({
    where: { id },
    include: { createdBy: { select: userSelect } },
  })
  if (!row) return null
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

export async function findNews(query = {}) {
  const args = buildPrismaListArgs(query, {}, {
    searchableFields: ['title', 'summary', 'content'],
  })
  const rows = await prisma.news.findMany({
    ...args,
    include: { author: { select: userSelect } },
  })
  return rows.map((row) => toApiDoc(row))
}

export async function findFeaturedNews(limit = 5) {
  const rows = await prisma.news.findMany({
    where: { isFeatured: true },
    take: limit,
    include: { author: { select: userSelect } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((row) => toApiDoc(row))
}

export async function findNewsByIdAndIncrementViews(id) {
  try {
    const row = await prisma.news.update({
      where: { id },
      data: { views: { increment: 1 } },
      include: { author: { select: userSelect } },
    })
    return toApiDoc(row)
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function findApprovedReviews(itemType, itemId) {
  const rows = await prisma.review.findMany({
    where: { itemType, itemId, status: 'approved' },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((row) => toApiDoc(row, { reviewMode: true }))
}

const PUBLIC_TOUR_STATUSES = ['active', 'published']

/**
 * Public tour visibility (mirrors the Mongo marketplace rules):
 * never secret, status active/published, and either a legacy tour (no org)
 * or owned by an approved + public organization with an approved version.
 * Returned as an AND clause so query-string filters can never override it.
 */
export function publicTourVisibilityClause(publicOrgIds = []) {
  return {
    secretTour: false,
    status: { in: PUBLIC_TOUR_STATUSES },
    OR: [
      { organizationId: null },
      ...(publicOrgIds.length ? [{ organizationId: { in: publicOrgIds } }] : []),
    ],
  }
}

/** Back-compat export: legacy-only base (used by older callers/tests). */
export function publicTourBaseWhere() {
  return {
    secretTour: false,
    organizationId: null,
    status: { in: PUBLIC_TOUR_STATUSES },
  }
}

function withVisibility(args, publicOrgIds) {
  // Drop raw query-string overrides of visibility fields, then AND the clause.
  delete args.where.secretTour
  delete args.where.OR
  if (
    args.where.status &&
    !(typeof args.where.status === 'string' && PUBLIC_TOUR_STATUSES.includes(args.where.status))
  ) {
    delete args.where.status
  }
  args.where.AND = [...(args.where.AND || []), publicTourVisibilityClause(publicOrgIds)]
  return args
}

/** Attach public organization summary from the approved version snapshot. */
async function attachPublicOrganizations(rows) {
  const orgIds = [...new Set(rows.map((r) => r.organizationId).filter(Boolean))]
  if (!orgIds.length) return new Map()
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: {
      id: true,
      slug: true,
      averageRating: true,
      reviewCount: true,
      approvedVersion: { select: { snapshot: true } },
    },
  })
  const map = new Map()
  for (const org of orgs) {
    const s = org.approvedVersion?.snapshot || {}
    map.set(org.id, {
      _id: org.id,
      slug: org.slug,
      name: s.name,
      logo: s.logo ?? null,
      coverImage: s.coverImage ?? null,
      shortDescription: s.shortDescription ?? '',
      providerTypes: s.providerTypes ?? [],
      location: s.location ?? null,
      averageRating: org.averageRating,
      reviewCount: org.reviewCount,
    })
  }
  return map
}

export async function findPublicTours(query = {}, extraWhere = {}) {
  const publicOrgIds = await publicOrganizationIds()
  const args = withVisibility(
    buildPrismaListArgs(query, { ...extraWhere }, {
      searchableFields: ['title', 'shortDescription', 'description'],
    }),
    publicOrgIds
  )
  const rows = await prisma.tour.findMany(args)
  return rows.map((row) => toApiDoc(row))
}

export async function findMarketplaceTours(query = {}) {
  const publicOrgIds = await publicOrganizationIds()
  const base = {}
  if (query.destination) {
    base.destinations = { has: String(query.destination) }
  }
  if (query.organizationId) {
    const orgId = String(query.organizationId)
    if (!publicOrgIds.includes(orgId)) return []
    base.organizationId = orgId
  }
  if (query.durationDays) {
    base.durationDays = Number(query.durationDays)
  }
  const listQuery = { ...query }
  for (const k of ['destination', 'organizationId', 'durationDays', 'packageType']) {
    delete listQuery[k]
  }
  const args = withVisibility(
    buildPrismaListArgs(listQuery, base, {
      searchableFields: ['title', 'shortDescription'],
    }),
    publicOrgIds
  )
  const rows = await prisma.tour.findMany(args)
  const orgMap = await attachPublicOrganizations(rows)
  return rows.map((row) => {
    const doc = toApiDoc(row)
    if (row.organizationId && orgMap.has(row.organizationId)) {
      doc.organization = orgMap.get(row.organizationId)
    }
    // marketplace serialize shape (no org)
    return {
      _id: doc._id,
      slug: doc.slug,
      title: doc.title,
      shortDescription: doc.shortDescription,
      description: doc.description,
      highlights: doc.highlights,
      uniqueSellingPoints: doc.uniqueSellingPoints,
      duration: doc.duration,
      destinations: doc.destinations,
      startingLocation: doc.startingLocation,
      destinationLocations: doc.destinationLocations,
      categories: doc.categories,
      difficulty: doc.difficulty,
      price: doc.price,
      priceMinor: doc.priceMinor,
      currency: doc.currency,
      discount: doc.discount,
      coverImage: doc.coverImage,
      images: doc.images,
      gallery: doc.gallery,
      portfolioPhotos: doc.portfolioPhotos,
      inclusions: doc.inclusions,
      exclusions: doc.exclusions,
      policies: doc.policies,
      packages: (doc.packages || []).filter((p) => p.active !== false),
      itinerary: doc.itinerary,
      maxGroupSize: doc.maxGroupSize,
      averageRating: doc.averageRating,
      reviewCount: doc.reviewCount,
      isFeatured: doc.isFeatured,
      organizationId: doc.organizationId ?? null,
      ...(doc.organization ? { organization: doc.organization } : {}),
    }
  })
}

export async function findPublicTourByIdOrSlug(param) {
  const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(param))
  let row = null
  if (isObjectId) {
    row = await prisma.tour.findUnique({ where: { id: String(param) } })
  }
  if (!row) {
    row = await prisma.tour.findFirst({
      where: { slug: String(param).toLowerCase() },
    })
  }
  if (!row) return null
  if (row.secretTour) return null
  if (!PUBLIC_TOUR_STATUSES.includes(row.status)) return null
  const doc = toApiDoc(row)
  if (row.organizationId) {
    const publicOrgIds = await publicOrganizationIds()
    if (!publicOrgIds.includes(row.organizationId)) return null
    const orgMap = await attachPublicOrganizations([row])
    doc.organization = orgMap.get(row.organizationId) || null
  }
  return doc
}

export default {
  findDestinations,
  findDestinationById,
  findToursForDestination,
  findHotels,
  findHotelById,
  findPublicHotelById,
  findTransports,
  findTransportById,
  findPublicTransportById,
  findAllRoutes,
  findRestaurants,
  findRestaurantById,
  findNews,
  findFeaturedNews,
  findNewsByIdAndIncrementViews,
  findApprovedReviews,
  findPublicTours,
  findMarketplaceTours,
  findPublicTourByIdOrSlug,
}
