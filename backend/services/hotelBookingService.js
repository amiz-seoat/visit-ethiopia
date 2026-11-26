/**
 * Hotel v2 booking — price snapshot, stay parsing, fingerprint.
 * Inventory reservation lives in prismaBookingDomainService (mirrors tours).
 */
import crypto from 'crypto'
import AppError from '../utils/appError.js'
import {
  toInventoryDate,
  dateToYmd,
  listInventory,
} from '../repositories/prisma/hotelInventoryRepository.js'
import {
  findHotelRoomType,
} from './hotelLifecycleService.js'
import { isHotelPubliclyVisible } from './hotelVisibilityService.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import { getOrganizationRepository } from '../repositories/organizations/index.js'
import { isPrismaIdentity } from '../utils/databaseMode.js'

const MAX_RANGE_DAYS = 90

export function parseStayNights(checkIn, checkOut) {
  const start = toInventoryDate(checkIn)
  const end = toInventoryDate(checkOut)
  if (end <= start) {
    throw new AppError('checkOut must be after checkIn', 400)
  }
  const nights = Math.round((end - start) / (24 * 60 * 60 * 1000))
  if (nights < 1) {
    throw new AppError('Stay must include at least one night', 400)
  }
  if (nights > MAX_RANGE_DAYS) {
    throw new AppError(`Date range cannot exceed ${MAX_RANGE_DAYS} nights`, 400)
  }
  const dates = []
  for (let i = 0; i < nights; i += 1) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    dates.push(dateToYmd(d))
  }
  return { checkIn: dateToYmd(start), checkOut: dateToYmd(end), nights: dates, nightsCount: nights }
}

export function parseHotelQuantity(raw) {
  const quantity = Number(raw)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  if (quantity > 20) {
    throw new AppError('quantity cannot exceed 20 rooms', 400)
  }
  return quantity
}

export function buildHotelRequestFingerprint({
  hotelId,
  roomTypeKey,
  checkIn,
  checkOut,
  quantity,
  contactInfo,
}) {
  const payload = {
    hotelId: String(hotelId),
    roomTypeKey: String(roomTypeKey).trim().toLowerCase(),
    checkIn: String(checkIn),
    checkOut: String(checkOut),
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

export function fingerprintFromHotelBooking(booking) {
  const details = booking.bookingDetails || {}
  const snap = booking.priceSnapshot || {}
  return buildHotelRequestFingerprint({
    hotelId: booking.bookingItem || booking.bookingItemId,
    roomTypeKey: details.roomTypeKey || snap.roomTypeKey,
    checkIn: details.checkIn || snap.checkIn,
    checkOut: details.checkOut || snap.checkOut,
    quantity: booking.inventoryQuantity || snap.quantity || details.quantity,
    contactInfo: booking.contactInfo,
  })
}

export async function loadPublicBookableHotel(hotelId) {
  const hotel = await catalogWrite.findHotelById(hotelId)
  if (!hotel || !(await isHotelPubliclyVisible(hotel))) {
    throw new AppError('Hotel is not available for booking', 404)
  }
  let organization = null
  if (hotel.organizationId) {
    if (isPrismaIdentity()) {
      const orgs = getOrganizationRepository()
      organization = await orgs.findOrganizationById(hotel.organizationId)
    }
  }
  return { hotel, organization }
}

/**
 * Build immutable hotel price snapshot from room base + nightly overrides.
 * unitPriceMinor = sum of nightly rates for one room across the stay.
 * totalMinor = unitPriceMinor * quantity.
 */
export async function buildHotelPriceSnapshot({
  hotel,
  organization,
  roomType,
  roomTypeKey,
  checkIn,
  checkOut,
  nights,
  quantity,
}) {
  const rows = await listInventory({
    hotelId: hotel._id || hotel.id,
    roomTypeKey,
    from: nights[0],
    to: nights[nights.length - 1],
  })
  const byDate = new Map(
    rows.map((r) => [String(r.date).slice(0, 10), r])
  )

  const baseMinor =
    roomType.priceMinor != null
      ? Math.round(Number(roomType.priceMinor))
      : Math.round(Number(roomType.price || 0) * 100)
  if (!Number.isInteger(baseMinor) || baseMinor < 0) {
    throw new AppError('Room type price is invalid', 400)
  }

  const currency = String(roomType.currency || 'ETB').toUpperCase()
  const nightlyRates = []
  let unitPriceMinor = 0

  for (const day of nights) {
    const row = byDate.get(day)
    if (!row) {
      throw new AppError(`No inventory for ${day}`, 409)
    }
    if (row.availableRooms < quantity) {
      throw new AppError(`Not enough available rooms for ${day}`, 409)
    }
    let priceMinor = baseMinor
    let source = 'base'
    if (row.priceOverrideMinor != null) {
      priceMinor = Math.round(Number(row.priceOverrideMinor))
      source = 'override'
    }
    if (!Number.isInteger(priceMinor) || priceMinor < 0) {
      throw new AppError(`Invalid nightly price for ${day}`, 400)
    }
    nightlyRates.push({
      date: day,
      priceMinor,
      currency: row.currency || currency,
      source,
      availableRooms: row.availableRooms,
      totalRooms: row.totalRooms,
    })
    unitPriceMinor += priceMinor
  }

  const subtotalMinor = unitPriceMinor * quantity
  const totalMinor = subtotalMinor

  return {
    currency,
    quantity,
    unitPriceMinor,
    subtotalMinor,
    discountMinor: 0,
    feesMinor: 0,
    taxMinor: 0,
    totalMinor,
    hotelId: hotel._id || hotel.id,
    hotelName: hotel.name,
    roomTypeKey,
    roomTypeName: roomType.name || roomType.type || roomTypeKey,
    roomCapacity: roomType.capacity,
    checkIn,
    checkOut,
    nights,
    nightsCount: nights.length,
    nightlyRates,
    organizationId: hotel.organizationId || organization?._id || null,
    organizationName: organization?.name || null,
    organizationSlug: organization?.slug || null,
    pricedFrom: 'hotel_inventory',
    pricedAt: new Date().toISOString(),
    baseRoomPriceMinor: baseMinor,
  }
}

export function assertActiveRoomType(hotel, roomTypeKey) {
  const key = String(roomTypeKey || '')
    .trim()
    .toLowerCase()
  if (!key) throw new AppError('roomTypeKey is required', 400)
  const roomType = findHotelRoomType(hotel, key)
  if (!roomType) throw new AppError('Unknown roomTypeKey', 400)
  if (roomType.active === false) {
    throw new AppError('Room type is inactive', 400)
  }
  return { roomType, roomTypeKey: roomType.key || key }
}

export default {
  parseStayNights,
  parseHotelQuantity,
  buildHotelRequestFingerprint,
  fingerprintFromHotelBooking,
  loadPublicBookableHotel,
  buildHotelPriceSnapshot,
  assertActiveRoomType,
}
