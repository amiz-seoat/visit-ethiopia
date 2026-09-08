import Tour from '../models/Tour.js'
import TourDeparture from '../models/TourDeparture.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import {
  createDeparture,
  updateDeparture,
} from '../services/tourDepartureService.js'

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

export const listTourDepartures = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.tourId)
  try {
    assertOrgTour(tour, req.params.organizationId)
  } catch (e) {
    return next(e)
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
  const tour = await Tour.findById(req.params.tourId)
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
  const tour = await Tour.findById(req.params.tourId)
  try {
    assertOrgTour(tour, req.params.organizationId)
    assertTourManageable(tour)
  } catch (e) {
    return next(e)
  }

  const departure = await TourDeparture.findOne({
    _id: req.params.departureId,
    tourId: tour._id,
    organizationId: req.params.organizationId,
  })
  if (!departure) return next(new AppError('Departure not found', 404))

  const updated = await updateDeparture(departure, req.body)
  res.status(200).json({ status: 'success', data: { data: updated } })
})

export default {
  listTourDepartures,
  createTourDeparture,
  updateTourDeparture,
}
