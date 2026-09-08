import Tour from '../models/Tour.js'
import Review from '../models/Review.js'
import OrganizationMember from '../models/OrganizationMember.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import APIFeatures from '../utils/apiFeatures.js'
import { isOrganizationPubliclyVisible, organizationIdsPubliclyVisible } from '../services/tourVisibilityService.js'
import { isPublicTourStatus } from '../config/tourLifecycle.js'

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

export const createTour = catchAsync(async (req, res, next) => {
  // Always stamp creator from authenticated user; ignore client-supplied createdBy
  req.body.createdBy = req.user.id
  delete req.body.secretTour // non-admins cannot create secret tours via body unless admin
  if (req.user.role !== 'admin') {
    req.body.secretTour = false
  }

  // Organization-linked tours must use the organization tour API
  delete req.body.organizationId
  delete req.body.publishedAt
  delete req.body.archivedAt
  if (req.user.role !== 'admin') {
    delete req.body.averageRating
    delete req.body.reviewCount
    delete req.body.status
  }

  const doc = await Tour.create(req.body)
  res.status(201).json({
    status: 'success',
    data: { data: doc },
  })
})

export const updateTour = catchAsync(async (req, res, next) => {
  const existing = await Tour.findById(req.params.id)
  if (!existing) {
    return next(new AppError('No document found with that ID', 404))
  }
  if (existing.organizationId) {
    return next(
      new AppError(
        'Organization tours must be updated through the organization tour API',
        403
      )
    )
  }

  delete req.body.createdBy
  delete req.body.organizationId
  delete req.body.slug
  if (req.user.role !== 'admin') {
    delete req.body.secretTour
  }

  const doc = await Tour.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    status: 'success',
    data: { data: doc },
  })
})

export const deleteTour = catchAsync(async (req, res, next) => {
  const existing = await Tour.findById(req.params.id)
  if (!existing) {
    return next(new AppError('No document found with that ID', 404))
  }
  if (existing.organizationId) {
    return next(
      new AppError(
        'Organization tours must be deleted through the organization tour API',
        403
      )
    )
  }

  await Tour.findByIdAndDelete(req.params.id)
  res.status(204).json({
    status: 'success',
    data: null,
  })
})

export const getAllTours = catchAsync(async (req, res) => {
  const isPublicConsumer =
    !req.user ||
    req.user.role === 'customer' ||
    req.user.role === 'user' ||
    req.query.status === 'active' ||
    req.query.status === 'published'

  let baseFilter = {}
  if (isPublicConsumer) {
    const publicOrgIds = await organizationIdsPubliclyVisible()
    baseFilter = {
      secretTour: { $ne: true },
      $or: [
        { organizationId: null, status: { $in: ['active', 'published'] } },
        {
          organizationId: { $in: publicOrgIds },
          status: { $in: ['published', 'active'] },
        },
      ],
    }
  }

  const features = new APIFeatures(Tour.find(baseFilter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()

  const tours = await features.query

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: { data: tours },
  })
})

export const getTour = catchAsync(async (req, res, next) => {
  let query = Tour.findById(req.params.id).populate({ path: 'reviews' })
  const doc = await query
  if (!doc) {
    return next(new AppError('No document found with that ID', 404))
  }

  const isAdmin = req.user?.role === 'admin'

  if (doc.organizationId) {
    const visible = await isOrganizationPubliclyVisible(doc.organizationId)
    const isPublic = isPublicTourStatus(doc.status) && !doc.secretTour

    if (!isPublic || !visible) {
      if (isAdmin) {
        // admin may inspect
      } else if (req.user?.id) {
        const member = await OrganizationMember.findOne({
          organizationId: doc.organizationId,
          userId: req.user.id,
          status: 'active',
        })
        if (!member) {
          return next(new AppError('No document found with that ID', 404))
        }
      } else {
        return next(new AppError('No document found with that ID', 404))
      }
    }
  } else if ((!isPublicTourStatus(doc.status) || doc.secretTour) && !isAdmin) {
    return next(new AppError('No document found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: doc },
  })
})

export const getTourReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({
    itemId: req.params.id,
    itemType: 'tour',
    status: 'approved',
  })

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: { reviews },
  })
})
