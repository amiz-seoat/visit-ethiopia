import Hotel from '../models/Hotel.js'
import AppError from '../utils/appError.js'
import { assertHotelTransition } from '../config/hotelLifecycle.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import { slugify } from '../utils/slugify.js'

async function transitionHotelStatus(hotel, toStatus) {
  assertHotelTransition(hotel.status, toStatus)

  if (isPrismaApp()) {
    const id = hotel._id || hotel.id
    const updated = await catalogWrite.transitionHotelStatus(
      id,
      hotel.status,
      toStatus
    )
    if (!updated) {
      const err = new Error(
        `Invalid hotel status transition: ${hotel.status} → ${toStatus}`
      )
      err.statusCode = 409
      throw err
    }
    Object.assign(hotel, updated)
    return hotel
  }

  const updated = await Hotel.findOneAndUpdate(
    { _id: hotel._id, status: hotel.status },
    { status: toStatus },
    { new: true, runValidators: true }
  )
  if (!updated) {
    const err = new Error(
      `Invalid hotel status transition: ${hotel.status} → ${toStatus}`
    )
    err.statusCode = 409
    throw err
  }
  Object.assign(hotel, updated.toObject())
  return hotel
}

export async function publishHotel(hotel) {
  return transitionHotelStatus(hotel, 'active')
}

export async function unpublishHotel(hotel) {
  return transitionHotelStatus(hotel, 'inactive')
}

/**
 * Normalize roomTypes JSON for marketplace inventory keys while keeping
 * legacy `type` / `availableRooms` fields for frontend compatibility.
 */
export function normalizeHotelRoomTypes(roomTypes = []) {
  if (!Array.isArray(roomTypes)) {
    throw new AppError('roomTypes must be an array', 400)
  }
  const keys = new Set()
  return roomTypes.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new AppError(`roomTypes[${index}] must be an object`, 400)
    }
    const name = String(raw.name || raw.type || '').trim()
    if (!name) {
      throw new AppError(`roomTypes[${index}] requires name or type`, 400)
    }
    let key = String(raw.key || slugify(name) || `room-${index + 1}`)
      .trim()
      .toLowerCase()
    if (!key) key = `room-${index + 1}`
    if (keys.has(key)) {
      throw new AppError(`Duplicate room type key: ${key}`, 400)
    }
    keys.add(key)

    const capacity = Number(raw.capacity)
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new AppError(
        `roomTypes[${index}].capacity must be a positive integer`,
        400
      )
    }

    let price =
      raw.price != null && raw.price !== '' ? Number(raw.price) : undefined
    let priceMinor =
      raw.priceMinor != null && raw.priceMinor !== ''
        ? Math.round(Number(raw.priceMinor))
        : undefined
    if (price != null && Number.isNaN(price)) {
      throw new AppError(`roomTypes[${index}].price must be a number`, 400)
    }
    if (priceMinor != null && (!Number.isInteger(priceMinor) || priceMinor < 0)) {
      throw new AppError(
        `roomTypes[${index}].priceMinor must be a non-negative integer`,
        400
      )
    }
    if (priceMinor == null && price != null) {
      priceMinor = Math.round(price * 100)
    }
    if (price == null && priceMinor != null) {
      price = priceMinor / 100
    }
    if (price == null) {
      throw new AppError(`roomTypes[${index}] requires price or priceMinor`, 400)
    }

    const availableRooms =
      raw.availableRooms != null ? Number(raw.availableRooms) : 0
    if (!Number.isInteger(availableRooms) || availableRooms < 0) {
      throw new AppError(
        `roomTypes[${index}].availableRooms must be a non-negative integer`,
        400
      )
    }

    return {
      key,
      type: name,
      name,
      description: raw.description != null ? String(raw.description) : '',
      capacity,
      price,
      priceMinor,
      currency: String(raw.currency || 'ETB'),
      amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String) : [],
      images: Array.isArray(raw.images) ? raw.images.map(String) : [],
      availableRooms,
      active: raw.active === false ? false : true,
    }
  })
}

export function getActiveRoomTypeKeys(hotel) {
  const types = Array.isArray(hotel?.roomTypes) ? hotel.roomTypes : []
  return types
    .filter((rt) => rt && rt.active !== false)
    .map((rt) => String(rt.key || slugify(rt.type || rt.name || '')))
    .filter(Boolean)
}

export function findHotelRoomType(hotel, roomTypeKey) {
  const key = String(roomTypeKey || '').toLowerCase()
  const types = Array.isArray(hotel?.roomTypes) ? hotel.roomTypes : []
  return (
    types.find((rt) => String(rt.key || '').toLowerCase() === key) ||
    types.find(
      (rt) => slugify(rt.type || rt.name || '') === key
    ) ||
    null
  )
}

export default {
  publishHotel,
  unpublishHotel,
  normalizeHotelRoomTypes,
  getActiveRoomTypeKeys,
  findHotelRoomType,
}
