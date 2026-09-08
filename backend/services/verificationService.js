import { getVerificationProfile } from '../config/verificationProfiles.js'
import AppError from '../utils/appError.js'

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined
    return acc[key]
  }, obj)
}

export function buildVerificationChecklist(providerTypes = [], verification = {}) {
  const checklist = []

  for (const providerType of providerTypes) {
    const profile = getVerificationProfile(providerType)
    if (!profile) continue

    for (const field of profile.requiredVerificationFields) {
      const value = getByPath(verification, field)
      checklist.push({
        key: `${providerType}:${field}`,
        label: `${profile.label}: ${field}`,
        required: true,
        satisfied: Boolean(value && String(value).trim()),
      })
    }

    for (const docType of profile.requiredDocumentTypes) {
      const docs = verification.businessDocuments || []
      const found = docs.some(
        (d) => d.type === docType && d.url && d.status !== 'rejected'
      )
      checklist.push({
        key: `${providerType}:doc:${docType}`,
        label: `${profile.label}: document ${docType}`,
        required: true,
        satisfied: found,
      })
    }
  }

  return checklist
}

export function validateVerification(providerTypes = [], verification = {}) {
  const checklist = buildVerificationChecklist(providerTypes, verification)
  const missing = checklist.filter((item) => item.required && !item.satisfied)

  if (missing.length) {
    throw new AppError(
      `Missing required verification: ${missing.map((m) => m.label).join('; ')}`,
      400
    )
  }

  return checklist
}

export default { buildVerificationChecklist, validateVerification }
