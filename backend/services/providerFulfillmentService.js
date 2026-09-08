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

export async function checkInProviderBooking({
  organizationId,
  bookingId,
  actorUserId,
  body = {},
}) {
  rejectFulfillmentMassAssignment(body)
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

export async function markNoShowProviderBooking({
  organizationId,
  bookingId,
  actorUserId,
  body = {},
}) {
  rejectFulfillmentMassAssignment(body)
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
  markNoShowProviderBooking,
  addProviderBookingNote,
  listBookingOperationAudits,
  rejectFulfillmentMassAssignment,
}
