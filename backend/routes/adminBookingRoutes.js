import express from 'express'
import { protect, restrict } from '../controllers/authController.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import {
  reconcileBookings,
  listAdminBookings,
  getAdminBooking,
} from '../controllers/adminBookingController.js'

const router = express.Router()

router.use(protect)
router.use(restrict('admin'))

router.post('/reconcile', reconcileBookings)
router.get('/', listAdminBookings)
router.get('/:id', requireObjectIdParam('id'), getAdminBooking)

export default router
