import express from 'express'
import {
  test,
  getAllTransports,
  getTransport,
  getAllRoutes,
  createTransport,
  getTransportReviews,
  updateTransport,
  deleteTransport,
} from '../controllers/transportController.js'
import { protect, restrict } from '../controllers/authController.js'
import requireOwnershipOrAdmin from '../middlewares/ownership.js'
import Transport from '../models/Transport.js'

const router = express.Router()

router.get('/transport', test)

router
  .route('/')
  .get(getAllTransports)
  .post(protect, restrict('admin', 'transport_manager'), createTransport)

router.get('/routes', getAllRoutes)
router.get('/:id/reviews', getTransportReviews)

router
  .route('/:id')
  .get(getTransport)
  .patch(
    protect,
    restrict('admin', 'transport_manager'),
    requireOwnershipOrAdmin(Transport),
    updateTransport
  )
  .delete(
    protect,
    restrict('admin', 'transport_manager'),
    requireOwnershipOrAdmin(Transport),
    deleteTransport
  )

export default router
