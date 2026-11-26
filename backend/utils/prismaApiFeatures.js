import { escapeRegex } from './escapeRegex.js'

const MAX_PAGE_LIMIT = 100
const SORT_FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

const EXCLUDE = new Set([
  'page',
  'sort',
  'limit',
  'fields',
  'minPrice',
  'maxPrice',
  'search',
])

/** Map API/Mongo field names → Prisma column names for sorting/filtering. */
const FIELD_MAP = {
  createdBy: 'createdById',
  author: 'authorId',
  user: 'userId',
}

/**
 * Build Prisma findMany args from Express query (APIFeatures-compatible).
 * @param {object} queryString
 * @param {object} [baseWhere]
 * @param {{ searchableFields?: string[], priceField?: string }} [opts]
 */
export function buildPrismaListArgs(queryString = {}, baseWhere = {}, opts = {}) {
  const searchableFields = opts.searchableFields || [
    'title',
    'name',
    'shortDescription',
    'description',
  ]
  const priceField = opts.priceField || 'price'
  const sortAliases = opts.sortAliases || {}

  const where = { ...baseWhere }
  const and = []

  for (const [rawKey, rawVal] of Object.entries(queryString)) {
    if (EXCLUDE.has(rawKey)) continue
    if (rawVal == null || rawVal === '') continue

    const key = FIELD_MAP[rawKey] || rawKey
    if (typeof rawVal === 'object' && !Array.isArray(rawVal)) {
      // advanced operators from query like price[gte]= — rare; skip complex nesting
      continue
    }

    const strVal = String(rawVal)
    // boolean-ish
    if (strVal === 'true' || strVal === 'false') {
      where[key] = strVal === 'true'
      continue
    }
    // number for known numeric filters
    if (
      ['price', 'stars', 'averageRating', 'views', 'maxGroupSize'].includes(key) &&
      !Number.isNaN(Number(strVal))
    ) {
      where[key] = Number(strVal)
      continue
    }
    where[key] = rawVal
  }

  if (queryString.minPrice || queryString.maxPrice) {
    const price = {}
    if (queryString.minPrice) price.gte = Number(queryString.minPrice)
    if (queryString.maxPrice) price.lte = Number(queryString.maxPrice)
    and.push({ [priceField]: price })
  }

  if (queryString.search) {
    const term = escapeRegex(String(queryString.search).trim())
    if (term) {
      and.push({
        OR: searchableFields.map((field) => ({
          [field]: { contains: term, mode: 'insensitive' },
        })),
      })
    }
  }

  if (and.length) {
    where.AND = [...(where.AND || []), ...and]
  }

  // sort
  let orderBy = [{ createdAt: 'desc' }]
  if (queryString.sort) {
    const parts = String(queryString.sort)
      .split(',')
      .map((p) => p.trim())
      .filter((part) => {
        const field = part.replace(/^-/, '')
        return SORT_FIELD_PATTERN.test(field)
      })
    if (parts.length) {
      orderBy = parts.map((part) => {
        const desc = part.startsWith('-')
        const rawField = part.replace(/^-/, '')
        const field =
          sortAliases[rawField] || FIELD_MAP[rawField] || rawField
        // duration.days → durationDays
        const prismaField =
          field === 'duration.days' || field === 'durationDays'
            ? 'durationDays'
            : field
        return { [prismaField]: desc ? 'desc' : 'asc' }
      })
    }
  }

  const page = Math.max(1, Number(queryString.page) || 1)
  const requested = Number(queryString.limit) || 100
  const take = Math.min(MAX_PAGE_LIMIT, Math.max(1, requested))
  const skip = (page - 1) * take

  return { where, orderBy, skip, take }
}

export default { buildPrismaListArgs }
