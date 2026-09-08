import mongoose from 'mongoose'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import Organization from '../models/Organization.js'
import OrganizationMember from '../models/OrganizationMember.js'
import UserOrganizationPreference from '../models/UserOrganizationPreference.js'
import {
  memberHasPermission,
  memberHasOrgRole,
  isOrganizationOwner,
  isOrganizationAdmin,
} from '../utils/organizationPermissions.js'

const ORG_CONTEXT_HEADER = 'x-org-context'
const ADMIN_ORG_BYPASS_HEADER = 'x-admin-org-bypass'

/**
 * Resolve organization id from header or optional fallback on req.user preference.
 */
export function getOrganizationContextId(req) {
  const header =
    req.headers[ORG_CONTEXT_HEADER] ||
    req.headers[ORG_CONTEXT_HEADER.toLowerCase()]
  if (header) return String(header).trim()
  if (req.user?.activeOrganizationId) {
    return String(req.user.activeOrganizationId)
  }
  return null
}

function urlScopedOrganizationId(req) {
  const candidate = req.params?.organizationId || req.params?.id
  if (!candidate) return null
  const value = String(candidate).trim()
  return mongoose.Types.ObjectId.isValid(value) ? value : null
}

async function resolveOrganizationContextId(req) {
  const header =
    req.headers[ORG_CONTEXT_HEADER] ||
    req.headers[ORG_CONTEXT_HEADER.toLowerCase()]
  if (header) return String(header).trim()

  // URL-scoped provider routes must send X-Org-Context explicitly.
  if (urlScopedOrganizationId(req)) return null

  if (req.user?.id) {
    const pref = await UserOrganizationPreference.findOne({
      userId: req.user.id,
    }).select('activeOrganizationId')
    if (pref?.activeOrganizationId) {
      req.user.activeOrganizationId = pref.activeOrganizationId
      return String(pref.activeOrganizationId)
    }
  }
  return null
}

/**
 * Require X-Org-Context (or server preference fallback) for provider mutations.
 */
export const requireOrganizationContext = (options = {}) =>
  catchAsync(async (req, res, next) => {
    const orgId = await resolveOrganizationContextId(req)

    if (!orgId) {
      return next(
        new AppError(
          'Organization context is required. Send the X-Org-Context header with your organization id.',
          400
        )
      )
    }

    const organization = await Organization.findById(orgId)
    if (!organization) {
      return next(new AppError('Organization not found for context', 400))
    }

    const isPlatformAdmin = req.user?.role === 'admin'
    const adminBypass =
      options.allowAdminBypass !== false &&
      isPlatformAdmin &&
      (req.headers[ADMIN_ORG_BYPASS_HEADER] === 'true' ||
        req.headers[ADMIN_ORG_BYPASS_HEADER.toLowerCase()] === 'true')

    let member = null
    if (!adminBypass) {
      member = await OrganizationMember.findOne({
        organizationId: orgId,
        userId: req.user.id,
      })

      if (!member) {
        return next(
          new AppError('You are not a member of this organization', 403)
        )
      }

      if (member.status === 'suspended') {
        return next(
          new AppError('Your membership in this organization is suspended', 403)
        )
      }

      if (member.status === 'removed') {
        return next(
          new AppError('Your membership in this organization has been removed', 403)
        )
      }

      if (member.status !== 'active') {
        return next(
          new AppError('Your membership in this organization is not active', 403)
        )
      }
    }

    req.organizationId = organization._id
    req.organization = organization
    req.organizationMember = member
    req.isAdminOrgBypass = adminBypass
    next()
  })

/**
 * Require a specific permission within the resolved organization.
 */
export const requireOrganizationPermission = (permission) =>
  catchAsync(async (req, res, next) => {
    if (req.isAdminOrgBypass && req.user?.role === 'admin') {
      return next()
    }
    if (!memberHasPermission(req.organizationMember, permission)) {
      return next(
        new AppError(
          `You do not have permission: ${permission}`,
          403
        )
      )
    }
    next()
  })

/**
 * Require one of the organization roles.
 */
export const requireOrganizationRole =
  (...roles) =>
  (req, res, next) => {
    if (req.isAdminOrgBypass && req.user?.role === 'admin') {
      return next()
    }
    if (!memberHasOrgRole(req.organizationMember, ...roles)) {
      return next(
        new AppError('You do not have the required organization role', 403)
      )
    }
    next()
  }

export { isOrganizationOwner, isOrganizationAdmin, memberHasPermission }

export default requireOrganizationContext
