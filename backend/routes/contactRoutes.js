import express from 'express'
import {
  test,
  createContact,
  getAllContacts,
  getContact,
  updateContactStatus,
} from '../controllers/contactController.js'
import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

router.get('/contact', test)

// 👉 Public contact form submission
router.post('/', createContact)

// Admin-only inquiry management
router.route('/').get(protect, restrict('admin'), getAllContacts)
router.route('/:id').get(protect, restrict('admin'), getContact)
router.patch('/:id', protect, restrict('admin'), updateContactStatus)

export default router
