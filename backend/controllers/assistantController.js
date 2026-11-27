import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import { LIMITS, answerQuestion, assistantStatus } from '../services/assistant/assistantService.js'

export const chat = catchAsync(async (req, res) => {
  const { message, history } = req.body || {}
  if (typeof message !== 'string' || !message.trim()) {
    throw new AppError('message is required', 400)
  }
  if (message.length > LIMITS.message) {
    throw new AppError(`message must be at most ${LIMITS.message} characters`, 400)
  }
  if (history !== undefined && !Array.isArray(history)) {
    throw new AppError('history must be an array', 400)
  }
  const result = await answerQuestion({ message, history })
  res.status(200).json({ status: 'success', data: result })
})

export const status = (req, res) => {
  res.status(200).json({ status: 'success', data: assistantStatus() })
}
