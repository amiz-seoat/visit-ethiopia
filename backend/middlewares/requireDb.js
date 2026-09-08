import mongoose from 'mongoose'
import AppError from '../utils/appError.js'

export const requireDb = (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next()
  }

  return next(
    new AppError(
      'Database is currently unavailable. Please try again later.',
      503
    )
  )
}

export default requireDb
