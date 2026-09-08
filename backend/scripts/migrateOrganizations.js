/**
 * Backfill Organization + OrganizationMember + organizationId on provider resources.
 *
 * Usage:
 *   node scripts/migrateOrganizations.js [--dry-run] [--approve-migrated]
 *
 * --dry-run           Report actions without writing
 * --approve-migrated  Set approvalStatus=approved visibility=public on migrated orgs
 *                     (default: draft/private — safe for production)
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: './config.env' })

const dryRun = process.argv.includes('--dry-run')
const approveMigrated = process.argv.includes('--approve-migrated')

const PROVIDER_TYPE_BY_MODEL = {
  Tour: 'travel_company',
  Hotel: 'hotel',
  Transport: 'bus_company',
}

async function connect() {
  const uri = process.env.DATABASE
  if (!uri) throw new Error('DATABASE not set in config.env')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
}

async function findOrCreateOrg(userId, providerType, Organization, OrganizationMember, slugify, ensureUniqueSlug, permissionsForProviderTypes, membershipRolesForProviderTypes) {
  const existingOrg = await Organization.findOne({
    ownerUserId: userId,
    providerTypes: providerType,
  })
  if (existingOrg) return { org: existingOrg, created: false }

  const orgName = `Migrated ${providerType.replace('_', ' ')} — ${userId.toString().slice(-6)}`
  const baseSlug = slugify(orgName)
  const slug = await ensureUniqueSlug(Organization, baseSlug)

  const orgPayload = {
    slug,
    name: orgName,
    providerTypes: [providerType],
    ownerUserId: userId,
    legacyCreatedByUserId: userId,
    visibility: approveMigrated ? 'public' : 'private',
    approvalStatus: approveMigrated ? 'approved' : 'draft',
    description: 'Auto-migrated organization stub',
    shortDescription: 'Migrated',
  }

  if (dryRun) {
    console.log(`[dry-run] Would create org for user ${userId} type ${providerType}`)
    return { org: null, created: false }
  }

  const organization = await Organization.create(orgPayload)
  await OrganizationMember.create({
    organizationId: organization._id,
    userId,
    orgRole: 'owner',
    permissions: permissionsForProviderTypes([providerType]),
    membershipRoles: membershipRolesForProviderTypes([providerType]),
    status: 'active',
  })

  return { org: organization, created: true }
}

async function run() {
  await connect()

  const Organization = (await import('../models/Organization.js')).default
  const OrganizationMember = (await import('../models/OrganizationMember.js')).default
  const Tour = (await import('../models/Tour.js')).default
  const Hotel = (await import('../models/Hotel.js')).default
  const Transport = (await import('../models/Transport.js')).default
  const { slugify, ensureUniqueSlug } = await import('../utils/slugify.js')
  const {
    permissionsForProviderTypes,
    membershipRolesForProviderTypes,
  } = await import('../utils/organizationPermissions.js')

  const stats = {
    orgsCreated: 0,
    toursLinked: 0,
    hotelsLinked: 0,
    transportsLinked: 0,
    skipped: 0,
  }

  const orgCache = new Map()

  async function linkModel(Model, modelName) {
    const providerType = PROVIDER_TYPE_BY_MODEL[modelName]
    const docs = await Model.find({
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
    })
      .setOptions({ skipGuidePopulate: true })
      .select('_id createdBy organizationId')

    for (const doc of docs) {
      if (!doc.createdBy) {
        stats.skipped += 1
        continue
      }

      const cacheKey = `${doc.createdBy}:${providerType}`
      let orgId = orgCache.get(cacheKey)

      if (!orgId) {
        const { org, created } = await findOrCreateOrg(
          doc.createdBy,
          providerType,
          Organization,
          OrganizationMember,
          slugify,
          ensureUniqueSlug,
          permissionsForProviderTypes,
          membershipRolesForProviderTypes
        )
        if (org) {
          orgId = org._id
          orgCache.set(cacheKey, orgId)
          if (created) stats.orgsCreated += 1
        } else if (dryRun) {
          stats.skipped += 1
          continue
        }
      }

      if (!orgId) {
        stats.skipped += 1
        continue
      }

      if (dryRun) {
        console.log(`[dry-run] Would link ${modelName} ${doc._id} → org ${orgId}`)
      } else if (!doc.organizationId) {
        await Model.updateOne({ _id: doc._id }, { organizationId: orgId })
      }

      if (modelName === 'Tour') stats.toursLinked += 1
      if (modelName === 'Hotel') stats.hotelsLinked += 1
      if (modelName === 'Transport') stats.transportsLinked += 1
    }
  }

  await linkModel(Tour, 'Tour')
  await linkModel(Hotel, 'Hotel')
  await linkModel(Transport, 'Transport')

  console.log('\nMigration summary:', stats)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLIED'}`)
  console.log(`Approve migrated orgs: ${approveMigrated}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
