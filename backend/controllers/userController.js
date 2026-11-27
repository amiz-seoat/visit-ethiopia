import catchAsync from '../utils/catchAsync.js'
import { USER_ROLES, updateUserByAdmin } from '../services/adminService.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import User from '../models/User.js'
import { getUserRepository } from '../repositories/users/index.js'
import { isPrismaIdentity, isPrismaApp } from '../utils/databaseMode.js'

const fillterObj = (obj, allowedFields) => {
  const newObj = {}
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el]
  })
  return newObj
}

export const getMyProfile = catchAsync(async (req, res, next) => {
  const users = getUserRepository()
  const user = await users.findByIdWithFavorites(req.user.id)

  if (!user) {
    return next(new AppError('No user found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: user,
    },
  })
})

export const updateMyProfile = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updatePassword.',
        400
      )
    )
  }
  const users = getUserRepository()
  const filteredBody = fillterObj(req.body, [
    'FirstName',
    'LastName',
    'favorites',
  ])
  const updatedUser = await users.updateProfile(req.user.id, filteredBody)
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  })
})

export const deleteMyProfile = catchAsync(async (req, res) => {
  const users = getUserRepository()
  await users.softDelete(req.user.id)

  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  })

  res.status(204).json({
    status: 'success',
    data: null,
  })
})

export const updateUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body

  if (!role) {
    return next(new AppError('Please provide a role to update.', 400))
  }
  if (!USER_ROLES.includes(role)) {
    return next(new AppError('Invalid role', 400))
  }
  if (String(req.params.id) === String(req.user._id || req.user.id)) {
    return next(new AppError('You cannot change your own role or status', 403))
  }

  if (isPrismaApp()) {
    // Same guards and audit trail as the admin console (last-admin protection).
    const user = await updateUserByAdmin(req.user, req.params.id, { role })
    return res.status(200).json({
      status: 'success',
      message: 'User role updated successfully.',
      data: { user },
    })
  }

  const users = getUserRepository()
  const user = await users.updateRole(req.params.id, role)

  if (!user) {
    return next(new AppError('No user found with that ID.', 404))
  }

  res.status(200).json({
    status: 'success',
    message: 'User role updated successfully.',
    data: { user },
  })
})

const mongooseGetAllUsers = factory.getAll(User)
const mongooseGetUser = factory.getOne(User)
const mongooseDeleteUser = factory.deleteOne(User)

export const getAllUsers = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const users = getUserRepository()
    const docs = await users.findManyAdmin(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllUsers(req, res, next)
})

export const getUser = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const users = getUserRepository()
    const user = await users.findByIdAdmin(req.params.id)
    if (!user) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: user },
    })
  }
  return mongooseGetUser(req, res, next)
})

export const deleteUser = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const users = getUserRepository()
    const existing = await users.findByIdAdmin(req.params.id)
    if (!existing) {
      return next(new AppError('No document found with that ID', 404))
    }
    // Deactivation goes through the guarded path (no self-suspension, keeps one admin).
    await updateUserByAdmin(req.user, req.params.id, { active: false })
    return res.status(204).json({
      status: 'success',
      data: null,
    })
  }
  return mongooseDeleteUser(req, res, next)
})

export default {
  getMyProfile,
  updateMyProfile,
  deleteMyProfile,
  updateUserRole,
  getAllUsers,
  getUser,
  deleteUser,
  isPrismaIdentity,
}
