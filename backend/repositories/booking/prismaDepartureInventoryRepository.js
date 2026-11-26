import prisma from '../../config/prisma.js'
import AppError from '../../utils/appError.js'
import { generateObjectId } from '../../utils/objectId.js'
import { toApiDeparture, toApiHold } from './bookingSerialize.js'

/**
 * Atomic inventory CAS — equivalent to Mongo findOneAndUpdate $inc with condition.
 * Uses conditional UPDATE … RETURNING inside a transaction.
 */
export async function reserveSpotsAtomic(departureId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "tour_departures"
      SET "availableSpots" = "availableSpots" - ${quantity},
          "updatedAt" = NOW()
      WHERE id = ${String(departureId)}
        AND status = 'open'::"DepartureStatus"
        AND "availableSpots" >= ${quantity}
      RETURNING *
    `
    if (!rows?.length) {
      throw new AppError('Not enough available spots', 409)
    }
    let row = rows[0]
    if (row.availableSpots === 0) {
      row = await tx.tourDeparture.update({
        where: { id: row.id },
        data: { status: 'full' },
      })
    }
    return toApiDeparture(row)
  })
}

export async function releaseSpotsAtomic(departureId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "tour_departures"
      SET "availableSpots" = LEAST("availableSpots" + ${quantity}, capacity),
          "updatedAt" = NOW()
      WHERE id = ${String(departureId)}
      RETURNING *
    `
    if (!rows?.length) throw new AppError('Departure not found', 404)
    let row = rows[0]
    if (row.status === 'full' && row.availableSpots > 0) {
      row = await tx.tourDeparture.update({
        where: { id: row.id },
        data: { status: 'open' },
      })
    }
    return toApiDeparture(row)
  })
}

export async function createDepartureRecord({
  tourId,
  organizationId,
  departureDate,
  returnDate,
  capacity,
  availableSpots,
  status,
  packages,
  notes,
}) {
  const row = await prisma.tourDeparture.create({
    data: {
      id: generateObjectId(),
      tourId: String(tourId),
      organizationId: String(organizationId),
      departureDate,
      returnDate: returnDate || null,
      capacity,
      availableSpots,
      status: status || 'open',
      packages: packages || [],
      notes: notes || '',
    },
  })
  return toApiDeparture(row)
}

export async function findDepartureById(id) {
  const row = await prisma.tourDeparture.findUnique({ where: { id: String(id) } })
  return toApiDeparture(row)
}

export async function findDepartures(filter = {}, { sort = 'departureDate' } = {}) {
  const where = {}
  if (filter.tourId) where.tourId = String(filter.tourId)
  if (filter.organizationId) where.organizationId = String(filter.organizationId)
  if (filter.status) where.status = filter.status
  if (filter.statusIn) where.status = { in: filter.statusIn }

  const orderBy =
    sort.startsWith('-')
      ? { [sort.slice(1)]: 'desc' }
      : { [sort]: 'asc' }

  const rows = await prisma.tourDeparture.findMany({ where, orderBy })
  return rows.map(toApiDeparture)
}

export async function updateDepartureRecord(id, data) {
  const row = await prisma.tourDeparture.update({
    where: { id: String(id) },
    data,
  })
  return toApiDeparture(row)
}

export async function hasActiveHolds(departureId) {
  const count = await prisma.inventoryHold.count({
    where: {
      departureId: String(departureId),
      status: { in: ['held', 'consumed'] },
    },
  })
  return count > 0
}

export async function findActiveHoldForBooking(bookingId) {
  const row = await prisma.inventoryHold.findFirst({
    where: {
      bookingId: String(bookingId),
      status: { in: ['pending', 'held', 'consumed'] },
    },
  })
  return toApiHold(row)
}

export async function findHoldByBooking(bookingId) {
  const row = await prisma.inventoryHold.findFirst({
    where: { bookingId: String(bookingId) },
    orderBy: { createdAt: 'desc' },
  })
  return toApiHold(row)
}

export async function createHold(data) {
  try {
    const row = await prisma.inventoryHold.create({
      data: {
        id: generateObjectId(),
        bookingId: String(data.bookingId),
        departureId: data.departureId ? String(data.departureId) : null,
        hotelId: data.hotelId ? String(data.hotelId) : null,
        roomTypeKey: data.roomTypeKey ? String(data.roomTypeKey) : null,
        nights: data.nights ?? undefined,
        transportId: data.transportId ? String(data.transportId) : null,
        routeKey: data.routeKey ? String(data.routeKey) : null,
        travelDate: data.travelDate
          ? data.travelDate instanceof Date
            ? data.travelDate
            : new Date(`${String(data.travelDate).slice(0, 10)}T00:00:00.000Z`)
          : null,
        organizationId: data.organizationId ? String(data.organizationId) : null,
        quantity: data.quantity,
        status: data.status || 'pending',
        expiresAt: data.expiresAt || null,
      },
    })
    return toApiHold(row)
  } catch (err) {
    if (err?.code === 'P2002') {
      const raced = await findActiveHoldForBooking(data.bookingId)
      if (raced) {
        const e = new Error('Duplicate active hold')
        e.code = 'P2002'
        e.hold = raced
        throw e
      }
    }
    throw err
  }
}

export async function updateHoldIfStatus(id, fromStatuses, data) {
  const result = await prisma.inventoryHold.updateMany({
    where: {
      id: String(id),
      status: Array.isArray(fromStatuses) ? { in: fromStatuses } : fromStatuses,
    },
    data,
  })
  if (result.count === 0) return null
  const row = await prisma.inventoryHold.findUnique({ where: { id: String(id) } })
  return toApiHold(row)
}

export default {
  reserveSpotsAtomic,
  releaseSpotsAtomic,
  createDepartureRecord,
  findDepartureById,
  findDepartures,
  updateDepartureRecord,
  hasActiveHolds,
  findActiveHoldForBooking,
  findHoldByBooking,
  createHold,
  updateHoldIfStatus,
}
