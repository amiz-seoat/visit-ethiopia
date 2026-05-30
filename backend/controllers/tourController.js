import Tour from '../models/Tour.js'
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

export const featuredTours = (req, res, next) => {
  req.query.isFeatured = 'true'
  req.query.sort = '-averageRating,price'
  next()
}

// ✅ Create a tour
export const createTour = factory.createOne(Tour)

// ✅ Delete a tour
export const deleteTour = factory.deleteOne(Tour)

// ✅ Update a tour
export const updateTour = factory.updateOne(Tour)

// ✅ Get all tours
export const getAllTours = factory.getAll(Tour)

// ✅ Get a single tour with populated reviews
export const getTour = factory.getOne(Tour, { path: 'reviews' })

// ✅ Get reviews for a specific tour (using itemId + itemType)
export const getTourReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ 
    itemId: req.params.id, 
    itemType: 'tour' 
  })

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: { reviews },
  })
})
