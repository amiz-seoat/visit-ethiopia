/**
 * Generate a URL-safe slug from a string.
 */
export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Ensure slug is unique by appending -2, -3, ...
 * @param {import('mongoose').Model} Model
 * @param {string} baseSlug
 * @param {string} [excludeId]
 */
export async function ensureUniqueSlug(Model, baseSlug, excludeId = null) {
  let slug = baseSlug || 'organization'
  let n = 1
  while (true) {
    const query = { slug }
    if (excludeId) query._id = { $ne: excludeId }
    const exists = await Model.exists(query)
    if (!exists) return slug
    n += 1
    slug = `${baseSlug}-${n}`
  }
}

export default slugify
