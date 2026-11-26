import AppError from '../utils/appError.js'
import { isObjectIdCompatible } from '../utils/objectId.js'

/**
 * Validate URL params as ObjectId-compatible 24-char hex.
 * Works for both Mongo ObjectIds and Prisma TEXT ids.
 */
export function requireObjectIdParam(paramName = 'organizationId') {
  return (req, res, next) => {
    const value = req.params[paramName]
    if (!isObjectIdCompatible(String(value || ''))) {
      return next(new AppError('Resource not found', 404))
    }
    next()
  }
}

export default requireObjectIdParam
