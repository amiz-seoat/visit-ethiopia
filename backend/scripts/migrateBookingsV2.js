/**
 * Backfill Phase 4 booking fields on existing records.
 *
 * Usage:
 *   node scripts/migrateBookingsV2.js [--dry-run]
 *
 * --dry-run   Report actions without writing (zero writes)
 *
 * Safe to rerun: only updates bookings missing bookingFlowVersion.
 * Does NOT convert legacy bookings to v2 semantics.
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: './config.env' })

const dryRun = process.argv.includes('--dry-run')

async function connect() {
  const uri = process.env.DATABASE
  if (!uri) throw new Error('DATABASE not set in config.env')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
}

async function run() {
  await connect()

  const Booking = (await import('../models/Booking.js')).default

  const filter = {
    $or: [
      { bookingFlowVersion: { $exists: false } },
      { bookingFlowVersion: null },
    ],
  }

  const count = await Booking.countDocuments(filter)

  if (dryRun) {
    console.log(`[dry-run] Would set bookingFlowVersion='legacy' on ${count} booking(s)`)
    console.log('\nDone. updated=0 skipped=0 dryRun=true')
    await mongoose.disconnect()
    return
  }

  if (count === 0) {
    console.log('No bookings require migration.')
    await mongoose.disconnect()
    return
  }

  const result = await Booking.updateMany(filter, {
    $set: { bookingFlowVersion: 'legacy' },
  })

  console.log(`Updated ${result.modifiedCount} booking(s) with bookingFlowVersion='legacy'`)
  console.log(`\nDone. updated=${result.modifiedCount} dryRun=false`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
