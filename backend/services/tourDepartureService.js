import TourDeparture from '../models/TourDeparture.js'
import InventoryHold from '../models/InventoryHold.js'
import AppError from '../utils/appError.js'

function parseDate(value, fieldName) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400)
  }
  return date
}

function validateDeparturePackages(packages = []) {
  for (const pkg of packages) {
    if (!pkg.key) throw new AppError('Package key is required', 400)
    if (pkg.priceMinor != null) {
      if (!Number.isInteger(pkg.priceMinor) || pkg.priceMinor < 0) {
        throw new AppError('Package priceMinor must be a non-negative integer', 400)
      }
    }
  }
}

export async function createDeparture({
  tour,
  organizationId,
  payload,
}) {
  const capacity = Number(payload.capacity)
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new AppError('capacity must be a positive integer', 400)
  }

  const departureDate = parseDate(payload.departureDate, 'departureDate')
  if (!departureDate) throw new AppError('departureDate is required', 400)

  const returnDate = parseDate(payload.returnDate, 'returnDate')
  if (returnDate && returnDate < departureDate) {
    throw new AppError('returnDate cannot be before departureDate', 400)
  }

  let availableSpots =
    payload.availableSpots != null ? Number(payload.availableSpots) : capacity

  if (!Number.isInteger(availableSpots) || availableSpots < 0 || availableSpots > capacity) {
    throw new AppError('availableSpots must be an integer between 0 and capacity', 400)
  }

  validateDeparturePackages(payload.packages)

  const status = payload.status || 'open'
  if (status === 'open' && availableSpots === 0) {
    throw new AppError('open departures must have availableSpots > 0', 400)
  }

  return TourDeparture.create({
    tourId: tour._id,
    organizationId,
    departureDate,
    returnDate,
    capacity,
    availableSpots,
    status,
    packages: payload.packages || [],
    notes: payload.notes || '',
  })
}

export async function updateDeparture(departure, updates) {
  if (
    updates.availableSpots !== undefined &&
    updates.availableSpots !== departure.availableSpots
  ) {
    const activeHold = await InventoryHold.exists({
      departureId: departure._id,
      status: { $in: ['held', 'consumed'] },
    })
    if (activeHold) {
      throw new AppError(
        'Cannot manually change availableSpots while active v2 bookings exist for this departure',
        409
      )
    }
  }

  const capacity =
    updates.capacity != null ? Number(updates.capacity) : departure.capacity
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new AppError('capacity must be a positive integer', 400)
  }

  let availableSpots =
    updates.availableSpots != null
      ? Number(updates.availableSpots)
      : departure.availableSpots

  if (
    !Number.isInteger(availableSpots) ||
    availableSpots < 0 ||
    availableSpots > capacity
  ) {
    throw new AppError('availableSpots must be an integer between 0 and capacity', 400)
  }

  if (updates.departureDate) {
    departure.departureDate = parseDate(updates.departureDate, 'departureDate')
  }
  if (updates.returnDate !== undefined) {
    departure.returnDate = updates.returnDate
      ? parseDate(updates.returnDate, 'returnDate')
      : null
  }
  if (
    departure.returnDate &&
    departure.returnDate < departure.departureDate
  ) {
    throw new AppError('returnDate cannot be before departureDate', 400)
  }

  if (updates.status) {
    const allowed = ['scheduled', 'open', 'full', 'cancelled', 'completed']
    if (!allowed.includes(updates.status)) {
      throw new AppError('Invalid departure status', 400)
    }
    departure.status = updates.status
  }
  if (updates.packages) {
    validateDeparturePackages(updates.packages)
    departure.packages = updates.packages
  }
  if (updates.notes !== undefined) departure.notes = updates.notes

  departure.capacity = capacity
  departure.availableSpots = availableSpots
  if (departure.availableSpots === 0 && departure.status === 'open') {
    departure.status = 'full'
  } else if (departure.status === 'full' && departure.availableSpots > 0) {
    departure.status = 'open'
  }

  await departure.save()
  return departure
}

/**
 * Atomically reserve spots. Returns updated departure or throws if unavailable.
 */
export async function reserveDepartureSpots(departureId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  const updated = await TourDeparture.findOneAndUpdate(
    {
      _id: departureId,
      status: 'open',
      availableSpots: { $gte: quantity },
    },
    {
      $inc: { availableSpots: -quantity },
    },
    { new: true }
  )

  if (!updated) {
    throw new AppError('Not enough available spots', 409)
  }

  if (updated.availableSpots === 0) {
    updated.status = 'full'
    await updated.save()
  }

  return updated
}

export async function releaseDepartureSpots(departureId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('quantity must be a positive integer', 400)
  }

  const updated = await TourDeparture.findOneAndUpdate(
    { _id: departureId },
    [
      {
        $set: {
          availableSpots: {
            $min: [{ $add: ['$availableSpots', quantity] }, '$capacity'],
          },
        },
      },
    ],
    { new: true }
  )

  if (!updated) throw new AppError('Departure not found', 404)

  if (updated.status === 'full' && updated.availableSpots > 0) {
    updated.status = 'open'
    await updated.save()
  }

  return updated
}

export default {
  createDeparture,
  updateDeparture,
  reserveDepartureSpots,
  releaseDepartureSpots,
}
