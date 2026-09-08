/** Escape special regex characters in user input for safe MongoDB $regex queries. */
export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default escapeRegex
