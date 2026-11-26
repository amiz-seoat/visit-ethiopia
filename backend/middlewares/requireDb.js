import mongoose from 'mongoose'
import AppError from '../utils/appError.js'
import { isPrismaIdentity } from '../utils/databaseMode.js'
import prisma from '../config/prisma.js'

let prismaReadyCache = null
let prismaReadyAt = 0

async function isPrismaReady() {
  const now = Date.now()
  if (prismaReadyCache && now - prismaReadyAt < 5000) {
    return prismaReadyCache
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    prismaReadyCache = true
    prismaReadyAt = now
    return true
  } catch {
    prismaReadyCache = false
    prismaReadyAt = now
    return false
  }
}

/**
 * Ready when:
 * - Mongo connected (default / mongo mode), OR
 * - DATABASE_MODE=prisma and PostgreSQL responds
 */
export const requireDb = async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next()
  }

  if (isPrismaIdentity()) {
    const ok = await isPrismaReady()
    if (ok) return next()
  }

  return next(
    new AppError(
      'Database is currently unavailable. Please try again later.',
      503
    )
  )
}

export default requireDb
