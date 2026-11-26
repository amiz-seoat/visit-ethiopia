/**
 * Identity DB selector (Phase 3): users, auth, organizations, approvals.
 * Independent of Phase 2 CATALOG_DB.
 *
 * DATABASE_MODE=mongo   (default) — Mongoose
 * DATABASE_MODE=prisma  — PostgreSQL via Prisma (local opt-in only)
 */
export function getDatabaseMode() {
  const raw = String(process.env.DATABASE_MODE || 'mongo')
    .trim()
    .toLowerCase()
  if (raw === 'prisma' || raw === 'postgres' || raw === 'postgresql') {
    return 'prisma'
  }
  return 'mongo'
}

export function isPrismaIdentity() {
  return getDatabaseMode() === 'prisma'
}

/** App-wide Prisma mode (same switch as identity/booking). */
export function isPrismaApp() {
  return isPrismaIdentity()
}

export function isMongoIdentity() {
  return getDatabaseMode() === 'mongo'
}

export default {
  getDatabaseMode,
  isPrismaIdentity,
  isPrismaApp,
  isMongoIdentity,
}
