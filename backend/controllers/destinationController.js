import Destination from '../models/Destination.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import { isPrismaCatalog } from '../utils/catalogDb.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as destinationRepo from '../repositories/prisma/destinationRepository.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

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

const mongooseGetAllDestinations = factory.getAll(Destination)
const mongooseGetDestination = factory.getOne(Destination)
const mongooseCreateDestination = factory.createOne(Destination)
const mongooseUpdateDestination = factory.updateOne(Destination)
const mongooseDeleteDestination = factory.deleteOne(Destination)

export const getAllDestinations = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const docs = await destinationRepo.findMany(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllDestinations(req, res, next)
})

export const getDestination = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const doc = await destinationRepo.findById(req.params.id)
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseGetDestination(req, res, next)
})

export const createDestination = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const doc = await catalogWrite.createDestination(req.body)
    return res.status(201).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseCreateDestination(req, res, next)
})

export const updateDestination = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const doc = await catalogWrite.updateDestination(req.params.id, req.body)
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseUpdateDestination(req, res, next)
})

export const deleteDestination = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const ok = await catalogWrite.deleteDestination(req.params.id)
    if (!ok) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(204).json({ status: 'success', data: null })
  }
  return mongooseDeleteDestination(req, res, next)
})

// ✅ Get Tours for a Destination
export const getToursForDestination = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const tours = await destinationRepo.findToursForDestination(req.params.id)
    if (!tours) {
      return next(new AppError('No destination found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      results: tours.length,
      data: { tours },
    })
  }

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
