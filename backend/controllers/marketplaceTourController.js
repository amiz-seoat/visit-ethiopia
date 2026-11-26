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
import { isPrismaCatalog } from '../utils/catalogDb.js'
import { isPrismaBooking } from '../repositories/booking/index.js'
import * as tourRepo from '../repositories/prisma/tourRepository.js'
import * as prismaDep from '../repositories/booking/prismaDepartureInventoryRepository.js'
import prisma from '../config/prisma.js'

export const listMarketplaceTours = catchAsync(async (req, res) => {
  if (isPrismaCatalog()) {
    const serialized = await tourRepo.findMarketplace(req.query)
    return res.status(200).json({
      status: 'success',
      results: serialized.length,
      data: { data: serialized },
    })
  }

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
  if (isPrismaCatalog()) {
    const param = req.params.id || req.params.slug
    const data = await tourRepo.findByIdOrSlug(param)
    if (!data) return next(new AppError('Tour not found', 404))
    return res.status(200).json({ status: 'success', data: { data } })
  }

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

  if (isPrismaBooking()) {
    if (mongoose.Types.ObjectId.isValid(param) && String(param).length === 24) {
      const row = await prisma.tour.findUnique({ where: { id: String(param) } })
      if (row) {
        tour = {
          _id: row.id,
          secretTour: row.secretTour,
          status: row.status,
          organizationId: row.organizationId,
        }
      }
    } else {
      const row = await prisma.tour.findFirst({
        where: { slug: String(param).toLowerCase() },
      })
      if (row) {
        tour = {
          _id: row.id,
          secretTour: row.secretTour,
          status: row.status,
          organizationId: row.organizationId,
        }
      }
    }
  } else if (mongoose.Types.ObjectId.isValid(param) && String(param).length === 24) {
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

  if (isPrismaBooking()) {
    let departures = await prismaDep.findDepartures({
      tourId: tour._id,
      statusIn: ['open', 'scheduled'],
    })
    departures = departures.filter((d) => d.availableSpots > 0)
    if (req.query.fromDate) {
      const from = new Date(req.query.fromDate)
      departures = departures.filter((d) => new Date(d.departureDate) >= from)
    }
    if (req.query.packageType) {
      const key = String(req.query.packageType).toLowerCase()
      departures = departures.filter((d) =>
        (d.packages || []).some((p) => p.key === key)
      )
    }
    return res.status(200).json({
      status: 'success',
      results: departures.length,
      data: { data: departures },
    })
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

  let tours
  if (isPrismaCatalog() || isPrismaBooking()) {
    const rows = await prisma.tour.findMany({
      where: {
        organizationId: String(result.organization._id),
        status: { in: ['published', 'active'] },
        secretTour: false,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    })
    tours = rows.map((row) => ({
      _id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      description: row.description,
      highlights: row.highlights,
      uniqueSellingPoints: row.uniqueSellingPoints,
      duration: { days: row.durationDays, nights: row.durationNights },
      destinations: row.destinations,
      startingLocation: row.startingLocation,
      destinationLocations: row.destinationLocations,
      categories: row.categories,
      difficulty: row.difficulty,
      price: row.price,
      priceMinor: row.priceMinor,
      currency: row.currency,
      discount: row.discount,
      coverImage: row.coverImage,
      images: row.images,
      gallery: row.gallery,
      portfolioPhotos: row.portfolioPhotos,
      inclusions: row.inclusions,
      exclusions: row.exclusions,
      policies: row.policies,
      packages: row.packages || [],
      itinerary: row.itinerary,
      maxGroupSize: row.maxGroupSize,
      averageRating: row.averageRating,
      reviewCount: row.reviewCount,
      isFeatured: row.isFeatured,
      organizationId: row.organizationId,
    }))
  } else {
    tours = await Tour.find({
      organizationId: result.organization._id,
      status: { $in: ['published', 'active'] },
      secretTour: { $ne: true },
    }).sort('-publishedAt -createdAt')
  }

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
