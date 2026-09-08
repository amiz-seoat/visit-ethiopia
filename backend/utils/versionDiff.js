import { REAPPROVAL_FIELDS } from '../config/reapprovalFields.js'

function getByPath(obj, path) {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined
    return acc[key]
  }, obj)
}

function stableStringify(value) {
  if (value === undefined) return '__undefined__'
  if (value === null) return 'null'
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(',')}}`
  }
  return String(value)
}

function valuesEqual(a, b) {
  return stableStringify(a) === stableStringify(b)
}

/**
 * Compare two snapshot objects and return changed field paths.
 */
export function diffSnapshots(before = {}, after = {}, basePath = '') {
  const changed = []
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ])

  for (const key of keys) {
    const path = basePath ? `${basePath}.${key}` : key
    const a = before?.[key]
    const b = after?.[key]

    if (
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b) &&
      !(a instanceof Date) &&
      !(b instanceof Date)
    ) {
      changed.push(...diffSnapshots(a, b, path))
    } else if (!valuesEqual(a, b)) {
      changed.push(path)
    }
  }

  return changed
}

/**
 * Determine which changed fields require re-approval.
 */
export function getReapprovalChanges(changedFields, subjectType = 'organization') {
  const rules = REAPPROVAL_FIELDS[subjectType] || []
  return changedFields.filter((field) =>
    rules.some(
      (rule) => field === rule || field.startsWith(`${rule}.`)
    )
  )
}

export function analyzeVersionChanges({
  approvedSnapshot,
  submittedSnapshot,
  subjectType = 'organization',
}) {
  const changedFields = approvedSnapshot
    ? diffSnapshots(approvedSnapshot, submittedSnapshot)
    : Object.keys(submittedSnapshot || {})

  const reapprovalFields = getReapprovalChanges(changedFields, subjectType)

  return {
    changedFields,
    requiresReapproval: reapprovalFields.length > 0,
    reapprovalFields,
  }
}

export default { diffSnapshots, getReapprovalChanges, analyzeVersionChanges }
