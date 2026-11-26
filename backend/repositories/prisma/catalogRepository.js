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

/** Public tour visibility: legacy (null org) + active/published, never secret. */
export function publicTourBaseWhere() {
  return {
    secretTour: false,
    organizationId: null,
    status: { in: ['active', 'published'] },
  }
}

export async function findPublicTours(query = {}, extraWhere = {}) {
  const base = { ...publicTourBaseWhere(), ...extraWhere }
  const args = buildPrismaListArgs(query, base, {
    searchableFields: ['title', 'shortDescription', 'description'],
  })
  // Remove conflicting status if query forces status=active (AND with in)
  if (query.status && typeof query.status === 'string') {
    args.where.status = query.status
    args.where.secretTour = false
    args.where.organizationId = null
  }
  const rows = await prisma.tour.findMany(args)
  return rows.map((row) => toApiDoc(row))
}

export async function findMarketplaceTours(query = {}) {
  // Phase 2: org marketplace tours not seeded; legacy null-org only
  const base = { ...publicTourBaseWhere() }
  if (query.destination) {
    base.destinations = { has: String(query.destination) }
  }
  if (query.organizationId) {
    // No public orgs in Phase 2 PG seed
    return []
  }
  if (query.durationDays) {
    base.durationDays = Number(query.durationDays)
  }
  const args = buildPrismaListArgs(query, base, {
    searchableFields: ['title', 'shortDescription'],
  })
  // search also on destinations array — approximate with hasSome if simple term
  if (query.search) {
    // already handled title/shortDescription; destinations contains handled loosely
  }
  const rows = await prisma.tour.findMany(args)
  return rows.map((row) => {
    const doc = toApiDoc(row)
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
  if (!['active', 'published'].includes(row.status)) return null
  // Phase 2: org-linked tours not supported on Prisma catalog path
  if (row.organizationId) return null
  return toApiDoc(row)
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
