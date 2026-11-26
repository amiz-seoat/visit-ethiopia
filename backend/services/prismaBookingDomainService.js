/**
 * Prisma booking domain flows (DATABASE_MODE=prisma).
 * Preserves Mongo business behavior with PostgreSQL transactions + conditional UPDATE CAS.
 */
import mongoose from 'mongoose'
import AppError from '../utils/appError.js'
import { isPublicTourStatus } from '../config/tourLifecycle.js'
import {
  getPaymentPendingMinutes,
  getMaxBookingQuantity,
  isLegacyBookingFlow,
  isV2BookingFlow,
} from '../config/booking.js'
import { generateObjectId } from '../utils/objectId.js'
import prisma from '../config/prisma.js'
import * as depInv from '../repositories/booking/prismaDepartureInventoryRepository.js'
import * as bookRepo from '../repositories/booking/prismaBookingRepository.js'
import { getApprovedVersion } from './organizationVersionService.js'
import { buildPriceSnapshot } from './tourPricingService.js'
import {
  validateIdempotencyKey,
  parseContactInfo,
  buildRequestFingerprint,
} from './bookingRequestUtils.js'
import MockPaymentProvider from './payment/MockPaymentProvider.js'
import { getPaymentProvider } from './payment/paymentProviderRegistry.js'
import { sendEmailInBackground } from '../utils/Email.js'
import {
  getActivePaymentProviderName,
  isMockPaymentAllowed,
} from '../config/payments.js'
import * as hotelInv from '../repositories/prisma/hotelInventoryRepository.js'
import * as transportInv from '../repositories/prisma/transportInventoryRepository.js'
import {
  parseStayNights,
  parseHotelQuantity,
  buildHotelRequestFingerprint,
  fingerprintFromHotelBooking,
  loadPublicBookableHotel,
  buildHotelPriceSnapshot,
  assertActiveRoomType,
} from './hotelBookingService.js'
import {
  parseTravelDate,
  parseTransportQuantity,
  buildTransportRequestFingerprint,
  fingerprintFromTransportBooking,
  loadPublicBookableTransport,
  assertActiveRoute,
  buildTransportPriceSnapshot,
} from './transportBookingService.js'

const mockProvider = new MockPaymentProvider()

const PAYMENT_CONFIRM_BLOCKED_BODY = [
  'amount',
  'amountMinor',
  'currency',
  'total',
  'price',
  'unitPrice',
  'status',
  'provider',
  'bookingId',
  'organizationId',
  'providerPaymentId',
  'paymentId',
]

const IDEMPOTENCY_KEY_MIN = 8
const IDEMPOTENCY_KEY_MAX = 128
const IDEMPOTENCY_KEY_PATTERN = /^[\w-]+$/

function rejectConfirmBodyFields(body = {}) {
  for (const field of PAYMENT_CONFIRM_BLOCKED_BODY) {
    if (body[field] !== undefined) {
      throw new AppError(`Field ${field} is not allowed in payment confirmation`, 400)
    }
  }
}

function validatePaymentIdempotencyKeyLocal(key) {
  if (key == null) return null
  if (typeof key !== 'string') {
    throw new AppError('Idempotency-Key must be a string', 400)
  }
  const trimmed = key.trim()
  if (
    trimmed.length < IDEMPOTENCY_KEY_MIN ||
    trimmed.length > IDEMPOTENCY_KEY_MAX ||
    !IDEMPOTENCY_KEY_PATTERN.test(trimmed)
  ) {
    throw new AppError(
      'Idempotency-Key must be 8–128 characters (letters, numbers, underscore, hyphen)',
      400
    )
  }
  return trimmed
}

function assertBookingPaymentIntegrity(booking, payment) {
  if (payment.amountMinor !== booking.priceSnapshot?.totalMinor) {
    throw new AppError('Payment amount does not match booking snapshot', 500)
  }
  if (payment.currency !== booking.priceSnapshot?.currency) {
    throw new AppError('Payment currency does not match booking snapshot', 500)
  }
  if (String(payment.bookingId) !== String(booking._id)) {
    throw new AppError('Payment booking mismatch', 500)
  }
}

function assertUserCanAccessPaymentLocal({ payment, booking, user, notFound = true }) {
  if (isLegacyBookingFlow(booking)) {
    throw new AppError('Payment not found', notFound ? 404 : 403)
  }

  const ownerId = booking.user?.toString?.() ?? String(booking.user)
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'

  if (!isOwner && !isAdmin) {
    throw new AppError('Payment not found', notFound ? 404 : 403)
  }

  return { isOwner, isAdmin }
}

function assertBookingPayable(booking) {
  if (booking.status === 'expired') {
    throw new AppError('Booking has expired', 409)
  }
  if (booking.status === 'cancelled') {
    throw new AppError('Booking is cancelled', 409)
  }
  if (booking.status === 'failed') {
    throw new AppError('Booking payment has failed', 409)
  }
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    return 'already_confirmed'
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot pay booking in status ${booking.status}`, 409)
  }
  if (booking.expiresAt && new Date(booking.expiresAt) <= new Date()) {
    throw new AppError('Booking has expired', 409)
  }
  return 'payable'
}

async function nextAttemptNumberPrisma(paymentId) {
  return (await bookRepo.countPaymentAttempts(paymentId)) + 1
}

async function recordAttemptPrisma({
  payment,
  attemptNumber,
  status,
  providerReference,
  failureCode = null,
  failureMessage = null,
  raw = null,
}) {
  return bookRepo.upsertPaymentAttempt({
    paymentId: payment._id,
    attemptNumber,
    status,
    providerReference,
    failureCode,
    failureMessage,
    rawProviderResponse: raw,
  })
}

function assertV2Transition(fromStatus, toStatus) {
  const allowed = {
    payment_pending: ['cancelled', 'expired', 'failed', 'confirmed'],
    failed: [],
    expired: [],
    cancelled: [],
    confirmed: ['cancelled', 'partially_refunded'],
    partially_refunded: ['cancelled'],
    completed: [],
  }
  if (!(allowed[fromStatus] || []).includes(toStatus)) {
    throw new AppError(
      `Invalid booking transition from ${fromStatus} to ${toStatus}`,
      409
    )
  }
}

function isObjectIdCompat(id) {
  return typeof id === 'string'
    ? /^[a-fA-F0-9]{24}$/.test(id)
    : mongoose.Types.ObjectId.isValid(id)
}

async function loadTour(tourId) {
  const row = await prisma.tour.findUnique({ where: { id: String(tourId) } })
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    secretTour: row.secretTour,
    organizationId: row.organizationId,
    packages: row.packages || [],
    price: row.price,
  }
}

async function loadOrg(orgId) {
  const row = await prisma.organization.findUnique({ where: { id: String(orgId) } })
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    slug: row.slug,
    name: row.name,
    approvalStatus: row.approvalStatus,
    visibility: row.visibility,
    approvedVersionId: row.approvedVersionId,
    providerTypes: row.providerTypes,
  }
}

export async function isOrganizationPubliclyVisiblePrisma(organizationId) {
  if (!organizationId) return true
  const org = await loadOrg(organizationId)
  if (!org) return false
  return (
    org.approvalStatus === 'approved' &&
    org.visibility === 'public' &&
    Boolean(org.approvedVersionId)
  )
}

export async function loadBookableDepartureContextPrisma(departureId) {
  if (!isObjectIdCompat(departureId)) {
    throw new AppError('Invalid departureId', 400)
  }

  const departure = await depInv.findDepartureById(departureId)
  if (!departure) throw new AppError('Departure not found', 404)
  if (departure.status !== 'open') {
    throw new AppError('Departure is not available for booking', 409)
  }

  const tour = await loadTour(departure.tourId)
  if (!tour) throw new AppError('Tour not found', 404)
  if (tour.status === 'archived') {
    throw new AppError('Archived tours cannot be booked', 409)
  }
  if (tour.secretTour) throw new AppError('Tour not found', 404)
  if (!isPublicTourStatus(tour.status)) {
    throw new AppError('Tour is not available for booking', 409)
  }
  if (
    tour.organizationId &&
    String(departure.organizationId) !== String(tour.organizationId)
  ) {
    throw new AppError('Departure does not belong to tour organization', 403)
  }
  if (tour.organizationId) {
    const visible = await isOrganizationPubliclyVisiblePrisma(tour.organizationId)
    if (!visible) throw new AppError('Tour is not available for booking', 409)
  }
  return { departure, tour }
}

export async function loadPublicBookableContextPrisma(departureId) {
  const { departure, tour } = await loadBookableDepartureContextPrisma(departureId)
  if (!tour.organizationId) {
    throw new AppError('Tour is not available for booking', 404)
  }
  const organization = await loadOrg(tour.organizationId)
  if (
    !organization ||
    organization.approvalStatus !== 'approved' ||
    organization.visibility !== 'public' ||
    !organization.approvedVersionId
  ) {
    throw new AppError('Tour is not available for booking', 404)
  }
  const approvedVersion = await getApprovedVersion(organization)
  if (!approvedVersion || approvedVersion.status !== 'approved') {
    throw new AppError('Tour is not available for booking', 404)
  }
  return { departure, tour, organization, approvedVersion }
}

function fingerprintFromBooking(booking) {
  return buildRequestFingerprint({
    departureId: booking.departureId,
    packageKey: booking.packageKey,
    quantity: booking.inventoryQuantity,
    contactInfo: booking.contactInfo,
  })
}

function parseQuantity(value, departure) {
  const quantity = Number(value)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  if (quantity > getMaxBookingQuantity()) {
    throw new AppError(`quantity cannot exceed ${getMaxBookingQuantity()}`, 400)
  }
  if (quantity > departure.availableSpots) {
    throw new AppError('Not enough available spots', 409)
  }
  return quantity
}

function parsePackageKey(value) {
  const key = String(value || '').trim().toLowerCase()
  if (!key) throw new AppError('packageKey is required', 400)
  return key
}

function rejectProtectedFields(body) {
  const blocked = [
    'organizationId',
    'tourId',
    'payment',
    'status',
    'bookingFlowVersion',
    'inventoryReserved',
    'inventoryQuantity',
    'priceSnapshot',
    'paymentId',
    'idempotencyKey',
  ]
  for (const field of blocked) {
    if (body?.[field] !== undefined) {
      throw new AppError(`Field ${field} is not allowed in the request body`, 400)
    }
  }
}

/**
 * Reserve inventory for a booking atomically:
 * hold(pending) → CAS decrement → hold(held) → booking flags.
 */
export async function reserveForBookingPrisma({
  bookingId,
  departureId,
  quantity,
  expiresAt = null,
}) {
  if (!isObjectIdCompat(bookingId)) throw new AppError('Invalid bookingId', 400)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  const booking = await bookRepo.findBookingById(bookingId)
  if (!booking) throw new AppError('Booking not found', 404)
  if (booking.bookingFlowVersion !== 'v2') {
    throw new AppError('Inventory reservation applies only to v2 bookings', 400)
  }
  if (String(booking.departureId) !== String(departureId)) {
    throw new AppError('Departure does not match booking', 403)
  }

  const existingHold = await depInv.findActiveHoldForBooking(bookingId)
  if (existingHold) {
    if (existingHold.status === 'consumed') {
      return { hold: existingHold, idempotent: true, consumed: true }
    }
    if (existingHold.quantity !== quantity) {
      throw new AppError(
        'Booking already has a reservation with different quantity',
        409
      )
    }
    if (!booking.inventoryReserved) {
      await bookRepo.updateBooking(bookingId, {
        inventoryReserved: true,
        inventoryQuantity: existingHold.quantity,
        inventoryReleasedAt: null,
      })
    }
    return { hold: existingHold, idempotent: true, consumed: false }
  }

  const { departure, tour } = await loadBookableDepartureContextPrisma(departureId)
  if (String(booking.organizationId) !== String(departure.organizationId)) {
    throw new AppError('Booking organization does not match departure', 403)
  }
  if (String(booking.organizationId) !== String(tour.organizationId)) {
    throw new AppError('Booking organization does not match tour', 403)
  }

  let hold
  try {
    hold = await depInv.createHold({
      bookingId,
      departureId: departure._id,
      organizationId: departure.organizationId,
      quantity,
      status: 'pending',
      expiresAt,
    })
  } catch (err) {
    if (err.code === 'P2002' && err.hold) {
      return {
        hold: err.hold,
        idempotent: true,
        consumed: err.hold.status === 'consumed',
      }
    }
    throw err
  }

  try {
    await depInv.reserveSpotsAtomic(departure._id, quantity)
  } catch (err) {
    await depInv.updateHoldIfStatus(hold._id, 'pending', {
      status: 'released',
      releasedAt: new Date(),
      releaseReason: 'reserve_failed',
    })
    throw err
  }

  const activated = await depInv.updateHoldIfStatus(hold._id, 'pending', {
    status: 'held',
  })
  if (!activated) {
    await depInv.releaseSpotsAtomic(departure._id, quantity)
    throw new AppError('Reservation activation conflict', 409)
  }

  await bookRepo.updateBooking(bookingId, {
    inventoryReserved: true,
    inventoryQuantity: quantity,
    inventoryReleasedAt: null,
  })

  return { hold: activated, idempotent: false, consumed: false }
}

export async function releaseForBookingPrisma({
  bookingId,
  reason = 'release',
  targetStatus = 'released',
}) {
  if (!['released', 'expired'].includes(targetStatus)) {
    throw new AppError('Invalid release target status', 400)
  }
  const hold = await depInv.findHoldByBooking(bookingId)
  if (!hold) return { released: false, idempotent: true, reason: 'no_hold' }
  if (hold.status === 'released' || hold.status === 'expired') {
    return { hold, released: false, idempotent: true, reason: 'already_released' }
  }
  if (hold.status === 'consumed') {
    throw new AppError('Cannot release consumed reservation', 409)
  }
  if (hold.status === 'pending') {
    const cancelled = await depInv.updateHoldIfStatus(hold._id, 'pending', {
      status: targetStatus,
      releasedAt: new Date(),
      releaseReason: reason,
    })
    if (cancelled) {
      await bookRepo.updateBooking(bookingId, {
        inventoryReserved: false,
        inventoryQuantity: null,
        inventoryReleasedAt: new Date(),
      })
      return {
        hold: cancelled,
        released: false,
        idempotent: false,
        reason: 'pending_cancelled',
      }
    }
  }

  const releasedHold = await depInv.updateHoldIfStatus(hold._id, ['held'], {
    status: targetStatus,
    releasedAt: new Date(),
    releaseReason: reason,
  })
  if (!releasedHold) {
    const current = await depInv.findHoldByBooking(bookingId)
    if (current?.status === 'released' || current?.status === 'expired') {
      return { hold: current, released: false, idempotent: true, reason: 'already_released' }
    }
    if (current?.status === 'consumed') {
      throw new AppError('Cannot release consumed reservation', 409)
    }
    throw new AppError('Release conflict', 409)
  }

  if (isHotelHold(releasedHold)) {
    await releaseHotelInventoryFromHold(releasedHold)
  } else if (isTransportHold(releasedHold)) {
    await releaseTransportInventoryFromHold(releasedHold)
  } else {
    await depInv.releaseSpotsAtomic(releasedHold.departureId, releasedHold.quantity)
  }
  await bookRepo.updateBooking(bookingId, {
    inventoryReserved: false,
    inventoryQuantity: null,
    inventoryReleasedAt: new Date(),
  })
  return { hold: releasedHold, released: true, idempotent: false, reason }
}

function isHotelHold(hold) {
  return Boolean(hold?.hotelId)
}

function isTransportHold(hold) {
  return Boolean(hold?.transportId)
}

async function releaseHotelInventoryFromHold(hold) {
  const nights = Array.isArray(hold.nights) ? hold.nights : []
  if (!hold.hotelId || !hold.roomTypeKey || !nights.length) {
    throw new AppError('Hotel hold is missing inventory metadata', 500)
  }
  await hotelInv.releaseNightsAtomic({
    hotelId: hold.hotelId,
    roomTypeKey: hold.roomTypeKey,
    dates: nights,
    quantity: hold.quantity,
  })
}

async function releaseTransportInventoryFromHold(hold) {
  if (!hold.transportId || !hold.routeKey || !hold.travelDate) {
    throw new AppError('Transport hold is missing inventory metadata', 500)
  }
  await transportInv.releaseSeatsAtomic({
    transportId: hold.transportId,
    routeKey: hold.routeKey,
    date: hold.travelDate,
    quantity: hold.quantity,
  })
}

export async function finalizeForBookingPrisma({ bookingId }) {
  const active = await depInv.findActiveHoldForBooking(bookingId)
  if (!active) throw new AppError('No active hold to finalize', 404)
  if (active.status === 'consumed') return { hold: active, idempotent: true }
  if (active.status !== 'held') throw new AppError('No active hold to finalize', 404)

  const updated = await depInv.updateHoldIfStatus(active._id, 'held', {
    status: 'consumed',
  })
  if (updated) return { hold: updated, idempotent: false }
  const consumed = await depInv.findActiveHoldForBooking(bookingId)
  if (consumed?.status === 'consumed') return { hold: consumed, idempotent: true }
  throw new AppError('No active hold to finalize', 404)
}

export async function restoreConsumedForBookingPrisma({
  bookingId,
  reason = 'refund_cancelled',
}) {
  const hold = await depInv.findHoldByBooking(bookingId)
  if (!hold) return { restored: false, idempotent: true, reason: 'no_hold' }
  if (hold.status === 'released' || hold.status === 'expired') {
    return { hold, restored: false, idempotent: true, reason: 'already_released' }
  }
  if (hold.status !== 'consumed') {
    throw new AppError(
      `Cannot restore inventory from hold status ${hold.status}`,
      409
    )
  }
  const restoredHold = await depInv.updateHoldIfStatus(hold._id, 'consumed', {
    status: 'released',
    releasedAt: new Date(),
    releaseReason: reason,
  })
  if (!restoredHold) {
    const current = await depInv.findHoldByBooking(bookingId)
    if (current?.status === 'released' || current?.status === 'expired') {
      return { hold: current, restored: false, idempotent: true, reason: 'already_released' }
    }
    throw new AppError('Restore consumed hold conflict', 409)
  }
  if (isHotelHold(restoredHold)) {
    await releaseHotelInventoryFromHold(restoredHold)
  } else if (isTransportHold(restoredHold)) {
    await releaseTransportInventoryFromHold(restoredHold)
  } else {
    await depInv.releaseSpotsAtomic(restoredHold.departureId, restoredHold.quantity)
  }
  await bookRepo.updateBooking(bookingId, {
    inventoryReserved: false,
    inventoryQuantity: null,
    inventoryReleasedAt: new Date(),
  })
  return { hold: restoredHold, restored: true, idempotent: false, reason }
}

export async function createTourBookingPrisma({ userId, body, idempotencyKey }) {
  rejectProtectedFields(body || {})
  const key = validateIdempotencyKey(idempotencyKey)
  if (!isObjectIdCompat(body?.departureId)) {
    throw new AppError('Invalid departureId', 400)
  }

  const contactInfo = parseContactInfo(body.contactInfo)
  const packageKey = parsePackageKey(body.packageKey)
  const fingerprint = buildRequestFingerprint({
    departureId: body.departureId,
    packageKey,
    quantity: body.quantity,
    contactInfo,
  })

  const existing = await bookRepo.findV2BookingByIdempotency(userId, key)
  if (existing) {
    if (fingerprintFromBooking(existing) !== fingerprint) {
      throw new AppError(
        'Idempotency-Key was already used with a different request payload',
        409
      )
    }
    let payment = null
    if (existing.paymentId) {
      payment = (await createPaymentForBookingPrisma(existing)).payment
    }
    return { booking: existing, payment, idempotent: true }
  }

  const { departure, tour, organization, approvedVersion } =
    await loadPublicBookableContextPrisma(body.departureId)
  const quantity = parseQuantity(body.quantity, departure)
  const priceSnapshot = buildPriceSnapshot({
    departure,
    tour,
    organization,
    approvedVersion,
    packageKey,
    quantity,
  })
  const expiresAt = new Date(Date.now() + getPaymentPendingMinutes() * 60 * 1000)
  const bookingId = generateObjectId()

  let booking
  try {
    booking = await bookRepo.createBooking({
      id: bookingId,
      userId,
      bookingFlowVersion: 'v2',
      bookingType: 'tour',
      bookingItemId: tour._id,
      organizationId: organization._id,
      departureId: departure._id,
      packageKey,
      priceSnapshot,
      inventoryQuantity: quantity,
      inventoryReserved: false,
      status: 'payment_pending',
      contactInfo,
      expiresAt,
      idempotencyKey: key,
    })
  } catch (err) {
    if (err.isIdempotencyConflict || err.code === 'P2002') {
      const raced = await bookRepo.findV2BookingByIdempotency(userId, key)
      if (raced) {
        if (fingerprintFromBooking(raced) !== fingerprint) {
          throw new AppError(
            'Idempotency-Key was already used with a different request payload',
            409
          )
        }
        return {
          booking: raced,
          payment: raced.paymentId
            ? (await createPaymentForBookingPrisma(raced)).payment
            : null,
          idempotent: true,
        }
      }
    }
    throw err
  }

  try {
    await reserveForBookingPrisma({
      bookingId: booking._id,
      departureId: departure._id,
      quantity,
      expiresAt,
    })
  } catch (err) {
    await bookRepo.updateBooking(booking._id, {
      status: 'failed',
      cancellationReason: 'inventory_reservation_failed',
      inventoryReserved: false,
    })
    throw err
  }

  const refreshed = await bookRepo.findBookingById(booking._id)
  const { payment } = await createPaymentForBookingPrisma(refreshed)
  const bookingWithPayment = await bookRepo.findBookingById(booking._id)
  return { booking: bookingWithPayment, payment, idempotent: false }
}

export async function reserveHotelForBookingPrisma({
  bookingId,
  hotelId,
  organizationId,
  roomTypeKey,
  nights,
  quantity,
  expiresAt,
}) {
  if (!isObjectIdCompat(bookingId)) throw new AppError('Invalid bookingId', 400)
  if (!isObjectIdCompat(hotelId)) throw new AppError('Invalid hotelId', 400)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  const booking = await bookRepo.findBookingById(bookingId)
  if (!booking) throw new AppError('Booking not found', 404)
  if (booking.bookingType !== 'hotel') {
    throw new AppError('Not a hotel booking', 400)
  }

  const existingHold = await depInv.findActiveHoldForBooking(bookingId)
  if (existingHold) {
    if (existingHold.status === 'consumed') {
      return { hold: existingHold, idempotent: true, consumed: true }
    }
    if (!['pending', 'held'].includes(existingHold.status)) {
      throw new AppError(
        `Unexpected hold status ${existingHold.status} for reservation`,
        409
      )
    }
    if (!booking.inventoryReserved) {
      await bookRepo.updateBooking(bookingId, {
        inventoryReserved: true,
        inventoryQuantity: existingHold.quantity,
        inventoryReleasedAt: null,
      })
    }
    return { hold: existingHold, idempotent: true, consumed: false }
  }

  let hold
  try {
    hold = await depInv.createHold({
      bookingId,
      hotelId,
      roomTypeKey,
      nights,
      organizationId: organizationId || null,
      quantity,
      status: 'pending',
      expiresAt,
    })
  } catch (err) {
    if (err.code === 'P2002' && err.hold) {
      return {
        hold: err.hold,
        idempotent: true,
        consumed: err.hold.status === 'consumed',
      }
    }
    throw err
  }

  try {
    await hotelInv.reserveNightsAtomic({
      hotelId,
      roomTypeKey,
      dates: nights,
      quantity,
    })
  } catch (err) {
    await depInv.updateHoldIfStatus(hold._id, 'pending', {
      status: 'released',
      releasedAt: new Date(),
      releaseReason: 'reserve_failed',
    })
    throw err
  }

  const activated = await depInv.updateHoldIfStatus(hold._id, 'pending', {
    status: 'held',
  })
  if (!activated) {
    await hotelInv.releaseNightsAtomic({
      hotelId,
      roomTypeKey,
      dates: nights,
      quantity,
    })
    throw new AppError('Reservation activation conflict', 409)
  }

  await bookRepo.updateBooking(bookingId, {
    inventoryReserved: true,
    inventoryQuantity: quantity,
    inventoryReleasedAt: null,
  })

  return { hold: activated, idempotent: false, consumed: false }
}

export async function createHotelBookingPrisma({ userId, body, idempotencyKey }) {
  rejectProtectedFields(body || {})
  const key = validateIdempotencyKey(idempotencyKey)
  const hotelId = body?.hotelId || body?.bookingItem
  if (!isObjectIdCompat(hotelId)) {
    throw new AppError('Invalid hotelId', 400)
  }

  const contactInfo = parseContactInfo(body.contactInfo)
  const quantity = parseHotelQuantity(body.quantity ?? 1)
  const stay = parseStayNights(body.checkIn, body.checkOut)
  const hotelIdNormalized = String(hotelId)

  const { hotel, organization } = await loadPublicBookableHotel(hotelIdNormalized)
  const { roomType, roomTypeKey } = assertActiveRoomType(hotel, body.roomTypeKey)
  const fingerprint = buildHotelRequestFingerprint({
    hotelId: hotelIdNormalized,
    roomTypeKey,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    quantity,
    contactInfo,
  })

  const existing = await bookRepo.findV2BookingByIdempotency(userId, key)
  if (existing) {
    if (fingerprintFromHotelBooking(existing) !== fingerprint) {
      throw new AppError(
        'Idempotency-Key was already used with a different request payload',
        409
      )
    }
    let payment = null
    if (existing.paymentId) {
      payment = (await createPaymentForBookingPrisma(existing)).payment
    }
    return { booking: existing, payment, idempotent: true }
  }

  const priceSnapshot = await buildHotelPriceSnapshot({
    hotel,
    organization,
    roomType,
    roomTypeKey,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: stay.nights,
    quantity,
  })

  const expiresAt = new Date(Date.now() + getPaymentPendingMinutes() * 60 * 1000)
  const bookingId = generateObjectId()
  const bookingDetails = {
    roomTypeKey,
    roomTypeName: roomType.name || roomType.type,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: stay.nights,
    nightsCount: stay.nightsCount,
    quantity,
  }

  let booking
  try {
    booking = await bookRepo.createBooking({
      id: bookingId,
      userId,
      bookingFlowVersion: 'v2',
      bookingType: 'hotel',
      bookingItemId: hotel._id || hotel.id,
      organizationId: hotel.organizationId || null,
      priceSnapshot,
      inventoryQuantity: quantity,
      inventoryReserved: false,
      status: 'payment_pending',
      contactInfo,
      bookingDetails,
      expiresAt,
      idempotencyKey: key,
    })
  } catch (err) {
    if (err.isIdempotencyConflict || err.code === 'P2002') {
      const raced = await bookRepo.findV2BookingByIdempotency(userId, key)
      if (raced) {
        if (fingerprintFromHotelBooking(raced) !== fingerprint) {
          throw new AppError(
            'Idempotency-Key was already used with a different request payload',
            409
          )
        }
        return {
          booking: raced,
          payment: raced.paymentId
            ? (await createPaymentForBookingPrisma(raced)).payment
            : null,
          idempotent: true,
        }
      }
    }
    throw err
  }

  try {
    await reserveHotelForBookingPrisma({
      bookingId: booking._id,
      hotelId: hotel._id || hotel.id,
      organizationId: hotel.organizationId || null,
      roomTypeKey,
      nights: stay.nights,
      quantity,
      expiresAt,
    })
  } catch (err) {
    await bookRepo.updateBooking(booking._id, {
      status: 'failed',
      cancellationReason: 'inventory_reservation_failed',
      inventoryReserved: false,
    })
    throw err
  }

  const refreshed = await bookRepo.findBookingById(booking._id)
  const { payment } = await createPaymentForBookingPrisma(refreshed)
  const bookingWithPayment = await bookRepo.findBookingById(booking._id)
  return { booking: bookingWithPayment, payment, idempotent: false }
}

export async function reserveTransportForBookingPrisma({
  bookingId,
  transportId,
  organizationId,
  routeKey,
  travelDate,
  quantity,
  expiresAt,
}) {
  if (!isObjectIdCompat(bookingId)) throw new AppError('Invalid bookingId', 400)
  if (!isObjectIdCompat(transportId)) throw new AppError('Invalid transportId', 400)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  const booking = await bookRepo.findBookingById(bookingId)
  if (!booking) throw new AppError('Booking not found', 404)

  const existingHold = await depInv.findActiveHoldForBooking(bookingId)
  if (existingHold) {
    if (existingHold.status === 'consumed') {
      return { hold: existingHold, idempotent: true, consumed: true }
    }
    if (!['pending', 'held'].includes(existingHold.status)) {
      throw new AppError(
        `Unexpected hold status ${existingHold.status} for reservation`,
        409
      )
    }
    if (!booking.inventoryReserved) {
      await bookRepo.updateBooking(bookingId, {
        inventoryReserved: true,
        inventoryQuantity: existingHold.quantity,
        inventoryReleasedAt: null,
      })
    }
    return { hold: existingHold, idempotent: true, consumed: false }
  }

  let hold
  try {
    hold = await depInv.createHold({
      bookingId,
      transportId,
      routeKey,
      travelDate,
      organizationId: organizationId || null,
      quantity,
      status: 'pending',
      expiresAt,
    })
  } catch (err) {
    if (err.code === 'P2002' && err.hold) {
      return {
        hold: err.hold,
        idempotent: true,
        consumed: err.hold.status === 'consumed',
      }
    }
    throw err
  }

  try {
    await transportInv.reserveSeatsAtomic({
      transportId,
      routeKey,
      date: travelDate,
      quantity,
    })
  } catch (err) {
    await depInv.updateHoldIfStatus(hold._id, 'pending', {
      status: 'released',
      releasedAt: new Date(),
      releaseReason: 'reserve_failed',
    })
    throw err
  }

  const activated = await depInv.updateHoldIfStatus(hold._id, 'pending', {
    status: 'held',
  })
  if (!activated) {
    await transportInv.releaseSeatsAtomic({
      transportId,
      routeKey,
      date: travelDate,
      quantity,
    })
    throw new AppError('Reservation activation conflict', 409)
  }

  await bookRepo.updateBooking(bookingId, {
    inventoryReserved: true,
    inventoryQuantity: quantity,
    inventoryReleasedAt: null,
  })

  return { hold: activated, idempotent: false, consumed: false }
}

export async function createTransportBookingPrisma({ userId, body, idempotencyKey }) {
  rejectProtectedFields(body || {})
  const key = validateIdempotencyKey(idempotencyKey)
  const transportId = body?.transportId || body?.bookingItem
  if (!isObjectIdCompat(transportId)) {
    throw new AppError('Invalid transportId', 400)
  }

  const contactInfo = parseContactInfo(body.contactInfo)
  const quantity = parseTransportQuantity(body.quantity ?? 1)
  const travelDate = parseTravelDate(body.travelDate || body.date)
  const transportIdNormalized = String(transportId)

  const { transport, organization } =
    await loadPublicBookableTransport(transportIdNormalized)
  const { route, routeKey } = assertActiveRoute(transport, body.routeKey)
  const fingerprint = buildTransportRequestFingerprint({
    transportId: transportIdNormalized,
    routeKey,
    travelDate,
    quantity,
    contactInfo,
  })

  const existing = await bookRepo.findV2BookingByIdempotency(userId, key)
  if (existing) {
    if (fingerprintFromTransportBooking(existing) !== fingerprint) {
      throw new AppError(
        'Idempotency-Key was already used with a different request payload',
        409
      )
    }
    let payment = null
    if (existing.paymentId) {
      payment = (await createPaymentForBookingPrisma(existing)).payment
    }
    return { booking: existing, payment, idempotent: true }
  }

  const priceSnapshot = await buildTransportPriceSnapshot({
    transport,
    organization,
    route,
    routeKey,
    travelDate,
    quantity,
  })

  const expiresAt = new Date(Date.now() + getPaymentPendingMinutes() * 60 * 1000)
  const bookingId = generateObjectId()
  const bookingDetails = {
    routeKey,
    from: route.from,
    to: route.to,
    departureTime: route.departureTime,
    arrivalTime: route.arrivalTime,
    travelDate,
    quantity,
  }

  let booking
  try {
    booking = await bookRepo.createBooking({
      id: bookingId,
      userId,
      bookingFlowVersion: 'v2',
      bookingType: 'transport',
      bookingItemId: transport._id || transport.id,
      organizationId: transport.organizationId || null,
      priceSnapshot,
      inventoryQuantity: quantity,
      inventoryReserved: false,
      status: 'payment_pending',
      contactInfo,
      bookingDetails,
      expiresAt,
      idempotencyKey: key,
    })
  } catch (err) {
    if (err.isIdempotencyConflict || err.code === 'P2002') {
      const raced = await bookRepo.findV2BookingByIdempotency(userId, key)
      if (raced) {
        if (fingerprintFromTransportBooking(raced) !== fingerprint) {
          throw new AppError(
            'Idempotency-Key was already used with a different request payload',
            409
          )
        }
        return {
          booking: raced,
          payment: raced.paymentId
            ? (await createPaymentForBookingPrisma(raced)).payment
            : null,
          idempotent: true,
        }
      }
    }
    throw err
  }

  try {
    await reserveTransportForBookingPrisma({
      bookingId: booking._id,
      transportId: transport._id || transport.id,
      organizationId: transport.organizationId || null,
      routeKey,
      travelDate,
      quantity,
      expiresAt,
    })
  } catch (err) {
    await bookRepo.updateBooking(booking._id, {
      status: 'failed',
      cancellationReason: 'inventory_reservation_failed',
      inventoryReserved: false,
    })
    throw err
  }

  const refreshed = await bookRepo.findBookingById(booking._id)
  const { payment } = await createPaymentForBookingPrisma(refreshed)
  const bookingWithPayment = await bookRepo.findBookingById(booking._id)
  return { booking: bookingWithPayment, payment, idempotent: false }
}

export async function createPaymentForBookingPrisma(booking) {
  if (booking.bookingFlowVersion !== 'v2') {
    throw new AppError('Payments apply only to v2 bookings', 400)
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(
      'Payment can only be created for payment_pending bookings',
      409
    )
  }
  if (!booking.priceSnapshot) {
    throw new AppError('Booking price snapshot is required', 500)
  }
  if (booking.paymentId) {
    const existing = await bookRepo.findPaymentById(booking.paymentId)
    if (existing) {
      if (existing.amountMinor !== booking.priceSnapshot.totalMinor) {
        throw new AppError('Payment amount does not match booking snapshot', 500)
      }
      if (existing.currency !== booking.priceSnapshot.currency) {
        throw new AppError('Payment currency does not match booking snapshot', 500)
      }
      return { payment: existing, idempotent: true }
    }
  }

  const amountMinor = booking.priceSnapshot.totalMinor
  const currency = booking.priceSnapshot.currency
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new AppError('Invalid booking price snapshot amount', 500)
  }

  const providerName = getActivePaymentProviderName()
  let payment = await bookRepo.createPayment({
    bookingId: booking._id,
    organizationId: booking.organizationId,
    amountMinor,
    currency,
    provider: providerName,
    status: 'pending',
    expiresAt: booking.expiresAt,
  })

  const initResult = await getPaymentProvider(providerName).initiatePayment({ payment })
  const attemptNumber = (await bookRepo.countPaymentAttempts(payment._id)) + 1
  await bookRepo.createPaymentAttempt({
    paymentId: payment._id,
    attemptNumber,
    status: 'pending',
    providerReference: initResult.providerReference,
    rawProviderResponse: initResult.raw,
  })
  if (initResult.providerReference) {
    payment = await bookRepo.updatePayment(payment._id, {
      providerPaymentId: initResult.providerReference,
    })
  }
  await bookRepo.updateBooking(booking._id, { paymentId: payment._id })
  return { payment, idempotent: false }
}

export async function confirmV2BookingPrisma(booking) {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'confirmed') {
    return { booking, idempotent: true }
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot confirm booking in status ${booking.status}`, 409)
  }
  assertV2Transition(booking.status, 'confirmed')

  const updated = await bookRepo.updateBookingIfStatus(booking._id, 'payment_pending', {
    status: 'confirmed',
    confirmedAt: new Date(),
    inventoryReserved: true,
    fulfillmentStatus: 'confirmed',
    fulfillmentConfirmedAt: new Date(),
  })
  if (updated) return { booking: updated, idempotent: false }

  const current = await bookRepo.findBookingById(booking._id)
  if (current?.status === 'confirmed') {
    return { booking: current, idempotent: true }
  }
  throw new AppError('Booking confirmation conflict', 409)
}

export async function markV2BookingFailedPrisma(booking, reason = 'failed') {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'failed') {
    return { booking, idempotent: true }
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot fail booking in status ${booking.status}`, 409)
  }
  const updated = await bookRepo.updateBooking(booking._id, {
    status: 'failed',
    cancellationReason: reason,
    inventoryReserved: false,
  })
  return { booking: updated, idempotent: false }
}

export async function expireV2BookingPrisma(booking) {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'expired') {
    return { booking, released: false, idempotent: true }
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot expire booking in status ${booking.status}`, 409)
  }
  assertV2Transition(booking.status, 'expired')

  const releaseResult = await releaseForBookingPrisma({
    bookingId: booking._id,
    reason: 'expired',
    targetStatus: 'expired',
  })

  const updated = await bookRepo.updateBooking(booking._id, {
    status: 'expired',
    cancelledAt: booking.cancelledAt || new Date(),
    cancellationReason: booking.cancellationReason || 'expired',
    inventoryReserved: false,
  })
  return { booking: updated, released: releaseResult.released, idempotent: false }
}

export async function cancelV2BookingPrisma(
  booking,
  { reason = 'customer_cancelled', actorRole = 'user' } = {}
) {
  void actorRole
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'cancelled') {
    return { booking, released: false, idempotent: true }
  }
  if (booking.status === 'expired') {
    throw new AppError('Booking has already expired', 409)
  }

  const hold = await depInv.findHoldByBooking(booking._id)
  if (hold?.status === 'consumed') {
    throw new AppError('Confirmed bookings cannot be cancelled through this flow', 409)
  }

  if (booking.status === 'payment_pending') {
    assertV2Transition(booking.status, 'cancelled')
    const releaseResult = await releaseForBookingPrisma({
      bookingId: booking._id,
      reason,
      targetStatus: 'released',
    })
    const updated = await bookRepo.updateBooking(booking._id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
      inventoryReserved: false,
      fulfillmentStatus: 'cancelled',
    })
    return { booking: updated, released: releaseResult.released, idempotent: false }
  }

  throw new AppError(`Cannot cancel booking in status ${booking.status}`, 409)
}

export async function cancelBookingForUserPrisma(booking, user, { reason } = {}) {
  const ownerId = booking.user?.toString?.() ?? String(booking.user)
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'

  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to cancel this booking', 403)
  }

  if (isV2BookingFlow(booking)) {
    if (['confirmed', 'partially_refunded'].includes(booking.status)) {
      throw new AppError(
        'Paid bookings must be cancelled through the refund cancellation flow',
        409
      )
    }
    return cancelV2BookingPrisma(booking, {
      reason: reason || (isAdmin ? 'admin_cancelled' : 'customer_cancelled'),
      actorRole: user.role,
    })
  }

  if (!isOwner) {
    throw new AppError('You do not have permission to cancel this booking', 403)
  }

  if (booking.status === 'cancelled') {
    throw new AppError('Booking is already cancelled', 400)
  }
  if (booking.status === 'completed') {
    throw new AppError('Completed bookings cannot be cancelled', 400)
  }
  const updated = await bookRepo.updateBooking(booking._id, {
    status: 'cancelled',
    cancelledAt: new Date(),
  })
  return { booking: updated, idempotent: false }
}

function notifyBookingConfirmed(booking, payment) {
  const to = booking.contactInfo?.email
  if (!to) return
  const snap = booking.priceSnapshot || {}
  const ref = String(booking._id).slice(-8).toUpperCase()
  const total = `${((payment.amountMinor || 0) / 100).toFixed(2)} ${payment.currency || 'ETB'}`
  const item = snap.tourTitle || snap.hotelName || snap.transportName || `${booking.bookingType || ''} booking`
  const link = `${String(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/bookings/${booking._id}`
  sendEmailInBackground({
    email: to,
    subject: `Booking confirmed — ${ref}`,
    message: `Your booking ${ref} (${item}) is confirmed. Amount paid: ${total}. View it at ${link}`,
  })
}

export async function finalizeSuccessfulPaymentPrisma({ payment, booking }) {
  await finalizeForBookingPrisma({ bookingId: booking._id })
  const confirmedBooking = await confirmV2BookingPrisma(booking)
  if (!confirmedBooking.idempotent) notifyBookingConfirmed(confirmedBooking.booking || booking, payment)
  let updatedPayment = payment

  if (payment.status === 'pending' || payment.status === 'processing') {
    updatedPayment =
      (await bookRepo.updatePaymentIfStatus(payment._id, payment.status, {
        status: 'completed',
        completedAt: payment.completedAt || new Date(),
      })) || (await bookRepo.findPaymentById(payment._id))
  } else if (!payment.completedAt) {
    updatedPayment = await bookRepo.updatePayment(payment._id, {
      completedAt: new Date(),
    })
  }

  return {
    payment: updatedPayment,
    booking: confirmedBooking.booking,
    idempotent: confirmedBooking.idempotent,
  }
}

export async function handlePaymentFailurePrisma({
  payment,
  booking,
  providerResult,
  attemptNumber,
}) {
  const failedPayment = await bookRepo.updatePaymentIfStatus(
    payment._id,
    ['pending', 'processing'],
    {
      status: 'failed',
      providerPaymentId:
        providerResult?.providerReference || payment.providerPaymentId || null,
    }
  )

  if (!failedPayment) {
    const current = await bookRepo.findPaymentById(payment._id)
    if (current?.status === 'failed') {
      return { payment: current, booking, idempotent: true, failed: true }
    }
    throw new AppError('Payment failure transition conflict', 409)
  }

  await recordAttemptPrisma({
    payment: failedPayment,
    attemptNumber,
    status: 'failed',
    providerReference: providerResult?.providerReference,
    failureCode: providerResult?.failureCode,
    failureMessage: providerResult?.failureMessage,
    raw: providerResult?.raw,
  })

  if (booking.status === 'payment_pending') {
    await releaseForBookingPrisma({
      bookingId: booking._id,
      reason: 'payment_failed',
      targetStatus: 'released',
    })
    await markV2BookingFailedPrisma(booking, 'payment_failed')
  }

  const refreshedBooking = await bookRepo.findBookingById(booking._id)
  return {
    payment: failedPayment,
    booking: refreshedBooking,
    idempotent: false,
    failed: true,
  }
}

export async function loadPaymentContextPrisma(paymentId) {
  if (!isObjectIdCompat(paymentId)) {
    throw new AppError('Payment not found', 404)
  }
  const payment = await bookRepo.findPaymentById(paymentId)
  if (!payment) throw new AppError('Payment not found', 404)

  const booking = await bookRepo.findBookingById(payment.bookingId)
  if (!booking) throw new AppError('Payment not found', 404)

  return { payment, booking }
}

export async function getPaymentForUserPrisma(paymentId, user) {
  const { payment, booking } = await loadPaymentContextPrisma(paymentId)
  assertUserCanAccessPaymentLocal({ payment, booking, user })
  assertBookingPaymentIntegrity(booking, payment)
  return { payment, booking }
}

export async function cancelStalePaymentPrisma(payment, { reason = 'expired' } = {}) {
  if (
    payment.status === 'completed' ||
    payment.status === 'failed' ||
    payment.status === 'cancelled'
  ) {
    return { payment, idempotent: true }
  }

  const cancelled = await bookRepo.updatePaymentIfStatus(
    payment._id,
    ['pending', 'processing'],
    { status: 'cancelled' }
  )
  if (cancelled) return { payment: cancelled, idempotent: false, reason }

  const current = await bookRepo.findPaymentById(payment._id)
  return { payment: current, idempotent: true, reason }
}

export async function applyProviderPaymentSuccessPrisma({
  payment,
  booking,
  providerReference,
  source = 'provider',
}) {
  assertBookingPaymentIntegrity(booking, payment)

  if (booking.status === 'expired' || booking.status === 'cancelled') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_completed_after_booking_terminal',
    }
  }

  if (
    booking.expiresAt &&
    new Date(booking.expiresAt) <= new Date() &&
    booking.status === 'payment_pending'
  ) {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_completed_after_booking_expired',
    }
  }

  if (payment.status === 'completed') {
    if (booking.status === 'payment_pending') {
      const reconciled = await finalizeSuccessfulPaymentPrisma({ payment, booking })
      return { ...reconciled, idempotent: reconciled.idempotent, flagged: false }
    }
    return { payment, booking, idempotent: true, flagged: false }
  }

  if (payment.status === 'failed' || payment.status === 'cancelled') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_completed_while_payment_terminal',
    }
  }

  if (booking.status !== 'payment_pending') {
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      return { payment, booking, idempotent: true, flagged: false }
    }
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: `payment_success_booking_${booking.status}`,
    }
  }

  let completed = payment
  if (payment.status === 'pending' || payment.status === 'processing') {
    const fromStatus = payment.status
    completed = await bookRepo.updatePaymentIfStatus(payment._id, fromStatus, {
      status: 'completed',
      providerPaymentId: providerReference || payment.providerPaymentId,
      completedAt: new Date(),
    })

    if (!completed) {
      const current = await bookRepo.findPaymentById(payment._id)
      if (current?.status === 'completed') {
        return applyProviderPaymentSuccessPrisma({
          payment: current,
          booking,
          providerReference,
          source,
        })
      }
      throw new AppError('Payment completion conflict', 409)
    }

    const attemptNumber = await nextAttemptNumberPrisma(completed._id)
    await recordAttemptPrisma({
      payment: completed,
      attemptNumber,
      status: 'succeeded',
      providerReference: providerReference || completed.providerPaymentId,
      raw: { provider: completed.provider, source, outcome: 'success' },
    })
  }

  const result = await finalizeSuccessfulPaymentPrisma({ payment: completed, booking })
  return { ...result, idempotent: false, flagged: false }
}

export async function applyProviderPaymentFailurePrisma({
  payment,
  booking,
  providerReference,
  failureCode = 'PROVIDER_DECLINED',
  failureMessage = 'Payment failed',
  source = 'provider',
}) {
  if (payment.status === 'failed') {
    if (booking.status === 'payment_pending') {
      await releaseForBookingPrisma({
        bookingId: booking._id,
        reason: 'payment_failed',
        targetStatus: 'released',
      })
      await markV2BookingFailedPrisma(booking, 'payment_failed')
      const refreshed = await bookRepo.findBookingById(booking._id)
      return { payment, booking: refreshed, idempotent: true, failed: true }
    }
    return { payment, booking, idempotent: true, failed: true }
  }

  if (payment.status === 'completed') {
    return {
      payment,
      booking,
      idempotent: false,
      flagged: true,
      flagReason: 'payment_failure_after_completion',
    }
  }

  const attemptNumber = await nextAttemptNumberPrisma(payment._id)
  return handlePaymentFailurePrisma({
    payment,
    booking,
    providerResult: {
      success: false,
      providerReference,
      failureCode,
      failureMessage,
      raw: { provider: payment.provider, source, outcome: 'fail' },
    },
    attemptNumber,
  })
}

/**
 * Confirm a mock payment — idempotent, owner/admin only (Prisma path).
 */
export async function confirmPaymentForUserPrisma({
  paymentId,
  user,
  body = {},
  idempotencyKey = null,
  mockOutcome = 'success',
}) {
  rejectConfirmBodyFields(body)
  const confirmKey = validatePaymentIdempotencyKeyLocal(idempotencyKey)

  const { payment, booking } = await loadPaymentContextPrisma(paymentId)
  assertUserCanAccessPaymentLocal({ payment, booking, user })
  assertBookingPaymentIntegrity(booking, payment)

  // Direct confirmation is a mock-provider (demo/test) feature only. Real
  // providers are confirmed exclusively through server-side verification.
  if (payment.provider !== 'mock') {
    throw new AppError(
      'This payment must be completed through checkout; it cannot be confirmed directly',
      409
    )
  }
  if (!isMockPaymentAllowed()) {
    throw new AppError('Demo payments are disabled on this server', 403)
  }

  if (confirmKey && payment.idempotencyKey && payment.idempotencyKey !== confirmKey) {
    throw new AppError(
      'Idempotency-Key was already used with a different confirmation request',
      409
    )
  }

  if (payment.status === 'completed') {
    if (booking.status === 'payment_pending') {
      const reconciled = await finalizeSuccessfulPaymentPrisma({ payment, booking })
      return { ...reconciled, idempotent: true }
    }
    const refreshed = await bookRepo.findBookingById(booking._id)
    return { payment, booking: refreshed, idempotent: true, failed: false }
  }

  if (payment.status === 'failed') {
    throw new AppError('Payment has failed and cannot be confirmed', 409)
  }

  const payableState = assertBookingPayable(booking)
  if (payableState === 'already_confirmed') {
    throw new AppError('Booking is already confirmed', 409)
  }

  const processing = await bookRepo.updatePaymentIfStatus(payment._id, 'pending', {
    status: 'processing',
    ...(confirmKey ? { idempotencyKey: confirmKey } : {}),
  })

  if (!processing) {
    const current = await bookRepo.findPaymentById(payment._id)
    if (current?.status === 'completed') {
      return confirmPaymentForUserPrisma({
        paymentId,
        user,
        body,
        idempotencyKey,
        mockOutcome,
      })
    }
    if (current?.status === 'processing') {
      throw new AppError('Payment confirmation already in progress', 409)
    }
    throw new AppError('Payment cannot be confirmed', 409)
  }

  const attemptNumber = await nextAttemptNumberPrisma(processing._id)
  const providerResult = await mockProvider.confirmPayment({
    payment: processing,
    mockOutcome,
  })

  if (!providerResult.success) {
    return handlePaymentFailurePrisma({
      payment: processing,
      booking,
      providerResult,
      attemptNumber,
    })
  }

  const completed = await bookRepo.updatePaymentIfStatus(processing._id, 'processing', {
    status: 'completed',
    providerPaymentId: providerResult.providerReference,
    completedAt: new Date(),
  })

  if (!completed) {
    const current = await bookRepo.findPaymentById(processing._id)
    if (current?.status === 'completed') {
      return confirmPaymentForUserPrisma({
        paymentId,
        user,
        body,
        idempotencyKey,
        mockOutcome,
      })
    }
    throw new AppError('Payment completion conflict', 409)
  }

  await recordAttemptPrisma({
    payment: completed,
    attemptNumber,
    status: 'succeeded',
    providerReference: providerResult.providerReference,
    raw: providerResult.raw,
  })

  try {
    const result = await finalizeSuccessfulPaymentPrisma({ payment: completed, booking })
    return { ...result, idempotent: false, failed: false }
  } catch (err) {
    throw new AppError(
      err.message || 'Payment completed but booking confirmation failed; retry confirmation',
      409
    )
  }
}

export async function createAuditPrisma(data) {
  return bookRepo.createAudit(data)
}

export async function createProviderNotePrisma(data) {
  return bookRepo.createProviderNote(data)
}

export async function createWebhookEventPrisma(data) {
  try {
    return await bookRepo.createWebhookEvent(data)
  } catch (err) {
    if (err.existing) return { event: err.existing, duplicate: true }
    throw err
  }
}

export default {
  loadBookableDepartureContextPrisma,
  loadPublicBookableContextPrisma,
  reserveForBookingPrisma,
  releaseForBookingPrisma,
  finalizeForBookingPrisma,
  restoreConsumedForBookingPrisma,
  createTourBookingPrisma,
  createHotelBookingPrisma,
  createTransportBookingPrisma,
  reserveHotelForBookingPrisma,
  reserveTransportForBookingPrisma,
  createPaymentForBookingPrisma,
  finalizeSuccessfulPaymentPrisma,
  handlePaymentFailurePrisma,
  loadPaymentContextPrisma,
  getPaymentForUserPrisma,
  confirmPaymentForUserPrisma,
  cancelStalePaymentPrisma,
  applyProviderPaymentSuccessPrisma,
  applyProviderPaymentFailurePrisma,
  confirmV2BookingPrisma,
  markV2BookingFailedPrisma,
  expireV2BookingPrisma,
  cancelV2BookingPrisma,
  cancelBookingForUserPrisma,
  isOrganizationPubliclyVisiblePrisma,
  createAuditPrisma,
  createProviderNotePrisma,
  createWebhookEventPrisma,
}
