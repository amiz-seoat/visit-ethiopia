import Transport from '../models/Transport.js'
import AppError from '../utils/appError.js'
import { assertTransportTransition } from '../config/transportLifecycle.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import { slugify } from '../utils/slugify.js'

async function transitionTransportStatus(transport, toStatus) {
  assertTransportTransition(transport.status, toStatus)

  if (isPrismaApp()) {
    const id = transport._id || transport.id
    const updated = await catalogWrite.transitionTransportStatus(
      id,
      transport.status,
      toStatus
    )
    if (!updated) {
      const err = new Error(
        `Invalid transport status transition: ${transport.status} → ${toStatus}`
      )
      err.statusCode = 409
      throw err
    }
    Object.assign(transport, updated)
    return transport
  }

  const updated = await Transport.findOneAndUpdate(
    { _id: transport._id, status: transport.status },
    { status: toStatus },
    { new: true, runValidators: true }
  )
  if (!updated) {
    const err = new Error(
      `Invalid transport status transition: ${transport.status} → ${toStatus}`
    )
    err.statusCode = 409
    throw err
  }
  Object.assign(transport, updated.toObject())
  return transport
}

export async function publishTransport(transport) {
  return transitionTransportStatus(transport, 'active')
}

export async function unpublishTransport(transport) {
  return transitionTransportStatus(transport, 'inactive')
}

/**
 * Normalize routes JSON with stable keys for inventory while keeping
 * legacy from/to/times/price/availableSeats for frontend compatibility.
 */
export function normalizeTransportRoutes(routes = []) {
  if (!Array.isArray(routes)) {
    throw new AppError('routes must be an array', 400)
  }
  const keys = new Set()
  return routes.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new AppError(`routes[${index}] must be an object`, 400)
    }
    const from = String(raw.from || '').trim()
    const to = String(raw.to || '').trim()
    if (!from || !to) {
      throw new AppError(`routes[${index}] requires from and to`, 400)
    }
    const departureTime = String(raw.departureTime || '').trim()
    const arrivalTime = String(raw.arrivalTime || '').trim()
    if (!departureTime || !arrivalTime) {
      throw new AppError(
        `routes[${index}] requires departureTime and arrivalTime`,
        400
      )
    }

    let key = String(
      raw.key || slugify(`${from}-${to}-${departureTime}`) || `route-${index + 1}`
    )
      .trim()
      .toLowerCase()
    if (!key) key = `route-${index + 1}`
    if (keys.has(key)) {
      throw new AppError(`Duplicate route key: ${key}`, 400)
    }
    keys.add(key)

    const price = Number(raw.price)
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(`routes[${index}].price must be a non-negative number`, 400)
    }
    let priceMinor =
      raw.priceMinor != null && raw.priceMinor !== ''
        ? Math.round(Number(raw.priceMinor))
        : Math.round(price * 100)
    if (!Number.isInteger(priceMinor) || priceMinor < 0) {
      throw new AppError(
        `routes[${index}].priceMinor must be a non-negative integer`,
        400
      )
    }

    const availableSeats = Number(raw.availableSeats)
    if (!Number.isInteger(availableSeats) || availableSeats < 0) {
      throw new AppError(
        `routes[${index}].availableSeats must be a non-negative integer`,
        400
      )
    }

    return {
      key,
      from,
      to,
      departureTime,
      arrivalTime,
      duration: raw.duration != null ? String(raw.duration) : '',
      price,
      priceMinor,
      currency: String(raw.currency || 'ETB').toUpperCase(),
      availableSeats,
      active: raw.active === false ? false : true,
    }
  })
}

export function findTransportRoute(transport, routeKey) {
  const key = String(routeKey || '').toLowerCase()
  const routes = Array.isArray(transport?.routes) ? transport.routes : []
  return (
    routes.find((r) => String(r.key || '').toLowerCase() === key) ||
    routes.find(
      (r) =>
        slugify(`${r.from || ''}-${r.to || ''}-${r.departureTime || ''}`) === key
    ) ||
    null
  )
}

export default {
  publishTransport,
  unpublishTransport,
  normalizeTransportRoutes,
  findTransportRoute,
}
