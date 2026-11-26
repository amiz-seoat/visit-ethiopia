import prisma from '../../config/prisma.js'
import { generateObjectId } from '../../utils/objectId.js'
import {
  toApiBooking,
  toApiPayment,
  toApiPaymentAttempt,
  toApiRefund,
  toApiWebhookEvent,
  toApiAudit,
} from './bookingSerialize.js'

export async function findBookingById(id, { includeNotes = false } = {}) {
  const row = await prisma.booking.findUnique({
    where: { id: String(id) },
    include: includeNotes ? { providerNotes: true } : undefined,
  })
  return toApiBooking(row)
}

export async function findBookingByIdForUser(id, userId) {
  const row = await prisma.booking.findFirst({
    where: {
      id: String(id),
      userId: String(userId),
    },
  })
  return toApiBooking(row)
}

export async function listBookingsForUser(userId) {
  const rows = await prisma.booking.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toApiBooking)
}

/**
 * Basic admin list — supports status / bookingType / organizationId / userId filters.
 */
export async function listBookingsAdmin(filters = {}) {
  const where = {}
  if (filters.status) where.status = String(filters.status)
  if (filters.bookingType) where.bookingType = String(filters.bookingType)
  if (filters.organizationId) where.organizationId = String(filters.organizationId)
  if (filters.userId) where.userId = String(filters.userId)
  if (filters.bookingFlowVersion) {
    where.bookingFlowVersion = String(filters.bookingFlowVersion)
  }

  const take = Math.min(Number(filters.limit) || 100, 500)
  const skip = Math.max(Number(filters.skip) || 0, 0)

  const rows = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  })
  return rows.map(toApiBooking)
}

export async function findV2BookingByIdempotency(userId, idempotencyKey) {
  const row = await prisma.booking.findFirst({
    where: {
      userId: String(userId),
      idempotencyKey: String(idempotencyKey),
      bookingFlowVersion: 'v2',
    },
  })
  return toApiBooking(row)
}

export async function createBooking(data) {
  try {
    const row = await prisma.booking.create({
      data: {
        id: data.id || generateObjectId(),
        userId: String(data.userId),
        bookingFlowVersion: data.bookingFlowVersion || 'v2',
        bookingType: data.bookingType,
        bookingItemId: String(data.bookingItemId),
        organizationId: data.organizationId ? String(data.organizationId) : null,
        departureId: data.departureId ? String(data.departureId) : null,
        packageKey: data.packageKey || null,
        priceSnapshot: data.priceSnapshot || undefined,
        paymentId: data.paymentId || null,
        inventoryReserved: Boolean(data.inventoryReserved),
        inventoryQuantity: data.inventoryQuantity ?? null,
        bookingDetails: data.bookingDetails || {},
        contactInfo: data.contactInfo,
        legacyPayment: data.legacyPayment ?? undefined,
        status: data.status || 'payment_pending',
        fulfillmentStatus: data.fulfillmentStatus || 'pending',
        expiresAt: data.expiresAt || null,
        idempotencyKey: data.idempotencyKey || null,
        notes: data.notes || null,
      },
    })
    return toApiBooking(row)
  } catch (err) {
    if (err?.code === 'P2002') {
      err.isIdempotencyConflict = true
    }
    throw err
  }
}

export async function updateBooking(id, data) {
  const row = await prisma.booking.update({
    where: { id: String(id) },
    data,
  })
  return toApiBooking(row)
}

export async function updateBookingMany(where, data) {
  return prisma.booking.updateMany({ where, data })
}

export async function updateBookingIfStatus(id, fromStatuses, data) {
  const result = await prisma.booking.updateMany({
    where: {
      id: String(id),
      status: Array.isArray(fromStatuses) ? { in: fromStatuses } : fromStatuses,
    },
    data,
  })
  if (result.count === 0) return null
  return findBookingById(id)
}

export async function findPaymentById(id) {
  const row = await prisma.payment.findUnique({ where: { id: String(id) } })
  return toApiPayment(row)
}

export async function findPaymentByBookingId(bookingId) {
  const row = await prisma.payment.findFirst({
    where: { bookingId: String(bookingId) },
    orderBy: { createdAt: 'desc' },
  })
  return toApiPayment(row)
}

export async function createPayment(data) {
  try {
    const row = await prisma.payment.create({
      data: {
        id: data.id || generateObjectId(),
        bookingId: String(data.bookingId),
        organizationId: data.organizationId ? String(data.organizationId) : null,
        amountMinor: data.amountMinor,
        amountRefundedMinor: data.amountRefundedMinor || 0,
        currency: data.currency || 'ETB',
        status: data.status || 'pending',
        provider: data.provider || 'mock',
        providerPaymentId: data.providerPaymentId || null,
        idempotencyKey: data.idempotencyKey || null,
        expiresAt: data.expiresAt || null,
        metadata: data.metadata || {},
      },
    })
    return toApiPayment(row)
  } catch (err) {
    if (err?.code === 'P2002') err.isIdempotencyConflict = true
    throw err
  }
}

export async function updatePayment(id, data) {
  const row = await prisma.payment.update({
    where: { id: String(id) },
    data,
  })
  return toApiPayment(row)
}

export async function updatePaymentIfStatus(id, fromStatuses, data) {
  const result = await prisma.payment.updateMany({
    where: {
      id: String(id),
      status: Array.isArray(fromStatuses) ? { in: fromStatuses } : fromStatuses,
    },
    data,
  })
  if (result.count === 0) return null
  return findPaymentById(id)
}

export async function createPaymentAttempt(data) {
  const row = await prisma.paymentAttempt.create({
    data: {
      id: data.id || generateObjectId(),
      paymentId: String(data.paymentId),
      attemptNumber: data.attemptNumber,
      status: data.status,
      providerReference: data.providerReference || null,
      failureCode: data.failureCode || null,
      failureMessage: data.failureMessage || null,
      rawProviderResponse: data.rawProviderResponse ?? undefined,
    },
  })
  return toApiPaymentAttempt(row)
}

export async function upsertPaymentAttempt(data) {
  const row = await prisma.paymentAttempt.upsert({
    where: {
      paymentId_attemptNumber: {
        paymentId: String(data.paymentId),
        attemptNumber: data.attemptNumber,
      },
    },
    create: {
      id: data.id || generateObjectId(),
      paymentId: String(data.paymentId),
      attemptNumber: data.attemptNumber,
      status: data.status,
      providerReference: data.providerReference || null,
      failureCode: data.failureCode || null,
      failureMessage: data.failureMessage || null,
      rawProviderResponse: data.rawProviderResponse ?? undefined,
    },
    update: {
      status: data.status,
      providerReference: data.providerReference || null,
      failureCode: data.failureCode || null,
      failureMessage: data.failureMessage || null,
      rawProviderResponse: data.rawProviderResponse ?? undefined,
    },
  })
  return toApiPaymentAttempt(row)
}

export async function countPaymentAttempts(paymentId) {
  return prisma.paymentAttempt.count({ where: { paymentId: String(paymentId) } })
}

export async function createRefund(data) {
  try {
    const row = await prisma.refund.create({
      data: {
        id: data.id || generateObjectId(),
        bookingId: String(data.bookingId),
        paymentId: String(data.paymentId),
        userId: String(data.userId),
        organizationId: String(data.organizationId),
        amountMinor: data.amountMinor,
        currency: data.currency || 'ETB',
        provider: data.provider || 'mock',
        status: data.status || 'pending',
        reason: data.reason,
        idempotencyKey: data.idempotencyKey || null,
        metadata: data.metadata || {},
        requestedAt: data.requestedAt || new Date(),
      },
    })
    return toApiRefund(row)
  } catch (err) {
    if (err?.code === 'P2002') err.isIdempotencyConflict = true
    throw err
  }
}

export async function findRefundById(id) {
  const row = await prisma.refund.findUnique({ where: { id: String(id) } })
  return toApiRefund(row)
}

export async function findRefundByIdempotency(userId, bookingId, key) {
  const row = await prisma.refund.findFirst({
    where: {
      userId: String(userId),
      bookingId: String(bookingId),
      idempotencyKey: String(key),
    },
  })
  return toApiRefund(row)
}

export async function updateRefund(id, data) {
  const row = await prisma.refund.update({
    where: { id: String(id) },
    data,
  })
  return toApiRefund(row)
}

export async function updateRefundIfStatus(id, fromStatuses, data) {
  const result = await prisma.refund.updateMany({
    where: {
      id: String(id),
      status: Array.isArray(fromStatuses) ? { in: fromStatuses } : fromStatuses,
    },
    data,
  })
  if (result.count === 0) return null
  return findRefundById(id)
}

export async function findLatestCompletedRefundByBooking(bookingId) {
  const row = await prisma.refund.findFirst({
    where: { bookingId: String(bookingId), status: 'completed' },
    orderBy: { completedAt: 'desc' },
  })
  return toApiRefund(row)
}

export async function listCompletedRefundsByPayment(paymentId) {
  const rows = await prisma.refund.findMany({
    where: { paymentId: String(paymentId), status: 'completed' },
    select: { amountMinor: true },
  })
  return rows
}

/**
 * CAS: only bump amountRefundedMinor when status + expected refunded total still match.
 */
export async function updatePaymentRefundCas(
  id,
  expectedAmountRefundedMinor,
  nextAmountRefundedMinor,
  nextStatus
) {
  const result = await prisma.payment.updateMany({
    where: {
      id: String(id),
      status: { in: ['completed', 'partially_refunded'] },
      amountRefundedMinor: expectedAmountRefundedMinor,
    },
    data: {
      amountRefundedMinor: nextAmountRefundedMinor,
      status: nextStatus,
    },
  })
  if (result.count === 0) return null
  return findPaymentById(id)
}

export async function findPaymentsByIds(ids = []) {
  if (!ids.length) return []
  const rows = await prisma.payment.findMany({
    where: { id: { in: ids.map(String) } },
  })
  return rows.map(toApiPayment)
}

export async function findPaymentIdsByOrgStatus(organizationId, status) {
  const rows = await prisma.payment.findMany({
    where: {
      ...(organizationId ? { organizationId: String(organizationId) } : {}),
      status: String(status),
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/** Marketplace booking types eligible for provider fulfillment (Prisma). */
export const PROVIDER_FULFILLMENT_BOOKING_TYPES = ['tour', 'transport', 'hotel']

/**
 * Org-scoped V2 marketplace bookings with optional filters (provider list).
 * Default booking types: tour + transport + hotel (Mongo tour-only semantics preserved elsewhere).
 */
export async function listProviderBookings({
  organizationId = null,
  status = null,
  bookingType = null,
  departureId = null,
  tourId = null,
  transportId = null,
  routeKey = null,
  travelDate = null,
  hotelId = null,
  checkIn = null,
  checkOut = null,
  paymentIds = null,
  createdFrom = null,
  createdTo = null,
  customerSearch = null,
  skip = 0,
  take = 20,
} = {}) {
  const where = {
    bookingFlowVersion: 'v2',
  }
  if (bookingType) {
    if (!PROVIDER_FULFILLMENT_BOOKING_TYPES.includes(String(bookingType))) {
      where.bookingType = '__none__'
    } else {
      where.bookingType = String(bookingType)
    }
  } else {
    where.bookingType = { in: [...PROVIDER_FULFILLMENT_BOOKING_TYPES] }
  }
  if (organizationId) where.organizationId = String(organizationId)
  if (status) where.status = String(status)
  if (departureId) where.departureId = String(departureId)
  if (Array.isArray(paymentIds)) {
    where.paymentId = { in: paymentIds.map(String) }
  }

  const snapshotFilters = []
  if (tourId) {
    snapshotFilters.push({
      path: ['tourId'],
      equals: String(tourId),
    })
  }
  if (transportId) {
    snapshotFilters.push({
      path: ['transportId'],
      equals: String(transportId),
    })
  }
  if (routeKey) {
    snapshotFilters.push({
      path: ['routeKey'],
      equals: String(routeKey).trim().toLowerCase(),
    })
  }
  if (travelDate) {
    snapshotFilters.push({
      path: ['travelDate'],
      equals: String(travelDate).slice(0, 10),
    })
  }
  if (hotelId) {
    snapshotFilters.push({
      path: ['hotelId'],
      equals: String(hotelId),
    })
  }
  if (checkIn) {
    snapshotFilters.push({
      path: ['checkIn'],
      equals: String(checkIn).slice(0, 10),
    })
  }
  if (checkOut) {
    snapshotFilters.push({
      path: ['checkOut'],
      equals: String(checkOut).slice(0, 10),
    })
  }
  if (snapshotFilters.length === 1) {
    where.priceSnapshot = snapshotFilters[0]
  } else if (snapshotFilters.length > 1) {
    where.AND = snapshotFilters.map((f) => ({ priceSnapshot: f }))
  }

  if (createdFrom || createdTo) {
    where.createdAt = {}
    if (createdFrom) where.createdAt.gte = createdFrom
    if (createdTo) where.createdAt.lte = createdTo
  }
  if (customerSearch) {
    const term = String(customerSearch)
    where.OR = [
      {
        contactInfo: {
          path: ['fullName'],
          string_contains: term,
          mode: 'insensitive',
        },
      },
      {
        contactInfo: {
          path: ['email'],
          string_contains: term,
          mode: 'insensitive',
        },
      },
      {
        contactInfo: {
          path: ['phone'],
          string_contains: term,
          mode: 'insensitive',
        },
      },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { providerNotes: true },
    }),
  ])

  return { total, bookings: rows.map(toApiBooking) }
}

export async function findProviderBooking(organizationId, bookingId) {
  const row = await prisma.booking.findFirst({
    where: {
      id: String(bookingId),
      organizationId: String(organizationId),
      bookingFlowVersion: 'v2',
      bookingType: { in: [...PROVIDER_FULFILLMENT_BOOKING_TYPES] },
    },
    include: { providerNotes: true },
  })
  return toApiBooking(row)
}

export async function updateBookingFulfillmentIf(
  id,
  {
    organizationId,
    fromFulfillmentStatuses,
    financialStatus = 'confirmed',
    data,
  }
) {
  const result = await prisma.booking.updateMany({
    where: {
      id: String(id),
      organizationId: String(organizationId),
      bookingFlowVersion: 'v2',
      status: financialStatus,
      fulfillmentStatus: {
        in: Array.isArray(fromFulfillmentStatuses)
          ? fromFulfillmentStatuses
          : [fromFulfillmentStatuses],
      },
    },
    data,
  })
  if (result.count === 0) return null
  return findBookingById(id, { includeNotes: true })
}

export async function appendProviderNoteAndTouch(bookingId, organizationId, noteData) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: String(bookingId),
      organizationId: String(organizationId),
      bookingFlowVersion: 'v2',
    },
  })
  if (!booking) return null

  await prisma.bookingProviderNote.create({
    data: {
      id: noteData.id || generateObjectId(),
      bookingId: String(bookingId),
      note: noteData.note,
      createdById: String(noteData.createdById),
    },
  })

  return findBookingById(bookingId, { includeNotes: true })
}

export async function listAuditsForBookingOrg(bookingId, organizationId, { limit = 100 } = {}) {
  const rows = await prisma.bookingOperationAudit.findMany({
    where: {
      bookingId: String(bookingId),
      organizationId: String(organizationId),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map(toApiAudit)
}

export async function findUsersByIds(ids = []) {
  if (!ids.length) return []
  const rows = await prisma.user.findMany({
    where: { id: { in: ids.map(String) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })
  return rows.map((row) => ({
    _id: row.id,
    id: row.id,
    FirstName: row.firstName,
    LastName: row.lastName,
    email: row.email,
  }))
}

export async function createWebhookEvent(data) {
  try {
    const row = await prisma.webhookEvent.create({
      data: {
        id: data.id || generateObjectId(),
        provider: data.provider,
        eventId: String(data.eventId),
        eventType: String(data.eventType),
        status: data.status || 'pending',
        paymentId: data.paymentId ? String(data.paymentId) : null,
        payloadHash: data.payloadHash || null,
        metadata: data.metadata || {},
      },
    })
    return toApiWebhookEvent(row)
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await prisma.webhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: data.provider,
            eventId: String(data.eventId),
          },
        },
      })
      err.existing = toApiWebhookEvent(existing)
    }
    throw err
  }
}

export async function updateWebhookEvent(id, data) {
  const row = await prisma.webhookEvent.update({
    where: { id: String(id) },
    data,
  })
  return toApiWebhookEvent(row)
}

export async function findWebhookByProviderEvent(provider, eventId) {
  const row = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: { provider, eventId: String(eventId) },
    },
  })
  return toApiWebhookEvent(row)
}

export async function createAudit(data) {
  const row = await prisma.bookingOperationAudit.create({
    data: {
      id: data.id || generateObjectId(),
      bookingId: String(data.bookingId),
      organizationId: String(data.organizationId),
      actorUserId: String(data.actorUserId),
      action: data.action,
      previousFulfillmentStatus: data.previousFulfillmentStatus || null,
      newFulfillmentStatus: data.newFulfillmentStatus || null,
      metadata: data.metadata ?? undefined,
    },
  })
  return toApiAudit(row)
}

export async function listAuditsForBooking(bookingId) {
  const rows = await prisma.bookingOperationAudit.findMany({
    where: { bookingId: String(bookingId) },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toApiAudit)
}

export async function createProviderNote(data) {
  const row = await prisma.bookingProviderNote.create({
    data: {
      id: data.id || generateObjectId(),
      bookingId: String(data.bookingId),
      note: data.note,
      createdById: String(data.createdById),
    },
  })
  return {
    _id: row.id,
    note: row.note,
    createdBy: row.createdById,
    createdAt: row.createdAt,
  }
}

export { prisma }

export default {
  findBookingById,
  findBookingByIdForUser,
  listBookingsForUser,
  listBookingsAdmin,
  findV2BookingByIdempotency,
  createBooking,
  updateBooking,
  updateBookingMany,
  updateBookingIfStatus,
  findPaymentById,
  findPaymentByBookingId,
  createPayment,
  updatePayment,
  updatePaymentIfStatus,
  updatePaymentRefundCas,
  findPaymentsByIds,
  findPaymentIdsByOrgStatus,
  createPaymentAttempt,
  upsertPaymentAttempt,
  countPaymentAttempts,
  createRefund,
  findRefundById,
  findRefundByIdempotency,
  findLatestCompletedRefundByBooking,
  listCompletedRefundsByPayment,
  updateRefund,
  updateRefundIfStatus,
  createWebhookEvent,
  updateWebhookEvent,
  findWebhookByProviderEvent,
  createAudit,
  listAuditsForBooking,
  listAuditsForBookingOrg,
  createProviderNote,
  appendProviderNoteAndTouch,
  PROVIDER_FULFILLMENT_BOOKING_TYPES,
  listProviderBookings,
  findProviderBooking,
  updateBookingFulfillmentIf,
  findUsersByIds,
}
