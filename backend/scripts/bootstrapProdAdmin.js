/**
 * Production-safe admin bootstrap.
 *
 * Usage:
 *   DATABASE=... PROD_ADMIN_EMAIL=... PROD_ADMIN_PASSWORD=... node scripts/bootstrapProdAdmin.js
 *   node scripts/bootstrapProdAdmin.js --dry-run
 *
 * Never prints passwords or full DATABASE credentials.
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes('--dry-run')

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env') })
}

function maskDatabaseUri(uri) {
  if (!uri) return '[missing]'
  return String(uri).replace(/(mongodb(?:\+srv)?:\/\/)([^@/]+)@/i, '$1***@')
}

function assertNotMemoryUri(uri) {
  const memoryUriFile = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(memoryUriFile)) {
    const memoryUri = fs.readFileSync(memoryUriFile, 'utf8').trim()
    if (memoryUri && uri === memoryUri) {
      throw new Error(
        'Refusing to run against MongoMemoryServer URI from .memory-db-uri'
      )
    }
  }
  if (/memory|mongo-mem/i.test(uri)) {
    throw new Error('Refusing to run against a memory-style MongoDB URI')
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return String(value).trim()
}

async function main() {
  const uri = process.env.DATABASE || process.env.MONGO_URI
  if (process.env.NODE_ENV === 'production' && !uri) {
    throw new Error('NODE_ENV=production requires DATABASE (or MONGO_URI)')
  }
  if (!uri) {
    throw new Error('DATABASE (or MONGO_URI) is required')
  }
  assertNotMemoryUri(uri)

  const email = requireEnv('PROD_ADMIN_EMAIL').toLowerCase()
  const password = process.env.PROD_ADMIN_PASSWORD
  if (!password || String(password).length < 8) {
    throw new Error(
      'PROD_ADMIN_PASSWORD is required and must be at least 8 characters'
    )
  }

  const firstName = (process.env.PROD_ADMIN_FIRST_NAME || 'Production').trim()
  const lastName = (process.env.PROD_ADMIN_LAST_NAME || 'Admin').trim()

  console.log(`[bootstrapProdAdmin] dryRun=${dryRun}`)
  console.log(`[bootstrapProdAdmin] target=${maskDatabaseUri(uri)}`)
  console.log(`[bootstrapProdAdmin] email=${email}`)

  if (dryRun) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
    const User = (await import('../models/User.js')).default
    const existing = await User.findOne({ email }).select('+password')
    if (!existing) {
      console.log(
        `[dry-run] Would CREATE verified admin user for ${email} (password not logged)`
      )
    } else {
      console.log(
        `[dry-run] User exists id=${existing._id} role=${existing.role} isVerified=${existing.isVerified}`
      )
      if (existing.role !== 'admin' || !existing.isVerified) {
        console.log(
          '[dry-run] Would UPDATE role→admin and/or isVerified→true (password unchanged)'
        )
      } else {
        console.log('[dry-run] No changes needed')
      }
    }
    await mongoose.disconnect()
    return
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  const User = (await import('../models/User.js')).default

  const existing = await User.findOne({ email })
  if (!existing) {
    const created = await User.create({
      FirstName: firstName,
      LastName: lastName,
      email,
      password,
      passwordConfirm: password,
      role: 'admin',
      isVerified: true,
    })
    console.log(
      `[bootstrapProdAdmin] CREATED admin id=${created._id} email=${created.email} verified=true`
    )
  } else {
    let changed = false
    if (existing.role !== 'admin') {
      existing.role = 'admin'
      changed = true
    }
    if (!existing.isVerified) {
      existing.isVerified = true
      changed = true
    }
    if (changed) {
      await existing.save({ validateBeforeSave: false })
      console.log(
        `[bootstrapProdAdmin] UPDATED existing user id=${existing._id} → role=admin isVerified=true (password unchanged)`
      )
    } else {
      console.log(
        `[bootstrapProdAdmin] OK existing admin id=${existing._id} (no changes; password unchanged)`
      )
    }
  }

  await mongoose.disconnect()
  console.log('[bootstrapProdAdmin] done')
}

main().catch(async (err) => {
  console.error('[bootstrapProdAdmin] FAILED:', err.message || err)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
