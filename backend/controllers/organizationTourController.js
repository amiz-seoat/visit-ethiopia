import Tour from '../models/Tour.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import {
  ensureTourSlug,
  normalizeTourInput,
  publishTour,
  unpublishTour,
  archiveTour,
} from '../services/tourLifecycleService.js'

function assertTourManageable(tour) {
  if (tour.status === 'archived') {
    throw new AppError('Archived tours cannot be modified', 409)
  }
}

function assertOrgTour(tour, organizationId) {
  if (!tour) throw new AppError('Tour not found', 404)
  const tourOrgId = tour.organizationId?.toString?.() ?? tour.organizationId
  if (String(tourOrgId) !== String(organizationId)) {
    throw new AppError('Tour does not belong to this organization', 403)
  }
}

export const listOrganizationTours = catchAsync(async (req, res) => {
  const { organizationId } = req.params

  if (isPrismaApp()) {
    const tours = await catalogWrite.listOrgTours(organizationId, {
      status: req.query.status,
    })
    return res.status(200).json({
      status: 'success',
      results: tours.length,
      data: { data: tours },
    })
  }

  const filter = { organizationId }
  if (req.query.status) filter.status = req.query.status

  const tours = await Tour.find(filter).sort('-updatedAt')
  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: { data: tours },
  })
})

export const getOrganizationTour = catchAsync(async (req, res, next) => {
  const tour = isPrismaApp()
    ? await catalogWrite.findTourById(req.params.id)
    : await Tour.findById(req.params.id)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
  }
  res.status(200).json({ status: 'success', data: { data: tour } })
})

export const createOrganizationTour = catchAsync(async (req, res, next) => {
  const organization = req.organization
  if (!organization.providerTypes?.includes('travel_company')) {
    return next(
      new AppError('Only travel company organizations can manage tours', 403)
    )
  }

  const payload = normalizeTourInput(req.body, organization)
  payload.createdBy = req.user.id
  payload.status = 'draft'
  payload.slug = await ensureTourSlug(
    organization._id || organization.id,
    payload.title
  )

  if (!payload.packages?.length) {
    payload.packages = [
      {
        key: 'normal',
        name: 'Standard Package',
        priceMinor: payload.priceMinor ?? Math.round((payload.price || 0) * 100),
        currency: payload.currency || 'ETB',
        active: true,
      },
      {
        key: 'vip',
        name: 'VIP Package',
        priceMinor: Math.round(
          ((payload.priceMinor ?? Math.round((payload.price || 0) * 100)) || 0) * 1.5
        ),
        currency: payload.currency || 'ETB',
        active: true,
      },
    ]
  }

  if (isPrismaApp()) {
    const tour = await catalogWrite.createTour(payload)
    return res.status(201).json({ status: 'success', data: { data: tour } })
  }

  const tour = await Tour.create(payload)
  res.status(201).json({ status: 'success', data: { data: tour } })
})

export const updateOrganizationTour = catchAsync(async (req, res, next) => {
  const tour = isPrismaApp()
    ? await catalogWrite.findTourById(req.params.id)
    : await Tour.findById(req.params.id)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
  }

  if (tour.status === 'archived') {
    return next(new AppError('Archived tours cannot be edited', 409))
  }

  const payload = normalizeTourInput(req.body, req.organization)
  if (payload.title && payload.title !== tour.title) {
    payload.slug = await ensureTourSlug(
      req.params.organizationId,
      payload.title,
      tour._id || tour.id
    )
  }

  if (isPrismaApp()) {
    const updated = await catalogWrite.updateTour(req.params.id, payload)
    return res.status(200).json({ status: 'success', data: { data: updated } })
  }

  Object.assign(tour, payload)
  await tour.save()

  res.status(200).json({ status: 'success', data: { data: tour } })
})

export const publishOrganizationTour = catchAsync(async (req, res, next) => {
  const tour = isPrismaApp()
    ? await catalogWrite.findTourById(req.params.id)
    : await Tour.findById(req.params.id)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
  }
  try {
    const updated = await publishTour(tour)
    res.status(200).json({ status: 'success', data: { data: updated } })
  } catch (e) {
    return next(new AppError(e.message, e.statusCode || 409))
  }
})

export const unpublishOrganizationTour = catchAsync(async (req, res, next) => {
  const tour = isPrismaApp()
    ? await catalogWrite.findTourById(req.params.id)
    : await Tour.findById(req.params.id)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
  }
  try {
    const updated = await unpublishTour(tour)
    res.status(200).json({ status: 'success', data: { data: updated } })
  } catch (e) {
    return next(new AppError(e.message, e.statusCode || 409))
  }
})

export const archiveOrganizationTour = catchAsync(async (req, res, next) => {
  const tour = isPrismaApp()
    ? await catalogWrite.findTourById(req.params.id)
    : await Tour.findById(req.params.id)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
  }
  try {
    const updated = await archiveTour(tour)
    res.status(200).json({ status: 'success', data: { data: updated } })
  } catch (e) {
    return next(new AppError(e.message, e.statusCode || 409))
  }
})

export default {
  listOrganizationTours,
  getOrganizationTour,
  createOrganizationTour,
  updateOrganizationTour,
  publishOrganizationTour,
  unpublishOrganizationTour,
  archiveOrganizationTour,
  assertTourManageable,
}
