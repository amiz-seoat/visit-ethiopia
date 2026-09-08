import mongoose from 'mongoose'
import Organization from '../models/Organization.js'
import OrganizationMember from '../models/OrganizationMember.js'
import UserOrganizationPreference from '../models/UserOrganizationPreference.js'
import ProviderVersion from '../models/ProviderVersion.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import { slugify, ensureUniqueSlug } from '../utils/slugify.js'
import {
  PROVIDER_TYPES,
  permissionsForProviderTypes,
  membershipRolesForProviderTypes,
} from '../utils/organizationPermissions.js'
import {
  createInitialDraftVersion,
  updateEditableDraft,
  getApprovedVersion,
  getLatestVersion,
  listOrganizationVersions,
  loadPublicOrganizationBySlug,
} from '../services/organizationVersionService.js'
import {
  serializeProviderWorkspace,
  stripPrivateOrganizationFields,
} from '../services/publicOrganizationService.js'
import { submitVersionForApproval } from '../services/approvalService.js'

export const registerOrganization = catchAsync(async (req, res, next) => {
  const {
    name,
    legalName,
    providerTypes,
    description,
    shortDescription,
    location,
    contact,
    slug: requestedSlug,
    verification,
  } = req.body

  if (!name?.trim()) {
    return next(new AppError('Organization name is required', 400))
  }

  if (!Array.isArray(providerTypes) || providerTypes.length === 0) {
    return next(new AppError('At least one providerType is required', 400))
  }

  const invalidTypes = providerTypes.filter((t) => !PROVIDER_TYPES.includes(t))
  if (invalidTypes.length) {
    return next(
      new AppError(`Invalid providerTypes: ${invalidTypes.join(', ')}`, 400)
    )
  }

  const forbidden = [
    'approvalStatus',
    'visibility',
    'ownerUserId',
    'averageRating',
    'reviewCount',
    'approvedVersionId',
    'latestVersionId',
  ]
  for (const key of forbidden) {
    if (req.body[key] !== undefined) {
      return next(new AppError(`Cannot set ${key} during registration`, 400))
    }
  }

  const baseSlug = slugify(requestedSlug || name)
  const slug = await ensureUniqueSlug(Organization, baseSlug)

  const organization = await Organization.create({
    slug,
    name: name.trim(),
    legalName: legalName?.trim(),
    providerTypes,
    description: description || '',
    shortDescription: shortDescription || '',
    location,
    contact,
    verification: verification || {},
    ownerUserId: req.user.id,
    visibility: 'private',
    approvalStatus: 'draft',
    approvedVersionId: null,
    latestVersionId: null,
  })

  const membership = await OrganizationMember.create({
    organizationId: organization._id,
    userId: req.user.id,
    orgRole: 'owner',
    permissions: permissionsForProviderTypes(providerTypes),
    membershipRoles: membershipRolesForProviderTypes(providerTypes),
    status: 'active',
    joinedAt: new Date(),
  })

  const draftVersion = await createInitialDraftVersion(
    organization,
    verification || {}
  )

  res.status(201).json({
    status: 'success',
    data: {
      organization: stripPrivateOrganizationFields(organization),
      membership,
      draftVersion: {
        _id: draftVersion._id,
        versionNumber: draftVersion.versionNumber,
        status: draftVersion.status,
      },
    },
  })
})

export const getMyOrganizations = catchAsync(async (req, res) => {
  const memberships = await OrganizationMember.find({
    userId: req.user.id,
    status: { $in: ['active', 'invited', 'suspended'] },
  }).populate({
    path: 'organizationId',
  })

  const enriched = await Promise.all(
    memberships.map(async (m) => {
      const org = m.organizationId
      if (!org) return m
      const latest = await getLatestVersion(org)
      const approved = await getApprovedVersion(org)
      return {
        ...m.toObject(),
        organizationId: stripPrivateOrganizationFields(org),
        latestVersionStatus: latest?.status,
        approvedVersionNumber: approved?.versionNumber,
      }
    })
  )

  res.status(200).json({
    status: 'success',
    results: enriched.length,
    data: { memberships: enriched },
  })
})

export const getUserOrganizations = catchAsync(async (req, res) => {
  const memberships = await OrganizationMember.find({
    userId: req.user.id,
    status: { $ne: 'removed' },
  }).populate({ path: 'organizationId' })

  const pref = await UserOrganizationPreference.findOne({
    userId: req.user.id,
  })

  res.status(200).json({
    status: 'success',
    results: memberships.length,
    data: {
      memberships: memberships.map((m) => ({
        ...m.toObject(),
        organizationId: stripPrivateOrganizationFields(m.organizationId),
      })),
      activeOrganizationId: pref?.activeOrganizationId || null,
    },
  })
})

export const setActiveOrganization = catchAsync(async (req, res, next) => {
  const { organizationId } = req.body
  if (!organizationId) {
    return next(new AppError('organizationId is required', 400))
  }

  const member = await OrganizationMember.findOne({
    organizationId,
    userId: req.user.id,
    status: 'active',
  })

  if (!member) {
    return next(
      new AppError(
        'You must be an active member of the organization to set it as active',
        403
      )
    )
  }

  const pref = await UserOrganizationPreference.findOneAndUpdate(
    { userId: req.user.id },
    { activeOrganizationId: organizationId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  res.status(200).json({
    status: 'success',
    data: {
      activeOrganizationId: pref.activeOrganizationId,
    },
  })
})

export const listPublicOrganizations = catchAsync(async (req, res) => {
  const orgs = await Organization.find(Organization.publicMarketplaceFilter())
  const limit = Math.min(Number(req.query.limit) || 100, 100)
  const page = Number(req.query.page) || 1
  const skip = (page - 1) * limit

  const paginated = orgs.slice(skip, skip + limit)
  const data = []

  for (const org of paginated) {
    const approved = await getApprovedVersion(org)
    if (!approved) continue
    data.push({
      _id: org._id,
      slug: org.slug,
      name: approved.snapshot.name,
      shortDescription: approved.snapshot.shortDescription,
      providerTypes: approved.snapshot.providerTypes,
      logo: approved.snapshot.logo,
      coverImage: approved.snapshot.coverImage,
      averageRating: org.averageRating,
      reviewCount: org.reviewCount,
      location: approved.snapshot.location,
    })
  }

  res.status(200).json({
    status: 'success',
    results: data.length,
    data: { data },
  })
})

export const getOrganizationBySlug = catchAsync(async (req, res, next) => {
  if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
    return next(new AppError('Organization not found', 404))
  }

  const result = await loadPublicOrganizationBySlug(req.params.slug)
  if (!result) {
    return next(new AppError('Organization not found', 404))
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: result.organization,
      canonicalSlug: result.canonicalSlug,
      redirected: result.redirected,
    },
  })
})

export const getProviderWorkspace = catchAsync(async (req, res, next) => {
  if (req.organizationId.toString() !== req.params.organizationId) {
    return next(new AppError('Organization context mismatch', 403))
  }

  const latest = await getLatestVersion(req.organization)
  const approved = await getApprovedVersion(req.organization)

  res.status(200).json({
    status: 'success',
    data: serializeProviderWorkspace(req.organization, latest, approved),
  })
})

export const updateOrganizationDraft = catchAsync(async (req, res, next) => {
  if (req.organizationId.toString() !== req.params.organizationId) {
    return next(new AppError('Organization context mismatch', 403))
  }

  if (
    req.body.approvalStatus ||
    req.body.visibility ||
    req.body.approvedVersionId ||
    req.body.latestVersionId ||
    req.body.status
  ) {
    return next(
      new AppError('Approval fields cannot be changed directly', 400)
    )
  }

  const { verification, ...profileUpdates } = req.body

  const draft = await updateEditableDraft(
    req.organization,
    profileUpdates,
    verification
  )

  res.status(200).json({
    status: 'success',
    data: {
      version: {
        _id: draft._id,
        versionNumber: draft.versionNumber,
        status: draft.status,
        snapshot: draft.snapshot,
        changedFields: draft.changedFields,
        requiresReapproval: draft.requiresReapproval,
      },
    },
  })
})

export const listVersions = catchAsync(async (req, res, next) => {
  if (req.organizationId.toString() !== req.params.organizationId) {
    return next(new AppError('Organization context mismatch', 403))
  }

  const versions = await ProviderVersion.find({
    organizationId: req.organizationId,
  })
    .sort({ versionNumber: -1 })
    .select(
      '-verificationSnapshot'
    )

  res.status(200).json({
    status: 'success',
    results: versions.length,
    data: { versions },
  })
})

export const submitVersion = catchAsync(async (req, res, next) => {
  if (req.organizationId.toString() !== req.params.organizationId) {
    return next(new AppError('Organization context mismatch', 403))
  }

  const result = await submitVersionForApproval({
    organization: req.organization,
    versionId: req.params.versionId,
    submittedBy: req.user.id,
  })

  res.status(200).json({
    status: 'success',
    data: {
      version: {
        _id: result.version._id,
        versionNumber: result.version.versionNumber,
        status: result.version.status,
        submittedAt: result.version.submittedAt,
      },
      approvalRequest: {
        _id: result.approvalRequest._id,
        status: result.approvalRequest.status,
      },
    },
  })
})

/** Legacy PATCH — now updates draft version (version-aware). */
export const updateOrganization = catchAsync(async (req, res, next) => {
  req.params.organizationId = req.params.id
  return updateOrganizationDraft(req, res, next)
})

export const getOrganizationResource = catchAsync(async (req, res, next) => {
  const orgId = req.params.organizationId

  if (req.organizationId.toString() !== orgId) {
    return next(new AppError('Organization context mismatch', 403))
  }

  res.status(200).json({
    status: 'success',
    data: {
      organizationId: req.organizationId,
      organizationName: req.organization.name,
      memberRole: req.organizationMember?.orgRole,
    },
  })
})
