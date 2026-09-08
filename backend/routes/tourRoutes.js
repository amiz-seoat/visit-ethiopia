import express from 'express'

import {
  test,
  createTour,
  getAllTours,
  getTour,
  featuredTours,
  getTourReviews,
  updateTour,
  deleteTour,
} from '../controllers/tourController.js'
import {
  listMarketplaceTours,
  getTourBySlugOrId,
  listPublicTourDepartures,
} from '../controllers/marketplaceTourController.js'

import { protect, restrict } from '../controllers/authController.js'
import requireOwnershipOrAdmin from '../middlewares/ownership.js'
import Tour from '../models/Tour.js'

const router = express.Router()

// Test route
router.get('/tour', test)

// ✅ Create tour (protected & restricted)
router.post('/', protect, restrict('admin', 'tour_operator', 'guide'), createTour)

// ✅ Update a tour (owners or admin)
router.patch(
  '/:id',
  protect,
  restrict('admin', 'tour_operator', 'guide'),
  requireOwnershipOrAdmin(Tour),
  updateTour
)
// ✅ Delete a tour (owners or admin; guide may update but not delete unless owner+operator — keep tour_operator/admin)
router.delete(
  '/:id',
  protect,
  restrict('admin', 'tour_operator', 'guide'),
  requireOwnershipOrAdmin(Tour),
  deleteTour
)

// ✅ Get all tours (legacy + marketplace visibility filtering)
router.get('/', getAllTours)

// ✅ Enhanced marketplace discovery
router.get('/marketplace', listMarketplaceTours)

// ✅ Featured tours
router.get('/featured', featuredTours, getAllTours)

// ✅ Get reviews for a specific tour
router.get('/:id/reviews', getTourReviews)

// ✅ Public departures for a tour (by id or slug)
router.get('/:id/departures', listPublicTourDepartures)

// ✅ Get single tour by id or slug
router.get('/:id', getTourBySlugOrId)


export default router
