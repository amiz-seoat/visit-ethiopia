import crypto from 'crypto'

/** 24-char hex ObjectId-compatible id (12 random bytes). */
export function generateObjectId() {
  return crypto.randomBytes(12).toString('hex')
}

export function isObjectIdCompatible(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value)
}

export default { generateObjectId, isObjectIdCompatible }
