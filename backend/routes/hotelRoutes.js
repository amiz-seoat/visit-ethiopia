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
import requireOwnershipOrAdmin from '../middlewares/ownership.js'
import Hotel from '../models/Hotel.js'

const router = express.Router()

router.get('/hotel', test)

router.post('/', protect, restrict('admin', 'hotel_manager'), createHotel)

router.get('/', getAllHotels)
router.get('/featured', featuredHotels, getAllHotels)
router.get('/:id', getHotel)
router.get('/:id/reviews', getHotelReviews)

router.patch(
  '/:id',
  protect,
  restrict('admin', 'hotel_manager'),
  requireOwnershipOrAdmin(Hotel),
  updateHotel
)
router.delete(
  '/:id',
  protect,
  restrict('admin', 'hotel_manager'),
  requireOwnershipOrAdmin(Hotel),
  deleteHotel
)

export default router
