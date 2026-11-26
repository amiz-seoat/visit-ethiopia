import Restaurant from '../models/Restaurants.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import { isPrismaCatalog } from '../utils/catalogDb.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as restaurantRepo from '../repositories/prisma/restaurantRepository.js'
import * as reviewRepo from '../repositories/prisma/reviewRepository.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

// Test route
export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// Filter for featured restaurants
export const featuredRestaurants = (req, res, next) => {
  req.query.isFeatured = 'true'
  req.query.sort = '-averageRating,price'
  next()
}

// ✅ Create a restaurant (Admin only)
export const createRestaurant = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id

  if (isPrismaApp()) {
    const restaurant = await catalogWrite.createRestaurant(req.body)
    return res.status(201).json({
      status: 'success',
      data: { restaurant },
    })
  }

  const restaurant = await Restaurant.create(req.body)

  res.status(201).json({
    status: 'success',
    data: {
      restaurant,
    },
  })
})

// ✅ Get reviews for a specific restaurant
export const getRestaurantReviews = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const restaurant = await restaurantRepo.findById(req.params.id)
    if (!restaurant) {
      return next(new AppError('No restaurant found with that ID', 404))
    }
    const reviews = await reviewRepo.findApproved('restaurant', req.params.id)
    return res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews },
    })
  }

  const restaurant = await Restaurant.findById(req.params.id).populate({
    path: 'reviews',
    populate: {
      path: 'user',
      select: 'name email',
    },
  })

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    results: restaurant.reviews.length,
    data: {
      reviews: restaurant.reviews,
    },
  })
})

const mongooseGetAllRestaurants = factory.getAll(Restaurant)
const mongooseGetRestaurant = factory.getOne(Restaurant, {
  path: 'reviews createdBy',
})
const mongooseUpdateRestaurant = factory.updateOne(Restaurant)
const mongooseDeleteRestaurant = factory.deleteOne(Restaurant)

export const getAllRestaurants = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const docs = await restaurantRepo.findMany(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllRestaurants(req, res, next)
})

export const getRestaurant = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const doc = await restaurantRepo.findById(req.params.id)
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseGetRestaurant(req, res, next)
})

export const updateRestaurant = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const doc = await catalogWrite.updateRestaurant(req.params.id, req.body)
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }
  return mongooseUpdateRestaurant(req, res, next)
})

export const deleteRestaurant = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const ok = await catalogWrite.deleteRestaurant(req.params.id)
    if (!ok) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(204).json({ status: 'success', data: null })
  }
  return mongooseDeleteRestaurant(req, res, next)
})
