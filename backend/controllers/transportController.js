import Transport from '../models/Transport.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import APIFeatures from '../utils/apiFeatures.js'

// Test
export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// Existing
export const getAllTransports = factory.getAll(Transport)
export const getTransport = factory.getOne(Transport, {
  path: 'reviews createdBy',
  select: '-__v -createdAt -updatedAt',
})

// Create transport (Admin only)
export const createTransport = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id // ensure logged-in user is recorded

  const transport = await Transport.create(req.body)

  res.status(201).json({
    status: 'success',
    data: transport,
  })
})

// Get reviews of a specific transport
export const getTransportReviews = catchAsync(async (req, res, next) => {
  const transport = await Transport.findById(req.params.id).populate({
    path: 'reviews',
    populate: { path: 'user', select: 'name email' },
  })

  if (!transport) {
    return next(new AppError('No transport found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    results: transport.reviews.length,
    data: transport.reviews,
  })
})

// Update transport (Admin only)
export const updateTransport = catchAsync(async (req, res, next) => {
  // Prevent updating createdBy field
  if (req.body.createdBy) {
    delete req.body.createdBy
  }

  const doc = await Transport.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  if (!doc) {
    return next(new AppError('No transport found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: doc },
  })
})

// Delete transport (Admin only)
export const deleteTransport = factory.deleteOne(Transport)

// Get all routes (existing)
export const getAllRoutes = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Transport.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()

  const transports = await features.query

  const flattenedRoutes = transports.flatMap((transport) =>
    transport.routes.map((route) => ({
      transportId: transport._id,
      transportName: transport.name,
      type: transport.type,
      vehicleDetails: transport.vehicleDetails,
      contact: transport.contact,
      ...route.toObject(),
    }))
  )

  res.status(200).json({
    status: 'success',
    results: flattenedRoutes.length,
    data: flattenedRoutes,
  })
})
