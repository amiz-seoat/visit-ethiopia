import express from 'express'
import { getStats } from '../controllers/statsController.js'
import { protect, restrict } from '../controllers/authController.js'

const router = express.Router()

router.get('/', protect, restrict('admin'), getStats)

export default router
