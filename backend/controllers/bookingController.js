import Booking from '../models/Booking.js'
import Tour from '../models/Tour.js'
import Hotel from '../models/Hotel.js'
import Transport from '../models/Transport.js'
import Restaurant from '../models/Restaurants.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import APIFeatures from '../utils/apiFeatures.js'

const bookingItemModels = {
  tour: Tour,
  hotel: Hotel,
  transport: Transport,
  restaurant: Restaurant,
}

// Create new booking
export const createBooking = catchAsync(async (req, res, next) => {
  const {
    bookingType,
    bookingItem,
    bookingDetails,
    contactInfo,
    payment,
    notes,
  } = req.body

  // Validate required fields one by one for better error messages
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

  const booking = await Booking.create({
    user: req.user.id, // from auth middleware
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

// Get all bookings (admin only)
export const getAllBookings = catchAsync(async (req, res, next) => {
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

// Get current user's bookings
export const getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id }).sort({
    createdAt: -1,
  })

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: bookings,
  })
})

// cancel booking
export const cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    return next(new AppError('No booking found with that ID', 404))
  }
  if (booking.user._id.toString() !== req.user.id) {
    return next(
      new AppError(`You do not have permission to cancel this booking`, 403)
    )
  }
  if (booking.status === 'cancelled') {
    return next(new AppError('Booking is already cancelled', 400))
  }
  if (booking.status === 'completed') {
    return next(new AppError('Completed bookings cannot be cancelled', 400))
  }
  booking.status = 'cancelled'
  await booking.save()
  res.status(200).json({
    status: 'success',
    data: booking,
  })
})

//update booking status(admin only)
export const updateBookingStatus = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    return next(new AppError('No booking found with that ID', 404))
  }

  const allowedStatuses = ['confirmed', 'pending', 'cancelled', 'completed']

  // Check if status is provided and valid
  if (!req.body.status || !allowedStatuses.includes(req.body.status)) {
    return next(new AppError('Invalid booking status!', 400))
  }

  // Update the status
  booking.status = req.body.status
  await booking.save()

  res.status(200).json({
    status: 'success',
    data: booking,
  })
})
