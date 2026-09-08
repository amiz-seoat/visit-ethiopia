import mongoose from 'mongoose'
import Tour from '../models/Tour.js'
import TourDeparture from '../models/TourDeparture.js'
import Organization from '../models/Organization.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import APIFeatures from '../utils/apiFeatures.js'
import {
  filterPubliclyVisibleTours,
  organizationIdsPubliclyVisible,
  isOrganizationPubliclyVisible,
} from '../services/tourVisibilityService.js'
import { isPublicTourStatus } from '../config/tourLifecycle.js'
import {
  serializePublicTour,
  loadPublicOrganizationForTour,
} from '../services/publicTourService.js'
import { loadPublicOrganizationBySlug } from '../services/organizationVersionService.js'
import { escapeRegex } from '../utils/escapeRegex.js'

export const listMarketplaceTours = catchAsync(async (req, res) => {
  const publicOrgIds = await organizationIdsPubliclyVisible()

  const filter = {
    secretTour: { $ne: true },
    $or: [
      { organizationId: null, status: { $in: ['active', 'published'] } },
      {
        organizationId: { $in: publicOrgIds },
        status: { $in: ['published', 'active'] },
      },
    ],
  }

  if (req.query.destination) {
    filter.destinations = {
      $regex: escapeRegex(req.query.destination),
      $options: 'i',
    }
  }
  if (req.query.organizationId) {
    const orgId = String(req.query.organizationId)
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(200).json({ status: 'success', results: 0, data: { data: [] } })
    }
    const allowed = publicOrgIds.some((id) => id.toString() === orgId)
    if (!allowed) {
      return res.status(200).json({ status: 'success', results: 0, data: { data: [] } })
    }
    filter.$and = filter.$and || []
    filter.$and.push({ organizationId: orgId })
  }
  if (req.query.minPrice) {
    filter.price = { ...(filter.price || {}), $gte: Number(req.query.minPrice) }
  }
  if (req.query.maxPrice) {
    filter.price = { ...(filter.price || {}), $lte: Number(req.query.maxPrice) }
  }
  if (req.query.durationDays) {
    filter['duration.days'] = Number(req.query.durationDays)
  }
  if (req.query.packageType) {
    filter['packages.key'] = String(req.query.packageType).toLowerCase()
  }
  if (req.query.search) {
    const q = escapeRegex(String(req.query.search))
    filter.$and = filter.$and || []
    filter.$and.push({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { shortDescription: { $regex: q, $options: 'i' } },
        { destinations: { $regex: q, $options: 'i' } },
      ],
    })
  }

  let query = Tour.find(filter)
  const features = new APIFeatures(query, req.query).sort().limitFields().paginate()
  const tours = await features.query

  const serialized = []
  for (const tour of tours) {
    if (tour.organizationId) {
      const orgData = await loadPublicOrganizationForTour(tour)
      if (!orgData) continue
      serialized.push(
        serializePublicTour(tour, orgData.organization, orgData.approvedVersion)
      )
    } else {
      serialized.push(serializePublicTour(tour))
    }
  }

  res.status(200).json({
    status: 'success',
    results: serialized.length,
    data: { data: serialized },
  })
})

export const getTourBySlugOrId = catchAsync(async (req, res, next) => {
  const param = req.params.id || req.params.slug
  let tour = null

  if (mongoose.Types.ObjectId.isValid(param) && String(param).length === 24) {
    tour = await Tour.findById(param)
  } else {
    tour = await Tour.findOne({ slug: param.toLowerCase() })
  }

  if (!tour) return next(new AppError('Tour not found', 404))

  if (tour.secretTour) return next(new AppError('Tour not found', 404))

  if (!isPublicTourStatus(tour.status)) {
    return next(new AppError('Tour not found', 404))
  }

  if (tour.organizationId) {
    const visible = await isOrganizationPubliclyVisible(tour.organizationId)
    if (!visible) return next(new AppError('Tour not found', 404))
    const orgData = await loadPublicOrganizationForTour(tour)
    if (!orgData) return next(new AppError('Tour not found', 404))
    const data = serializePublicTour(
      tour,
      orgData.organization,
      orgData.approvedVersion
    )
    return res.status(200).json({ status: 'success', data: { data } })
  }

  const data = serializePublicTour(tour)
  res.status(200).json({ status: 'success', data: { data } })
})

export const listPublicTourDepartures = catchAsync(async (req, res, next) => {
  const param = req.params.id || req.params.tourSlug || req.params.slug
  let tour = null

  if (mongoose.Types.ObjectId.isValid(param) && String(param).length === 24) {
    tour = await Tour.findById(param)
  } else {
    tour = await Tour.findOne({ slug: param.toLowerCase() })
  }

  if (!tour || tour.secretTour || !isPublicTourStatus(tour.status)) {
    return next(new AppError('Tour not found', 404))
  }
  if (tour.organizationId) {
    const visible = await isOrganizationPubliclyVisible(tour.organizationId)
    if (!visible) return next(new AppError('Tour not found', 404))
  }

  const filter = {
    tourId: tour._id,
    status: { $in: ['open', 'scheduled'] },
    availableSpots: { $gt: 0 },
  }
  if (req.query.fromDate) {
    filter.departureDate = { $gte: new Date(req.query.fromDate) }
  }
  if (req.query.packageType) {
    filter['packages.key'] = String(req.query.packageType).toLowerCase()
  }

  const departures = await TourDeparture.find(filter).sort('departureDate')
  res.status(200).json({
    status: 'success',
    results: departures.length,
    data: { data: departures },
  })
})

export const listOrganizationPublicTours = catchAsync(async (req, res, next) => {
  if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
    return next(new AppError('Organization not found', 404))
  }

  const result = await loadPublicOrganizationBySlug(req.params.slug)
  if (!result) return next(new AppError('Organization not found', 404))

  const tours = await Tour.find({
    organizationId: result.organization._id,
    status: { $in: ['published', 'active'] },
    secretTour: { $ne: true },
  }).sort('-publishedAt -createdAt')

  const serialized = tours.map((t) => {
    const item = serializePublicTour(t)
    item.organization = result.organization
    return item
  })

  res.status(200).json({
    status: 'success',
    results: serialized.length,
    data: { data: serialized },
  })
})

export default {
  listMarketplaceTours,
  getTourBySlugOrId,
  listPublicTourDepartures,
  listOrganizationPublicTours,
}
