import Tour from '../models/Tour.js'
import AppError from '../utils/appError.js'
import { assertTourTransition } from '../config/tourLifecycle.js'
import { slugify } from '../utils/slugify.js'

export async function ensureTourSlug(organizationId, title, excludeTourId = null) {
  const base = slugify(title)
  let slug = base
  let n = 1
  while (true) {
    const query = { slug }
    if (excludeTourId) query._id = { $ne: excludeTourId }
    const exists = await Tour.exists(query)
    if (!exists) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

async function transitionTourStatus(tour, toStatus, extra = {}) {
  assertTourTransition(tour.status, toStatus)
  const updated = await Tour.findOneAndUpdate(
    { _id: tour._id, status: tour.status },
    { status: toStatus, ...extra },
    { new: true, runValidators: true }
  )
  if (!updated) {
    const err = new Error(`Invalid tour status transition: ${tour.status} → ${toStatus}`)
    err.statusCode = 409
    throw err
  }
  Object.assign(tour, updated.toObject())
  return tour
}

export async function publishTour(tour) {
  return transitionTourStatus(tour, 'published', { publishedAt: new Date() })
}

export async function unpublishTour(tour) {
  return transitionTourStatus(tour, 'unpublished')
}

export async function archiveTour(tour) {
  return transitionTourStatus(tour, 'archived', { archivedAt: new Date() })
}

export function stripUnsafeKeys(obj) {
  if (!obj || typeof obj !== 'object') return
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      delete obj[key]
    }
  }
}

const ALLOWED_TOUR_FIELDS = new Set([
  'title',
  'description',
  'shortDescription',
  'highlights',
  'uniqueSellingPoints',
  'duration',
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
  'inclusions',
  'exclusions',
  'policies',
  'packages',
  'itinerary',
  'isFeatured',
])

export function pickAllowedTourFields(body) {
  const payload = {}
  for (const key of ALLOWED_TOUR_FIELDS) {
    if (body[key] !== undefined) payload[key] = body[key]
  }
  return payload
}

export function validateTourPackages(packages = []) {
  if (!packages.length) return
  const keys = new Set()
  for (const pkg of packages) {
    if (!pkg.key || !pkg.name) {
      throw new AppError('Each package requires key and name', 400)
    }
    const normalizedKey = String(pkg.key).toLowerCase()
    if (keys.has(normalizedKey)) {
      throw new AppError('Duplicate package keys are not allowed', 400)
    }
    keys.add(normalizedKey)
    if (pkg.priceMinor == null || !Number.isInteger(pkg.priceMinor) || pkg.priceMinor < 0) {
      throw new AppError('Package priceMinor must be a non-negative integer', 400)
    }
  }
}

export function normalizeTourInput(body, organization) {
  stripUnsafeKeys(body)
  const payload = pickAllowedTourFields(body)

  if (payload.price != null && payload.priceMinor == null) {
    payload.priceMinor = Math.round(Number(payload.price) * 100)
  }
  if (payload.priceMinor != null) {
    payload.priceMinor = Math.round(Number(payload.priceMinor))
    if (!Number.isInteger(payload.priceMinor) || payload.priceMinor < 0) {
      throw new AppError('priceMinor must be a non-negative integer', 400)
    }
  }
  if (payload.maxGroupSize != null) {
    const size = Number(payload.maxGroupSize)
    if (!Number.isInteger(size) || size < 1) {
      throw new AppError('maxGroupSize must be a positive integer', 400)
    }
    payload.maxGroupSize = size
  }

  if (organization) {
    payload.organizationId = organization._id
  }

  validateTourPackages(payload.packages)
  return payload
}

export default {
  ensureTourSlug,
  publishTour,
  unpublishTour,
  archiveTour,
  validateTourPackages,
  normalizeTourInput,
  pickAllowedTourFields,
  stripUnsafeKeys,
}
