import crypto from 'crypto'
import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import Organization from '../models/Organization.js'
import AppError from '../utils/appError.js'
import {
  getPaymentPendingMinutes,
  getMaxBookingQuantity,
} from '../config/booking.js'
import { loadBookableDepartureContext, reserveForBooking } from './bookingInventoryService.js'
import { getApprovedVersion } from './organizationVersionService.js'
import { buildPriceSnapshot } from './tourPricingService.js'
import { markV2BookingFailed, serializeV2Booking } from './bookingLifecycleService.js'
import { createPaymentForBooking, serializePayment } from './paymentService.js'

const IDEMPOTENCY_KEY_MIN = 8
const IDEMPOTENCY_KEY_MAX = 128
const IDEMPOTENCY_KEY_PATTERN = /^[\w-]+$/

const CONTACT_ALLOWLIST = ['fullName', 'email', 'phone', 'address']

export function validateIdempotencyKey(key) {
  if (key == null || typeof key !== 'string') {
    throw new AppError('Idempotency-Key header is required', 400)
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

export function parseContactInfo(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError('contactInfo is required', 400)
  }

  const contactInfo = {}
  for (const key of Object.keys(raw)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      continue
    }
    if (!CONTACT_ALLOWLIST.includes(key)) continue
    if (raw[key] != null) contactInfo[key] = String(raw[key]).trim()
  }

  if (!contactInfo.fullName) {
    throw new AppError('contactInfo.fullName is required', 400)
  }
  if (!contactInfo.email) {
    throw new AppError('contactInfo.email is required', 400)
  }
  if (!contactInfo.phone) {
    throw new AppError('contactInfo.phone is required', 400)
  }

  return contactInfo
}

export function buildRequestFingerprint({ departureId, packageKey, quantity, contactInfo }) {
  const payload = {
    departureId: String(departureId),
    packageKey: String(packageKey).trim().toLowerCase(),
    quantity: Number(quantity),
    contactInfo: {
      fullName: contactInfo.fullName,
      email: contactInfo.email.toLowerCase(),
      phone: contactInfo.phone,
      address: contactInfo.address || '',
    },
  }
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function fingerprintFromBooking(booking) {
  return buildRequestFingerprint({
    departureId: booking.departureId,
    packageKey: booking.packageKey,
    quantity: booking.inventoryQuantity,
    contactInfo: booking.contactInfo,
  })
}

export async function loadPublicBookableContext(departureId) {
  const { departure, tour } = await loadBookableDepartureContext(departureId)

  if (!tour.organizationId) {
    throw new AppError('Tour is not available for booking', 404)
  }

  const organization = await Organization.findOne({
    _id: tour.organizationId,
    ...Organization.publicMarketplaceFilter(),
  })
  if (!organization) {
    throw new AppError('Tour is not available for booking', 404)
  }

  const approvedVersion = await getApprovedVersion(organization)
  if (!approvedVersion || approvedVersion.status !== 'approved') {
    throw new AppError('Tour is not available for booking', 404)
  }

  if (
    departure.organizationId?.toString() !== tour.organizationId?.toString() ||
    departure.tourId?.toString() !== tour._id?.toString()
  ) {
    throw new AppError('Departure does not match tour', 403)
  }

  return { departure, tour, organization, approvedVersion }
}

async function findIdempotentBooking(userId, idempotencyKey) {
  return Booking.findOne({
    user: userId,
    idempotencyKey,
    bookingFlowVersion: 'v2',
  }).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
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
  if (!key) {
    throw new AppError('packageKey is required', 400)
  }
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
    if (body[field] !== undefined) {
      throw new AppError(`Field ${field} is not allowed in the request body`, 400)
    }
  }
}

/**
 * Create a v2 tour departure booking with server-side pricing and inventory reservation.
 */
export async function createTourBooking({ userId, body, idempotencyKey }) {
  rejectProtectedFields(body || {})

  const key = validateIdempotencyKey(idempotencyKey)

  if (!mongoose.Types.ObjectId.isValid(body?.departureId)) {
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

  const existing = await findIdempotentBooking(userId, key)
  if (existing) {
    const existingFingerprint = fingerprintFromBooking(existing)
    if (existingFingerprint !== fingerprint) {
      throw new AppError(
        'Idempotency-Key was already used with a different request payload',
        409
      )
    }
    let payment = null
    if (existing.paymentId) {
      payment = (await createPaymentForBooking(existing)).payment
    }
    return { booking: existing, payment, idempotent: true }
  }

  const { departure, tour, organization, approvedVersion } =
    await loadPublicBookableContext(body.departureId)

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

  let booking
  try {
    booking = await Booking.create({
      user: userId,
      bookingFlowVersion: 'v2',
      bookingType: 'tour',
      bookingItem: tour._id,
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
    if (err?.code === 11000) {
      const raced = await findIdempotentBooking(userId, key)
      if (raced) {
        const racedFingerprint = fingerprintFromBooking(raced)
        if (racedFingerprint !== fingerprint) {
          throw new AppError(
            'Idempotency-Key was already used with a different request payload',
            409
          )
        }
        return { booking: raced, payment: raced.paymentId ? (await createPaymentForBooking(raced)).payment : null, idempotent: true }
      }
    }
    throw err
  }

  try {
    await reserveForBooking({
      bookingId: booking._id,
      departureId: departure._id,
      quantity,
      expiresAt,
    })
  } catch (err) {
    await markV2BookingFailed(booking, 'inventory_reservation_failed')
    throw err
  }

  const refreshed = await Booking.findById(booking._id).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  const { payment } = await createPaymentForBooking(refreshed)

  const bookingWithPayment = await Booking.findById(booking._id).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  return {
    booking: bookingWithPayment,
    payment,
    idempotent: false,
  }
}

export function formatTourBookingResponse(booking, payment = null) {
  const payload = serializeV2Booking(booking)
  if (payment) {
    payload.payment = serializePayment(payment)
  } else if (booking.paymentId) {
    payload.paymentId = booking.paymentId
  }
  return payload
}

export default {
  validateIdempotencyKey,
  parseContactInfo,
  buildRequestFingerprint,
  loadPublicBookableContext,
  createTourBooking,
  formatTourBookingResponse,
}
