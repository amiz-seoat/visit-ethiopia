import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'

/**
 * Ensure the current user may mutate a resource that has `createdBy`.
 * Admins bypass ownership. Managers/operators may only mutate their own docs.
 */
export const requireOwnershipOrAdmin = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findById(req.params.id).select('+createdBy')
    if (!doc) {
      return next(new AppError('No document found with that ID', 404))
    }

    if (req.user.role === 'admin') {
      req.resource = doc
      return next()
    }

    const ownerId =
      doc.createdBy?._id?.toString?.() ?? doc.createdBy?.toString?.()
    const userId = req.user.id?.toString?.() ?? req.user._id?.toString?.()

    if (!ownerId || ownerId !== userId) {
      return next(
        new AppError(
          options.message ||
            'You do not have permission to modify this resource',
          403
        )
      )
    }

    req.resource = doc
    next()
  })

export default requireOwnershipOrAdmin
