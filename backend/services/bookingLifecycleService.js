import Booking from '../models/Booking.js'
import InventoryHold from '../models/InventoryHold.js'
import AppError from '../utils/appError.js'
import { isLegacyBookingFlow, isV2BookingFlow } from '../config/booking.js'
import { releaseForBooking } from './bookingInventoryService.js'

/** Allowed v2 transitions (Phase 4C–4F). */
const V2_TRANSITIONS = {
  payment_pending: ['cancelled', 'expired', 'failed', 'confirmed'],
  failed: [],
  expired: [],
  cancelled: [],
  confirmed: ['cancelled', 'partially_refunded'],
  partially_refunded: ['cancelled'],
  completed: [],
}

export function canTransitionV2(fromStatus, toStatus) {
  const allowed = V2_TRANSITIONS[fromStatus] || []
  return allowed.includes(toStatus)
}

export function assertV2Transition(fromStatus, toStatus) {
  if (!canTransitionV2(fromStatus, toStatus)) {
    throw new AppError(
      `Invalid booking transition from ${fromStatus} to ${toStatus}`,
      409
    )
  }
}

export function serializeV2Booking(booking) {
  const doc = booking.toObject ? booking.toObject({ virtuals: true }) : { ...booking }
  return {
    _id: doc._id,
    bookingFlowVersion: doc.bookingFlowVersion,
    bookingType: doc.bookingType,
    status: doc.status,
    departureId: doc.departureId,
    organizationId: doc.organizationId,
    packageKey: doc.packageKey,
    paymentId: doc.paymentId,
    inventoryQuantity: doc.inventoryQuantity,
    inventoryReserved: doc.inventoryReserved,
    inventoryReleasedAt: doc.inventoryReleasedAt,
    priceSnapshot: doc.priceSnapshot,
    contactInfo: doc.contactInfo,
    expiresAt: doc.expiresAt,
    confirmedAt: doc.confirmedAt,
    cancelledAt: doc.cancelledAt,
    cancellationReason: doc.cancellationReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function loadV2Booking(bookingId) {
  return Booking.findById(bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
}

export async function markV2BookingFailed(booking, reason = 'failed') {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'failed') {
    return { booking, idempotent: true }
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot fail booking in status ${booking.status}`, 409)
  }

  booking.status = 'failed'
  booking.cancellationReason = reason
  booking.inventoryReserved = false
  await booking.save()
  return { booking, idempotent: false }
}

export async function expireV2Booking(booking) {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'expired') {
    return { booking, released: false, idempotent: true }
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot expire booking in status ${booking.status}`, 409)
  }

  assertV2Transition(booking.status, 'expired')

  const releaseResult = await releaseForBooking({
    bookingId: booking._id,
    reason: 'expired',
    targetStatus: 'expired',
  })

  booking.status = 'expired'
  booking.cancelledAt = booking.cancelledAt || new Date()
  booking.cancellationReason = booking.cancellationReason || 'expired'
  booking.inventoryReserved = false
  await booking.save()

  return { booking, released: releaseResult.released, idempotent: false }
}

export async function cancelV2Booking(booking, { reason = 'customer_cancelled', actorRole = 'user' } = {}) {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }

  if (booking.status === 'cancelled') {
    return { booking, released: false, idempotent: true }
  }

  if (booking.status === 'expired') {
    throw new AppError('Booking has already expired', 409)
  }

  const consumedHold = await InventoryHold.exists({
    bookingId: booking._id,
    status: 'consumed',
  })
  if (consumedHold) {
    throw new AppError('Confirmed bookings cannot be cancelled through this flow', 409)
  }

  if (booking.status === 'payment_pending') {
    assertV2Transition(booking.status, 'cancelled')
    const releaseResult = await releaseForBooking({
      bookingId: booking._id,
      reason,
      targetStatus: 'released',
    })

    booking.status = 'cancelled'
    booking.cancelledAt = new Date()
    booking.cancellationReason = reason
    booking.inventoryReserved = false
    booking.fulfillmentStatus = 'cancelled'
    await booking.save()

    return { booking, released: releaseResult.released, idempotent: false }
  }

  throw new AppError(`Cannot cancel booking in status ${booking.status}`, 409)
}

export async function cancelLegacyBooking(booking) {
  if (!isLegacyBookingFlow(booking)) {
    throw new AppError('Not a legacy booking', 400)
  }
  if (booking.status === 'cancelled') {
    throw new AppError('Booking is already cancelled', 400)
  }
  if (booking.status === 'completed') {
    throw new AppError('Completed bookings cannot be cancelled', 400)
  }
  booking.status = 'cancelled'
  booking.cancelledAt = new Date()
  await booking.save()
  return { booking, idempotent: false }
}

export async function cancelBookingForUser(booking, user, { reason } = {}) {
  const ownerId = booking.user?._id?.toString?.() ?? booking.user?.toString?.()
  const isOwner = ownerId === user.id
  const isAdmin = user.role === 'admin'

  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to cancel this booking', 403)
  }

  if (isV2BookingFlow(booking)) {
    if (['confirmed', 'partially_refunded'].includes(booking.status)) {
      throw new AppError(
        'Paid bookings must be cancelled through the refund cancellation flow',
        409
      )
    }
    return cancelV2Booking(booking, {
      reason: reason || (isAdmin ? 'admin_cancelled' : 'customer_cancelled'),
      actorRole: user.role,
    })
  }

  if (!isOwner) {
    throw new AppError('You do not have permission to cancel this booking', 403)
  }
  return cancelLegacyBooking(booking)
}

export async function confirmV2Booking(booking) {
  if (!isV2BookingFlow(booking)) {
    throw new AppError('Not a v2 booking', 400)
  }
  if (booking.status === 'confirmed') {
    return { booking, idempotent: true }
  }
  if (booking.status !== 'payment_pending') {
    throw new AppError(`Cannot confirm booking in status ${booking.status}`, 409)
  }

  assertV2Transition(booking.status, 'confirmed')

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'payment_pending' },
    {
      status: 'confirmed',
      confirmedAt: new Date(),
      inventoryReserved: true,
      fulfillmentStatus: 'confirmed',
      fulfillmentConfirmedAt: new Date(),
    },
    { new: true }
  ).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  if (updated) {
    return { booking: updated, idempotent: false }
  }

  const current = await Booking.findById(booking._id).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (current?.status === 'confirmed') {
    return { booking: current, idempotent: true }
  }

  throw new AppError('Booking confirmation conflict', 409)
}

export default {
  canTransitionV2,
  assertV2Transition,
  serializeV2Booking,
  markV2BookingFailed,
  expireV2Booking,
  cancelV2Booking,
  cancelLegacyBooking,
  cancelBookingForUser,
  confirmV2Booking,
}
