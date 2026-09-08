/**
 * Backfill ProviderVersion records for organizations created before Phase 2.
 *
 * Usage:
 *   node scripts/migrateOrganizationVersions.js [--dry-run] [--approve-legacy]
 *
 * --dry-run         Report actions without writing
 * --approve-legacy  For orgs already approved/public, create an approved v1 snapshot
 *                   (default: draft v1 only — safe for production)
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: './config.env' })

const dryRun = process.argv.includes('--dry-run')
const approveLegacy = process.argv.includes('--approve-legacy')

async function connect() {
  const uri = process.env.DATABASE
  if (!uri) throw new Error('DATABASE not set in config.env')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
}

async function run() {
  await connect()

  const Organization = (await import('../models/Organization.js')).default
  const ProviderVersion = (await import('../models/ProviderVersion.js')).default
  const { buildPublicProfileSnapshot } = await import(
    '../services/publicOrganizationService.js'
  )

  const orgs = await Organization.find({})
  let created = 0
  let skipped = 0
  let approved = 0

  for (const org of orgs) {
    const existingVersions = await ProviderVersion.countDocuments({
      organizationId: org._id,
    })

    if (existingVersions > 0) {
      skipped++
      continue
    }

    const snapshot = buildPublicProfileSnapshot(org)
    const verificationSnapshot = JSON.parse(
      JSON.stringify(org.verification || {})
    )

    const shouldApprove =
      approveLegacy &&
      org.approvalStatus === 'approved' &&
      org.visibility === 'public'

    const versionPayload = {
      organizationId: org._id,
      versionNumber: 1,
      status: shouldApprove ? 'approved' : 'draft',
      snapshot,
      verificationSnapshot,
      ...(shouldApprove
        ? { approvedAt: org.updatedAt || new Date() }
        : {}),
    }

    if (dryRun) {
      console.log(
        `[dry-run] Would create v1 (${versionPayload.status}) for org ${org._id} (${org.name})`
      )
      created++
      if (shouldApprove) approved++
      continue
    }

    const version = await ProviderVersion.create(versionPayload)

    const orgUpdate = {
      latestVersionId: version._id,
    }
    if (shouldApprove) {
      orgUpdate.approvedVersionId = version._id
      approved++
    }

    await Organization.findByIdAndUpdate(org._id, orgUpdate)
    created++
    console.log(`Created v1 (${version.status}) for org ${org._id}`)
  }

  console.log(
    `\nDone. created=${created} skipped=${skipped} approvedLegacy=${approved} dryRun=${dryRun}`
  )
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
