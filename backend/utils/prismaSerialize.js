/**
 * Serialize Prisma rows to Mongo-compatible API documents (`id` → `_id`).
 */

const SKIP_KEYS = new Set(['__v'])

function mapUser(user) {
  if (!user) return user
  return {
    _id: user.id,
    FirstName: user.firstName,
    LastName: user.lastName,
    email: user.email,
    role: user.role,
  }
}

export function toApiDoc(value, options = {}) {
  if (value == null) return value
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    return value.map((item) => toApiDoc(item, options))
  }
  if (typeof value !== 'object') return value

  // Prisma Decimal etc.
  if (typeof value.toNumber === 'function') return value.toNumber()

  const out = {}
  for (const [key, raw] of Object.entries(value)) {
    if (SKIP_KEYS.has(key)) continue
    if (key === 'id') {
      out._id = raw
      continue
    }
    if (key === 'firstName' || key === 'lastName') continue
    if (key === 'createdById') {
      if (!options.keepFkIds) continue
      out.createdBy = raw
      continue
    }
    if (key === 'authorId') {
      if (!options.keepFkIds) continue
      out.author = raw
      continue
    }
    if (key === 'userId' && options.reviewMode) {
      continue
    }
    if (key === 'createdBy' && raw && typeof raw === 'object' && raw.id) {
      out.createdBy = mapUser(raw)
      continue
    }
    if (key === 'author' && raw && typeof raw === 'object' && raw.id) {
      out.author = mapUser(raw)
      continue
    }
    if (key === 'user' && raw && typeof raw === 'object' && raw.id) {
      out.user = mapUser(raw)
      continue
    }
    if (key === 'durationDays' || key === 'durationNights') {
      continue
    }
    if (key === 'destinationLinks' || key === 'favoritedBy') {
      continue
    }
    if (key === 'guides') {
      if (Array.isArray(raw)) {
        out.guides = raw.map((g) => {
          if (g?.user && typeof g.user === 'object') return mapUser(g.user)
          if (g?.userId) return g.userId
          if (typeof g === 'string') return g
          return toApiDoc(g, options)
        })
      }
      continue
    }
    out[key] = toApiDoc(raw, options)
  }

  // Tour duration reshape
  if (
    Object.prototype.hasOwnProperty.call(value, 'durationDays') ||
    Object.prototype.hasOwnProperty.call(value, 'durationNights')
  ) {
    out.duration = {
      days: value.durationDays,
      nights: value.durationNights,
    }
  }

  return out
}

export default { toApiDoc }
