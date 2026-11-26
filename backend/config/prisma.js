import { PrismaClient } from '@prisma/client'

/**
 * Shared PrismaClient for PostgreSQL (Phase 1+).
 *
 * - Express default path still uses Mongoose + MongoDB (`DATABASE`).
 * - Opt-in: CATALOG_DB=prisma (Phase 2 reads) and/or DATABASE_MODE=prisma (Phase 3 identity).
 * - `DATABASE_URL` / `DIRECT_URL` are PostgreSQL only — never Mongo URIs.
 */

const globalForPrisma = globalThis

const prisma =
  globalForPrisma.__visitEthiopiaPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__visitEthiopiaPrisma = prisma
}

export default prisma
