import express from 'express'
import {
  createBooking,
  createTourDepartureBooking,
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

router.post('/tours', createTourDepartureBooking)

router.post('/', createBooking)

router.get('/me', getMyBookings)

router.get('/:id', requireObjectIdParam('id'), getBookingById)

router.get('/', restrict('admin'), getAllBookings)

router.patch('/:id/cancel', requireObjectIdParam('id'), cancelBooking)

router.patch('/:id/status', requireObjectIdParam('id'), restrict('admin'), updateBookingStatus)

export default router
