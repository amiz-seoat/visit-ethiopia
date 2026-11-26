import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import AppError from '../utils/appError.js'

const BCRYPT_COST = 12

export async function hashPassword(plain) {
  if (!plain || String(plain).length < 8) {
    throw new AppError('Password must be at least 8 characters', 400)
  }
  return bcrypt.hash(String(plain), BCRYPT_COST)
}

export async function comparePassword(candidate, hash) {
  if (!candidate || !hash) return false
  return bcrypt.compare(String(candidate), String(hash))
}

export function assertPasswordConfirm(password, passwordConfirm) {
  if (password !== passwordConfirm) {
    throw new AppError('Passwords do not match', 400)
  }
}

/** Create raw reset token + SHA-256 hash + expiry (10 minutes), matching User model. */
export function createPasswordResetTokenPair() {
  const resetToken = crypto.randomBytes(32).toString('hex')
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')
  const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000)
  return { resetToken, passwordResetToken, passwordResetExpires }
}

export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex')
}

export function changedPasswordAfter(passwordChangedAt, jwtIat) {
  if (!passwordChangedAt) return false
  const changedTimestamp = parseInt(
    new Date(passwordChangedAt).getTime() / 1000,
    10
  )
  return jwtIat < changedTimestamp
}

export default {
  hashPassword,
  comparePassword,
  assertPasswordConfirm,
  createPasswordResetTokenPair,
  hashResetToken,
  changedPasswordAfter,
}
