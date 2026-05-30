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

const router = express.Router()

router.get('/transport', test)

router
  .route('/')
  .get(getAllTransports)
  .post(protect, restrict('admin'), createTransport) // ✅ only admin can create

router.get('/routes', getAllRoutes)
router.get('/:id/reviews', getTransportReviews) // ✅ new route

// Transport CRUD routes
router
  .route('/:id')
  .get(getTransport) // ✅ GET /api/transports/:id - Get single transport
  .patch(protect, restrict('admin'), updateTransport) // ✅ PATCH /api/transports/:id - Update transport (admin)
  .delete(protect, restrict('admin'), deleteTransport) // ✅ DELETE /api/transports/:id - Delete transport (admin)

export default router
