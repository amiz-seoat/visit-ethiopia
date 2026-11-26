import prisma from '../../config/prisma.js'
import AppError from '../../utils/appError.js'
import { generateObjectId } from '../../utils/objectId.js'
import { slugify } from '../../utils/slugify.js'
import {
  permissionsForProviderTypes,
  membershipRolesForProviderTypes,
} from '../../utils/organizationPermissions.js'
import { buildPublicProfileSnapshot } from '../../services/publicOrganizationService.js'
import {
  toApiOrganization,
  toApiMember,
  toApiProviderVersion,
  toApiApprovalRequest,
} from '../prisma/identitySerialize.js'

export const PUBLIC_ORG_FILTER = {
  approvalStatus: 'approved',
  visibility: 'public',
  approvedVersionId: { not: null },
}

export async function ensureUniqueOrgSlug(baseSlug, excludeId = null) {
  let slug = baseSlug || 'organization'
  let n = 1
  while (true) {
    const existing = await prisma.organization.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: String(excludeId) } } : {}),
      },
      select: { id: true },
    })
    if (!existing) return slug
    n += 1
    slug = `${baseSlug}-${n}`
  }
}

export async function findOrganizationById(id) {
  const row = await prisma.organization.findUnique({ where: { id: String(id) } })
  return toApiOrganization(row)
}

export async function findMember(organizationId, userId) {
  const row = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: String(organizationId),
        userId: String(userId),
      },
    },
  })
  return toApiMember(row)
}

export async function findPreference(userId) {
  const row = await prisma.userOrganizationPreference.findUnique({
    where: { userId: String(userId) },
  })
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    userId: row.userId,
    activeOrganizationId: row.activeOrganizationId,
  }
}

export async function upsertActiveOrganization(userId, organizationId) {
  const existing = await prisma.userOrganizationPreference.findUnique({
    where: { userId: String(userId) },
  })
  const row = existing
    ? await prisma.userOrganizationPreference.update({
        where: { userId: String(userId) },
        data: { activeOrganizationId: String(organizationId) },
      })
    : await prisma.userOrganizationPreference.create({
        data: {
          id: generateObjectId(),
          userId: String(userId),
          activeOrganizationId: String(organizationId),
        },
      })
  return {
    _id: row.id,
    userId: row.userId,
    activeOrganizationId: row.activeOrganizationId,
  }
}

export async function listMembershipsForUser(userId, { statuses } = {}) {
  const where = { userId: String(userId) }
  if (statuses?.length) where.status = { in: statuses }
  else where.status = { not: 'removed' }

  const rows = await prisma.organizationMember.findMany({
    where,
    include: { organization: true },
  })

  return rows.map((m) => ({
    ...toApiMember(m),
    organizationId: toApiOrganization(m.organization),
  }))
}

/**
 * Atomic: Organization + owner Membership + initial draft ProviderVersion.
 */
export async function registerOrganization({
  name,
  legalName,
  providerTypes,
  description,
  shortDescription,
  location,
  contact,
  slug: requestedSlug,
  verification,
  ownerUserId,
}) {
  const baseSlug = slugify(requestedSlug || name)
  const slug = await ensureUniqueOrgSlug(baseSlug)
  const orgId = generateObjectId()
  const memberId = generateObjectId()
  const versionId = generateObjectId()

  const orgData = {
    id: orgId,
    slug,
    name: name.trim(),
    legalName: legalName?.trim() || null,
    providerTypes,
    description: description || '',
    shortDescription: shortDescription || '',
    location: location || undefined,
    contact: contact || undefined,
    verification: verification || {},
    ownerUserId: String(ownerUserId),
    visibility: 'private',
    approvalStatus: 'draft',
    approvedVersionId: null,
    latestVersionId: versionId,
  }

  const snapshot = buildPublicProfileSnapshot({
    ...orgData,
    _id: orgId,
    gallery: [],
    portfolioPhotos: [],
    uniqueSellingPoints: [],
    services: [],
  })

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: orgData })

    const membership = await tx.organizationMember.create({
      data: {
        id: memberId,
        organizationId: orgId,
        userId: String(ownerUserId),
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(providerTypes),
        membershipRoles: membershipRolesForProviderTypes(providerTypes),
        status: 'active',
        joinedAt: new Date(),
      },
    })

    const draftVersion = await tx.providerVersion.create({
      data: {
        id: versionId,
        organizationId: orgId,
        versionNumber: 1,
        status: 'draft',
        snapshot,
        verificationSnapshot: verification || {},
      },
    })

    return { organization, membership, draftVersion }
  })

  return {
    organization: toApiOrganization(result.organization),
    membership: toApiMember(result.membership),
    draftVersion: toApiProviderVersion(result.draftVersion),
  }
}

export async function findProviderVersionById(id) {
  const row = await prisma.providerVersion.findUnique({ where: { id: String(id) } })
  return toApiProviderVersion(row)
}

export async function getApprovedVersion(organization) {
  if (!organization?.approvedVersionId) return null
  const version = await findProviderVersionById(organization.approvedVersionId)
  if (!version || version.status !== 'approved') return null
  if (String(version.organizationId) !== String(organization._id || organization.id)) {
    return null
  }
  return version
}

export async function getLatestVersion(organization) {
  if (!organization?.latestVersionId) return null
  return findProviderVersionById(organization.latestVersionId)
}

export async function listVersions(organizationId, { includePrivate = true } = {}) {
  const where = { organizationId: String(organizationId) }
  if (!includePrivate) {
    where.status = { in: ['approved', 'superseded'] }
  }
  const rows = await prisma.providerVersion.findMany({
    where,
    orderBy: { versionNumber: 'desc' },
  })
  return rows.map(toApiProviderVersion)
}

export async function updateOrganizationFields(id, data) {
  const row = await prisma.organization.update({
    where: { id: String(id) },
    data,
  })
  return toApiOrganization(row)
}

export async function updateProviderVersion(id, data) {
  const mapped = { ...data }
  if (mapped.submittedBy !== undefined) {
    mapped.submittedById = mapped.submittedBy
    delete mapped.submittedBy
  }
  if (mapped.approvedBy !== undefined) {
    mapped.approvedById = mapped.approvedBy
    delete mapped.approvedBy
  }
  if (mapped.rejectedBy !== undefined) {
    mapped.rejectedById = mapped.rejectedBy
    delete mapped.rejectedBy
  }
  const row = await prisma.providerVersion.update({
    where: { id: String(id) },
    data: mapped,
  })
  return toApiProviderVersion(row)
}

export async function findPendingApprovalForVersion(providerVersionId) {
  const row = await prisma.approvalRequest.findFirst({
    where: {
      providerVersionId: String(providerVersionId),
      status: { in: ['pending', 'processing'] },
    },
  })
  return toApiApprovalRequest(row)
}

export async function createApprovalRequest(data) {
  const row = await prisma.approvalRequest.create({
    data: {
      id: generateObjectId(),
      organizationId: String(data.organizationId),
      providerVersionId: String(data.providerVersionId),
      requestType: data.requestType,
      status: data.status || 'pending',
      submittedById: String(data.submittedBy),
      submittedAt: data.submittedAt || new Date(),
      verificationChecklist: data.verificationChecklist || [],
      providerTypes: data.providerTypes || [],
      changedFields: data.changedFields || [],
      requiresReapproval: Boolean(data.requiresReapproval),
    },
  })
  return toApiApprovalRequest(row)
}

export async function findApprovalRequestById(id) {
  const row = await prisma.approvalRequest.findUnique({
    where: { id: String(id) },
  })
  return toApiApprovalRequest(row)
}

export async function updateApprovalRequest(id, data) {
  const mapped = { ...data }
  if (mapped.reviewedBy !== undefined) {
    mapped.reviewedById = mapped.reviewedBy
    delete mapped.reviewedBy
  }
  const row = await prisma.approvalRequest.update({
    where: { id: String(id) },
    data: mapped,
  })
  return toApiApprovalRequest(row)
}

export async function claimPendingApproval(id, update) {
  const mapped = { ...update }
  if (mapped.reviewedBy !== undefined) {
    mapped.reviewedById = mapped.reviewedBy
    delete mapped.reviewedBy
  }
  const result = await prisma.approvalRequest.updateMany({
    where: { id: String(id), status: 'pending' },
    data: mapped,
  })
  if (result.count === 0) return null
  return findApprovalRequestById(id)
}

export async function claimSubmittedVersion(id, update) {
  const mapped = { ...update }
  if (mapped.approvedBy !== undefined) {
    mapped.approvedById = mapped.approvedBy
    delete mapped.approvedBy
  }
  if (mapped.rejectedBy !== undefined) {
    mapped.rejectedById = mapped.rejectedBy
    delete mapped.rejectedBy
  }
  const result = await prisma.providerVersion.updateMany({
    where: { id: String(id), status: 'submitted' },
    data: mapped,
  })
  if (result.count === 0) return null
  return findProviderVersionById(id)
}

/**
 * Sync org profile from approved version + finalize approval (transaction).
 */
export async function applyApprovalTransaction({
  organizationId,
  versionId,
  approvalRequestId,
  previousApprovedId,
  snapshot,
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({
      where: { id: String(organizationId) },
    })
    if (!current) throw new AppError('Organization not found', 404)

    let slug = current.slug
    if (
      snapshot.proposedSlug &&
      slugify(snapshot.proposedSlug) !== current.slug
    ) {
      const proposed = slugify(snapshot.proposedSlug)
      const clash = await tx.organization.findFirst({
        where: { slug: proposed, id: { not: String(organizationId) } },
      })
      slug = clash ? `${proposed}-${Date.now().toString(36)}` : proposed
      if (slug !== current.slug) {
        await tx.organizationPreviousSlug.create({
          data: {
            id: generateObjectId(),
            organizationId: String(organizationId),
            slug: current.slug,
            changedAt: new Date(),
          },
        })
      }
    }

    // Clear unique approvedVersionId FK before reassignment
    await tx.organization.update({
      where: { id: String(organizationId) },
      data: { approvedVersionId: null },
    })

    if (previousApprovedId && String(previousApprovedId) !== String(versionId)) {
      await tx.providerVersion.updateMany({
        where: { id: String(previousApprovedId), status: 'approved' },
        data: { status: 'superseded' },
      })
    }

    const organization = await tx.organization.update({
      where: { id: String(organizationId) },
      data: {
        name: snapshot.name,
        legalName: snapshot.legalName ?? null,
        providerTypes: snapshot.providerTypes,
        logo: snapshot.logo ?? null,
        coverImage: snapshot.coverImage ?? null,
        gallery: snapshot.gallery ?? [],
        portfolioPhotos: snapshot.portfolioPhotos ?? [],
        description: snapshot.description ?? '',
        shortDescription: snapshot.shortDescription ?? '',
        uniqueSellingPoints: snapshot.uniqueSellingPoints ?? [],
        services: snapshot.services ?? [],
        yearsInBusiness: snapshot.yearsInBusiness ?? null,
        location: snapshot.location ?? undefined,
        contact: snapshot.contact ?? undefined,
        slug,
        approvedVersionId: String(versionId),
        latestVersionId: String(versionId),
        approvalStatus: 'approved',
        visibility: 'public',
      },
    })

    const approvalRequest = await tx.approvalRequest.update({
      where: { id: String(approvalRequestId) },
      data: { status: 'approved' },
    })

    const version = await tx.providerVersion.findUnique({
      where: { id: String(versionId) },
    })

    return {
      organization: toApiOrganization(organization),
      approvalRequest: toApiApprovalRequest(approvalRequest),
      version: toApiProviderVersion(version),
    }
  })
}

export async function listPublicOrganizations() {
  const rows = await prisma.organization.findMany({
    where: PUBLIC_ORG_FILTER,
  })
  return rows.map(toApiOrganization)
}

export async function findPublicOrganizationBySlug(slug) {
  const normalized = String(slug).toLowerCase()
  let org = await prisma.organization.findFirst({
    where: { slug: normalized, ...PUBLIC_ORG_FILTER },
  })
  let redirected = false
  if (!org) {
    const prev = await prisma.organizationPreviousSlug.findUnique({
      where: { slug: normalized },
      include: { organization: true },
    })
    if (
      prev?.organization &&
      prev.organization.approvalStatus === 'approved' &&
      prev.organization.visibility === 'public' &&
      prev.organization.approvedVersionId
    ) {
      org = prev.organization
      redirected = true
    }
  }
  if (!org) return null
  const approved = await getApprovedVersion(toApiOrganization(org))
  if (!approved) return null
  return {
    organization: toApiOrganization(org),
    approvedVersion: approved,
    canonicalSlug: org.slug,
    redirected: redirected || org.slug !== normalized,
  }
}

export async function createDraftVersion(organization, verification = {}) {
  const latest = await prisma.providerVersion.findFirst({
    where: { organizationId: String(organization._id) },
    orderBy: { versionNumber: 'desc' },
  })
  const versionNumber = (latest?.versionNumber || 0) + 1
  const id = generateObjectId()
  const row = await prisma.providerVersion.create({
    data: {
      id,
      organizationId: String(organization._id),
      versionNumber,
      status: 'draft',
      snapshot: buildPublicProfileSnapshot(organization),
      verificationSnapshot: verification || {},
    },
  })
  await prisma.organization.update({
    where: { id: String(organization._id) },
    data: { latestVersionId: id },
  })
  return toApiProviderVersion(row)
}

export async function listApprovalRequests(filters = {}) {
  const where = {}
  if (filters.status) where.status = filters.status
  if (filters.providerType) {
    where.providerTypes = { has: String(filters.providerType) }
  }

  const rows = await prisma.approvalRequest.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          providerTypes: true,
          approvalStatus: true,
          visibility: true,
        },
      },
      submittedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  return rows.map((row) => {
    const req = toApiApprovalRequest(row)
    req.organizationId = row.organization
      ? {
          _id: row.organization.id,
          name: row.organization.name,
          slug: row.organization.slug,
          providerTypes: row.organization.providerTypes,
          approvalStatus: row.organization.approvalStatus,
          visibility: row.organization.visibility,
        }
      : row.organizationId
    req.submittedBy = row.submittedBy
      ? {
          _id: row.submittedBy.id,
          FirstName: row.submittedBy.firstName,
          LastName: row.submittedBy.lastName,
          email: row.submittedBy.email,
        }
      : row.submittedById
    return req
  })
}

function mapApprovalUser(user) {
  if (!user) return null
  return {
    _id: user.id,
    FirstName: user.firstName,
    LastName: user.lastName,
    email: user.email,
  }
}

export async function getApprovalRequestDetail(approvalRequestId) {
  const row = await prisma.approvalRequest.findUnique({
    where: { id: String(approvalRequestId) },
    include: {
      submittedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      reviewedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })
  if (!row) return null

  const approvalRequest = {
    ...toApiApprovalRequest(row),
    submittedBy: mapApprovalUser(row.submittedBy) || row.submittedById,
    reviewedBy: mapApprovalUser(row.reviewedBy) || row.reviewedById,
  }

  const version = await findProviderVersionById(row.providerVersionId)
  const organization = await findOrganizationById(row.organizationId)

  let currentApprovedVersion = null
  if (
    organization?.approvedVersionId &&
    version &&
    String(organization.approvedVersionId) !== String(version._id)
  ) {
    currentApprovedVersion = await findProviderVersionById(
      organization.approvedVersionId
    )
  }

  return {
    approvalRequest,
    submittedVersion: version,
    currentApprovedVersion,
    organization: organization
      ? {
          _id: organization._id,
          slug: organization.slug,
          approvalStatus: organization.approvalStatus,
          visibility: organization.visibility,
          providerTypes: organization.providerTypes,
        }
      : null,
    diff: version
      ? null // filled by service with analyzeVersionChanges
      : null,
    verificationChecklist: approvalRequest.verificationChecklist || [],
    _submittedSnapshot: version?.snapshot,
    _approvedSnapshot: currentApprovedVersion?.snapshot,
  }
}

export async function suspendOrganization(organizationId, adminUserId, reason) {
  const existing = await prisma.organization.findUnique({
    where: { id: String(organizationId) },
  })
  if (!existing) return null
  const row = await prisma.organization.update({
    where: { id: String(organizationId) },
    data: {
      approvalStatus: 'suspended',
      visibility: 'private',
      suspendedAt: new Date(),
      suspendedById: String(adminUserId),
      suspensionReason: reason || '',
    },
  })
  return toApiOrganization(row)
}

export async function reactivateOrganization(organizationId) {
  const current = await prisma.organization.findUnique({
    where: { id: String(organizationId) },
  })
  if (!current) return null
  if (!current.approvedVersionId) {
    const err = new Error(
      'Organization cannot be reactivated without an approved version'
    )
    err.statusCode = 400
    throw err
  }
  const row = await prisma.organization.update({
    where: { id: String(organizationId) },
    data: {
      approvalStatus: 'approved',
      visibility: 'public',
      suspendedAt: null,
      suspendedById: null,
      suspensionReason: '',
    },
  })
  return toApiOrganization(row)
}

export default {
  ensureUniqueOrgSlug,
  findOrganizationById,
  findMember,
  findPreference,
  upsertActiveOrganization,
  listMembershipsForUser,
  registerOrganization,
  findProviderVersionById,
  getApprovedVersion,
  getLatestVersion,
  listVersions,
  updateOrganizationFields,
  updateProviderVersion,
  findPendingApprovalForVersion,
  createApprovalRequest,
  findApprovalRequestById,
  updateApprovalRequest,
  claimPendingApproval,
  claimSubmittedVersion,
  applyApprovalTransaction,
  listPublicOrganizations,
  findPublicOrganizationBySlug,
  createDraftVersion,
  listApprovalRequests,
  getApprovalRequestDetail,
  suspendOrganization,
  reactivateOrganization,
  PUBLIC_ORG_FILTER,
}
