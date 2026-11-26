import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

const PRISMA_FINDERS = {
  Tour: (id) => catalogWrite.findTourById(id),
  Hotel: (id) => catalogWrite.findHotelById(id),
  Transport: (id) => catalogWrite.findTransportById(id),
}

/**
 * Ensure the current user may mutate a resource that has `createdBy`.
 * Admins bypass ownership. Managers/operators may only mutate their own docs.
 *
 * DATABASE_MODE=prisma → Prisma is the only ownership source (fail closed).
 * DATABASE_MODE=mongo  → existing Mongoose Model.findById path.
 */
export const requireOwnershipOrAdmin = (Model, options = {}) =>
  catchAsync(async (req, res, next) => {
    let doc = null

    if (isPrismaApp()) {
      const modelName = Model?.modelName || Model?.name
      const finder = PRISMA_FINDERS[modelName]
      if (!finder) {
        return next(new AppError('No document found with that ID', 404))
      }
      doc = await finder(req.params.id)
      if (!doc) {
        return next(new AppError('No document found with that ID', 404))
      }
    } else {
      if (!Model?.findById) {
        return next(new AppError('No document found with that ID', 404))
      }
      doc = await Model.findById(req.params.id).select('+createdBy')
      if (!doc) {
        return next(new AppError('No document found with that ID', 404))
      }
    }

    if (req.user.role === 'admin') {
      req.resource = doc
      return next()
    }

    const ownerId =
      doc.createdBy?._id?.toString?.() ??
      doc.createdBy?.toString?.() ??
      doc.createdById?.toString?.()
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
