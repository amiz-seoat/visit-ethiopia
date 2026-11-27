import express from 'express'
import rateLimit from 'express-rate-limit'
import { chat, status } from '../controllers/assistantController.js'

const router = express.Router()

// Per-IP limit on top of the global API limiter: protects the free LLM quota.
const chatLimiter = rateLimit({
  max: Number(process.env.ASSISTANT_RATE_LIMIT_PER_MIN) || (process.env.NODE_ENV === 'production' ? 12 : 300),
  windowMs: 60 * 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'fail', message: 'You are asking very quickly. Please wait a minute and try again.' },
})

router.get('/status', status)
router.post('/chat', chatLimiter, chat)

export default router
