/**
 * Transport v2 booking — price snapshot, fingerprint, public load.
 */
import crypto from 'crypto'
import AppError from '../utils/appError.js'
import {
  toInventoryDate,
  dateToYmd,
  findInventoryDay,
} from '../repositories/prisma/transportInventoryRepository.js'
import { findTransportRoute } from './transportLifecycleService.js'
import { isTransportPubliclyVisible } from './transportVisibilityService.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import { getOrganizationRepository } from '../repositories/organizations/index.js'
import { isPrismaIdentity } from '../utils/databaseMode.js'

export function parseTravelDate(travelDate) {
  const day = toInventoryDate(travelDate)
  return dateToYmd(day)
}

export function parseTransportQuantity(raw) {
  const quantity = Number(raw)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }
  if (quantity > 40) {
    throw new AppError('quantity cannot exceed 40 seats', 400)
  }
  return quantity
}

export function buildTransportRequestFingerprint({
  transportId,
  routeKey,
  travelDate,
  quantity,
  contactInfo,
}) {
  const payload = {
    transportId: String(transportId),
    routeKey: String(routeKey).trim().toLowerCase(),
    travelDate: String(travelDate),
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

export function fingerprintFromTransportBooking(booking) {
  const details = booking.bookingDetails || {}
  const snap = booking.priceSnapshot || {}
  return buildTransportRequestFingerprint({
    transportId: booking.bookingItem || booking.bookingItemId,
    routeKey: details.routeKey || snap.routeKey,
    travelDate: details.travelDate || snap.travelDate,
    quantity: booking.inventoryQuantity || snap.quantity || details.quantity,
    contactInfo: booking.contactInfo,
  })
}

export async function loadPublicBookableTransport(transportId) {
  const transport = await catalogWrite.findTransportById(transportId)
  if (!transport || !(await isTransportPubliclyVisible(transport))) {
    throw new AppError('Transport is not available for booking', 404)
  }
  let organization = null
  if (transport.organizationId) {
    if (isPrismaIdentity()) {
      const orgs = getOrganizationRepository()
      organization = await orgs.findOrganizationById(transport.organizationId)
    }
  }
  return { transport, organization }
}

export function assertActiveRoute(transport, routeKey) {
  const key = String(routeKey || '')
    .trim()
    .toLowerCase()
  if (!key) throw new AppError('routeKey is required', 400)
  const route = findTransportRoute(transport, key)
  if (!route) throw new AppError('Unknown routeKey', 400)
  if (route.active === false) {
    throw new AppError('Route is inactive', 400)
  }
  return { route, routeKey: route.key || key }
}

/**
 * Immutable transport price snapshot from route base + daily override.
 */
export async function buildTransportPriceSnapshot({
  transport,
  organization,
  route,
  routeKey,
  travelDate,
  quantity,
}) {
  const row = await findInventoryDay({
    transportId: transport._id || transport.id,
    routeKey,
    date: travelDate,
  })
  if (!row) {
    throw new AppError(`No inventory for ${travelDate}`, 409)
  }
  if (row.availableSeats < quantity) {
    throw new AppError(`Not enough available seats for ${travelDate}`, 409)
  }

  const baseMinor =
    route.priceMinor != null
      ? Math.round(Number(route.priceMinor))
      : Math.round(Number(route.price || 0) * 100)
  if (!Number.isInteger(baseMinor) || baseMinor < 0) {
    throw new AppError('Route price is invalid', 400)
  }

  let unitPriceMinor = baseMinor
  let source = 'base'
  if (row.priceOverrideMinor != null) {
    unitPriceMinor = Math.round(Number(row.priceOverrideMinor))
    source = 'override'
  }
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new AppError('Invalid seat price', 400)
  }

  const currency = String(
    row.currency || route.currency || 'ETB'
  ).toUpperCase()
  const subtotalMinor = unitPriceMinor * quantity

  return {
    currency,
    quantity,
    unitPriceMinor,
    subtotalMinor,
    discountMinor: 0,
    feesMinor: 0,
    taxMinor: 0,
    totalMinor: subtotalMinor,
    transportId: transport._id || transport.id,
    transportName: transport.name,
    transportType: transport.type,
    routeKey,
    from: route.from,
    to: route.to,
    departureTime: route.departureTime,
    arrivalTime: route.arrivalTime,
    travelDate,
    priceSource: source,
    organizationId: transport.organizationId || organization?._id || null,
    organizationName: organization?.name || null,
    organizationSlug: organization?.slug || null,
    pricedFrom: 'transport_inventory',
    pricedAt: new Date().toISOString(),
    baseRoutePriceMinor: baseMinor,
    availableSeatsAtQuote: row.availableSeats,
    totalSeatsAtQuote: row.totalSeats,
  }
}

export default {
  parseTravelDate,
  parseTransportQuantity,
  buildTransportRequestFingerprint,
  fingerprintFromTransportBooking,
  loadPublicBookableTransport,
  assertActiveRoute,
  buildTransportPriceSnapshot,
}
