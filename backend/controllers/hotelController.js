import Hotel from '../models/Hotel.js'
import Review from '../models/Review.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import { isPrismaCatalog } from '../utils/catalogDb.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as hotelRepo from '../repositories/prisma/hotelRepository.js'
import * as reviewRepo from '../repositories/prisma/reviewRepository.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

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

  if (isPrismaApp()) {
    const hotel = await catalogWrite.createHotel(req.body)
    return res.status(201).json({
      status: 'success',
      data: { data: hotel },
    })
  }

  const hotel = await Hotel.create(req.body)

  res.status(201).json({
    status: 'success',
    data: { data: hotel },
  })
})

const mongooseGetAllHotels = factory.getAll(Hotel)
const mongooseGetHotel = factory.getOne(Hotel, { path: 'reviews createdBy' })

export const getAllHotels = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const docs = await hotelRepo.findMany(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllHotels(req, res, next)
})

export const getHotel = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const doc = await hotelRepo.findPublicById(req.params.id)
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseGetHotel(req, res, next)
})

export const getHotelAvailability = catchAsync(async (req, res, next) => {
  if (!isPrismaCatalog()) {
    return next(
      new AppError('Hotel availability requires Prisma catalog mode', 501)
    )
  }
  try {
    const { getPublicHotelAvailability } = await import(
      '../services/hotelInventoryService.js'
    )
    const data = await getPublicHotelAvailability(req.params.id, req.query)
    return res.status(200).json({ status: 'success', data })
  } catch (e) {
    return next(e)
  }
})

export const updateHotel = catchAsync(async (req, res, next) => {
  delete req.body.createdBy

  if (isPrismaApp()) {
    const hotel = await catalogWrite.updateHotel(req.params.id, req.body)
    if (!hotel) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: hotel },
    })
  }

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
  if (isPrismaApp()) {
    const ok = await catalogWrite.deleteHotel(req.params.id)
    if (!ok) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(204).json({ status: 'success', data: null })
  }

  const hotel = await Hotel.findByIdAndDelete(req.params.id)
  if (!hotel) {
    return next(new AppError('No document found with that ID', 404))
  }
  res.status(204).json({ status: 'success', data: null })
})

export const getHotelReviews = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const reviews = await reviewRepo.findApproved('hotel', req.params.id)
    return res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews },
    })
  }

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
