import express from 'express'
import { protect } from '../controllers/authController.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import {
  confirmPayment,
  createRefund,
  getPaymentById,
  handlePaymentWebhook,
} from '../controllers/paymentController.js'

const router = express.Router()

router.post('/webhooks/:provider', handlePaymentWebhook)

router.use(protect)

router.get('/:id', requireObjectIdParam('id'), getPaymentById)
router.post('/:id/confirm', requireObjectIdParam('id'), confirmPayment)
router.post('/:id/refund', requireObjectIdParam('id'), createRefund)

export default router
