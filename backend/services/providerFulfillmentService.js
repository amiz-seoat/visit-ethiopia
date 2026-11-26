import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import BookingOperationAudit from '../models/BookingOperationAudit.js'
import AppError from '../utils/appError.js'
import {
  isV2BookingFlow,
  canTransitionFulfillment,
} from '../config/booking.js'
import {
  getOrganizationV2Booking,
  serializeProviderBooking,
} from './providerBookingService.js'
import Payment from '../models/Payment.js'
import User from '../models/User.js'
import { isPrismaBooking } from '../repositories/booking/index.js'
import { isObjectIdCompatible } from '../utils/objectId.js'
import * as bookRepo from '../repositories/booking/prismaBookingRepository.js'
import {
  createAuditPrisma,
  createProviderNotePrisma,
} from './prismaBookingDomainService.js'

const NOTE_MAX_LENGTH = 1000
const FINANCIAL_BLOCKED = new Set([
  'cancelled',
  'expired',
  'failed',
  'partially_refunded',
])

const MUTATION_BODY_BLOCKLIST = [
  'organizationId',
  'orgId',
  'userId',
  'user',
  'status',
  'fulfillmentStatus',
  'paymentId',
  'payment',
  'priceSnapshot',
  'amountMinor',
  'inventoryReserved',
  'inventoryQuantity',
  'availableSpots',
  'bookingFlowVersion',
  'departureId',
  'packageKey',
  'bookingType',
]

export function rejectFulfillmentMassAssignment(body = {}) {
  for (const field of MUTATION_BODY_BLOCKLIST) {
    if (body[field] !== undefined) {
      throw new AppError(`Field ${field} is not allowed`, 400)
    }
  }
}

async function loadScopedV2Booking(organizationId, bookingId) {
  if (!mongoose.Types.ObjectId.isValid(String(bookingId))) {
    throw new AppError('Booking not found', 404)
  }

  const booking = await Booking.findById(bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  if (
    !booking ||
    !isV2BookingFlow(booking) ||
    booking.bookingType !== 'tour' ||
    String(booking.organizationId) !== String(organizationId)
  ) {
    throw new AppError('Booking not found', 404)
  }

  return booking
}

async function loadScopedV2BookingPrisma(organizationId, bookingId) {
  if (!isObjectIdCompatible(String(bookingId))) {
    throw new AppError('Booking not found', 404)
  }

  const booking = await bookRepo.findProviderBooking(organizationId, bookingId)
  if (!booking) throw new AppError('Booking not found', 404)
  return booking
}

async function writeAudit({
  booking,
  actorUserId,
  action,
  previousFulfillmentStatus,
  newFulfillmentStatus,
  metadata = null,
}) {
  await BookingOperationAudit.create({
    bookingId: booking._id,
    organizationId: booking.organizationId,
    actorUserId,
    action,
    previousFulfillmentStatus,
    newFulfillmentStatus,
    metadata,
  })
}

async function writeAuditPrisma({
  booking,
  actorUserId,
  action,
  previousFulfillmentStatus,
  newFulfillmentStatus,
  metadata = null,
}) {
  await createAuditPrisma({
    bookingId: booking._id,
    organizationId: booking.organizationId,
    actorUserId,
    action,
    previousFulfillmentStatus,
    newFulfillmentStatus,
    metadata,
  })
}

async function serializeResult(booking) {
  let payment = null
  if (booking.paymentId) {
    payment = await Payment.findById(booking.paymentId)
  }
  const customerUser = booking.user
    ? await User.findById(booking.user).select('FirstName LastName email')
    : null
  return serializeProviderBooking(booking, { payment, customerUser })
}

async function serializeResultPrisma(booking) {
  let payment = null
  if (booking.paymentId) {
    payment = await bookRepo.findPaymentById(booking.paymentId)
  }
  const users = booking.user
    ? await bookRepo.findUsersByIds([booking.user])
    : []
  return serializeProviderBooking(booking, {
    payment,
    customerUser: users[0] || null,
  })
}

function assertFinanciallyOperable(booking) {
  if (booking.status !== 'confirmed') {
    throw new AppError(
      `Booking must be financially confirmed (current status: ${booking.status})`,
      409
    )
  }
  if (FINANCIAL_BLOCKED.has(booking.status)) {
    throw new AppError('Booking is not operable in its current financial state', 409)
  }
}

function utcTodayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function getHotelStayDates(booking) {
  const snap = booking.priceSnapshot || {}
  const details = booking.bookingDetails || {}
  return {
    checkIn: String(details.checkIn || snap.checkIn || '').slice(0, 10) || null,
    checkOut: String(details.checkOut || snap.checkOut || '').slice(0, 10) || null,
  }
}

/** Hotel check-in / no-show require arrival day (UTC calendar date) to have started. */
function assertHotelArrivalDayReached(booking, actionLabel) {
  if (booking.bookingType !== 'hotel') return
  const { checkIn } = getHotelStayDates(booking)
  if (!checkIn || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) {
    throw new AppError('Hotel booking is missing a valid check-in date', 409)
  }
  const today = utcTodayYmd()
  if (today < checkIn) {
    throw new AppError(
      `Cannot ${actionLabel} before arrival date ${checkIn}`,
      409
    )
  }
}

/**
 * CAS transition helper for fulfillmentStatus.
 */
async function transitionFulfillment({
  booking,
  fromStatuses,
  toStatus,
  actorUserId,
  action,
  extraUpdate = {},
}) {
  const current = booking.fulfillmentStatus || 'pending'
  if (fromStatuses.includes(current) && current === toStatus) {
    return { booking, idempotent: true }
  }

  if (!fromStatuses.includes(current)) {
    if (current === toStatus) {
      return { booking, idempotent: true }
    }
    throw new AppError(
      `Cannot transition fulfillment from ${current} to ${toStatus}`,
      409
    )
  }

  if (!canTransitionFulfillment(current, toStatus)) {
    throw new AppError(
      `Invalid fulfillment transition from ${current} to ${toStatus}`,
      409
    )
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      organizationId: booking.organizationId,
      bookingFlowVersion: 'v2',
      status: 'confirmed',
      fulfillmentStatus: { $in: fromStatuses },
    },
    {
      $set: {
        fulfillmentStatus: toStatus,
        updatedAt: new Date(),
        ...extraUpdate,
      },
    },
    { new: true }
  ).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  if (updated) {
    await writeAudit({
      booking: updated,
      actorUserId,
      action,
      previousFulfillmentStatus: current,
      newFulfillmentStatus: toStatus,
    })
    return { booking: updated, idempotent: false }
  }

  const fresh = await Booking.findById(booking._id).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (fresh?.fulfillmentStatus === toStatus) {
    return { booking: fresh, idempotent: true }
  }

  throw new AppError('Fulfillment update conflict', 409)
}

async function transitionFulfillmentPrisma({
  booking,
  fromStatuses,
  toStatus,
  actorUserId,
  action,
  extraUpdate = {},
}) {
  const current = booking.fulfillmentStatus || 'pending'
  if (fromStatuses.includes(current) && current === toStatus) {
    return { booking, idempotent: true }
  }

  if (!fromStatuses.includes(current)) {
    if (current === toStatus) {
      return { booking, idempotent: true }
    }
    throw new AppError(
      `Cannot transition fulfillment from ${current} to ${toStatus}`,
      409
    )
  }

  if (!canTransitionFulfillment(current, toStatus)) {
    throw new AppError(
      `Invalid fulfillment transition from ${current} to ${toStatus}`,
      409
    )
  }

  const updated = await bookRepo.updateBookingFulfillmentIf(booking._id, {
    organizationId: booking.organizationId,
    fromFulfillmentStatuses: fromStatuses,
    financialStatus: 'confirmed',
    data: {
      fulfillmentStatus: toStatus,
      ...extraUpdate,
    },
  })

  if (updated) {
    await writeAuditPrisma({
      booking: updated,
      actorUserId,
      action,
      previousFulfillmentStatus: current,
      newFulfillmentStatus: toStatus,
    })
    return { booking: updated, idempotent: false }
  }

  const fresh = await bookRepo.findBookingById(booking._id, { includeNotes: true })
  if (fresh?.fulfillmentStatus === toStatus) {
    return { booking: fresh, idempotent: true }
  }

  throw new AppError('Fulfillment update conflict', 409)
}

export async function checkInProviderBooking({
  organizationId,
  bookingId,
  actorUserId,
  body = {},
}) {
  rejectFulfillmentMassAssignment(body)

  if (isPrismaBooking()) {
    const booking = await loadScopedV2BookingPrisma(organizationId, bookingId)
    assertFinanciallyOperable(booking)

    const current = booking.fulfillmentStatus || 'pending'
    if (current === 'checked_in') {
      return {
        booking: await serializeResultPrisma(booking),
        idempotent: true,
      }
    }

    assertHotelArrivalDayReached(booking, 'check in')

    const result = await transitionFulfillmentPrisma({
      booking,
      fromStatuses: ['confirmed'],
      toStatus: 'checked_in',
      actorUserId,
      action: 'check_in',
      extraUpdate: { checkedInAt: new Date() },
    })

    return {
      booking: await serializeResultPrisma(result.booking),
      idempotent: result.idempotent,
    }
  }

  const booking = await loadScopedV2Booking(organizationId, bookingId)
  assertFinanciallyOperable(booking)

  const current = booking.fulfillmentStatus || 'pending'
  if (current === 'checked_in') {
    return {
      booking: await serializeResult(booking),
      idempotent: true,
    }
  }

  const result = await transitionFulfillment({
    booking,
    fromStatuses: ['confirmed'],
    toStatus: 'checked_in',
    actorUserId,
    action: 'check_in',
    extraUpdate: { checkedInAt: new Date() },
  })

  return {
    booking: await serializeResult(result.booking),
    idempotent: result.idempotent,
  }
}

export async function completeProviderBooking({
  organizationId,
  bookingId,
  actorUserId,
  body = {},
}) {
  rejectFulfillmentMassAssignment(body)

  if (isPrismaBooking()) {
    const booking = await loadScopedV2BookingPrisma(organizationId, bookingId)
    assertFinanciallyOperable(booking)

    const current = booking.fulfillmentStatus || 'pending'
    if (current === 'completed') {
      return {
        booking: await serializeResultPrisma(booking),
        idempotent: true,
      }
    }

    // Hotels: check-out only after check-in (no skip-to-complete).
    // Tours/transport: may complete from confirmed or checked_in.
    const isHotel = booking.bookingType === 'hotel'
    if (isHotel && current === 'confirmed') {
      throw new AppError(
        'Hotel booking must be checked in before check-out',
        409
      )
    }

    const result = await transitionFulfillmentPrisma({
      booking,
      fromStatuses: isHotel ? ['checked_in'] : ['confirmed', 'checked_in'],
      toStatus: 'completed',
      actorUserId,
      action: isHotel ? 'check_out' : 'complete',
      extraUpdate: { fulfillmentCompletedAt: new Date() },
    })

    return {
      booking: await serializeResultPrisma(result.booking),
      idempotent: result.idempotent,
    }
  }

  const booking = await loadScopedV2Booking(organizationId, bookingId)
  assertFinanciallyOperable(booking)

  const current = booking.fulfillmentStatus || 'pending'
  if (current === 'completed') {
    return {
      booking: await serializeResult(booking),
      idempotent: true,
    }
  }

  const result = await transitionFulfillment({
    booking,
    fromStatuses: ['confirmed', 'checked_in'],
    toStatus: 'completed',
    actorUserId,
    action: 'complete',
    extraUpdate: { fulfillmentCompletedAt: new Date() },
  })

  return {
    booking: await serializeResult(result.booking),
    idempotent: result.idempotent,
  }
}

/** Hotel-facing alias for complete (same fulfillmentStatus=completed). */
export async function checkOutProviderBooking(args) {
  return completeProviderBooking(args)
}

export async function markNoShowProviderBooking({
  organizationId,
  bookingId,
  actorUserId,
  body = {},
}) {
  rejectFulfillmentMassAssignment(body)

  if (isPrismaBooking()) {
    const booking = await loadScopedV2BookingPrisma(organizationId, bookingId)
    assertFinanciallyOperable(booking)

    const current = booking.fulfillmentStatus || 'pending'
    if (current === 'no_show') {
      return {
        booking: await serializeResultPrisma(booking),
        idempotent: true,
      }
    }

    if (current === 'completed' || current === 'checked_in') {
      throw new AppError(
        `Cannot mark no-show from fulfillment status ${current}`,
        409
      )
    }

    assertHotelArrivalDayReached(booking, 'mark no-show')

    const result = await transitionFulfillmentPrisma({
      booking,
      fromStatuses: ['confirmed'],
      toStatus: 'no_show',
      actorUserId,
      action: 'no_show',
      extraUpdate: { noShowAt: new Date() },
    })

    return {
      booking: await serializeResultPrisma(result.booking),
      idempotent: result.idempotent,
    }
  }

  const booking = await loadScopedV2Booking(organizationId, bookingId)
  assertFinanciallyOperable(booking)

  const current = booking.fulfillmentStatus || 'pending'
  if (current === 'no_show') {
    return {
      booking: await serializeResult(booking),
      idempotent: true,
    }
  }

  if (current === 'completed' || current === 'checked_in') {
    throw new AppError(
      `Cannot mark no-show from fulfillment status ${current}`,
      409
    )
  }

  const result = await transitionFulfillment({
    booking,
    fromStatuses: ['confirmed'],
    toStatus: 'no_show',
    actorUserId,
    action: 'no_show',
    extraUpdate: { noShowAt: new Date() },
  })

  return {
    booking: await serializeResult(result.booking),
    idempotent: result.idempotent,
  }
}

export async function addProviderBookingNote({
  organizationId,
  bookingId,
  actorUserId,
  body = {},
}) {
  rejectFulfillmentMassAssignment(body)
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!note) throw new AppError('Note is required', 400)
  if (note.length > NOTE_MAX_LENGTH) {
    throw new AppError(`Note must be at most ${NOTE_MAX_LENGTH} characters`, 400)
  }
  if (/cvv|card\s*number|pan\b|password|iban/i.test(note)) {
    throw new AppError('Note must not contain sensitive payment information', 400)
  }

  if (isPrismaBooking()) {
    const booking = await loadScopedV2BookingPrisma(organizationId, bookingId)

    await createProviderNotePrisma({
      bookingId: booking._id,
      note,
      createdById: actorUserId,
    })

    const updated = await bookRepo.findBookingById(booking._id, {
      includeNotes: true,
    })
    if (!updated) throw new AppError('Booking not found', 404)

    await writeAuditPrisma({
      booking: updated,
      actorUserId,
      action: 'add_note',
      previousFulfillmentStatus: updated.fulfillmentStatus,
      newFulfillmentStatus: updated.fulfillmentStatus,
      metadata: { noteLength: note.length },
    })

    return {
      booking: await serializeResultPrisma(updated),
      idempotent: false,
    }
  }

  const booking = await loadScopedV2Booking(organizationId, bookingId)

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      organizationId: booking.organizationId,
      bookingFlowVersion: 'v2',
    },
    {
      $push: {
        providerNotes: {
          note,
          createdBy: actorUserId,
          createdAt: new Date(),
        },
      },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  ).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  if (!updated) throw new AppError('Booking not found', 404)

  await writeAudit({
    booking: updated,
    actorUserId,
    action: 'add_note',
    previousFulfillmentStatus: updated.fulfillmentStatus,
    newFulfillmentStatus: updated.fulfillmentStatus,
    metadata: { noteLength: note.length },
  })

  return {
    booking: await serializeResult(updated),
    idempotent: false,
  }
}

export async function listBookingOperationAudits(organizationId, bookingId) {
  // Ensures org scope / 404 semantics
  await getOrganizationV2Booking(organizationId, bookingId)

  if (isPrismaBooking()) {
    return bookRepo.listAuditsForBookingOrg(bookingId, organizationId, {
      limit: 100,
    })
  }

  const audits = await BookingOperationAudit.find({
    bookingId,
    organizationId,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
  return audits
}

export default {
  checkInProviderBooking,
  completeProviderBooking,
  checkOutProviderBooking,
  markNoShowProviderBooking,
  addProviderBookingNote,
  listBookingOperationAudits,
  rejectFulfillmentMassAssignment,
}
