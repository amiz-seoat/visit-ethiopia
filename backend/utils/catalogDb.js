/**
 * Catalog read backend selector (Phase 2 / Phase 5).
 * Default: mongoose (MongoDB) — production-safe.
 * Set CATALOG_DB=prisma for local PostgreSQL catalog READ experiments.
 *
 * When DATABASE_MODE=prisma, catalog reads use Prisma unless CATALOG_DB is
 * explicitly set to mongoose/mongo/mongodb.
 */
import { getDatabaseMode } from './databaseMode.js'

export function getCatalogDb() {
  const raw = String(process.env.CATALOG_DB || '')
    .trim()
    .toLowerCase()

  if (raw === 'mongoose' || raw === 'mongo' || raw === 'mongodb') {
    return 'mongoose'
  }
  if (raw === 'prisma' || raw === 'postgres' || raw === 'postgresql') {
    return 'prisma'
  }
  if (getDatabaseMode() === 'prisma') {
    return 'prisma'
  }
  return 'mongoose'
}

export function isPrismaCatalog() {
  return getCatalogDb() === 'prisma'
}

export default { getCatalogDb, isPrismaCatalog }
