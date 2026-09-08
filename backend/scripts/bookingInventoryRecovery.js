/**
 * Expire held inventory reservations and reconcile orphaned state.
 *
 * Usage:
 *   node scripts/bookingInventoryRecovery.js [--dry-run] [--limit=100]
 *
 * Safe to rerun: release operations are idempotent via bookingInventoryService.
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: './config.env' })

const dryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const batchLimit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 100) : 100

async function connect() {
  const uri = process.env.DATABASE
  if (!uri) throw new Error('DATABASE not set in config.env')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
}

async function run() {
  await connect()

  const InventoryHold = (await import('../models/InventoryHold.js')).default
  const Booking = (await import('../models/Booking.js')).default
  const { expireV2Booking } = await import('../services/bookingLifecycleService.js')

  const now = new Date()
  const stats = {
    holdsScanned: 0,
    bookingsExpired: 0,
    bookingsSkipped: 0,
    bookingsErrors: 0,
    dryRun,
  }

  const expiredHolds = await InventoryHold.find({
    status: 'held',
    expiresAt: { $ne: null, $lte: now },
  })
    .sort('expiresAt')
    .limit(batchLimit)

  stats.holdsScanned = expiredHolds.length
  console.log(`Found ${expiredHolds.length} expired held reservation(s) (limit=${batchLimit})`)

  const processedBookingIds = new Set()

  for (const hold of expiredHolds) {
    if (dryRun) {
      console.log(
        `[dry-run] Would expire booking=${hold.bookingId} departure=${hold.departureId} qty=${hold.quantity}`
      )
      stats.bookingsSkipped++
      continue
    }

    try {
      const booking = await Booking.findById(hold.bookingId).setOptions({
        skipUserPopulate: true,
        skipBookingItemPopulate: true,
      })
      if (!booking) {
        stats.bookingsSkipped++
        continue
      }
      const result = await expireV2Booking(booking)
      processedBookingIds.add(String(booking._id))
      if (result.idempotent) stats.bookingsSkipped++
      else stats.bookingsExpired++
      console.log(`Expired booking=${booking._id} idempotent=${result.idempotent}`)
    } catch (err) {
      stats.bookingsErrors++
      console.error(`Failed hold ${hold._id}: ${err.message}`)
    }
  }

  const expiredBookings = await Booking.find({
    bookingFlowVersion: 'v2',
    status: 'payment_pending',
    expiresAt: { $ne: null, $lte: now },
    _id: { $nin: [...processedBookingIds] },
  })
    .sort('expiresAt')
    .limit(batchLimit)
    .setOptions({ skipUserPopulate: true, skipBookingItemPopulate: true })

  stats.bookingsScanned = expiredBookings.length
  console.log(`Found ${expiredBookings.length} additional expired payment_pending booking(s)`)

  for (const booking of expiredBookings) {
    if (dryRun) {
      console.log(`[dry-run] Would expire booking=${booking._id}`)
      stats.bookingsSkipped++
      continue
    }

    try {
      const result = await expireV2Booking(booking)
      if (result.idempotent) stats.bookingsSkipped++
      else stats.bookingsExpired++
      console.log(`Expired booking=${booking._id} idempotent=${result.idempotent}`)
    } catch (err) {
      stats.bookingsErrors++
      console.error(`Failed booking ${booking._id}: ${err.message}`)
    }
  }

  console.log('\nRecovery summary:', stats)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
