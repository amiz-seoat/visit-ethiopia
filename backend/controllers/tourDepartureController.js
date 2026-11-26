import Tour from '../models/Tour.js'
import TourDeparture from '../models/TourDeparture.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import {
  createDeparture,
  updateDeparture,
} from '../services/tourDepartureService.js'
import { isPrismaBooking } from '../repositories/booking/index.js'
import prisma from '../config/prisma.js'
import * as prismaDep from '../repositories/booking/prismaDepartureInventoryRepository.js'

function assertOrgTour(tour, organizationId) {
  if (!tour) throw new AppError('Tour not found', 404)
  if (tour.organizationId?.toString() !== organizationId.toString()) {
    throw new AppError('Tour does not belong to this organization', 403)
  }
}

function assertTourManageable(tour) {
  if (tour.status === 'archived') {
    throw new AppError('Archived tours cannot be modified', 409)
  }
}

async function loadOrgTour(tourId) {
  if (isPrismaBooking()) {
    const row = await prisma.tour.findUnique({ where: { id: String(tourId) } })
    if (!row) return null
    return {
      _id: row.id,
      id: row.id,
      organizationId: row.organizationId,
      status: row.status,
      title: row.title,
    }
  }
  return Tour.findById(tourId)
}

export const listTourDepartures = catchAsync(async (req, res, next) => {
  const tour = await loadOrgTour(req.params.tourId)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
  }

  if (isPrismaBooking()) {
    const filter = {
      tourId: tour._id,
      organizationId: req.params.organizationId,
    }
    if (req.query.status) filter.status = req.query.status
    const departures = await prismaDep.findDepartures(filter)
    return res.status(200).json({
      status: 'success',
      results: departures.length,
      data: { data: departures },
    })
  }

  const filter = { tourId: tour._id, organizationId: req.params.organizationId }
  if (req.query.status) filter.status = req.query.status

  const departures = await TourDeparture.find(filter).sort('departureDate')
  res.status(200).json({
    status: 'success',
    results: departures.length,
    data: { data: departures },
  })
})

export const createTourDeparture = catchAsync(async (req, res, next) => {
  const tour = await loadOrgTour(req.params.tourId)
  try {
    assertOrgTour(tour, req.params.organizationId)
    assertTourManageable(tour)
  } catch (e) {
    return next(e)
  }

  const departure = await createDeparture({
    tour,
    organizationId: req.params.organizationId,
    payload: req.body,
  })

  res.status(201).json({ status: 'success', data: { data: departure } })
})

export const updateTourDeparture = catchAsync(async (req, res, next) => {
  const tour = await loadOrgTour(req.params.tourId)
  try {
    assertOrgTour(tour, req.params.organizationId)
    assertTourManageable(tour)
  } catch (e) {
    return next(e)
  }

  let departure
  if (isPrismaBooking()) {
    departure = await prismaDep.findDepartureById(req.params.departureId)
    if (
      !departure ||
      String(departure.tourId) !== String(tour._id) ||
      String(departure.organizationId) !== String(req.params.organizationId)
    ) {
      return next(new AppError('Departure not found', 404))
    }
  } else {
    departure = await TourDeparture.findOne({
      _id: req.params.departureId,
      tourId: tour._id,
      organizationId: req.params.organizationId,
    })
    if (!departure) return next(new AppError('Departure not found', 404))
  }

  const updated = await updateDeparture(departure, req.body)
  res.status(200).json({ status: 'success', data: { data: updated } })
})

export default {
  listTourDepartures,
  createTourDeparture,
  updateTourDeparture,
}
