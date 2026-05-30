import express from 'express'
import {
  test,
  createHotel,
  getAllHotels,
  getHotel,
  updateHotel,
  deleteHotel,
  featuredHotels,
  getHotelReviews,
} from '../controllers/hotelController.js'
import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

router.get('/hotel', test)

// ✅ Create hotel (admin only)
router.post('/', protect, restrict('admin'), createHotel)

// ✅ Get all + featured + single hotel
router.get('/', getAllHotels)
router.get('/featured', featuredHotels, getAllHotels)
router.get('/:id', getHotel)

// ✅ Hotel reviews
router.get('/:id/reviews', getHotelReviews)

// ✅ Update + delete (admin only)
router.patch('/:id', protect, restrict('admin'), updateHotel)
router.delete('/:id', protect, restrict('admin'), deleteHotel)

export default router
