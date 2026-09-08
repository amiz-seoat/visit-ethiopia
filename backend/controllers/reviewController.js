import Review from '../models/Review.js'
import Tour from '../models/Tour.js'
import Hotel from '../models/Hotel.js'
import Transport from '../models/Transport.js'
import Restaurant from '../models/Restaurants.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import APIFeatures from '../utils/apiFeatures.js'
import mongoose from 'mongoose'

const reviewItemModels = {
  tour: Tour,
  hotel: Hotel,
  transport: Transport,
  restaurant: Restaurant,
}

// Test
export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// Admin: Get all pending reviews
export const getPendingReviews = catchAsync(async (req, res, next) => {
  let query = Review.find({ status: 'pending' }).populate({
    path: 'user',
    select: 'FirstName LastName',
  })

  const features = new APIFeatures(query, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()

  const reviews = await features.query

  await Promise.all(
    reviews.map(async (review) => {
      const Model = reviewItemModels[review.itemType]
      if (!Model || !review.itemId) return

      const item = await Model.findById(review.itemId).select(
        'title name coverImage'
      )
      review.itemId = item
    })
  )

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      data: reviews,
    },
  })
})

async function refreshAverageRating(itemType, itemId) {
  const Model = reviewItemModels[itemType]
  if (!Model || !itemId) return

  const oid =
    typeof itemId === 'string' ? new mongoose.Types.ObjectId(itemId) : itemId

  const stats = await Review.aggregate([
    { $match: { itemType, itemId: oid, status: 'approved' } },
    {
      $group: {
        _id: '$itemId',
        avg: { $avg: '$rating' },
        n: { $sum: 1 },
      },
    },
  ])

  const averageRating = stats[0]?.avg ? Math.round(stats[0].avg * 10) / 10 : 0
  await Model.findByIdAndUpdate(itemId, { averageRating })
}

// Admin: Approve review
export const approveReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { status: 'approved' },
    { new: true, runValidators: true }
  )

  if (!review) {
    return next(new AppError('No document found with that ID', 404))
  }

  await refreshAverageRating(review.itemType, review.itemId)

  res.status(200).json({
    status: 'success',
    data: { data: review },
  })
})

export const rejectReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected' },
    { new: true, runValidators: true }
  )

  if (!review) {
    return next(new AppError('No document found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: review },
  })
})

// ✅ User: Create new review
export const createReview = catchAsync(async (req, res, next) => {
  const { itemType, itemId, rating } = req.body

  if (!itemType || !reviewItemModels[itemType]) {
    return next(new AppError('Invalid itemType for review', 400))
  }
  if (!itemId) {
    return next(new AppError('itemId is required', 400))
  }
  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('Rating must be between 1 and 5', 400))
  }

  const item = await reviewItemModels[itemType].findById(itemId)
  if (!item) {
    return next(new AppError('The reviewed item does not exist', 404))
  }

  const newReview = await Review.create({
    user: req.user.id,
    itemType,
    itemId,
    rating,
    title: req.body.title,
    comment: req.body.comment,
    images: req.body.images || [],
    dateOfExperience: req.body.dateOfExperience,
    status: 'pending',
  })

  res.status(201).json({
    status: 'success',
    data: newReview,
  })
})

// ✅ User: Get current user's reviews
export const getMyReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ user: req.user.id })

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: reviews,
  })
})

// ✅ Update review (owner only)
export const updateReview = catchAsync(async (req, res, next) => {
  // Find the review and check if user owns it
  const review = await Review.findById(req.params.id)

  if (!review) {
    return next(new AppError('No review found with that ID', 404))
  }

  // Check if the current user is the owner of the review
  const ownerId = review.user?._id?.toString?.() ?? review.user?.toString?.()
  if (ownerId !== req.user.id) {
    return next(new AppError('You can only update your own reviews', 403))
  }

  // Prevent privilege escalation via status / user field
  delete req.body.user
  delete req.body.status
  delete req.body.itemType
  delete req.body.itemId

  // Update the review
  const updatedReview = await Review.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  )

  res.status(200).json({
    status: 'success',
    data: { data: updatedReview },
  })
})

// ✅ Delete review (owner/admin)
export const deleteReview = catchAsync(async (req, res, next) => {
  // Find the review
  const review = await Review.findById(req.params.id)

  if (!review) {
    return next(new AppError('No review found with that ID', 404))
  }

  // Check if the current user is the owner of the review OR an admin
  const ownerId = review.user?._id?.toString?.() ?? review.user?.toString?.()
  if (ownerId !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only delete your own reviews', 403))
  }

  // Delete the review
  await Review.findByIdAndDelete(req.params.id)

  res.status(204).json({
    status: 'success',
    data: null,
  })
})
