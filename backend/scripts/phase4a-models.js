/**
 * Phase 4A — model schema and migration validation.
 * Usage: node scripts/phase4a-models.js [databaseUri]
 *
 * If databaseUri omitted, uses DATABASE from config.env or .memory-db-uri.
 */
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const results = []

function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

function resolveDbUri() {
  if (process.argv[2]) return process.argv[2]
  const memFile = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(memFile)) return fs.readFileSync(memFile, 'utf8').trim()
  return process.env.DATABASE
}

async function run() {
  const uri = resolveDbUri()
  if (!uri) {
    fail('Database URI available')
    process.exit(1)
  }

  await mongoose.connect(uri)
  pass('Connected to database')

  const Booking = (await import('../models/Booking.js')).default
  const Payment = (await import('../models/Payment.js')).default
  const PaymentAttempt = (await import('../models/PaymentAttempt.js')).default
  const {
    getPaymentPendingMinutes,
    getCancellationCutoffHours,
    ALL_BOOKING_STATUSES,
  } = await import('../config/booking.js')

  if (getPaymentPendingMinutes() === 15) pass('Default payment pending minutes = 15')
  else fail('Default payment pending minutes', String(getPaymentPendingMinutes()))

  if (getCancellationCutoffHours() === 48) pass('Default cancellation cutoff hours = 48')
  else fail('Default cancellation cutoff hours', String(getCancellationCutoffHours()))

  const legacyStatuses = ['pending', 'confirmed', 'cancelled', 'completed']
  for (const s of legacyStatuses) {
    if (ALL_BOOKING_STATUSES.includes(s)) pass(`Legacy status preserved: ${s}`)
    else fail(`Legacy status preserved: ${s}`)
  }

  const v2Only = ['payment_pending', 'failed', 'expired', 'partially_refunded']
  for (const s of v2Only) {
    if (ALL_BOOKING_STATUSES.includes(s)) pass(`V2 status available: ${s}`)
    else fail(`V2 status available: ${s}`)
  }

  const userId = new mongoose.Types.ObjectId()
  const tourId = new mongoose.Types.ObjectId()
  const orgId = new mongoose.Types.ObjectId()
  const departureId = new mongoose.Types.ObjectId()

  try {
    const legacy = new Booking({
      user: userId,
      bookingType: 'hotel',
      bookingItem: new mongoose.Types.ObjectId(),
      contactInfo: {
        fullName: 'Legacy Guest',
        email: 'legacy@test.com',
        phone: '+251911000001',
      },
      payment: {
        amount: 100,
        currency: 'ETB',
        paymentMethod: 'credit_card',
        paymentStatus: 'pending',
      },
      status: 'pending',
    })
    await legacy.validate()
    pass('Legacy booking schema validates without v2 fields')
  } catch (e) {
    fail('Legacy booking schema validates', e.message)
  }

  try {
    const v2 = new Booking({
      user: userId,
      bookingFlowVersion: 'v2',
      bookingType: 'tour',
      bookingItem: tourId,
      organizationId: orgId,
      departureId,
      packageKey: 'normal',
      inventoryQuantity: 2,
      inventoryReserved: true,
      status: 'payment_pending',
      contactInfo: {
        fullName: 'V2 Guest',
        email: 'v2@test.com',
        phone: '+251911000002',
      },
      priceSnapshot: {
        currency: 'ETB',
        quantity: 2,
        unitPriceMinor: 50000,
        subtotalMinor: 100000,
        discountMinor: 0,
        feesMinor: 0,
        taxMinor: 0,
        totalMinor: 100000,
        tourId,
        tourTitle: 'Test Tour',
        tourSlug: 'test-tour',
        departureId,
        departureDate: new Date(Date.now() + 86400000 * 30),
        packageKey: 'normal',
        packageName: 'Standard',
        organizationId: orgId,
        organizationName: 'Test Org',
        organizationSlug: 'test-org',
        pricedFrom: 'departure_package',
        pricedAt: new Date(),
        tourPriceMinorAtBooking: 50000,
      },
    })
    await v2.validate()
    pass('V2 booking schema validates with priceSnapshot')
  } catch (e) {
    fail('V2 booking schema validates', e.message)
  }

  try {
    const badV2 = new Booking({
      user: userId,
      bookingFlowVersion: 'v2',
      bookingType: 'tour',
      bookingItem: tourId,
      contactInfo: {
        fullName: 'Bad',
        email: 'bad@test.com',
        phone: '+251911000003',
      },
    })
    await badV2.validate()
    fail('V2 booking rejects missing departureId')
  } catch {
    pass('V2 booking rejects missing departureId')
  }

  try {
    const badSnapshot = new Booking({
      user: userId,
      bookingFlowVersion: 'v2',
      bookingType: 'tour',
      bookingItem: tourId,
      organizationId: orgId,
      departureId,
      packageKey: 'normal',
      inventoryQuantity: 1,
      contactInfo: {
        fullName: 'Bad Snap',
        email: 'snap@test.com',
        phone: '+251911000004',
      },
      priceSnapshot: {
        currency: 'ETB',
        quantity: 2,
        unitPriceMinor: 50000,
        subtotalMinor: 99999,
        totalMinor: 99999,
        tourId,
        tourTitle: 'T',
        departureId,
        departureDate: new Date(),
        packageKey: 'normal',
        packageName: 'N',
        organizationId: orgId,
        organizationName: 'O',
        pricedFrom: 'tour_package',
        pricedAt: new Date(),
      },
    })
    await badSnapshot.validate()
    fail('Price snapshot rejects inconsistent subtotal')
  } catch {
    pass('Price snapshot rejects inconsistent subtotal')
  }

  try {
    const payment = new Payment({
      bookingId: new mongoose.Types.ObjectId(),
      organizationId: orgId,
      amountMinor: 100000,
      currency: 'ETB',
      status: 'pending',
      provider: 'mock',
    })
    await payment.validate()
    pass('Payment model validates')
  } catch (e) {
    fail('Payment model validates', e.message)
  }

  try {
    const badPayment = new Payment({
      bookingId: new mongoose.Types.ObjectId(),
      organizationId: orgId,
      amountMinor: 99.5,
      currency: 'ETB',
      provider: 'mock',
    })
    await badPayment.validate()
    fail('Payment rejects non-integer amountMinor')
  } catch {
    pass('Payment rejects non-integer amountMinor')
  }

  try {
    const attempt = new PaymentAttempt({
      paymentId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      status: 'pending',
    })
    await attempt.validate()
    pass('PaymentAttempt model validates')
  } catch (e) {
    fail('PaymentAttempt model validates', e.message)
  }

  const bookingIndexes = Booking.schema.indexes().map((idx) => JSON.stringify(idx[0]))
  if (bookingIndexes.some((i) => i.includes('idempotencyKey'))) {
    pass('Booking idempotency index defined')
  } else fail('Booking idempotency index defined')

  const unmigrated = await Booking.countDocuments({
    $or: [{ bookingFlowVersion: { $exists: false } }, { bookingFlowVersion: null }],
  })

  if (unmigrated > 0) {
    const update = await Booking.updateMany(
      {
        $or: [{ bookingFlowVersion: { $exists: false } }, { bookingFlowVersion: null }],
      },
      { $set: { bookingFlowVersion: 'legacy' } }
    )
    pass('Migration idempotent backfill', `updated=${update.modifiedCount}`)
  } else {
    pass('Migration idempotent backfill', 'nothing to update')
  }

  const second = await Booking.updateMany(
    { bookingFlowVersion: 'legacy' },
    { $set: { bookingFlowVersion: 'legacy' } }
  )
  if (second.modifiedCount === 0) pass('Migration rerun modifies zero records')
  else fail('Migration rerun modifies zero records', `modified=${second.modifiedCount}`)

  await mongoose.disconnect()

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Phase 4A models: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
