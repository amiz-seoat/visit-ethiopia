import Destination from '../models/Destination.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'

// Just for testing
export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// ✅ Get featured destinations
export const featuredDestinations = (req, res, next) => {
  req.query.isFeatured = 'true'
  next()
}

// ✅ Reuse factory for common CRUD
export const getAllDestinations = factory.getAll(Destination)
export const getDestination = factory.getOne(Destination)
// ✅ Get featured destinations

export const createDestination = factory.createOne(Destination) // (Admin only)

export const updateDestination = factory.updateOne(Destination)
export const deleteDestination = factory.deleteOne(Destination)

// ✅ Get Tours for a Destination
export const getToursForDestination = catchAsync(async (req, res, next) => {
  const destination = await Destination.findById(req.params.id).populate(
    'tours'
  )

  if (!destination) {
    return next(new AppError('No destination found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    results: destination.tours.length,
    data: {
      tours: destination.tours,
    },
  })
})
