import prisma from '../../config/prisma.js'
import { generateObjectId } from '../../utils/objectId.js'
import { buildPrismaListArgs } from '../../utils/prismaApiFeatures.js'
import { toApiDoc } from '../../utils/prismaSerialize.js'

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
}

function asId(value) {
  if (value == null) return null
  if (typeof value === 'object' && value._id != null) return String(value._id)
  if (typeof value === 'object' && value.id != null) return String(value.id)
  return String(value)
}

function omitUndefined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function pickScalar(body, keys) {
  const out = {}
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

function mapDestinationData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'name',
    'description',
    'shortDescription',
    'region',
    'location',
    'attractions',
    'bestTimeToVisit',
    'images',
    'coverImage',
    'climate',
    'localCuisine',
    'isFeatured',
    'status',
  ])
  if (forCreate) {
    data.id = generateObjectId()
    data.attractions = data.attractions || []
    data.bestTimeToVisit = data.bestTimeToVisit || []
    data.images = data.images || []
    data.localCuisine = data.localCuisine || []
    data.isFeatured = data.isFeatured ?? false
    data.status = data.status || 'active'
  }
  return omitUndefined(data)
}

async function syncDestinationLinks(destinationId, { tours, nearbyAccommodations }) {
  if (tours !== undefined) {
    await prisma.destinationTour.deleteMany({ where: { destinationId } })
    const tourIds = (tours || []).map(asId).filter(Boolean)
    if (tourIds.length) {
      await prisma.destinationTour.createMany({
        data: tourIds.map((tourId) => ({ destinationId, tourId })),
        skipDuplicates: true,
      })
    }
  }
  if (nearbyAccommodations !== undefined) {
    await prisma.destinationHotel.deleteMany({ where: { destinationId } })
    const hotelIds = (nearbyAccommodations || []).map(asId).filter(Boolean)
    if (hotelIds.length) {
      await prisma.destinationHotel.createMany({
        data: hotelIds.map((hotelId) => ({ destinationId, hotelId })),
        skipDuplicates: true,
      })
    }
  }
}

async function loadDestination(id) {
  const row = await prisma.destination.findUnique({
    where: { id: String(id) },
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

export async function createDestination(body) {
  const data = mapDestinationData(body, { forCreate: true })
  const { tours, nearbyAccommodations } = body
  await prisma.destination.create({ data })
  await syncDestinationLinks(data.id, { tours, nearbyAccommodations })
  return loadDestination(data.id)
}

export async function updateDestination(id, body) {
  const data = mapDestinationData(body)
  try {
    await prisma.destination.update({ where: { id: String(id) }, data })
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
  if (body.tours !== undefined || body.nearbyAccommodations !== undefined) {
    await syncDestinationLinks(String(id), {
      tours: body.tours,
      nearbyAccommodations: body.nearbyAccommodations,
    })
  }
  return loadDestination(id)
}

export async function deleteDestination(id) {
  try {
    await prisma.destination.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

function mapTourData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'title',
    'slug',
    'description',
    'shortDescription',
    'highlights',
    'uniqueSellingPoints',
    'destinations',
    'startingLocation',
    'destinationLocations',
    'categories',
    'difficulty',
    'price',
    'priceMinor',
    'currency',
    'discount',
    'images',
    'coverImage',
    'gallery',
    'portfolioPhotos',
    'startDate',
    'endDate',
    'availableDates',
    'maxGroupSize',
    'currentBookings',
    'inclusions',
    'exclusions',
    'policies',
    'packages',
    'itinerary',
    'secretTour',
    'averageRating',
    'reviewCount',
    'isFeatured',
    'status',
    'publishedAt',
    'archivedAt',
  ])

  if (body.duration != null) {
    if (body.duration.days != null) data.durationDays = Number(body.duration.days)
    if (body.duration.nights != null) {
      data.durationNights = Number(body.duration.nights)
    }
  }
  if (body.durationDays != null) data.durationDays = Number(body.durationDays)
  if (body.durationNights != null) data.durationNights = Number(body.durationNights)

  if (body.createdBy !== undefined) data.createdById = asId(body.createdBy)
  if (body.createdById !== undefined) data.createdById = asId(body.createdById)
  if (body.organizationId !== undefined) {
    data.organizationId = body.organizationId ? asId(body.organizationId) : null
  }

  if (forCreate) {
    data.id = body.id ? String(body.id) : generateObjectId()
    data.highlights = data.highlights || []
    data.uniqueSellingPoints = data.uniqueSellingPoints || []
    data.destinations = data.destinations || []
    data.destinationLocations = data.destinationLocations ?? []
    data.categories = data.categories || []
    data.images = data.images || []
    data.gallery = data.gallery ?? []
    data.portfolioPhotos = data.portfolioPhotos ?? []
    data.availableDates = data.availableDates || []
    data.inclusions = data.inclusions || []
    data.exclusions = data.exclusions || []
    data.policies = data.policies ?? {}
    data.packages = data.packages ?? []
    data.itinerary = data.itinerary ?? []
    data.currency = data.currency || 'ETB'
    data.discount = data.discount ?? 0
    data.secretTour = data.secretTour ?? false
    data.averageRating = data.averageRating ?? 0
    data.reviewCount = data.reviewCount ?? 0
    data.isFeatured = data.isFeatured ?? false
    data.status = data.status || 'active'
    data.currentBookings = data.currentBookings ?? 0
  }

  return omitUndefined(data)
}

async function syncTourGuides(tourId, guides) {
  if (guides === undefined) return
  const ids = (Array.isArray(guides) ? guides : [])
    .map((g) => {
      if (typeof g === 'string') return g
      return g?._id || g?.id || g?.userId || null
    })
    .filter(Boolean)
    .map(String)

  await prisma.$transaction(async (tx) => {
    await tx.tourGuide.deleteMany({ where: { tourId: String(tourId) } })
    if (ids.length) {
      await tx.tourGuide.createMany({
        data: ids.map((userId) => ({
          tourId: String(tourId),
          userId,
        })),
        skipDuplicates: true,
      })
    }
  })
}

async function loadTourWithGuides(id) {
  return prisma.tour.findUnique({
    where: { id: String(id) },
    include: {
      guides: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  })
}

export async function createTour(body) {
  const data = mapTourData(body, { forCreate: true })
  const row = await prisma.tour.create({ data })
  await syncTourGuides(row.id, body.guides)
  const full = await loadTourWithGuides(row.id)
  return toApiDoc(full, { keepFkIds: true })
}

export async function updateTour(id, body) {
  const data = mapTourData(body)
  try {
    await prisma.tour.update({
      where: { id: String(id) },
      data,
    })
    await syncTourGuides(id, body.guides)
    const full = await loadTourWithGuides(id)
    return toApiDoc(full, { keepFkIds: true })
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function deleteTour(id) {
  try {
    await prisma.tour.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

export async function findTourById(id) {
  const row = await loadTourWithGuides(id)
  return row ? toApiDoc(row, { keepFkIds: true }) : null
}

export async function findHotelById(id) {
  const row = await prisma.hotel.findUnique({ where: { id: String(id) } })
  return row ? toApiDoc(row, { keepFkIds: true }) : null
}

export async function findTransportById(id) {
  const row = await prisma.transport.findUnique({ where: { id: String(id) } })
  return row ? toApiDoc(row, { keepFkIds: true }) : null
}

export async function listOrgHotels(organizationId, { status } = {}) {
  const where = { organizationId: String(organizationId) }
  if (status) where.status = status
  const rows = await prisma.hotel.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((row) => toApiDoc(row, { keepFkIds: true }))
}

export async function listOrgTransports(organizationId, { status } = {}) {
  const where = { organizationId: String(organizationId) }
  if (status) where.status = status
  const rows = await prisma.transport.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((row) => toApiDoc(row, { keepFkIds: true }))
}

export async function listOrgTours(organizationId, { status } = {}) {
  const where = { organizationId: String(organizationId) }
  if (status) where.status = status
  const rows = await prisma.tour.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((row) => toApiDoc(row))
}

export async function transitionTourStatus(id, fromStatus, toStatus, extra = {}) {
  const result = await prisma.tour.updateMany({
    where: { id: String(id), status: fromStatus },
    data: { status: toStatus, ...extra },
  })
  if (result.count === 0) return null
  return findTourById(id)
}

export async function transitionHotelStatus(id, fromStatus, toStatus) {
  const result = await prisma.hotel.updateMany({
    where: { id: String(id), status: fromStatus },
    data: { status: toStatus },
  })
  if (result.count === 0) return null
  return findHotelById(id)
}

export async function transitionTransportStatus(id, fromStatus, toStatus) {
  const result = await prisma.transport.updateMany({
    where: { id: String(id), status: fromStatus },
    data: { status: toStatus },
  })
  if (result.count === 0) return null
  return findTransportById(id)
}

export async function tourSlugExists(slug, excludeTourId = null) {
  const row = await prisma.tour.findFirst({
    where: {
      slug: String(slug).toLowerCase(),
      ...(excludeTourId ? { id: { not: String(excludeTourId) } } : {}),
    },
    select: { id: true },
  })
  return Boolean(row)
}

function mapHotelData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'name',
    'description',
    'shortDescription',
    'location',
    'stars',
    'amenities',
    'roomTypes',
    'images',
    'coverImage',
    'contact',
    'policies',
    'averageRating',
    'isFeatured',
    'status',
  ])
  if (body.createdBy !== undefined) data.createdById = asId(body.createdBy)
  if (body.createdById !== undefined) data.createdById = asId(body.createdById)
  if (body.organizationId !== undefined) {
    data.organizationId = body.organizationId ? asId(body.organizationId) : null
  }
  if (forCreate) {
    data.id = generateObjectId()
    data.amenities = data.amenities || []
    data.roomTypes = data.roomTypes ?? []
    data.images = data.images || []
    data.policies = data.policies ?? {}
    data.averageRating = data.averageRating ?? 0
    data.isFeatured = data.isFeatured ?? false
    data.status = data.status || 'active'
  }
  return omitUndefined(data)
}

export async function createHotel(body) {
  const data = mapHotelData(body, { forCreate: true })
  const row = await prisma.hotel.create({
    data,
    include: { createdBy: { select: userSelect } },
  })
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

export async function updateHotel(id, body) {
  const data = mapHotelData(body)
  try {
    const row = await prisma.hotel.update({
      where: { id: String(id) },
      data,
      include: { createdBy: { select: userSelect } },
    })
    const doc = toApiDoc(row)
    doc.reviews = []
    return doc
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function deleteHotel(id) {
  try {
    await prisma.hotel.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

function mapTransportData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'name',
    'description',
    'type',
    'vehicleDetails',
    'routes',
    'contact',
    'averageRating',
    'status',
  ])
  if (body.createdBy !== undefined) data.createdById = asId(body.createdBy)
  if (body.createdById !== undefined) data.createdById = asId(body.createdById)
  if (body.organizationId !== undefined) {
    data.organizationId = body.organizationId ? asId(body.organizationId) : null
  }
  if (forCreate) {
    data.id = generateObjectId()
    data.vehicleDetails = data.vehicleDetails ?? {}
    data.routes = data.routes ?? []
    data.averageRating = data.averageRating ?? 0
    data.status = data.status || 'active'
  }
  return omitUndefined(data)
}

export async function createTransport(body) {
  const data = mapTransportData(body, { forCreate: true })
  const row = await prisma.transport.create({
    data,
    include: { createdBy: { select: userSelect } },
  })
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

export async function updateTransport(id, body) {
  const data = mapTransportData(body)
  try {
    const row = await prisma.transport.update({
      where: { id: String(id) },
      data,
      include: { createdBy: { select: userSelect } },
    })
    const doc = toApiDoc(row)
    doc.reviews = []
    return doc
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function deleteTransport(id) {
  try {
    await prisma.transport.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

function mapRestaurantData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'name',
    'description',
    'shortDescription',
    'cuisineType',
    'location',
    'openingHours',
    'priceRange',
    'menu',
    'images',
    'coverImage',
    'contact',
    'averageRating',
    'isFeatured',
    'status',
  ])
  if (body.createdBy !== undefined) data.createdById = asId(body.createdBy)
  if (body.createdById !== undefined) data.createdById = asId(body.createdById)
  if (forCreate) {
    data.id = generateObjectId()
    data.cuisineType = data.cuisineType || []
    data.openingHours = data.openingHours ?? {}
    data.menu = data.menu ?? []
    data.images = data.images || []
    data.averageRating = data.averageRating ?? 0
    data.isFeatured = data.isFeatured ?? false
    data.status = data.status || 'active'
  }
  return omitUndefined(data)
}

export async function createRestaurant(body) {
  const data = mapRestaurantData(body, { forCreate: true })
  const row = await prisma.restaurant.create({
    data,
    include: { createdBy: { select: userSelect } },
  })
  const doc = toApiDoc(row)
  doc.reviews = []
  return doc
}

export async function updateRestaurant(id, body) {
  const data = mapRestaurantData(body)
  try {
    const row = await prisma.restaurant.update({
      where: { id: String(id) },
      data,
      include: { createdBy: { select: userSelect } },
    })
    const doc = toApiDoc(row)
    doc.reviews = []
    return doc
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function deleteRestaurant(id) {
  try {
    await prisma.restaurant.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

function mapNewsData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'title',
    'content',
    'summary',
    'category',
    'images',
    'coverImage',
    'tags',
    'isFeatured',
    'status',
    'publishedAt',
    'views',
  ])
  if (body.author !== undefined) data.authorId = asId(body.author)
  if (body.authorId !== undefined) data.authorId = asId(body.authorId)
  if (forCreate) {
    data.id = generateObjectId()
    data.images = data.images || []
    data.tags = data.tags || []
    data.isFeatured = data.isFeatured ?? false
    data.status = data.status || 'published'
    data.views = data.views ?? 0
  }
  return omitUndefined(data)
}

export async function createNews(body) {
  const data = mapNewsData(body, { forCreate: true })
  const row = await prisma.news.create({
    data,
    include: { author: { select: userSelect } },
  })
  return toApiDoc(row)
}

export async function updateNews(id, body) {
  const data = mapNewsData(body)
  try {
    const row = await prisma.news.update({
      where: { id: String(id) },
      data,
      include: { author: { select: userSelect } },
    })
    return toApiDoc(row)
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function deleteNews(id) {
  try {
    await prisma.news.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

const REVIEW_ITEM_DELEGATE = {
  tour: () => prisma.tour,
  hotel: () => prisma.hotel,
  transport: () => prisma.transport,
  restaurant: () => prisma.restaurant,
}

export async function findCatalogItem(itemType, itemId) {
  const delegate = REVIEW_ITEM_DELEGATE[itemType]
  if (!delegate) return null
  const selectByType = {
    tour: { id: true, title: true, coverImage: true },
    hotel: { id: true, name: true, coverImage: true },
    transport: { id: true, name: true },
    restaurant: { id: true, name: true, coverImage: true },
  }
  const row = await delegate().findUnique({
    where: { id: String(itemId) },
    select: selectByType[itemType],
  })
  return row ? toApiDoc(row) : null
}

function mapReviewData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'itemType',
    'rating',
    'title',
    'comment',
    'images',
    'dateOfExperience',
    'status',
  ])
  if (body.itemId !== undefined) data.itemId = asId(body.itemId)
  if (body.user !== undefined) data.userId = asId(body.user)
  if (body.userId !== undefined) data.userId = asId(body.userId)
  if (forCreate) {
    data.id = generateObjectId()
    data.images = data.images || []
    data.status = data.status || 'pending'
  }
  return omitUndefined(data)
}

export async function createReview(body) {
  const data = mapReviewData(body, { forCreate: true })
  const row = await prisma.review.create({
    data,
    include: { user: { select: userSelect } },
  })
  return toApiDoc(row, { reviewMode: true })
}

export async function updateReview(id, body) {
  const data = mapReviewData(body)
  try {
    const row = await prisma.review.update({
      where: { id: String(id) },
      data,
      include: { user: { select: userSelect } },
    })
    return toApiDoc(row, { reviewMode: true })
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export async function deleteReview(id) {
  try {
    await prisma.review.delete({ where: { id: String(id) } })
    return true
  } catch (err) {
    if (err?.code === 'P2025') return false
    throw err
  }
}

export async function findReviewById(id) {
  const row = await prisma.review.findUnique({
    where: { id: String(id) },
    include: { user: { select: userSelect } },
  })
  return row ? toApiDoc(row, { reviewMode: true }) : null
}

export async function findReviewsByUser(userId) {
  const rows = await prisma.review.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: userSelect } },
  })
  return rows.map((row) => toApiDoc(row, { reviewMode: true }))
}

export async function findPendingReviews(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200)
  const skip = (page - 1) * limit

  const rows = await prisma.review.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
    include: { user: { select: userSelect } },
  })

  const reviews = []
  for (const row of rows) {
    const doc = toApiDoc(row, { reviewMode: true })
    const item = await findCatalogItem(row.itemType, row.itemId)
    if (item) {
      doc.itemId = {
        _id: item._id,
        title: item.title,
        name: item.name,
        coverImage: item.coverImage,
      }
    }
    reviews.push(doc)
  }
  return reviews
}

export async function approveReview(id) {
  return updateReview(id, { status: 'approved' })
}

export async function refreshAverageRating(itemType, itemId) {
  const delegate = REVIEW_ITEM_DELEGATE[itemType]
  if (!delegate || !itemId) return

  const agg = await prisma.review.aggregate({
    where: {
      itemType,
      itemId: String(itemId),
      status: 'approved',
    },
    _avg: { rating: true },
    _count: { _all: true },
  })
  const averageRating = agg._avg.rating
    ? Math.round(agg._avg.rating * 10) / 10
    : 0
  const update = { averageRating }
  if (itemType === 'tour') {
    update.reviewCount = agg._count._all
  }
  await delegate().update({
    where: { id: String(itemId) },
    data: update,
  })
}

function mapContactData(body, { forCreate = false } = {}) {
  const data = pickScalar(body, [
    'name',
    'email',
    'phone',
    'subject',
    'message',
    'status',
    'response',
    'respondedAt',
  ])
  if (body.respondedBy !== undefined) {
    data.respondedById = body.respondedBy ? asId(body.respondedBy) : null
  }
  if (body.respondedById !== undefined) {
    data.respondedById = body.respondedById ? asId(body.respondedById) : null
  }
  if (forCreate) {
    data.id = generateObjectId()
    data.status = data.status || 'new'
  }
  return omitUndefined(data)
}

function serializeContact(row) {
  if (!row) return null
  const doc = toApiDoc(row, { keepFkIds: true })
  if (row.respondedBy) {
    doc.respondedBy = {
      _id: row.respondedBy.id,
      FirstName: row.respondedBy.firstName,
      LastName: row.respondedBy.lastName,
      email: row.respondedBy.email,
    }
  } else if (doc.respondedById) {
    doc.respondedBy = doc.respondedById
  }
  delete doc.respondedById
  return doc
}

export async function createContact(body) {
  const data = mapContactData(body, { forCreate: true })
  const row = await prisma.contact.create({ data })
  return serializeContact(row)
}

export async function findContacts(query = {}) {
  const args = buildPrismaListArgs(query, {}, {
    searchableFields: ['name', 'email', 'subject', 'message'],
  })
  const rows = await prisma.contact.findMany({
    ...args,
    include: {
      respondedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })
  return rows.map(serializeContact)
}

export async function findContactById(id) {
  const row = await prisma.contact.findUnique({
    where: { id: String(id) },
    include: {
      respondedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })
  return serializeContact(row)
}

export async function updateContact(id, body) {
  const data = mapContactData(body)
  try {
    const row = await prisma.contact.update({
      where: { id: String(id) },
      data,
      include: {
        respondedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    })
    return serializeContact(row)
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

export default {
  createDestination,
  updateDestination,
  deleteDestination,
  createTour,
  updateTour,
  deleteTour,
  findTourById,
  listOrgTours,
  transitionTourStatus,
  transitionHotelStatus,
  transitionTransportStatus,
  tourSlugExists,
  createHotel,
  updateHotel,
  deleteHotel,
  createTransport,
  updateTransport,
  deleteTransport,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  createNews,
  updateNews,
  deleteNews,
  findCatalogItem,
  createReview,
  updateReview,
  deleteReview,
  findReviewById,
  findReviewsByUser,
  findPendingReviews,
  findHotelById,
  findTransportById,
  listOrgHotels,
  listOrgTransports,
  approveReview,
  refreshAverageRating,
  createContact,
  findContacts,
  findContactById,
  updateContact,
}
