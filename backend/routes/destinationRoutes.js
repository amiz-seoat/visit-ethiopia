import express from 'express'

import {
  test,
  getAllDestinations,
  getDestination,
  createDestination,
  getToursForDestination,
  featuredDestinations,
  updateDestination,
  deleteDestination,
} from '../controllers/destinationController.js'

import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

// Test route
router.get('/destination', test)

// ✅ Admin only: Create a new destination
router.post('/', protect, restrict('admin'), createDestination)

// ✅ Public: Get all destinations
router.get('/', getAllDestinations)

// ✅ Public: Get featured destinations
router.get('/featured', featuredDestinations, getAllDestinations)

// ✅ Public: Get single destination by ID
router.get('/:id', getDestination)

// ✅ Admin only: Update a destination
router.patch('/:id', protect, restrict('admin'), updateDestination)
// ✅ Admin only: Delete a destination
router.delete('/:id', protect, restrict('admin'), deleteDestination)

// ✅ Public: Get tours for a destination
router.get('/:id/tours', getToursForDestination)

export default router
