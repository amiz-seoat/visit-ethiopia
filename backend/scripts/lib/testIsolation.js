/**
 * Clear cross-suite test pollution while preserving seed data.
 * Used between sequential test suites on a shared memory DB.
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') })

export function resolveMemoryDatabaseUri() {
  const memoryUriFile = path.join(__dirname, '..', '..', '.memory-db-uri')
  if (fs.existsSync(memoryUriFile)) {
    return fs.readFileSync(memoryUriFile, 'utf8').trim()
  }
  return process.env.DATABASE
}

export async function connectTestDatabase(uri = resolveMemoryDatabaseUri()) {
  if (!uri) throw new Error('No test database URI available')
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri)
  }
  return mongoose.connection
}

/**
 * Remove organizations, versions, org tours, preferences — keep seed users/legacy content.
 */
export async function resetSuitePollution() {
  const conn = await connectTestDatabase()
  const db = conn.db

  await db.collection('userorganizationpreferences').deleteMany({})
  await db.collection('approvalrequests').deleteMany({})
  await db.collection('providerversions').deleteMany({})
  await db.collection('organizationmembers').deleteMany({})
  await db.collection('organizations').deleteMany({})
  await db.collection('tourdepartures').deleteMany({})
  await db.collection('tours').deleteMany({ organizationId: { $ne: null } })

  return true
}

export default { resetSuitePollution, connectTestDatabase, resolveMemoryDatabaseUri }
