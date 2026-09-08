import mongoose from 'mongoose'
import AppError from '../utils/appError.js'

export function requireObjectIdParam(paramName = 'organizationId') {
  return (req, res, next) => {
    const value = req.params[paramName]
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return next(new AppError('Resource not found', 404))
    }
    next()
  }
}

export default requireObjectIdParam
