/**
 * Start Visit Ethiopia API against local PostgreSQL only (no Mongo).
 *
 * Sets:
 *   DATABASE_MODE=prisma
 *   CATALOG_DB=prisma
 *   SKIP_MONGO=true
 *
 * Usage: npm run dev:prisma
 * Requires: docker-compose.prisma.yml up, DATABASE_URL in config.env
 */
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, '..', 'config.env')

if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath })
}

// Local Prisma entrypoint: always development, never inherit production from config.env
process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'
process.env.CATALOG_DB = 'prisma'
process.env.SKIP_MONGO = 'true'
// Prefer VISIT_ETHIOPIA_PORT; default 4002 to match frontend/.env Prisma workflow
process.env.PORT = process.env.VISIT_ETHIOPIA_PORT || '4002'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'visit-ethiopia-dev-secret'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '90d'
process.env.JWT_COOKIE_EXPIRES_IN = process.env.JWT_COOKIE_EXPIRES_IN || '90'
process.env.BACKEND_URL = `http://localhost:${process.env.PORT}`
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5200'

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required for Prisma-only mode. Set it in backend/config.env'
  )
  process.exit(1)
}

console.log('Starting Prisma-only API (SKIP_MONGO=true, DATABASE_MODE=prisma)')

const { default: app } = await import('../app.js')
const { default: prisma } = await import('../config/prisma.js')

try {
  await prisma.$queryRaw`SELECT 1`
  console.log('PostgreSQL (Prisma) connectivity OK')
} catch (err) {
  console.error('Prisma connectivity failed:', err.message || err)
  process.exit(1)
}

const PORT = Number(process.env.PORT) || 4002
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Visit Ethiopia API (Prisma-only) on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
