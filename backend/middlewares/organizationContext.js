import mongoose from 'mongoose'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import Organization from '../models/Organization.js'
import OrganizationMember from '../models/OrganizationMember.js'
import UserOrganizationPreference from '../models/UserOrganizationPreference.js'
import { isPrismaIdentity } from '../utils/databaseMode.js'
import { getOrganizationRepository } from '../repositories/organizations/index.js'
import {
  memberHasPermission,
  memberHasOrgRole,
  isOrganizationOwner,
  isOrganizationAdmin,
} from '../utils/organizationPermissions.js'

const ORG_CONTEXT_HEADER = 'x-org-context'
const ADMIN_ORG_BYPASS_HEADER = 'x-admin-org-bypass'

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

  if (urlScopedOrganizationId(req)) return null

  if (req.user?.id) {
    if (isPrismaIdentity()) {
      const orgs = getOrganizationRepository()
      const pref = await orgs.findPreference(req.user.id)
      if (pref?.activeOrganizationId) {
        req.user.activeOrganizationId = pref.activeOrganizationId
        return String(pref.activeOrganizationId)
      }
    } else {
      const pref = await UserOrganizationPreference.findOne({
        userId: req.user.id,
      }).select('activeOrganizationId')
      if (pref?.activeOrganizationId) {
        req.user.activeOrganizationId = pref.activeOrganizationId
        return String(pref.activeOrganizationId)
      }
    }
  }
  return null
}

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

    let organization
    let member = null

    if (isPrismaIdentity()) {
      const orgs = getOrganizationRepository()
      organization = await orgs.findOrganizationById(orgId)
    } else {
      organization = await Organization.findById(orgId)
    }

    if (!organization) {
      return next(new AppError('Organization not found for context', 400))
    }

    const isPlatformAdmin = req.user?.role === 'admin'
    const adminBypass =
      options.allowAdminBypass !== false &&
      isPlatformAdmin &&
      (req.headers[ADMIN_ORG_BYPASS_HEADER] === 'true' ||
        req.headers[ADMIN_ORG_BYPASS_HEADER.toLowerCase()] === 'true')

    if (!adminBypass) {
      if (isPrismaIdentity()) {
        const orgs = getOrganizationRepository()
        member = await orgs.findMember(orgId, req.user.id)
      } else {
        member = await OrganizationMember.findOne({
          organizationId: orgId,
          userId: req.user.id,
        })
      }

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
          new AppError(
            'Your membership in this organization has been removed',
            403
          )
        )
      }

      if (member.status !== 'active') {
        return next(
          new AppError(
            'Your membership in this organization is not active',
            403
          )
        )
      }
    }

    req.organizationId = organization._id
    req.organization = organization
    req.organizationMember = member
    req.isAdminOrgBypass = adminBypass
    next()
  })

export const requireOrganizationPermission = (permission) =>
  catchAsync(async (req, res, next) => {
    if (req.isAdminOrgBypass && req.user?.role === 'admin') {
      return next()
    }
    if (!memberHasPermission(req.organizationMember, permission)) {
      return next(
        new AppError(`You do not have permission: ${permission}`, 403)
      )
    }
    next()
  })

/** Allow if the member has any one of the listed permissions (owner/admin still bypass). */
export const requireAnyOrganizationPermission = (...permissions) =>
  catchAsync(async (req, res, next) => {
    if (req.isAdminOrgBypass && req.user?.role === 'admin') {
      return next()
    }
    const member = req.organizationMember
    const ok = permissions.some((p) => memberHasPermission(member, p))
    if (!ok) {
      return next(
        new AppError(
          `You do not have permission: ${permissions.join(' or ')}`,
          403
        )
      )
    }
    next()
  })

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
