import express from 'express'
import {
  test,
  getAllNews,
  featuredNews,
  createNews,
  getNews,
  updateNews,
  deleteNews,
} from '../controllers/newsController.js'

import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

router.get('/test', test)

// Public routes
router.get('/', getAllNews)
router.get('/featured', featuredNews)
router.get('/:id', getNews)

// Admin only routes
router.post('/', protect, restrict('admin'), createNews)
router
  .route('/:id')
  .patch(protect, restrict('admin'), updateNews) // ✅ PATCH /api/news/:id - Update news (admin only)
  .delete(protect, restrict('admin'), deleteNews) // ✅ DELETE /api/news/:id - Delete news (admin only)

export default router
