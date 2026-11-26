import prisma from '../../config/prisma.js'
import AppError from '../../utils/appError.js'
import { generateObjectId } from '../../utils/objectId.js'
import { toApiDoc } from '../../utils/prismaSerialize.js'

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

/** Normalize to UTC calendar date (YYYY-MM-DD → Date @ midnight UTC). */
export function toInventoryDate(value) {
  const str = String(value || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!m) {
    throw new AppError('date must be YYYY-MM-DD', 400)
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new AppError('Invalid calendar date', 400)
  }
  return dt
}

export function dateToYmd(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().slice(0, 10)
}

export async function listInventory({
  hotelId,
  organizationId,
  from,
  to,
  roomTypeKey,
} = {}) {
  const where = {}
  if (hotelId) where.hotelId = String(hotelId)
  if (organizationId) where.organizationId = String(organizationId)
  if (roomTypeKey) where.roomTypeKey = String(roomTypeKey)
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = toInventoryDate(from)
    if (to) where.date.lte = toInventoryDate(to)
  }
  const rows = await prisma.hotelDailyInventory.findMany({
    where,
    orderBy: [{ date: 'asc' }, { roomTypeKey: 'asc' }],
  })
  return rows.map(toApiInventory)
}

export async function findInventoryById(id) {
  const row = await prisma.hotelDailyInventory.findUnique({
    where: { id: String(id) },
  })
  return toApiInventory(row)
}

export async function upsertInventoryDay({
  hotelId,
  organizationId,
  roomTypeKey,
  date,
  totalRooms,
  availableRooms,
  reservedRooms = 0,
  priceOverrideMinor = null,
  currency = null,
}) {
  const day = toInventoryDate(date)
  const data = {
    totalRooms,
    availableRooms,
    reservedRooms,
    priceOverrideMinor,
    currency,
    organizationId: String(organizationId),
  }
  const row = await prisma.hotelDailyInventory.upsert({
    where: {
      hotelId_roomTypeKey_date: {
        hotelId: String(hotelId),
        roomTypeKey: String(roomTypeKey),
        date: day,
      },
    },
    create: {
      id: generateObjectId(),
      hotelId: String(hotelId),
      organizationId: String(organizationId),
      roomTypeKey: String(roomTypeKey),
      date: day,
      ...data,
    },
    update: data,
  })
  return toApiInventory(row)
}

export async function updateInventoryById(id, updates) {
  try {
    const row = await prisma.hotelDailyInventory.update({
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
 * Atomic multi-night reserve for one room type.
 * All nights succeed or the transaction rolls back (no partial holds).
 */
export async function reserveNightsAtomic({
  hotelId,
  roomTypeKey,
  dates,
  quantity,
}) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  if (!Array.isArray(dates) || dates.length < 1) {
    throw new AppError('At least one night is required', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = []
    for (const day of dates) {
      const date = toInventoryDate(day)
      const rows = await tx.$queryRaw`
        UPDATE "hotel_daily_inventories"
        SET "availableRooms" = "availableRooms" - ${quantity},
            "reservedRooms" = "reservedRooms" + ${quantity},
            "updatedAt" = NOW()
        WHERE "hotelId" = ${String(hotelId)}
          AND "roomTypeKey" = ${String(roomTypeKey)}
          AND "date" = ${date}
          AND "availableRooms" >= ${quantity}
        RETURNING *
      `
      if (!rows?.length) {
        throw new AppError(
          `Not enough available rooms for ${String(day).slice(0, 10)}`,
          409
        )
      }
      updated.push(toApiInventory(rows[0]))
    }
    return updated
  })
}

/**
 * Atomic multi-night release (idempotent-safe caller must ensure once).
 */
export async function releaseNightsAtomic({
  hotelId,
  roomTypeKey,
  dates,
  quantity,
}) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  if (!Array.isArray(dates) || dates.length < 1) {
    throw new AppError('At least one night is required', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = []
    for (const day of dates) {
      const date = toInventoryDate(day)
      const rows = await tx.$queryRaw`
        UPDATE "hotel_daily_inventories"
        SET "availableRooms" = LEAST("availableRooms" + ${quantity}, "totalRooms"),
            "reservedRooms" = GREATEST("reservedRooms" - ${quantity}, 0),
            "updatedAt" = NOW()
        WHERE "hotelId" = ${String(hotelId)}
          AND "roomTypeKey" = ${String(roomTypeKey)}
          AND "date" = ${date}
        RETURNING *
      `
      if (!rows?.length) {
        throw new AppError(
          `Inventory row missing for release on ${String(day).slice(0, 10)}`,
          404
        )
      }
      updated.push(toApiInventory(rows[0]))
    }
    return updated
  })
}

/**
 * Atomic reserve — conditional UPDATE like TourDeparture CAS.
 */
export async function reserveRoomsAtomic(inventoryId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "hotel_daily_inventories"
      SET "availableRooms" = "availableRooms" - ${quantity},
          "reservedRooms" = "reservedRooms" + ${quantity},
          "updatedAt" = NOW()
      WHERE id = ${String(inventoryId)}
        AND "availableRooms" >= ${quantity}
      RETURNING *
    `
    if (!rows?.length) {
      throw new AppError('Not enough available rooms', 409)
    }
    return toApiInventory(rows[0])
  })
}

export async function releaseRoomsAtomic(inventoryId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "hotel_daily_inventories"
      SET "availableRooms" = LEAST("availableRooms" + ${quantity}, "totalRooms"),
          "reservedRooms" = GREATEST("reservedRooms" - ${quantity}, 0),
          "updatedAt" = NOW()
      WHERE id = ${String(inventoryId)}
      RETURNING *
    `
    if (!rows?.length) throw new AppError('Inventory not found', 404)
    return toApiInventory(rows[0])
  })
}

export async function countInventoryStats(organizationId) {
  const orgId = String(organizationId)
  const [inventoryDayCount, lowAvailabilityDayCount] = await Promise.all([
    prisma.hotelDailyInventory.count({ where: { organizationId: orgId } }),
    prisma.hotelDailyInventory.count({
      where: { organizationId: orgId, availableRooms: { lte: 2 } },
    }),
  ])
  return { inventoryDayCount, lowAvailabilityDayCount }
}

export default {
  toInventoryDate,
  dateToYmd,
  listInventory,
  findInventoryById,
  upsertInventoryDay,
  updateInventoryById,
  reserveRoomsAtomic,
  releaseRoomsAtomic,
  reserveNightsAtomic,
  releaseNightsAtomic,
  countInventoryStats,
}
