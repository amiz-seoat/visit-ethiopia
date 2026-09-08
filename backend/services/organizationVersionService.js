import mongoose from 'mongoose'
import Organization from '../models/Organization.js'
import ProviderVersion from '../models/ProviderVersion.js'
import AppError from '../utils/appError.js'
import { slugify, ensureUniqueSlug } from '../utils/slugify.js'
import { analyzeVersionChanges } from '../utils/versionDiff.js'
import {
  buildPublicProfileSnapshot,
  serializePublicOrganization,
} from './publicOrganizationService.js'

export async function syncOrganizationProfileFromApprovedVersion(
  organization,
  approvedVersion,
  session = null
) {
  const snapshot = approvedVersion.snapshot
  let slug = organization.slug

  if (snapshot.proposedSlug && slugify(snapshot.proposedSlug) !== organization.slug) {
    slug = await ensureUniqueSlug(
      Organization,
      slugify(snapshot.proposedSlug),
      organization._id
    )
  }

  const update = {
    name: snapshot.name,
    legalName: snapshot.legalName,
    providerTypes: snapshot.providerTypes,
    logo: snapshot.logo,
    coverImage: snapshot.coverImage,
    gallery: snapshot.gallery,
    portfolioPhotos: snapshot.portfolioPhotos,
    description: snapshot.description,
    shortDescription: snapshot.shortDescription,
    uniqueSellingPoints: snapshot.uniqueSellingPoints,
    services: snapshot.services,
    yearsInBusiness: snapshot.yearsInBusiness,
    location: snapshot.location,
    contact: snapshot.contact,
    slug,
    approvedVersionId: approvedVersion._id,
    latestVersionId: approvedVersion._id,
    approvalStatus: 'approved',
    visibility: 'public',
  }

  if (slug !== organization.slug) {
    update.previousSlugs = [
      ...(organization.previousSlugs || []),
      { slug: organization.slug, changedAt: new Date() },
    ]
  }

  return Organization.findByIdAndUpdate(organization._id, update, {
    session,
    new: true,
  })
}

const EDITABLE_SNAPSHOT_FIELDS = [
  'name',
  'legalName',
  'providerTypes',
  'logo',
  'coverImage',
  'gallery',
  'portfolioPhotos',
  'description',
  'shortDescription',
  'uniqueSellingPoints',
  'services',
  'yearsInBusiness',
  'location',
  'contact',
  'proposedSlug',
]

export async function getApprovedVersion(organization) {
  if (!organization?.approvedVersionId) return null
  const version = await ProviderVersion.findById(organization.approvedVersionId)
  if (!version || version.status !== 'approved') return null
  if (version.organizationId?.toString() !== organization._id?.toString()) {
    return null
  }
  return version
}

export async function getLatestVersion(organization) {
  if (!organization?.latestVersionId) return null
  return ProviderVersion.findById(organization.latestVersionId)
}

export async function createInitialDraftVersion(organization, verification = {}) {
  const version = await ProviderVersion.create({
    organizationId: organization._id,
    versionNumber: 1,
    status: 'draft',
    snapshot: buildPublicProfileSnapshot(organization),
    verificationSnapshot: verification,
  })

  organization.latestVersionId = version._id
  await organization.save({ validateBeforeSave: false })

  return version
}

export async function getOrCreateEditableDraft(organization) {
  const latest = await getLatestVersion(organization)

  if (!organization.approvedVersionId) {
    if (latest?.status === 'draft') return latest
    if (latest?.status === 'rejected') {
      const nextVersionNumber = (latest.versionNumber || 0) + 1
      const draft = await ProviderVersion.create({
        organizationId: organization._id,
        versionNumber: nextVersionNumber,
        status: 'draft',
        snapshot: buildPublicProfileSnapshot(organization),
        verificationSnapshot: JSON.parse(
          JSON.stringify(organization.verification || {})
        ),
      })
      organization.latestVersionId = draft._id
      await organization.save({ validateBeforeSave: false })
      return draft
    }
    if (latest?.status === 'submitted') {
      throw new AppError(
        'A version is already pending review. Wait for admin decision before editing.',
        400
      )
    }
    return createInitialDraftVersion(organization, organization.verification)
  }

  if (latest?.status === 'draft') {
    return latest
  }

  if (latest && latest.status === 'submitted') {
    throw new AppError(
      'A version is already submitted for approval. You cannot edit until it is reviewed.',
      400
    )
  }

  const approved = await getApprovedVersion(organization)
  const nextVersionNumber = (latest?.versionNumber || approved?.versionNumber || 0) + 1

  const draft = await ProviderVersion.create({
    organizationId: organization._id,
    versionNumber: nextVersionNumber,
    status: 'draft',
    snapshot: approved
      ? JSON.parse(JSON.stringify(approved.snapshot))
      : buildPublicProfileSnapshot(organization),
    verificationSnapshot: JSON.parse(
      JSON.stringify(organization.verification || {})
    ),
  })

  organization.latestVersionId = draft._id
  await organization.save({ validateBeforeSave: false })

  return draft
}

export async function updateEditableDraft(organization, updates, verificationUpdates) {
  const draft = await getOrCreateEditableDraft(organization)

  if (draft.status !== 'draft') {
    throw new AppError('Only draft versions can be edited', 400)
  }

  const nextSnapshot = { ...draft.snapshot }
  for (const key of EDITABLE_SNAPSHOT_FIELDS) {
    if (updates[key] !== undefined) {
      nextSnapshot[key] = updates[key]
    }
  }

  if (updates.slug !== undefined) {
    nextSnapshot.proposedSlug = slugify(updates.slug)
  }

  draft.snapshot = nextSnapshot

  if (verificationUpdates) {
    draft.verificationSnapshot = {
      ...(draft.verificationSnapshot || {}),
      ...verificationUpdates,
    }
    organization.verification = {
      ...(organization.verification || {}),
      ...verificationUpdates,
    }
    organization.markModified('verification')
    await organization.save()
  }

  const approved = await getApprovedVersion(organization)
  const analysis = analyzeVersionChanges({
    approvedSnapshot: approved?.snapshot,
    submittedSnapshot: draft.snapshot,
  })

  draft.changedFields = analysis.changedFields
  draft.requiresReapproval = analysis.requiresReapproval
  draft.reapprovalFields = analysis.reapprovalFields

  await draft.save()

  return draft
}

export async function freezeVersionForSubmission(version) {
  version.frozenAt = new Date()
  version.snapshot = JSON.parse(JSON.stringify(version.snapshot))
  version.verificationSnapshot = JSON.parse(
    JSON.stringify(version.verificationSnapshot || {})
  )
  await version.save()
  return version
}

export async function listOrganizationVersions(organizationId, { includePrivate = false } = {}) {
  const query = { organizationId }
  if (!includePrivate) {
    query.status = { $in: ['approved', 'superseded'] }
  }
  return ProviderVersion.find(query).sort({ versionNumber: -1 })
}

export async function loadPublicOrganizations(query = {}) {
  const orgs = await Organization.find({
    ...Organization.publicMarketplaceFilter(),
    ...query,
  })

  const results = []
  for (const org of orgs) {
    const approvedVersion = await getApprovedVersion(org)
    if (!approvedVersion) continue
    results.push(serializePublicOrganization(org, approvedVersion))
  }
  return results
}

export async function loadPublicOrganizationBySlug(slug) {
  let organization = await Organization.findOne({
    slug: slug.toLowerCase(),
    ...Organization.publicMarketplaceFilter(),
  })

  if (!organization) {
    organization = await Organization.findOne({
      'previousSlugs.slug': slug.toLowerCase(),
      ...Organization.publicMarketplaceFilter(),
    })
  }

  if (!organization) return null

  const approvedVersion = await getApprovedVersion(organization)
  if (!approvedVersion) return null

  return {
    organization: serializePublicOrganization(organization, approvedVersion),
    canonicalSlug: organization.slug,
    requestedSlug: slug.toLowerCase(),
    redirected: organization.slug !== slug.toLowerCase(),
  }
}

export async function applyApprovedSlug(organization, proposedSlug) {
  if (!proposedSlug || slugify(proposedSlug) === organization.slug) return organization
  return syncOrganizationProfileFromApprovedVersion(organization, {
    snapshot: { ...organization.toObject(), proposedSlug },
  })
}

export default {
  getApprovedVersion,
  getLatestVersion,
  createInitialDraftVersion,
  getOrCreateEditableDraft,
  updateEditableDraft,
  freezeVersionForSubmission,
  listOrganizationVersions,
  loadPublicOrganizations,
  loadPublicOrganizationBySlug,
}
