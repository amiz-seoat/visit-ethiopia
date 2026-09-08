import express from 'express'
import {
  test,
  getPendingReviews,
  approveReview,
  rejectReview,
  createReview,
  getMyReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js'
import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

router.get('/review', test)

router.post('/', protect, createReview)
router.get('/me', protect, getMyReviews)

router.get('/pending', protect, restrict('admin'), getPendingReviews)
router.patch('/:id/approve', protect, restrict('admin'), approveReview)
router.patch('/:id/reject', protect, restrict('admin'), rejectReview)

router
  .route('/:id')
  .patch(protect, updateReview)
  .delete(protect, deleteReview)

export default router
