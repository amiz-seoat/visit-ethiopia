import express from 'express'
import { protect } from '../controllers/authController.js'
import requireObjectIdParam from '../middlewares/requireObjectId.js'
import {
  confirmPayment,
  createRefund,
  getPaymentById,
  handlePaymentWebhook,
  getPaymentConfig,
  startCheckout,
  verifyPayment,
  chapaCallback,
} from '../controllers/paymentController.js'

const router = express.Router()

router.get('/config', getPaymentConfig)
router.get('/chapa/callback', chapaCallback)
router.post('/webhooks/:provider', handlePaymentWebhook)

router.use(protect)

router.get('/:id', requireObjectIdParam('id'), getPaymentById)
router.post('/:id/confirm', requireObjectIdParam('id'), confirmPayment)
router.post('/:id/checkout', requireObjectIdParam('id'), startCheckout)
router.post('/:id/verify', requireObjectIdParam('id'), verifyPayment)
router.post('/:id/refund', requireObjectIdParam('id'), createRefund)

export default router
