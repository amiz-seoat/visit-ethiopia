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

import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

// Test route
router.get('/tour', test)

// ✅ Create tour (protected & restricted)
router.post('/', protect, restrict('admin'), createTour)

// ✅ Update a tour
router.patch('/:id', protect, restrict('admin'), updateTour)
// ✅ Delete a tour
router.delete('/:id', protect, restrict('admin'), deleteTour)

// ✅ Get all tours
router.get('/', getAllTours)

// ✅ Featured tours
router.get('/featured', featuredTours, getAllTours)

// ✅ Get reviews for a specific tour
router.get('/:id/reviews', getTourReviews)

// ✅ Get single tour with reviews populated
router.get('/:id', getTour)


export default router
