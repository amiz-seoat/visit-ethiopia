import AppError from '../utils/appError.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import * as invRepo from '../repositories/prisma/transportInventoryRepository.js'
import { findTransportRoute } from './transportLifecycleService.js'
import { isTransportPubliclyVisible } from './transportVisibilityService.js'

function assertPrisma() {
  if (!isPrismaApp()) {
    throw new AppError(
      'Transport inventory is only available in Prisma development mode',
      501
    )
  }
}

export async function listTransportInventory(
  transport,
  { from, to, routeKey } = {}
) {
  assertPrisma()
  return invRepo.listInventory({
    transportId: transport._id || transport.id,
    organizationId: transport.organizationId,
    from,
    to,
    routeKey,
  })
}

export async function upsertTransportInventory(transport, body = {}) {
  assertPrisma()
  const routeKey = String(body.routeKey || '').trim().toLowerCase()
  if (!routeKey) throw new AppError('routeKey is required', 400)

  const route = findTransportRoute(transport, routeKey)
  if (!route || route.active === false) {
    throw new AppError('routeKey does not match an active transport route', 400)
  }

  const totalSeats = Number(body.totalSeats)
  if (!Number.isInteger(totalSeats) || totalSeats < 0) {
    throw new AppError('totalSeats must be a non-negative integer', 400)
  }

  let availableSeats =
    body.availableSeats != null ? Number(body.availableSeats) : totalSeats
  if (!Number.isInteger(availableSeats) || availableSeats < 0) {
    throw new AppError('availableSeats must be a non-negative integer', 400)
  }
  if (availableSeats > totalSeats) {
    throw new AppError('availableSeats cannot exceed totalSeats', 400)
  }

  let reservedSeats =
    body.reservedSeats != null
      ? Number(body.reservedSeats)
      : Math.max(0, totalSeats - availableSeats)
  if (!Number.isInteger(reservedSeats) || reservedSeats < 0) {
    throw new AppError('reservedSeats must be a non-negative integer', 400)
  }
  if (reservedSeats + availableSeats > totalSeats) {
    throw new AppError(
      'reservedSeats + availableSeats cannot exceed totalSeats',
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

  if (!transport.organizationId) {
    throw new AppError(
      'Transport must belong to an organization for inventory',
      400
    )
  }

  return invRepo.upsertInventoryDay({
    transportId: transport._id || transport.id,
    organizationId: transport.organizationId,
    routeKey: route.key || routeKey,
    date: body.date,
    totalSeats,
    availableSeats,
    reservedSeats,
    priceOverrideMinor,
    currency: body.currency
      ? String(body.currency)
      : route.currency || 'ETB',
  })
}

export async function updateTransportInventory(transport, inventoryId, body = {}) {
  assertPrisma()
  const existing = await invRepo.findInventoryById(inventoryId)
  if (!existing) throw new AppError('Inventory not found', 404)
  if (String(existing.transportId) !== String(transport._id || transport.id)) {
    throw new AppError('Inventory does not belong to this transport', 403)
  }

  const updates = {}
  if (body.totalSeats != null) {
    const totalSeats = Number(body.totalSeats)
    if (!Number.isInteger(totalSeats) || totalSeats < 0) {
      throw new AppError('totalSeats must be a non-negative integer', 400)
    }
    updates.totalSeats = totalSeats
  }
  if (body.availableSeats != null) {
    const availableSeats = Number(body.availableSeats)
    if (!Number.isInteger(availableSeats) || availableSeats < 0) {
      throw new AppError('availableSeats must be a non-negative integer', 400)
    }
    updates.availableSeats = availableSeats
  }
  if (body.reservedSeats != null) {
    const reservedSeats = Number(body.reservedSeats)
    if (!Number.isInteger(reservedSeats) || reservedSeats < 0) {
      throw new AppError('reservedSeats must be a non-negative integer', 400)
    }
    updates.reservedSeats = reservedSeats
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
  if (body.currency != null) updates.currency = String(body.currency)

  const nextTotal = updates.totalSeats ?? existing.totalSeats
  const nextAvail = updates.availableSeats ?? existing.availableSeats
  const nextReserved = updates.reservedSeats ?? existing.reservedSeats
  if (nextAvail > nextTotal) {
    throw new AppError('availableSeats cannot exceed totalSeats', 400)
  }
  if (nextReserved + nextAvail > nextTotal) {
    throw new AppError(
      'reservedSeats + availableSeats cannot exceed totalSeats',
      400
    )
  }

  const updated = await invRepo.updateInventoryById(inventoryId, updates)
  if (!updated) throw new AppError('Inventory not found', 404)
  return updated
}

export async function getPublicTransportAvailability(transportId, query = {}) {
  assertPrisma()
  const transport = await catalogWrite.findTransportById(transportId)
  if (!transport || !(await isTransportPubliclyVisible(transport))) {
    throw new AppError('Transport is not available', 404)
  }

  const travelDate = query.travelDate || query.date
  if (!travelDate) throw new AppError('travelDate is required (YYYY-MM-DD)', 400)
  invRepo.toInventoryDate(travelDate)

  const routeKey = query.routeKey
    ? String(query.routeKey).trim().toLowerCase()
    : null

  const rows = await invRepo.listInventory({
    transportId: transport._id || transport.id,
    from: travelDate,
    to: travelDate,
    routeKey: routeKey || undefined,
  })

  const routes = Array.isArray(transport.routes) ? transport.routes : []
  const activeRoutes = routes.filter((r) => r && r.active !== false)
  const filtered = routeKey
    ? activeRoutes.filter((r) => String(r.key || '').toLowerCase() === routeKey)
    : activeRoutes

  const byKey = new Map(rows.map((r) => [String(r.routeKey).toLowerCase(), r]))

  const availability = filtered.map((route) => {
    const key = String(route.key || '').toLowerCase()
    const inv = byKey.get(key)
    const baseMinor =
      route.priceMinor != null
        ? Math.round(Number(route.priceMinor))
        : Math.round(Number(route.price || 0) * 100)
    return {
      routeKey: route.key,
      from: route.from,
      to: route.to,
      departureTime: route.departureTime,
      arrivalTime: route.arrivalTime,
      travelDate: String(travelDate).slice(0, 10),
      availableSeats: inv ? inv.availableSeats : 0,
      totalSeats: inv ? inv.totalSeats : 0,
      hasInventory: Boolean(inv),
      priceMinor:
        inv?.priceOverrideMinor != null ? inv.priceOverrideMinor : baseMinor,
      currency: inv?.currency || route.currency || 'ETB',
      priceSource: inv?.priceOverrideMinor != null ? 'override' : 'base',
    }
  })

  return {
    transportId: transport._id || transport.id,
    travelDate: String(travelDate).slice(0, 10),
    availability,
  }
}

export default {
  listTransportInventory,
  upsertTransportInventory,
  updateTransportInventory,
  getPublicTransportAvailability,
}
