import express from 'express'
import {
  test,
  getPendingReviews,
  approveReview,
  createReview,
  getMyReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js'
import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

// Test route
router.get('/review', test)

// User routes
router.post('/', protect, createReview) // ✅ create review
router.get('/me', protect, getMyReviews) // ✅ get my reviews

// Admin routes (must come before /:id routes to avoid conflicts)
router.get('/pending', protect, restrict('admin'), getPendingReviews)
router.patch('/:id/approve', protect, restrict('admin'), approveReview)

// Review CRUD routes (must come after more specific routes)
router
  .route('/:id')
  .patch(protect, updateReview) // ✅ PATCH /api/reviews/:id - Update review (owner only)
  .delete(protect, deleteReview) // ✅ DELETE /api/reviews/:id - Delete review (owner/admin)

export default router
