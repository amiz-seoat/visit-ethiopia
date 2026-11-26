import dotenv from 'dotenv'
import fs from 'fs'

// Load local config before anything reads process.env (production uses host env).
if (process.env.NODE_ENV !== 'production' && fs.existsSync('./config.env')) {
  dotenv.config({ path: './config.env', quiet: true })
}

const { default: app } = await import('./app.js')
const { default: connectDB } = await import('./config/db.js')
const { isPrismaIdentity } = await import('./utils/databaseMode.js')
const { default: prisma } = await import('./config/prisma.js')
const { getPublicPaymentConfig } = await import('./config/payments.js')

const isProduction = process.env.NODE_ENV === 'production'

/** Fail fast on missing/unsafe production configuration (never log values). */
function validateEnvironment() {
  const problems = []
  const jwt = process.env.JWT_SECRET || ''
  if (!jwt) problems.push('JWT_SECRET is required')
  else if (isProduction && jwt.length < 32) problems.push('JWT_SECRET must be at least 32 characters in production')

  if (isPrismaIdentity()) {
    if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is required when DATABASE_MODE=prisma')
    if (!process.env.DIRECT_URL) problems.push('DIRECT_URL is required when DATABASE_MODE=prisma')
  } else if (!process.env.DATABASE && !process.env.MONGO_URI) {
    problems.push('DATABASE (MongoDB URI) is required when DATABASE_MODE=mongo')
  }

  if (isProduction && !process.env.FRONTEND_URL) {
    problems.push('FRONTEND_URL is required in production (CORS + payment return URL)')
  }

  if (problems.length) {
    for (const p of problems) console.error(`[config] ${p}`)
    if (isProduction) process.exit(1)
  }

  const pay = getPublicPaymentConfig()
  console.log(
    `[config] NODE_ENV=${process.env.NODE_ENV || 'unset'} DATABASE_MODE=${process.env.DATABASE_MODE || 'mongo'} ` +
      `payments=${pay.provider}${pay.testMode ? ' (test)' : ''} configured=${pay.configured}`
  )
}

validateEnvironment()

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
})

async function verifyPrisma() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('PostgreSQL (Prisma) connectivity OK')
    return true
  } catch (err) {
    console.error('Prisma connectivity failed:', err.message || err)
    return false
  }
}

async function connectDataStores() {
  if (isPrismaIdentity()) {
    const ok = await verifyPrisma()
    if (!ok && process.env.ALLOW_START_WITHOUT_DB !== 'true') {
      process.exit(1)
    }
  }

  // Prisma mode defaults to PostgreSQL-only unless SKIP_MONGO=false is set.
  const skipMongoRaw = String(process.env.SKIP_MONGO || '').toLowerCase()
  const skipMongo =
    skipMongoRaw === 'true' || (isPrismaIdentity() && skipMongoRaw !== 'false')

  if (isPrismaIdentity() && skipMongo) {
    console.log('Prisma mode — not connecting to MongoDB (SKIP_MONGO)')
    return
  }

  connectDB()
}

/**
 * Background reconciliation (Prisma mode): ask Chapa about unpaid checkouts,
 * then expire stale payment holds so inventory is released. Interval in
 * minutes via RECONCILIATION_INTERVAL_MINUTES (default 5, 0 disables).
 */
let reconcileTimer = null
function startReconciliationScheduler() {
  if (!isPrismaIdentity()) return
  const minutes = Number(process.env.RECONCILIATION_INTERVAL_MINUTES ?? 5)
  if (!Number.isFinite(minutes) || minutes <= 0) return

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const { verifyStaleChapaPayments } = await import('./services/chapaCheckoutService.js')
      const { runPaymentReconciliation } = await import('./services/paymentReconciliationService.js')
      const chapa = await verifyStaleChapaPayments({ limit: 50 })
      const summary = await runPaymentReconciliation({ limit: 500 })
      if (chapa.checked || summary.expired || summary.repaired || summary.errors) {
        console.log(
          `[reconcile] chapaChecked=${chapa.checked} chapaConfirmed=${chapa.confirmed || 0} ` +
            `expired=${summary.expired} repaired=${summary.repaired} flagged=${summary.flagged} errors=${summary.errors}`
        )
      }
    } catch (err) {
      console.error('[reconcile] failed:', err.message)
    } finally {
      running = false
    }
  }
  reconcileTimer = setInterval(tick, minutes * 60 * 1000)
  reconcileTimer.unref()
  setTimeout(tick, 30 * 1000).unref()
}

function shutdown(signal) {
  console.log(`${signal} received — shutting down`)
  if (reconcileTimer) clearInterval(reconcileTimer)
  server.close(async () => {
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

await connectDataStores()
startReconciliationScheduler()

export default app
