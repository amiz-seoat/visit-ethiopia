/**
 * Payment/booking reconciliation CLI.
 *
 * Usage:
 *   node scripts/bookingReconciliation.js [--dry-run] [--limit=N]
 *
 * Uses the same service as POST /api/v1/admin/bookings/reconcile.
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 100) : 100

function resolveDbUri() {
  const memFile = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(memFile)) return fs.readFileSync(memFile, 'utf8').trim()
  return process.env.DATABASE
}

async function main() {
  const uri = resolveDbUri()
  if (!uri) throw new Error('No DATABASE URI available')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const { runPaymentReconciliation } = await import('../services/paymentReconciliationService.js')
  const summary = await runPaymentReconciliation({ dryRun, limit })

  console.log('\nReconciliation summary:')
  console.log(JSON.stringify({
    scanned: summary.scanned,
    repaired: summary.repaired,
    expired: summary.expired,
    inventoryReleased: summary.inventoryReleased,
    bookingsConfirmed: summary.bookingsConfirmed,
    flagged: summary.flagged,
    errors: summary.errors,
    dryRun: summary.dryRun,
  }, null, 2))

  await mongoose.disconnect()
  process.exit(summary.errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
