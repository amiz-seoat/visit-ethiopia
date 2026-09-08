import Hotel from '../models/Hotel.js'
import Review from '../models/Review.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'

export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

export const featuredHotels = (req, res, next) => {
  req.query.isFeatured = 'true'
  req.query.sort = '-averageRating'
  next()
}

export const createHotel = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id

  const hotel = await Hotel.create(req.body)

  res.status(201).json({
    status: 'success',
    data: { data: hotel },
  })
})

export const getAllHotels = factory.getAll(Hotel)

export const getHotel = factory.getOne(Hotel, { path: 'reviews createdBy' })

export const updateHotel = catchAsync(async (req, res, next) => {
  delete req.body.createdBy

  const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  if (!hotel) {
    return next(new AppError('No document found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: hotel },
  })
})

export const deleteHotel = catchAsync(async (req, res, next) => {
  const hotel = await Hotel.findByIdAndDelete(req.params.id)
  if (!hotel) {
    return next(new AppError('No document found with that ID', 404))
  }
  res.status(204).json({ status: 'success', data: null })
})

export const getHotelReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({
    itemId: req.params.id,
    itemType: 'hotel',
    status: 'approved',
  })

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: { reviews },
  })
})
