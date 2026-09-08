import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import InventoryHold from '../models/InventoryHold.js'
import Tour from '../models/Tour.js'
import TourDeparture from '../models/TourDeparture.js'
import AppError from '../utils/appError.js'
import { isPublicTourStatus } from '../config/tourLifecycle.js'
import { isOrganizationPubliclyVisible } from './tourVisibilityService.js'
import {
  reserveDepartureSpots,
  releaseDepartureSpots,
} from './tourDepartureService.js'

const ACTIVE_HOLD_STATUSES = ['pending', 'held', 'consumed']
const RELEASABLE_HOLD_STATUSES = ['held']

export function parseReservationQuantity(value, fieldName = 'quantity') {
  const quantity = Number(value)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(`${fieldName} must be a positive integer`, 400)
  }
  return quantity
}

/**
 * Load departure + tour and verify the departure is bookable for v2 inventory.
 */
export async function loadBookableDepartureContext(departureId) {
  if (!mongoose.Types.ObjectId.isValid(departureId)) {
    throw new AppError('Invalid departureId', 400)
  }

  const departure = await TourDeparture.findById(departureId)
  if (!departure) throw new AppError('Departure not found', 404)

  if (departure.status !== 'open') {
    throw new AppError('Departure is not available for booking', 409)
  }

  const tour = await Tour.findById(departure.tourId)
  if (!tour) throw new AppError('Tour not found', 404)

  if (tour.status === 'archived') {
    throw new AppError('Archived tours cannot be booked', 409)
  }

  if (tour.secretTour) {
    throw new AppError('Tour not found', 404)
  }

  if (!isPublicTourStatus(tour.status)) {
    throw new AppError('Tour is not available for booking', 409)
  }

  if (
    tour.organizationId &&
    departure.organizationId?.toString() !== tour.organizationId?.toString()
  ) {
    throw new AppError('Departure does not belong to tour organization', 403)
  }

  if (tour.organizationId) {
    const visible = await isOrganizationPubliclyVisible(tour.organizationId)
    if (!visible) {
      throw new AppError('Tour is not available for booking', 409)
    }
  }

  return { departure, tour }
}

export async function hasActiveReservationsForDeparture(departureId) {
  const exists = await InventoryHold.exists({
    departureId,
    status: { $in: ['held', 'consumed'] },
  })
  return Boolean(exists)
}

/**
 * Block provider manual availableSpots edits when v2 holds exist.
 */
export async function assertManualInventoryEditAllowed(departure, updates = {}) {
  if (updates.availableSpots === undefined) return
  if (updates.availableSpots === departure.availableSpots) return

  if (await hasActiveReservationsForDeparture(departure._id)) {
    throw new AppError(
      'Cannot manually change availableSpots while active v2 bookings exist for this departure',
      409
    )
  }
}

async function findActiveHoldForBooking(bookingId) {
  return InventoryHold.findOne({
    bookingId,
    status: { $in: ACTIVE_HOLD_STATUSES },
  })
}

async function syncBookingInventoryFlags(bookingId, { reserved, quantity = null }) {
  const update = {
    inventoryReserved: reserved,
    inventoryQuantity: reserved ? quantity : null,
    inventoryReleasedAt: reserved ? null : new Date(),
  }
  await Booking.updateOne({ _id: bookingId }, update)
}

/**
 * Compensating release when a hold could not be fully persisted.
 * Safe to call multiple times for the same departure/quantity only when no hold exists.
 */
export async function compensateDepartureRelease(departureId, quantity) {
  try {
    await releaseDepartureSpots(departureId, quantity)
    return true
  } catch {
    return false
  }
}

/**
 * Reserve departure inventory for a v2 booking.
 * Idempotent: repeated calls for the same booking return the existing hold.
 */
export async function reserveForBooking({
  bookingId,
  departureId,
  quantity,
  expiresAt = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new AppError('Invalid bookingId', 400)
  }

  const parsedQuantity = parseReservationQuantity(quantity)

  const booking = await Booking.findOne({ _id: bookingId }).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })
  if (!booking) throw new AppError('Booking not found', 404)
  if (booking.bookingFlowVersion !== 'v2') {
    throw new AppError('Inventory reservation applies only to v2 bookings', 400)
  }
  if (booking.departureId?.toString() !== departureId.toString()) {
    throw new AppError('Departure does not match booking', 403)
  }

  const existingHold = await findActiveHoldForBooking(bookingId)
  if (existingHold) {
    if (existingHold.status === 'consumed') {
      return { hold: existingHold, idempotent: true, consumed: true }
    }
    if (existingHold.quantity !== parsedQuantity) {
      throw new AppError('Booking already has a reservation with different quantity', 409)
    }
    if (booking.inventoryReserved !== true) {
      await syncBookingInventoryFlags(bookingId, {
        reserved: true,
        quantity: existingHold.quantity,
      })
    }
    return { hold: existingHold, idempotent: true, consumed: false }
  }

  const { departure, tour } = await loadBookableDepartureContext(departureId)

  if (booking.organizationId?.toString() !== departure.organizationId?.toString()) {
    throw new AppError('Booking organization does not match departure', 403)
  }
  if (booking.organizationId?.toString() !== tour.organizationId?.toString()) {
    throw new AppError('Booking organization does not match tour', 403)
  }

  let hold
  try {
    hold = await InventoryHold.create({
      bookingId,
      departureId: departure._id,
      organizationId: departure.organizationId,
      quantity: parsedQuantity,
      status: 'pending',
      expiresAt,
    })
  } catch (err) {
    if (err?.code === 11000) {
      const raced = await findActiveHoldForBooking(bookingId)
      if (raced) {
        return { hold: raced, idempotent: true, consumed: raced.status === 'consumed' }
      }
    }
    throw err
  }

  try {
    await reserveDepartureSpots(departure._id, parsedQuantity)
  } catch (err) {
    await InventoryHold.findOneAndUpdate(
      { _id: hold._id, status: 'pending' },
      { status: 'released', releasedAt: new Date(), releaseReason: 'reserve_failed' }
    )
    throw err
  }

  const activated = await InventoryHold.findOneAndUpdate(
    { _id: hold._id, status: 'pending' },
    { status: 'held' },
    { new: true }
  )
  if (!activated) {
    await compensateDepartureRelease(departure._id, parsedQuantity)
    throw new AppError('Reservation activation conflict', 409)
  }

  const bookingUpdated = await Booking.updateOne(
    {
      _id: bookingId,
      $or: [{ inventoryReserved: { $ne: true } }, { inventoryReserved: null }],
    },
    {
      inventoryReserved: true,
      inventoryQuantity: parsedQuantity,
      inventoryReleasedAt: null,
    }
  )

  if (bookingUpdated.modifiedCount === 0) {
    const current = await Booking.findOne({ _id: bookingId }).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (current?.inventoryReserved) {
      return { hold: activated, idempotent: true, consumed: false }
    }
  }

  return { hold: activated, idempotent: false, consumed: false }
}

/**
 * Release inventory for a booking. Idempotent — safe to retry.
 */
export async function releaseForBooking({
  bookingId,
  reason = 'release',
  targetStatus = 'released',
}) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new AppError('Invalid bookingId', 400)
  }
  if (!['released', 'expired'].includes(targetStatus)) {
    throw new AppError('Invalid release target status', 400)
  }

  const hold = await InventoryHold.findOne({ bookingId })
  if (!hold) {
    return { released: false, idempotent: true, reason: 'no_hold' }
  }

  if (hold.status === 'released' || hold.status === 'expired') {
    return { hold, released: false, idempotent: true, reason: 'already_released' }
  }

  if (hold.status === 'consumed') {
    throw new AppError('Cannot release consumed reservation', 409)
  }

  if (hold.status === 'pending') {
    const cancelled = await InventoryHold.findOneAndUpdate(
      { _id: hold._id, status: 'pending' },
      {
        status: targetStatus,
        releasedAt: new Date(),
        releaseReason: reason,
      },
      { new: true }
    )
    if (cancelled) {
      await syncBookingInventoryFlags(bookingId, { reserved: false })
      return { hold: cancelled, released: false, idempotent: false, reason: 'pending_cancelled' }
    }
  }

  const releasedHold = await InventoryHold.findOneAndUpdate(
    { _id: hold._id, status: { $in: RELEASABLE_HOLD_STATUSES } },
    {
      status: targetStatus,
      releasedAt: new Date(),
      releaseReason: reason,
    },
    { new: true }
  )

  if (!releasedHold) {
    const current = await InventoryHold.findById(hold._id)
    if (current?.status === 'released' || current?.status === 'expired') {
      return { hold: current, released: false, idempotent: true, reason: 'already_released' }
    }
    if (current?.status === 'consumed') {
      throw new AppError('Cannot release consumed reservation', 409)
    }
    throw new AppError('Release conflict', 409)
  }

  await releaseDepartureSpots(releasedHold.departureId, releasedHold.quantity)
  await syncBookingInventoryFlags(bookingId, { reserved: false })

  return { hold: releasedHold, released: true, idempotent: false, reason }
}

/** Mark a held reservation as consumed (inventory stays decremented). */
export async function finalizeForBooking({ bookingId }) {
  const hold = await InventoryHold.findOneAndUpdate(
    { bookingId, status: 'held' },
    { status: 'consumed' },
    { new: true }
  )
  if (hold) return { hold, idempotent: false }

  const consumed = await InventoryHold.findOne({ bookingId, status: 'consumed' })
  if (consumed) return { hold: consumed, idempotent: true }

  throw new AppError('No active hold to finalize', 404)
}

/**
 * Restore inventory after a confirmed (consumed) booking is cancelled/refunded.
 * CAS: consumed → released. Restores departure spots exactly once.
 */
export async function restoreConsumedForBooking({
  bookingId,
  reason = 'refund_cancelled',
}) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new AppError('Invalid bookingId', 400)
  }

  const hold = await InventoryHold.findOne({ bookingId })
  if (!hold) {
    return { restored: false, idempotent: true, reason: 'no_hold' }
  }

  if (hold.status === 'released' || hold.status === 'expired') {
    return { hold, restored: false, idempotent: true, reason: 'already_released' }
  }

  if (hold.status !== 'consumed') {
    throw new AppError(
      `Cannot restore inventory from hold status ${hold.status}`,
      409
    )
  }

  const restoredHold = await InventoryHold.findOneAndUpdate(
    { _id: hold._id, status: 'consumed' },
    {
      status: 'released',
      releasedAt: new Date(),
      releaseReason: reason,
    },
    { new: true }
  )

  if (!restoredHold) {
    const current = await InventoryHold.findById(hold._id)
    if (current?.status === 'released' || current?.status === 'expired') {
      return { hold: current, restored: false, idempotent: true, reason: 'already_released' }
    }
    throw new AppError('Restore consumed hold conflict', 409)
  }

  await releaseDepartureSpots(restoredHold.departureId, restoredHold.quantity)
  await syncBookingInventoryFlags(bookingId, { reserved: false })

  return { hold: restoredHold, restored: true, idempotent: false, reason }
}

export async function assertReservationState(bookingId) {
  const [hold, booking] = await Promise.all([
    InventoryHold.findOne({ bookingId }),
    Booking.findOne({ _id: bookingId }).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    }),
  ])
  return { hold, booking }
}

export default {
  parseReservationQuantity,
  loadBookableDepartureContext,
  hasActiveReservationsForDeparture,
  assertManualInventoryEditAllowed,
  reserveForBooking,
  releaseForBooking,
  finalizeForBooking,
  restoreConsumedForBooking,
  assertReservationState,
  compensateDepartureRelease,
}
