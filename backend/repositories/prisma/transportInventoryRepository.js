import prisma from '../../config/prisma.js'
import AppError from '../../utils/appError.js'
import { generateObjectId } from '../../utils/objectId.js'
import { toApiDoc } from '../../utils/prismaSerialize.js'
import {
  toInventoryDate,
  dateToYmd,
} from './hotelInventoryRepository.js'

export { toInventoryDate, dateToYmd }

function toApiInventory(row) {
  if (!row) return null
  const doc = toApiDoc(row)
  if (doc.date instanceof Date) {
    doc.date = doc.date.toISOString().slice(0, 10)
  } else if (doc.date) {
    doc.date = String(doc.date).slice(0, 10)
  }
  return doc
}

export async function listInventory({
  transportId,
  organizationId,
  from,
  to,
  routeKey,
} = {}) {
  const where = {}
  if (transportId) where.transportId = String(transportId)
  if (organizationId) where.organizationId = String(organizationId)
  if (routeKey) where.routeKey = String(routeKey)
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = toInventoryDate(from)
    if (to) where.date.lte = toInventoryDate(to)
  }
  const rows = await prisma.transportRouteInventory.findMany({
    where,
    orderBy: [{ date: 'asc' }, { routeKey: 'asc' }],
  })
  return rows.map(toApiInventory)
}

export async function findInventoryById(id) {
  const row = await prisma.transportRouteInventory.findUnique({
    where: { id: String(id) },
  })
  return toApiInventory(row)
}

export async function findInventoryDay({ transportId, routeKey, date }) {
  const row = await prisma.transportRouteInventory.findUnique({
    where: {
      transportId_routeKey_date: {
        transportId: String(transportId),
        routeKey: String(routeKey),
        date: toInventoryDate(date),
      },
    },
  })
  return toApiInventory(row)
}

export async function upsertInventoryDay({
  transportId,
  organizationId,
  routeKey,
  date,
  totalSeats,
  availableSeats,
  reservedSeats = 0,
  priceOverrideMinor = null,
  currency = null,
}) {
  const day = toInventoryDate(date)
  const data = {
    totalSeats,
    availableSeats,
    reservedSeats,
    priceOverrideMinor,
    currency,
    organizationId: String(organizationId),
  }
  const row = await prisma.transportRouteInventory.upsert({
    where: {
      transportId_routeKey_date: {
        transportId: String(transportId),
        routeKey: String(routeKey),
        date: day,
      },
    },
    create: {
      id: generateObjectId(),
      transportId: String(transportId),
      organizationId: String(organizationId),
      routeKey: String(routeKey),
      date: day,
      ...data,
    },
    update: data,
  })
  return toApiInventory(row)
}

export async function updateInventoryById(id, updates) {
  try {
    const row = await prisma.transportRouteInventory.update({
      where: { id: String(id) },
      data: updates,
    })
    return toApiInventory(row)
  } catch (err) {
    if (err?.code === 'P2025') return null
    throw err
  }
}

/**
 * Atomic seat reserve — conditional UPDATE (CAS).
 */
export async function reserveSeatsAtomic({
  transportId,
  routeKey,
  date,
  quantity,
}) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  const day = toInventoryDate(date)
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "transport_route_inventories"
      SET "availableSeats" = "availableSeats" - ${quantity},
          "reservedSeats" = "reservedSeats" + ${quantity},
          "updatedAt" = NOW()
      WHERE "transportId" = ${String(transportId)}
        AND "routeKey" = ${String(routeKey)}
        AND "date" = ${day}
        AND "availableSeats" >= ${quantity}
      RETURNING *
    `
    if (!rows?.length) {
      throw new AppError(
        `Not enough available seats for ${String(date).slice(0, 10)}`,
        409
      )
    }
    return toApiInventory(rows[0])
  })
}

/**
 * Atomic seat release.
 */
export async function releaseSeatsAtomic({
  transportId,
  routeKey,
  date,
  quantity,
}) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  const day = toInventoryDate(date)
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "transport_route_inventories"
      SET "availableSeats" = LEAST("availableSeats" + ${quantity}, "totalSeats"),
          "reservedSeats" = GREATEST("reservedSeats" - ${quantity}, 0),
          "updatedAt" = NOW()
      WHERE "transportId" = ${String(transportId)}
        AND "routeKey" = ${String(routeKey)}
        AND "date" = ${day}
      RETURNING *
    `
    if (!rows?.length) {
      throw new AppError(
        `Inventory row missing for release on ${String(date).slice(0, 10)}`,
        404
      )
    }
    return toApiInventory(rows[0])
  })
}

export async function countInventoryDays(organizationId) {
  return prisma.transportRouteInventory.count({
    where: { organizationId: String(organizationId) },
  })
}

export default {
  listInventory,
  findInventoryById,
  findInventoryDay,
  upsertInventoryDay,
  updateInventoryById,
  reserveSeatsAtomic,
  releaseSeatsAtomic,
  countInventoryDays,
  toInventoryDate,
  dateToYmd,
}
