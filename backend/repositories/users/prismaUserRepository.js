import prisma from '../../config/prisma.js'
import AppError from '../../utils/appError.js'
import { generateObjectId } from '../../utils/objectId.js'
import { buildPrismaListArgs } from '../../utils/prismaApiFeatures.js'
import {
  assertPasswordConfirm,
  hashPassword,
} from '../../services/passwordService.js'
import { toAuthUser, toPublicUser } from '../prisma/identitySerialize.js'

const ACTIVE = { active: { not: false } }

async function getRow(id, { includeInactive = false, withPassword = false } = {}) {
  const row = await prisma.user.findFirst({
    where: includeInactive ? { id } : { id, ...ACTIVE },
    include: { favorites: true },
  })
  return row
}

export async function findByEmailForLogin(email) {
  const row = await prisma.user.findFirst({
    where: { email: String(email).toLowerCase().trim(), ...ACTIVE },
    include: { favorites: true },
  })
  return toAuthUser(row, { withPassword: true })
}

export async function findById(id) {
  const row = await getRow(id)
  return toAuthUser(row)
}

export async function findByIdWithPassword(id) {
  const row = await getRow(id)
  return toAuthUser(row, { withPassword: true })
}

export async function createUser(data) {
  assertPasswordConfirm(data.password, data.passwordConfirm)
  const email = String(data.email).toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AppError('Email already in use', 400)
  }

  const id = generateObjectId()
  const password = await hashPassword(data.password)
  const row = await prisma.user.create({
    data: {
      id,
      firstName: data.FirstName,
      lastName: data.LastName,
      email,
      password,
      role: 'user',
      isVerified: false,
      active: true,
    },
    include: { favorites: true },
  })
  return toAuthUser(row)
}

/** Persist mutable fields from an auth-user shaped object. */
export async function saveUser(user) {
  const id = user._id || user.id
  const data = {}
  if (user.isVerified !== undefined) data.isVerified = user.isVerified
  if (user.active !== undefined) data.active = user.active
  if (user.role !== undefined) data.role = user.role
  if (user.passwordResetToken !== undefined) {
    data.passwordResetToken = user.passwordResetToken || null
  }
  if (user.passwordResetExpires !== undefined) {
    data.passwordResetExpires = user.passwordResetExpires || null
  }
  if (user.passwordChangedAt !== undefined) {
    data.passwordChangedAt = user.passwordChangedAt
  }
  // Password already hashed by caller when set via updatePassword helpers
  if (user._hashedPassword) {
    data.password = user._hashedPassword
    delete user._hashedPassword
  }

  const row = await prisma.user.update({
    where: { id: String(id) },
    data,
    include: { favorites: true },
  })
  const next = toAuthUser(row, { withPassword: false })
  Object.assign(user, next)
  return user
}

export async function deleteById(id) {
  await prisma.user.delete({ where: { id: String(id) } })
}

export async function findByResetToken(hashedToken) {
  const row = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() },
      ...ACTIVE,
    },
    include: { favorites: true },
  })
  return toAuthUser(row, { withPassword: true })
}

export async function setPasswordResetToken(userId, tokenHash, expires) {
  const row = await prisma.user.update({
    where: { id: String(userId) },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    },
    include: { favorites: true },
  })
  return toAuthUser(row)
}

export async function clearPasswordResetToken(userId) {
  const row = await prisma.user.update({
    where: { id: String(userId) },
    data: {
      passwordResetToken: null,
      passwordResetExpires: null,
    },
    include: { favorites: true },
  })
  return toAuthUser(row)
}

export async function updatePassword(userId, plainPassword, passwordConfirm) {
  assertPasswordConfirm(plainPassword, passwordConfirm)
  const password = await hashPassword(plainPassword)
  const row = await prisma.user.update({
    where: { id: String(userId) },
    data: {
      password,
      passwordResetToken: null,
      passwordResetExpires: null,
      // Match current Mongo behavior: passwordChangedAt is not set on reset/update
    },
    include: { favorites: true },
  })
  return toAuthUser(row, { withPassword: true })
}

export async function softDelete(id) {
  await prisma.user.update({
    where: { id: String(id) },
    data: { active: false },
  })
}

export async function updateRole(id, role) {
  const row = await prisma.user.update({
    where: { id: String(id) },
    data: { role },
    include: { favorites: true },
  })
  return toPublicUser(row)
}

export async function findByIdWithFavorites(id) {
  const row = await prisma.user.findFirst({
    where: { id: String(id), ...ACTIVE },
    include: {
      favorites: {
        include: {
          tour: {
            select: {
              id: true,
              title: true,
              coverImage: true,
              price: true,
              averageRating: true,
            },
          },
        },
      },
    },
  })
  if (!row) return null
  const user = toPublicUser(row)
  user.favorites = (row.favorites || []).map((f) =>
    f.tour
      ? {
          _id: f.tour.id,
          title: f.tour.title,
          coverImage: f.tour.coverImage,
          price: f.tour.price,
          averageRating: f.tour.averageRating,
        }
      : f.tourId
  )
  return user
}

export async function updateProfile(id, filteredBody) {
  const data = {}
  if (filteredBody.FirstName !== undefined) data.firstName = filteredBody.FirstName
  if (filteredBody.LastName !== undefined) data.lastName = filteredBody.LastName

  if (filteredBody.favorites !== undefined) {
    const tourIds = (filteredBody.favorites || []).map(String)
    await prisma.$transaction([
      prisma.userFavorite.deleteMany({ where: { userId: String(id) } }),
      ...(tourIds.length
        ? [
            prisma.userFavorite.createMany({
              data: tourIds.map((tourId) => ({ userId: String(id), tourId })),
              skipDuplicates: true,
            }),
          ]
        : []),
      prisma.user.update({ where: { id: String(id) }, data }),
    ])
  } else if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: String(id) }, data })
  }

  return findByIdWithFavorites(id)
}

export async function setVerified(id, isVerified = true) {
  const row = await prisma.user.update({
    where: { id: String(id) },
    data: { isVerified },
    include: { favorites: true },
  })
  return toAuthUser(row)
}

export async function findManyAdmin(query = {}) {
  const args = buildPrismaListArgs(query, {}, {
    searchableFields: ['email', 'firstName', 'lastName'],
  })
  // API uses FirstName/LastName; Prisma columns are firstName/lastName
  delete args.where.FirstName
  delete args.where.LastName
  if (query.FirstName) args.where.firstName = String(query.FirstName)
  if (query.LastName) args.where.lastName = String(query.LastName)
  const rows = await prisma.user.findMany({
    ...args,
    include: { favorites: true },
  })
  return rows.map((row) => toPublicUser(row))
}

export async function findByIdAdmin(id) {
  const row = await prisma.user.findUnique({
    where: { id: String(id) },
    include: { favorites: true },
  })
  return toPublicUser(row)
}

export default {
  findByEmailForLogin,
  findById,
  findByIdWithPassword,
  createUser,
  saveUser,
  deleteById,
  findByResetToken,
  setPasswordResetToken,
  clearPasswordResetToken,
  updatePassword,
  softDelete,
  updateRole,
  findByIdWithFavorites,
  updateProfile,
  setVerified,
  findManyAdmin,
  findByIdAdmin,
}
