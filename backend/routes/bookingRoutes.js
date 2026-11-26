import requirePaymentsAvailable from '../middlewares/requirePaymentsAvailable.js'
import express from 'express'
import {
  createBooking,
  createTourDepartureBooking,
  createHotelInventoryBooking,
  createTransportInventoryBooking,
  getAllBookings,
  getMyBookings,
  getBookingById,
  cancelBooking,
  updateBookingStatus,
} from '../controllers/bookingController.js'
import { protect, restrict } from '../controllers/authController.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'

const router = express.Router()

router.use(protect)

router.post('/tours', requirePaymentsAvailable, createTourDepartureBooking)
router.post('/hotels', requirePaymentsAvailable, createHotelInventoryBooking)
router.post('/transports', requirePaymentsAvailable, createTransportInventoryBooking)

router.post('/', createBooking)

router.get('/me', getMyBookings)

router.get('/:id', requireObjectIdParam('id'), getBookingById)

router.get('/', restrict('admin'), getAllBookings)

router.patch('/:id/cancel', requireObjectIdParam('id'), cancelBooking)

router.patch('/:id/status', requireObjectIdParam('id'), restrict('admin'), updateBookingStatus)

export default router
