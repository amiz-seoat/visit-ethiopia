import Organization from '../models/Organization.js'
import ProviderVersion from '../models/ProviderVersion.js'
import ApprovalRequest from '../models/ApprovalRequest.js'
import { syncOrganizationProfileFromApprovedVersion } from './organizationVersionService.js'
import { checkApprovedVersionInvariants } from './approvalStateMachine.js'
import { isPrismaIdentity } from '../utils/databaseMode.js'
import prisma from '../config/prisma.js'
import * as orgRepo from '../repositories/organizations/prismaOrganizationRepository.js'

/**
 * Prisma repair for incomplete / inconsistent approval promotion state.
 * Mirrors Mongo reconcileOrganizationApprovalState semantics.
 */
export async function reconcileOrganizationApprovalStatePrisma(organizationId) {
  const repairs = []
  let organization = await orgRepo.findOrganizationById(organizationId)
  if (!organization) return { repairs, organization: null }

  const processing = await prisma.approvalRequest.findMany({
    where: { organizationId: String(organizationId), status: 'processing' },
  })

  for (const request of processing) {
    const version = await prisma.providerVersion.findUnique({
      where: { id: request.providerVersionId },
    })

    if (version?.status === 'approved') {
      if (String(organization.approvedVersionId) !== String(version.id)) {
        await orgRepo.applyApprovalTransaction({
          organizationId,
          versionId: version.id,
          approvalRequestId: request.id,
          previousApprovedId: organization.approvedVersionId,
          snapshot: version.snapshot || {},
        })
        repairs.push(`synced org to approved version ${version.id}`)
        organization = await orgRepo.findOrganizationById(organizationId)
      } else {
        await prisma.approvalRequest.update({
          where: { id: request.id },
          data: { status: 'approved' },
        })
        repairs.push(`finalized processing request ${request.id} → approved`)
      }
    } else if (version?.status === 'rejected') {
      await prisma.approvalRequest.update({
        where: { id: request.id },
        data: { status: 'rejected' },
      })
      repairs.push(`finalized processing request ${request.id} → rejected`)
    } else if (version?.status === 'submitted') {
      await prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: 'pending',
          reviewedById: null,
          reviewedAt: null,
        },
      })
      repairs.push(`rolled back stuck processing request ${request.id} → pending`)
    }
  }

  const approvedRequests = await prisma.approvalRequest.findMany({
    where: { organizationId: String(organizationId), status: 'approved' },
    orderBy: { reviewedAt: 'desc' },
  })

  for (const request of approvedRequests) {
    const version = await prisma.providerVersion.findUnique({
      where: { id: request.providerVersionId },
    })
    if (!version || version.status !== 'approved') continue

    if (String(organization.approvedVersionId) !== String(version.id)) {
      const previousApprovedId = organization.approvedVersionId
      await orgRepo.applyApprovalTransaction({
        organizationId,
        versionId: version.id,
        approvalRequestId: request.id,
        previousApprovedId,
        snapshot: version.snapshot || {},
      })
      repairs.push(`promoted org to version ${version.id}`)
      organization = await orgRepo.findOrganizationById(organizationId)
    }
  }

  if (organization.approvedVersionId) {
    const pointed = await prisma.providerVersion.findUnique({
      where: { id: String(organization.approvedVersionId) },
    })
    if (pointed?.status === 'superseded') {
      const latestApproved = await prisma.providerVersion.findFirst({
        where: {
          organizationId: String(organizationId),
          status: 'approved',
        },
        orderBy: { versionNumber: 'desc' },
      })
      if (latestApproved) {
        const snap = latestApproved.snapshot || {}
        await orgRepo.updateOrganizationFields(organizationId, {
          name: snap.name,
          legalName: snap.legalName ?? null,
          providerTypes: snap.providerTypes,
          logo: snap.logo ?? null,
          coverImage: snap.coverImage ?? null,
          gallery: snap.gallery ?? [],
          portfolioPhotos: snap.portfolioPhotos ?? [],
          description: snap.description ?? '',
          shortDescription: snap.shortDescription ?? '',
          uniqueSellingPoints: snap.uniqueSellingPoints ?? [],
          services: snap.services ?? [],
          yearsInBusiness: snap.yearsInBusiness ?? null,
          location: snap.location ?? undefined,
          contact: snap.contact ?? undefined,
          approvedVersionId: latestApproved.id,
          latestVersionId: latestApproved.id,
          approvalStatus: 'approved',
          visibility: 'public',
        })
        repairs.push(`repointed org from superseded to ${latestApproved.id}`)
        organization = await orgRepo.findOrganizationById(organizationId)
      }
    }
  }

  const pendingWithApprovedVersion = await prisma.approvalRequest.findMany({
    where: { organizationId: String(organizationId), status: 'pending' },
  })
  for (const request of pendingWithApprovedVersion) {
    const version = await prisma.providerVersion.findUnique({
      where: { id: request.providerVersionId },
    })
    if (version?.status === 'approved') {
      await prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: 'approved',
          reviewedAt: version.approvedAt || new Date(),
        },
      })
      repairs.push(`aligned pending request ${request.id} with approved version`)
    }
  }

  organization = await orgRepo.findOrganizationById(organizationId)
  return { repairs, organization }
}

export async function tryGetIdempotentApproveResultPrisma(approvalRequestId) {
  const approvalRequest = await orgRepo.findApprovalRequestById(approvalRequestId)
  if (!approvalRequest || approvalRequest.status !== 'approved') return null

  const version = await orgRepo.findProviderVersionById(
    approvalRequest.providerVersionId
  )
  const organization = await orgRepo.findOrganizationById(
    approvalRequest.organizationId
  )

  if (
    version?.status === 'approved' &&
    String(organization?.approvedVersionId) === String(version._id)
  ) {
    return { approvalRequest, version, organization, idempotent: true }
  }

  return null
}

export async function verifyOrganizationInvariantsPrisma(organizationId) {
  const organization = await orgRepo.findOrganizationById(organizationId)
  if (!organization) return { ok: false, violations: ['organization not found'] }

  const approvedVersion = organization.approvedVersionId
    ? await orgRepo.findProviderVersionById(organization.approvedVersionId)
    : null

  const violations = checkApprovedVersionInvariants(organization, approvedVersion)
  return { ok: violations.length === 0, violations, organization, approvedVersion }
}

/**
 * Repair incomplete or inconsistent approval promotion state.
 * Safe to call repeatedly (idempotent).
 */
export async function reconcileOrganizationApprovalState(organizationId) {
  if (isPrismaIdentity()) {
    return reconcileOrganizationApprovalStatePrisma(organizationId)
  }

  const repairs = []
  let organization = await Organization.findById(organizationId)
  if (!organization) return { repairs, organization: null }

  // 1. Stuck "processing" requests — crash during approve/reject
  const processing = await ApprovalRequest.find({
    organizationId,
    status: 'processing',
  })

  for (const request of processing) {
    const version = await ProviderVersion.findById(request.providerVersionId)

    if (version?.status === 'approved') {
      if (organization.approvedVersionId?.toString() !== version._id.toString()) {
        organization = await syncOrganizationProfileFromApprovedVersion(
          organization,
          version
        )
        repairs.push(`synced org to approved version ${version._id}`)
      }
      await ApprovalRequest.findByIdAndUpdate(request._id, { status: 'approved' })
      repairs.push(`finalized processing request ${request._id} → approved`)
    } else if (version?.status === 'rejected') {
      await ApprovalRequest.findByIdAndUpdate(request._id, {
        status: 'rejected',
      })
      repairs.push(`finalized processing request ${request._id} → rejected`)
    } else if (version?.status === 'submitted') {
      await ApprovalRequest.findByIdAndUpdate(request._id, {
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
      })
      repairs.push(`rolled back stuck processing request ${request._id} → pending`)
    }
  }

  // 2. Request approved but org not promoted — complete promotion
  const approvedRequests = await ApprovalRequest.find({
    organizationId,
    status: 'approved',
  }).sort({ reviewedAt: -1 })

  for (const request of approvedRequests) {
    const version = await ProviderVersion.findById(request.providerVersionId)
    if (!version || version.status !== 'approved') continue

    if (organization.approvedVersionId?.toString() !== version._id.toString()) {
      const previousApprovedId = organization.approvedVersionId
      organization = await syncOrganizationProfileFromApprovedVersion(
        organization,
        version
      )
      repairs.push(`promoted org to version ${version._id}`)

      if (
        previousApprovedId &&
        previousApprovedId.toString() !== version._id.toString()
      ) {
        await ProviderVersion.findOneAndUpdate(
          { _id: previousApprovedId, status: 'approved' },
          { status: 'superseded' }
        )
        repairs.push(`superseded previous version ${previousApprovedId}`)
      }
    }
  }

  // 3. Org points to superseded version — restore latest approved
  if (organization.approvedVersionId) {
    const pointed = await ProviderVersion.findById(organization.approvedVersionId)
    if (pointed?.status === 'superseded') {
      const latestApproved = await ProviderVersion.findOne({
        organizationId,
        status: 'approved',
      }).sort({ versionNumber: -1 })

      if (latestApproved) {
        organization = await syncOrganizationProfileFromApprovedVersion(
          organization,
          latestApproved
        )
        repairs.push(`repointed org from superseded to ${latestApproved._id}`)
      }
    }
  }

  // 4. Version approved with matching approved request but request still pending
  const pendingWithApprovedVersion = await ApprovalRequest.find({
    organizationId,
    status: 'pending',
  })
  for (const request of pendingWithApprovedVersion) {
    const version = await ProviderVersion.findById(request.providerVersionId)
    if (version?.status === 'approved') {
      await ApprovalRequest.findByIdAndUpdate(request._id, {
        status: 'approved',
        reviewedAt: version.approvedAt || new Date(),
      })
      repairs.push(`aligned pending request ${request._id} with approved version`)
    }
  }

  organization = await Organization.findById(organizationId)
  return { repairs, organization }
}

/**
 * Build idempotent approve result if promotion already completed.
 */
export async function tryGetIdempotentApproveResult(approvalRequestId) {
  if (isPrismaIdentity()) {
    return tryGetIdempotentApproveResultPrisma(approvalRequestId)
  }

  const approvalRequest = await ApprovalRequest.findById(approvalRequestId)
  if (!approvalRequest || approvalRequest.status !== 'approved') return null

  const version = await ProviderVersion.findById(approvalRequest.providerVersionId)
  const organization = await Organization.findById(approvalRequest.organizationId)

  if (
    version?.status === 'approved' &&
    organization?.approvedVersionId?.toString() === version._id.toString()
  ) {
    return { approvalRequest, version, organization, idempotent: true }
  }

  return null
}

export async function verifyOrganizationInvariants(organizationId) {
  if (isPrismaIdentity()) {
    return verifyOrganizationInvariantsPrisma(organizationId)
  }

  const organization = await Organization.findById(organizationId)
  if (!organization) return { ok: false, violations: ['organization not found'] }

  const approvedVersion = organization.approvedVersionId
    ? await ProviderVersion.findById(organization.approvedVersionId)
    : null

  const violations = checkApprovedVersionInvariants(organization, approvedVersion)
  return { ok: violations.length === 0, violations, organization, approvedVersion }
}

export default {
  reconcileOrganizationApprovalState,
  tryGetIdempotentApproveResult,
  verifyOrganizationInvariants,
}
