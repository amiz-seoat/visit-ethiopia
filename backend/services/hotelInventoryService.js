import AppError from '../utils/appError.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import * as invRepo from '../repositories/prisma/hotelInventoryRepository.js'
import {
  findHotelRoomType,
  getActiveRoomTypeKeys,
} from './hotelLifecycleService.js'
import { isHotelPubliclyVisible } from './hotelVisibilityService.js'

const MAX_RANGE_DAYS = 90

function assertPrisma() {
  if (!isPrismaApp()) {
    throw new AppError(
      'Hotel inventory is only available in Prisma development mode',
      501
    )
  }
}

function parseStay(checkIn, checkOut) {
  const start = invRepo.toInventoryDate(checkIn)
  const end = invRepo.toInventoryDate(checkOut)
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
    dates.push(invRepo.dateToYmd(d))
  }
  return { start, end, nights, dates }
}

export async function listHotelInventory(hotel, { from, to, roomTypeKey } = {}) {
  assertPrisma()
  return invRepo.listInventory({
    hotelId: hotel._id || hotel.id,
    organizationId: hotel.organizationId,
    from,
    to,
    roomTypeKey,
  })
}

export async function upsertHotelInventory(hotel, body = {}) {
  assertPrisma()
  const roomTypeKey = String(body.roomTypeKey || '').trim().toLowerCase()
  if (!roomTypeKey) throw new AppError('roomTypeKey is required', 400)

  const roomType = findHotelRoomType(hotel, roomTypeKey)
  if (!roomType || roomType.active === false) {
    throw new AppError('roomTypeKey does not match an active hotel room type', 400)
  }

  const totalRooms = Number(body.totalRooms)
  if (!Number.isInteger(totalRooms) || totalRooms < 0) {
    throw new AppError('totalRooms must be a non-negative integer', 400)
  }

  let availableRooms =
    body.availableRooms != null ? Number(body.availableRooms) : totalRooms
  if (!Number.isInteger(availableRooms) || availableRooms < 0) {
    throw new AppError('availableRooms must be a non-negative integer', 400)
  }
  if (availableRooms > totalRooms) {
    throw new AppError('availableRooms cannot exceed totalRooms', 400)
  }

  let reservedRooms =
    body.reservedRooms != null
      ? Number(body.reservedRooms)
      : Math.max(0, totalRooms - availableRooms)
  if (!Number.isInteger(reservedRooms) || reservedRooms < 0) {
    throw new AppError('reservedRooms must be a non-negative integer', 400)
  }
  if (reservedRooms + availableRooms > totalRooms) {
    throw new AppError(
      'reservedRooms + availableRooms cannot exceed totalRooms',
      400
    )
  }

  let priceOverrideMinor = null
  if (body.priceOverrideMinor != null && body.priceOverrideMinor !== '') {
    priceOverrideMinor = Math.round(Number(body.priceOverrideMinor))
    if (!Number.isInteger(priceOverrideMinor) || priceOverrideMinor < 0) {
      throw new AppError('priceOverrideMinor must be a non-negative integer', 400)
    }
  }

  if (!hotel.organizationId) {
    throw new AppError('Hotel must belong to an organization for inventory', 400)
  }

  return invRepo.upsertInventoryDay({
    hotelId: hotel._id || hotel.id,
    organizationId: hotel.organizationId,
    roomTypeKey: roomType.key || roomTypeKey,
    date: body.date,
    totalRooms,
    availableRooms,
    reservedRooms,
    priceOverrideMinor,
    currency: body.currency ? String(body.currency) : roomType.currency || 'ETB',
  })
}

export async function updateHotelInventory(hotel, inventoryId, body = {}) {
  assertPrisma()
  const existing = await invRepo.findInventoryById(inventoryId)
  if (!existing) throw new AppError('Inventory not found', 404)
  if (String(existing.hotelId) !== String(hotel._id || hotel.id)) {
    throw new AppError('Inventory does not belong to this hotel', 403)
  }
  if (
    hotel.organizationId &&
    String(existing.organizationId) !== String(hotel.organizationId)
  ) {
    throw new AppError('Inventory organization mismatch', 403)
  }

  const updates = {}
  if (body.totalRooms != null) {
    const totalRooms = Number(body.totalRooms)
    if (!Number.isInteger(totalRooms) || totalRooms < 0) {
      throw new AppError('totalRooms must be a non-negative integer', 400)
    }
    updates.totalRooms = totalRooms
  }
  if (body.availableRooms != null) {
    const availableRooms = Number(body.availableRooms)
    if (!Number.isInteger(availableRooms) || availableRooms < 0) {
      throw new AppError('availableRooms must be a non-negative integer', 400)
    }
    updates.availableRooms = availableRooms
  }
  if (body.reservedRooms != null) {
    const reservedRooms = Number(body.reservedRooms)
    if (!Number.isInteger(reservedRooms) || reservedRooms < 0) {
      throw new AppError('reservedRooms must be a non-negative integer', 400)
    }
    updates.reservedRooms = reservedRooms
  }
  if (body.priceOverrideMinor !== undefined) {
    if (body.priceOverrideMinor === null || body.priceOverrideMinor === '') {
      updates.priceOverrideMinor = null
    } else {
      const priceOverrideMinor = Math.round(Number(body.priceOverrideMinor))
      if (!Number.isInteger(priceOverrideMinor) || priceOverrideMinor < 0) {
        throw new AppError(
          'priceOverrideMinor must be a non-negative integer',
          400
        )
      }
      updates.priceOverrideMinor = priceOverrideMinor
    }
  }
  if (body.currency !== undefined) {
    updates.currency = body.currency ? String(body.currency) : null
  }

  const nextTotal =
    updates.totalRooms != null ? updates.totalRooms : existing.totalRooms
  const nextAvailable =
    updates.availableRooms != null
      ? updates.availableRooms
      : existing.availableRooms
  const nextReserved =
    updates.reservedRooms != null
      ? updates.reservedRooms
      : existing.reservedRooms
  if (nextAvailable > nextTotal) {
    throw new AppError('availableRooms cannot exceed totalRooms', 400)
  }
  if (nextReserved + nextAvailable > nextTotal) {
    throw new AppError(
      'reservedRooms + availableRooms cannot exceed totalRooms',
      400
    )
  }

  const updated = await invRepo.updateInventoryById(inventoryId, updates)
  if (!updated) throw new AppError('Inventory not found', 404)
  return updated
}

/**
 * Public stay availability: min available rooms across nights for each room type.
 */
export async function getPublicHotelAvailability(hotelId, query = {}) {
  assertPrisma()
  const hotel = await catalogWrite.findHotelById(hotelId)
  if (!hotel || !(await isHotelPubliclyVisible(hotel))) {
    throw new AppError('No document found with that ID', 404)
  }

  const { checkIn, checkOut, roomTypeKey } = query
  if (!checkIn || !checkOut) {
    throw new AppError('checkIn and checkOut are required (YYYY-MM-DD)', 400)
  }
  const { dates, nights } = parseStay(checkIn, checkOut)

  let keys = getActiveRoomTypeKeys(hotel)
  if (roomTypeKey) {
    const rt = findHotelRoomType(hotel, roomTypeKey)
    if (!rt || rt.active === false) {
      throw new AppError('roomTypeKey not found on hotel', 400)
    }
    keys = [rt.key || String(roomTypeKey).toLowerCase()]
  }

  const from = dates[0]
  const to = dates[dates.length - 1]
  const rows = await invRepo.listInventory({
    hotelId: hotel._id || hotel.id,
    from,
    to,
  })

  const byKey = new Map()
  for (const key of keys) {
    byKey.set(key, {
      roomTypeKey: key,
      roomType: findHotelRoomType(hotel, key),
      nights,
      checkIn,
      checkOut,
      available: true,
      minAvailableRooms: null,
      nightsMissingInventory: 0,
      days: [],
    })
  }

  for (const key of keys) {
    const entry = byKey.get(key)
    for (const day of dates) {
      const row = rows.find(
        (r) => r.roomTypeKey === key && String(r.date).slice(0, 10) === day
      )
      if (!row) {
        entry.available = false
        entry.nightsMissingInventory += 1
        entry.days.push({
          date: day,
          availableRooms: 0,
          totalRooms: 0,
          missing: true,
        })
        continue
      }
      entry.days.push({
        date: day,
        availableRooms: row.availableRooms,
        totalRooms: row.totalRooms,
        reservedRooms: row.reservedRooms,
        priceOverrideMinor: row.priceOverrideMinor ?? null,
        currency: row.currency || null,
        missing: false,
      })
      if (row.availableRooms < 1) entry.available = false
      entry.minAvailableRooms =
        entry.minAvailableRooms == null
          ? row.availableRooms
          : Math.min(entry.minAvailableRooms, row.availableRooms)
    }
    if (entry.minAvailableRooms == null) entry.minAvailableRooms = 0
  }

  return {
    hotelId: hotel._id || hotel.id,
    checkIn,
    checkOut,
    nights,
    roomTypes: [...byKey.values()].map((entry) => ({
      roomTypeKey: entry.roomTypeKey,
      name: entry.roomType?.name || entry.roomType?.type || entry.roomTypeKey,
      capacity: entry.roomType?.capacity,
      currency: entry.roomType?.currency || 'ETB',
      price: entry.roomType?.price,
      priceMinor: entry.roomType?.priceMinor,
      available: entry.available,
      minAvailableRooms: entry.minAvailableRooms,
      nightsMissingInventory: entry.nightsMissingInventory,
      days: entry.days,
    })),
  }
}

export async function reserveRoomsForTest(inventoryId, quantity) {
  assertPrisma()
  return invRepo.reserveRoomsAtomic(inventoryId, quantity)
}

export default {
  listHotelInventory,
  upsertHotelInventory,
  updateHotelInventory,
  getPublicHotelAvailability,
  reserveRoomsForTest,
}
