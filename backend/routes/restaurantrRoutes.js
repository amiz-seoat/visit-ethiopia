import express from 'express'
import { protect, restrict } from '../controllers/authController.js'
import {
  test,
  createRestaurant,
  getAllRestaurants,
  getRestaurant,
  getRestaurantReviews,
  featuredRestaurants,
  updateRestaurant,
  deleteRestaurant,
} from '../controllers/restaurantController.js'

const router = express.Router()

router.get('/restaurant', test)

// ✅ Create restaurant (Admin only)
router.post('/', protect, restrict('admin'), createRestaurant)

// ✅ Get all restaurants
router.get('/', getAllRestaurants)

// ✅ Get featured restaurants
router.get('/featured', featuredRestaurants, getAllRestaurants)

// ✅ Get restaurant reviews
router.get('/:id/reviews', getRestaurantReviews)

// ✅ Get single restaurant
router.get('/:id', getRestaurant)

// ✅ Update restaurant (Admin only)
router.patch('/:id', protect, restrict('admin'), updateRestaurant)

// ✅ Delete restaurant (Admin only)
router.delete('/:id', protect, restrict('admin'), deleteRestaurant)

export default router
