import Booking from '../models/Booking.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import APIFeatures from '../utils/apiFeatures.js'
import Tour from '../models/Tour.js'
import Hotel from '../models/Hotel.js'
import Transport from '../models/Transport.js'
import Restaurant from '../models/Restaurants.js'
import { isV2BookingFlow } from '../config/booking.js'
import {
  createTourBooking,
  formatTourBookingResponse,
} from '../services/tourBookingService.js'
import {
  serializeV2Booking,
} from '../services/bookingLifecycleService.js'
import { isPrismaBooking } from '../repositories/booking/index.js'
import {
  findBookingById,
  listBookingsForUser,
  listBookingsAdmin,
  createBooking as createPrismaBooking,
  updateBooking as updatePrismaBooking,
} from '../repositories/booking/prismaBookingRepository.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

const bookingItemModels = {
  tour: Tour,
  hotel: Hotel,
  transport: Transport,
  restaurant: Restaurant,
}

// Legacy booking creation (Phase 1–3)
export const createBooking = catchAsync(async (req, res, next) => {
  const {
    bookingType,
    bookingItem,
    bookingDetails,
    contactInfo,
    payment,
    notes,
  } = req.body

  if (!bookingType) return next(new AppError('bookingType is required', 400))
  if (!bookingItem) return next(new AppError('bookingItem is required', 400))

  if (!contactInfo) return next(new AppError('contactInfo is required', 400))
  if (!contactInfo.fullName)
    return next(new AppError('contactInfo.fullName is required', 400))
  if (!contactInfo.email)
    return next(new AppError('contactInfo.email is required', 400))
  if (!contactInfo.phone)
    return next(new AppError('contactInfo.phone is required', 400))

  if (!payment) return next(new AppError('payment is required', 400))
  if (!payment.amount)
    return next(new AppError('payment.amount is required', 400))
  if (!payment.paymentMethod)
    return next(new AppError('payment.paymentMethod is required', 400))

  if (isPrismaBooking()) {
    const booking = await createPrismaBooking({
      userId: req.user.id,
      bookingFlowVersion: 'legacy',
      bookingType,
      bookingItemId: bookingItem,
      bookingDetails: bookingDetails || {},
      contactInfo,
      legacyPayment: payment,
      notes: notes || null,
      status: 'pending',
    })
    return res.status(201).json({
      status: 'success',
      data: booking,
    })
  }

  const booking = await Booking.create({
    user: req.user.id,
    bookingType,
    bookingItem,
    bookingDetails,
    contactInfo,
    payment,
    notes,
  })

  res.status(201).json({
    status: 'success',
    data: booking,
  })
})

/** Phase 4C — v2 tour departure booking with server-side pricing. */
export const createTourDepartureBooking = catchAsync(async (req, res, next) => {
  const idempotencyKey =
    req.headers['idempotency-key'] || req.headers['Idempotency-Key']

  const result = await createTourBooking({
    userId: req.user.id,
    body: req.body,
    idempotencyKey,
  })

  const statusCode = result.idempotent ? 200 : 201
  res.status(statusCode).json({
    status: 'success',
    idempotent: result.idempotent,
    data: formatTourBookingResponse(result.booking, result.payment),
  })
})

/** Hotel v2 booking with multi-night daily inventory + mock payment. */
export const createHotelInventoryBooking = catchAsync(async (req, res, next) => {
  if (!isPrismaBooking()) {
    return next(
      new AppError('Hotel inventory booking requires Prisma mode', 501)
    )
  }
  const idempotencyKey =
    req.headers['idempotency-key'] || req.headers['Idempotency-Key']

  const { createHotelBookingPrisma } = await import(
    '../services/prismaBookingDomainService.js'
  )
  const result = await createHotelBookingPrisma({
    userId: req.user.id,
    body: req.body,
    idempotencyKey,
  })

  const statusCode = result.idempotent ? 200 : 201
  res.status(statusCode).json({
    status: 'success',
    idempotent: result.idempotent,
    data: formatTourBookingResponse(result.booking, result.payment),
  })
})

/** Transport v2 booking with route-date seat inventory + mock payment. */
export const createTransportInventoryBooking = catchAsync(async (req, res, next) => {
  if (!isPrismaBooking()) {
    return next(
      new AppError('Transport inventory booking requires Prisma mode', 501)
    )
  }
  const idempotencyKey =
    req.headers['idempotency-key'] || req.headers['Idempotency-Key']

  const { createTransportBookingPrisma } = await import(
    '../services/prismaBookingDomainService.js'
  )
  const result = await createTransportBookingPrisma({
    userId: req.user.id,
    body: req.body,
    idempotencyKey,
  })

  const statusCode = result.idempotent ? 200 : 201
  res.status(statusCode).json({
    status: 'success',
    idempotent: result.idempotent,
    data: formatTourBookingResponse(result.booking, result.payment),
  })
})

export const getAllBookings = catchAsync(async (req, res, next) => {
  if (isPrismaBooking()) {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
    const bookings = await listBookingsAdmin({
      status: req.query.status,
      bookingType: req.query.bookingType,
      organizationId: req.query.organizationId,
      userId: req.query.user,
      limit,
      skip: (page - 1) * limit,
    })

    await Promise.all(
      bookings.map(async (booking) => {
        if (!booking.bookingItem || !booking.bookingType) return
        const item = await catalogWrite.findCatalogItem(
          booking.bookingType,
          booking.bookingItem
        )
        if (item) {
          booking.bookingItem = {
            _id: item._id,
            title: item.title,
            name: item.name,
            coverImage: item.coverImage,
            price: item.price,
          }
        }
      })
    )

    return res.status(200).json({
      status: 'success',
      results: bookings.length,
      data: {
        data: bookings,
      },
    })
  }

  let query = Booking.find().populate({
    path: 'user',
    select: 'FirstName LastName email',
  })

  const features = new APIFeatures(query, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()

  const bookings = await features.query

  await Promise.all(
    bookings.map(async (booking) => {
      const Model = bookingItemModels[booking.bookingType]
      if (!Model || !booking.bookingItem) return

      const item = await Model.findById(booking.bookingItem).select(
        'title name coverImage price'
      )
      booking.bookingItem = item
    })
  )

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      data: bookings,
    },
  })
})

export const getMyBookings = catchAsync(async (req, res, next) => {
  if (isPrismaBooking()) {
    const bookings = await listBookingsForUser(req.user.id)
    return res.status(200).json({
      status: 'success',
      results: bookings.length,
      data: bookings,
    })
  }

  const bookings = await Booking.find({ user: req.user.id }).sort({
    createdAt: -1,
  })

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: bookings,
  })
})

export const getBookingById = catchAsync(async (req, res, next) => {
  if (isPrismaBooking()) {
    const booking = await findBookingById(req.params.id)
    if (!booking) {
      return next(new AppError('No booking found with that ID', 404))
    }

    const ownerId = booking.user?.toString?.() ?? String(booking.user)
    if (ownerId !== req.user.id && req.user.role !== 'admin') {
      return next(
        new AppError('You do not have permission to view this booking', 403)
      )
    }

    const data = isV2BookingFlow(booking)
      ? serializeV2Booking(booking)
      : booking

    return res.status(200).json({
      status: 'success',
      data,
    })
  }

  const booking = await Booking.findById(req.params.id)

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404))
  }

  const ownerId = booking.user?._id?.toString?.() ?? booking.user?.toString?.()
  if (ownerId !== req.user.id && req.user.role !== 'admin') {
    return next(
      new AppError('You do not have permission to view this booking', 403)
    )
  }

  const data = isV2BookingFlow(booking)
    ? serializeV2Booking(booking)
    : booking

  res.status(200).json({
    status: 'success',
    data,
  })
})

export const cancelBooking = catchAsync(async (req, res, next) => {
  let booking
  if (isPrismaBooking()) {
    booking = await findBookingById(req.params.id)
  } else {
    booking = await Booking.findById(req.params.id).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
  }
  if (!booking) {
    return next(new AppError('No booking found with that ID', 404))
  }

  const idempotencyKey =
    req.headers['idempotency-key'] || req.headers['Idempotency-Key']
  const mockOutcomeHeader =
    req.headers['x-mock-refund-outcome'] ||
    req.headers['X-Mock-Refund-Outcome']
  const mockOutcome =
    mockOutcomeHeader === 'fail' || req.body?.mockOutcome === 'fail'
      ? 'fail'
      : 'success'

  const {
    cancelOrRefundBookingForUser,
    serializeRefund,
  } = await import('../services/refundService.js')

  const result = await cancelOrRefundBookingForUser(booking, req.user, {
    reason: req.body?.reason,
    idempotencyKey,
    mockOutcome,
    body: req.body || {},
  })

  const data = isV2BookingFlow(result.booking)
    ? serializeV2Booking(result.booking)
    : result.booking

  res.status(200).json({
    status: 'success',
    idempotent: result.idempotent || false,
    failed: Boolean(result.failed),
    data,
    ...(result.refund ? { refund: serializeRefund(result.refund) } : {}),
    ...(result.payment
      ? {
          payment: {
            _id: result.payment._id,
            status: result.payment.status,
            amountMinor: result.payment.amountMinor,
            amountRefundedMinor: result.payment.amountRefundedMinor || 0,
            currency: result.payment.currency,
          },
        }
      : {}),
  })
})

export const updateBookingStatus = catchAsync(async (req, res, next) => {
  let booking
  if (isPrismaBooking()) {
    booking = await findBookingById(req.params.id)
  } else {
    booking = await Booking.findById(req.params.id)
  }

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404))
  }

  if (isV2BookingFlow(booking)) {
    return next(
      new AppError('Use the v2 booking lifecycle endpoints for this booking', 400)
    )
  }

  const allowedStatuses = ['confirmed', 'pending', 'cancelled', 'completed']

  if (!req.body.status || !allowedStatuses.includes(req.body.status)) {
    return next(new AppError('Invalid booking status!', 400))
  }

  if (isPrismaBooking()) {
    booking = await updatePrismaBooking(req.params.id, {
      status: req.body.status,
    })
    return res.status(200).json({
      status: 'success',
      data: booking,
    })
  }

  booking.status = req.body.status
  await booking.save()

  res.status(200).json({
    status: 'success',
    data: booking,
  })
})
