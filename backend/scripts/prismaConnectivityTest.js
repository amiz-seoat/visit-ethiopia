/**
 * Harmless PostgreSQL connectivity check (Phase 1).
 *
 * Usage (from repo root or backend, with env loaded):
 *   node backend/scripts/prismaConnectivityTest.js
 *
 * Requires DATABASE_URL (+ DIRECT_URL for schema compatibility).
 * Does NOT use MongoDB `DATABASE`.
 * Does NOT mutate application tables — only SELECT 1.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../config/prisma.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env') })
}

function maskDatabaseUrl(url) {
  if (!url) return '[missing]'
  return String(url).replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@')
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      '[prismaConnectivityTest] FAILED: DATABASE_URL is not set.\n' +
        'Set a PostgreSQL URL (local Docker or Supabase). Do not use MongoDB DATABASE.'
    )
    process.exit(1)
  }

  if (/^mongodb(\+srv)?:\/\//i.test(url)) {
    console.error(
      '[prismaConnectivityTest] FAILED: DATABASE_URL looks like MongoDB.\n' +
        'Use a postgresql:// URL. Keep Mongo in DATABASE.'
    )
    process.exit(1)
  }

  console.log('[prismaConnectivityTest] target=', maskDatabaseUrl(url))

  try {
    const rows = await prisma.$queryRaw`SELECT 1::int AS ok`
    const ok = Array.isArray(rows) && rows[0] && Number(rows[0].ok) === 1
    if (!ok) {
      throw new Error(`Unexpected result: ${JSON.stringify(rows)}`)
    }
    console.log('[prismaConnectivityTest] SUCCESS: PostgreSQL responded to SELECT 1')
  } catch (err) {
    console.error(
      '[prismaConnectivityTest] FAILED:',
      err?.message || err
    )
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
