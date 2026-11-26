import crypto from 'crypto'
import AppError from '../utils/appError.js'

const IDEMPOTENCY_KEY_MIN = 8
const IDEMPOTENCY_KEY_MAX = 128
const IDEMPOTENCY_KEY_PATTERN = /^[\w-]+$/
const CONTACT_ALLOWLIST = ['fullName', 'email', 'phone', 'address']

export function validateIdempotencyKey(key) {
  if (key == null || typeof key !== 'string') {
    throw new AppError('Idempotency-Key header is required', 400)
  }
  const trimmed = key.trim()
  if (
    trimmed.length < IDEMPOTENCY_KEY_MIN ||
    trimmed.length > IDEMPOTENCY_KEY_MAX ||
    !IDEMPOTENCY_KEY_PATTERN.test(trimmed)
  ) {
    throw new AppError(
      'Idempotency-Key must be 8–128 characters (letters, numbers, underscore, hyphen)',
      400
    )
  }
  return trimmed
}

export function parseContactInfo(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError('contactInfo is required', 400)
  }

  const contactInfo = {}
  for (const key of Object.keys(raw)) {
    if (
      key.startsWith('$') ||
      key.includes('.') ||
      key === '__proto__' ||
      key === 'constructor'
    ) {
      continue
    }
    if (!CONTACT_ALLOWLIST.includes(key)) continue
    if (raw[key] != null) contactInfo[key] = String(raw[key]).trim()
  }

  if (!contactInfo.fullName) {
    throw new AppError('contactInfo.fullName is required', 400)
  }
  if (!contactInfo.email) {
    throw new AppError('contactInfo.email is required', 400)
  }
  if (!contactInfo.phone) {
    throw new AppError('contactInfo.phone is required', 400)
  }

  return contactInfo
}

export function buildRequestFingerprint({
  departureId,
  packageKey,
  quantity,
  contactInfo,
}) {
  const payload = {
    departureId: String(departureId),
    packageKey: String(packageKey).trim().toLowerCase(),
    quantity: Number(quantity),
    contactInfo: {
      fullName: contactInfo.fullName,
      email: contactInfo.email.toLowerCase(),
      phone: contactInfo.phone,
      address: contactInfo.address || '',
    },
  }
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export default {
  validateIdempotencyKey,
  parseContactInfo,
  buildRequestFingerprint,
}
