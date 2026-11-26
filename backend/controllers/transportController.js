import Transport from '../models/Transport.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import APIFeatures from '../utils/apiFeatures.js'
import { isPrismaCatalog } from '../utils/catalogDb.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as transportRepo from '../repositories/prisma/transportRepository.js'
import * as reviewRepo from '../repositories/prisma/reviewRepository.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

// Test
export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

const mongooseGetAllTransports = factory.getAll(Transport)
const mongooseGetTransport = factory.getOne(Transport, {
  path: 'reviews createdBy',
  select: '-__v -createdAt -updatedAt',
})

export const getAllTransports = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const docs = await transportRepo.findMany(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllTransports(req, res, next)
})

export const getTransport = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const doc = await transportRepo.findPublicById(req.params.id)
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseGetTransport(req, res, next)
})

export const getTransportAvailability = catchAsync(async (req, res, next) => {
  if (!isPrismaCatalog()) {
    return next(
      new AppError('Transport availability requires Prisma catalog mode', 501)
    )
  }
  try {
    const { getPublicTransportAvailability } = await import(
      '../services/transportInventoryService.js'
    )
    const data = await getPublicTransportAvailability(req.params.id, req.query)
    return res.status(200).json({ status: 'success', data })
  } catch (e) {
    return next(e)
  }
})

// Create transport (Admin only)
export const createTransport = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id

  if (isPrismaApp()) {
    const transport = await catalogWrite.createTransport(req.body)
    return res.status(201).json({
      status: 'success',
      data: transport,
    })
  }

  const transport = await Transport.create(req.body)

  res.status(201).json({
    status: 'success',
    data: transport,
  })
})

// Get reviews of a specific transport
export const getTransportReviews = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const transport = await transportRepo.findPublicById(req.params.id)
    if (!transport) {
      return next(new AppError('No transport found with that ID', 404))
    }
    const reviews = await reviewRepo.findApproved('transport', req.params.id)
    return res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: reviews,
    })
  }

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
  if (req.body.createdBy) {
    delete req.body.createdBy
  }

  if (isPrismaApp()) {
    const doc = await catalogWrite.updateTransport(req.params.id, req.body)
    if (!doc) {
      return next(new AppError('No transport found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
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

// Delete transport
export const deleteTransport = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const ok = await catalogWrite.deleteTransport(req.params.id)
    if (!ok) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(204).json({ status: 'success', data: null })
  }

  const doc = await Transport.findByIdAndDelete(req.params.id)
  if (!doc) {
    return next(new AppError('No document found with that ID', 404))
  }
  res.status(204).json({ status: 'success', data: null })
})

// Get all routes (existing)
export const getAllRoutes = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const flattenedRoutes = await transportRepo.findAllRoutes()
    return res.status(200).json({
      status: 'success',
      results: flattenedRoutes.length,
      data: flattenedRoutes,
    })
  }

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
