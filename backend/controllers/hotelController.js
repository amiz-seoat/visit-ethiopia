import Hotel from '../models/Hotel.js'
import Review from '../models/Review.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'

// ✅ Test endpoint
export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// ✅ Featured hotels middleware
export const featuredHotels = (req, res, next) => {
  req.query.isFeatured = 'true'
  req.query.sort = '-averageRating,price'
  next()
}

// ✅ Create hotel (admin only)
export const createHotel = catchAsync(async (req, res, next) => {
  console.log('👉 Incoming hotel body:', req.body)
  console.log('👉 Authenticated user:', req.user)

  // set creator automatically
  req.body.createdBy = req.user._id

  const hotel = await Hotel.create(req.body)

  console.log('✅ Hotel created:', hotel._id)

  res.status(201).json({
    status: 'success',
    data: hotel,
  })
})

// ✅ Get all hotels
export const getAllHotels = factory.getAll(Hotel)

// ✅ Get single hotel with reviews + createdBy
export const getHotel = factory.getOne(Hotel, { path: 'reviews createdBy' })

// ✅ Update hotel (admin only)
export const updateHotel = factory.updateOne(Hotel)

// ✅ Delete hotel (admin only)
export const deleteHotel = factory.deleteOne(Hotel)

// ✅ Get hotel reviews
export const getHotelReviews = catchAsync(async (req, res, next) => {
  const hotel = await Hotel.findById(req.params.id).populate({
    path: 'reviews',
    populate: { path: 'createdBy', select: 'name email' },
  })

  if (!hotel) {
    return next(new AppError('No hotel found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    results: hotel.reviews.length,
    data: { reviews: hotel.reviews },
  })
})
