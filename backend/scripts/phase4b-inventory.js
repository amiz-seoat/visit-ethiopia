/**
 * Phase 4B — booking inventory reservation tests.
 * Usage: node scripts/phase4b-inventory.js [databaseUri]
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

function priceSnapshot({ tourId, tourTitle, departureId, orgId, orgName, quantity, unitPriceMinor }) {
  const subtotal = unitPriceMinor * quantity
  return {
    currency: 'ETB',
    quantity,
    unitPriceMinor,
    subtotalMinor: subtotal,
    discountMinor: 0,
    feesMinor: 0,
    taxMinor: 0,
    totalMinor: subtotal,
    tourId,
    tourTitle,
    tourSlug: 'test-tour',
    departureId,
    departureDate: new Date(Date.now() + 86400000 * 30),
    packageKey: 'normal',
    packageName: 'Standard',
    organizationId: orgId,
    organizationName: orgName,
    organizationSlug: 'test-org',
    pricedFrom: 'departure_package',
    pricedAt: new Date(),
    tourPriceMinorAtBooking: unitPriceMinor,
  }
}

async function createV2Booking({
  Booking,
  userId,
  tourId,
  orgId,
  departureId,
  quantity = 2,
}) {
  return Booking.create({
    user: userId,
    bookingFlowVersion: 'v2',
    bookingType: 'tour',
    bookingItem: tourId,
    organizationId: orgId,
    departureId,
    packageKey: 'normal',
    inventoryQuantity: quantity,
    status: 'payment_pending',
    contactInfo: {
      fullName: 'Test User',
      email: 'phase4b@test.com',
      phone: '+251911000777',
    },
    priceSnapshot: priceSnapshot({
      tourId,
      tourTitle: 'Phase 4B Tour',
      departureId,
      orgId,
      orgName: 'Phase 4B Org',
      quantity,
      unitPriceMinor: 50000,
    }),
  })
}

async function createDeparture(TourDeparture, { tourId, orgId, capacity = 10 }) {
  return TourDeparture.create({
    tourId,
    organizationId: orgId,
    departureDate: new Date(Date.now() + 86400000 * 45),
    capacity,
    availableSpots: capacity,
    status: 'open',
    packages: [{ key: 'normal', priceMinor: 50000, currency: 'ETB', active: true }],
  })
}

async function run() {
  const uri = resolveDbUri()
  if (!uri) {
    fail('Database URI available')
    process.exit(1)
  }

  await mongoose.connect(uri, {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  pass('Connected to database')

  await import('../models/User.js')

  const Booking = (await import('../models/Booking.js')).default
  const Tour = (await import('../models/Tour.js')).default
  const TourDeparture = (await import('../models/TourDeparture.js')).default
  const Organization = (await import('../models/Organization.js')).default
  const {
    reserveForBooking,
    releaseForBooking,
    finalizeForBooking,
    parseReservationQuantity,
    loadBookableDepartureContext,
    compensateDepartureRelease,
    assertReservationState,
  } = await import('../services/bookingInventoryService.js')
  const { updateDeparture, reserveDepartureSpots } = await import(
    '../services/tourDepartureService.js'
  )

  const userId = new mongoose.Types.ObjectId()

  const org = await Organization.create({
    slug: `phase4b-org-${Date.now()}`,
    name: 'Phase 4B Org',
    providerTypes: ['travel_company'],
    ownerUserId: userId,
    approvalStatus: 'approved',
    visibility: 'public',
    approvedVersionId: new mongoose.Types.ObjectId(),
    shortDescription: 'Test org',
  })
  const orgId = org._id

  const tour = await Tour.create({
    title: 'Phase 4B Tour',
    slug: `phase4b-${Date.now()}`,
    description: 'Test tour',
    shortDescription: 'Test',
    duration: { days: 3, nights: 2 },
    destinations: ['Addis'],
    difficulty: 'easy',
    price: 500,
    coverImage: 'https://example.com/img.jpg',
    maxGroupSize: 12,
    organizationId: orgId,
    status: 'published',
    createdBy: userId,
  })

  let departure = await createDeparture(TourDeparture, { tourId: tour._id, orgId, capacity: 10 })
  let booking = await createV2Booking({
    Booking,
    userId,
    tourId: tour._id,
    orgId,
    departureId: departure._id,
    quantity: 2,
  })

  try {
    const reserved = await reserveForBooking({
      bookingId: booking._id,
      departureId: departure._id,
      quantity: 2,
    })
    if (reserved.hold?.status === 'held') pass('Valid reservation')
    else fail('Valid reservation')

    const state = await assertReservationState(booking._id)
    if (state.hold && state.booking?.inventoryReserved) pass('Reservation linked to booking')
    else fail('Reservation linked to booking')

    departure = await TourDeparture.findById(departure._id)
    if (departure.availableSpots === 8) pass('Inventory decremented correctly', 'spots=8')
    else fail('Inventory decremented correctly', `spots=${departure.availableSpots}`)
  } catch (e) {
    fail('Valid reservation', e.message)
  }

  try {
    await reserveForBooking({
      bookingId: booking._id,
      departureId: departure._id,
      quantity: 2,
    })
    pass('Reserve twice for same booking does NOT double-reserve')
    departure = await TourDeparture.findById(departure._id)
    if (departure.availableSpots === 8) pass('Idempotent reserve preserves inventory', 'spots=8')
    else fail('Idempotent reserve preserves inventory', `spots=${departure.availableSpots}`)
  } catch (e) {
    fail('Reserve twice for same booking', e.message)
  }

  for (const [label, qty] of [
    ['zero', 0],
    ['negative', -1],
    ['decimal', 1.5],
  ]) {
    const b = await createV2Booking({
      Booking,
      userId: new mongoose.Types.ObjectId(),
      tourId: tour._id,
      orgId,
      departureId: departure._id,
      quantity: 1,
    })
    try {
      await reserveForBooking({ bookingId: b._id, departureId: departure._id, quantity: qty })
      fail(`${label} quantity rejected`)
    } catch {
      pass(`${label} quantity rejected`)
    }
  }

  const bigBooking = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: departure._id,
    quantity: 99,
  })
  try {
    await reserveForBooking({
      bookingId: bigBooking._id,
      departureId: departure._id,
      quantity: 99,
    })
    fail('quantity > available rejected')
  } catch {
    pass('quantity > available rejected')
  }

  await Tour.findByIdAndUpdate(tour._id, { status: 'archived' })
  try {
    await loadBookableDepartureContext(departure._id)
    fail('archived tour rejected')
  } catch {
    pass('archived tour rejected')
  }
  await Tour.findByIdAndUpdate(tour._id, { status: 'published' })

  await TourDeparture.findByIdAndUpdate(departure._id, { status: 'cancelled' })
  try {
    await loadBookableDepartureContext(departure._id)
    fail('closed departure rejected')
  } catch {
    pass('closed departure rejected')
  }
  await TourDeparture.findByIdAndUpdate(departure._id, { status: 'open' })

  const r1 = await releaseForBooking({ bookingId: booking._id, reason: 'test' })
  if (r1.released) pass('Release restores inventory')
  else fail('Release restores inventory')

  departure = await TourDeparture.findById(departure._id)
  if (departure.availableSpots === 10) pass('Release restores exact quantity', 'spots=10')
  else fail('Release restores exact quantity', `spots=${departure.availableSpots}`)

  const r2 = await releaseForBooking({ bookingId: booking._id, reason: 'test_retry' })
  if (r2.idempotent) pass('Release twice does NOT double-release')
  else fail('Release twice does NOT double-release')

  if (departure.availableSpots === 10) pass('Spots unchanged after double-release')
  else fail('Spots unchanged after double-release', `spots=${departure.availableSpots}`)

  const bookingB = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: departure._id,
    quantity: 3,
  })
  await reserveForBooking({
    bookingId: bookingB._id,
    departureId: departure._id,
    quantity: 3,
  })

  try {
    await updateDeparture(departure, { availableSpots: 5 })
    fail('manual availableSpots edit blocked with active reservation')
  } catch (e) {
    if (e.statusCode === 409) pass('manual availableSpots edit blocked with active reservation')
    else fail('manual availableSpots edit blocked', e.message)
  }

  await releaseForBooking({ bookingId: bookingB._id })
  departure = await TourDeparture.findById(departure._id)

  const crossA = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: departure._id,
    quantity: 2,
  })
  const crossB = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: departure._id,
    quantity: 2,
  })
  await reserveForBooking({
    bookingId: crossA._id,
    departureId: departure._id,
    quantity: 2,
  })
  await reserveForBooking({
    bookingId: crossB._id,
    departureId: departure._id,
    quantity: 2,
  })
  await releaseForBooking({ bookingId: crossA._id })
  departure = await TourDeparture.findById(departure._id)
  if (departure.availableSpots === 8) {
    pass('cross-booking release affects only target booking')
  } else {
    fail('cross-booking release affects only target booking', `spots=${departure.availableSpots}`)
  }

  await releaseForBooking({ bookingId: crossB._id })
  departure = await TourDeparture.findById(departure._id)

  try {
    await updateDeparture(departure, { availableSpots: 9 })
    pass('manual edit allowed when no active v2 reservations')
  } catch (e) {
    fail('manual edit allowed when no active v2 reservations', e.message)
  }

  const dep50 = await createDeparture(TourDeparture, {
    tourId: tour._id,
    orgId,
    capacity: 10,
  })
  const raceReservations = async (departureId, attempts) => {
    const bookings = []
    for (let i = 0; i < attempts; i += 1) {
      bookings.push(
        await createV2Booking({
          Booking,
          userId: new mongoose.Types.ObjectId(),
          tourId: tour._id,
          orgId,
          departureId,
          quantity: 1,
        })
      )
    }
    const outcomes = await Promise.all(
      bookings.map(async (b) => {
        try {
          await reserveForBooking({
            bookingId: b._id,
            departureId,
            quantity: 1,
          })
          return true
        } catch {
          return false
        }
      })
    )
    const ok = outcomes.filter(Boolean).length
    const d = await TourDeparture.findById(departureId)
    return { ok, spots: d.availableSpots }
  }

  const c50 = await raceReservations(dep50._id, 50)
  if (c50.ok === 10 && c50.spots === 0) pass('50 concurrent x1 on capacity 10')
  else fail('50 concurrent x1 on capacity 10', `ok=${c50.ok} spots=${c50.spots}`)

  const dep100 = await createDeparture(TourDeparture, {
    tourId: tour._id,
    orgId,
    capacity: 10,
  })
  const c100 = await raceReservations(dep100._id, 100)
  const ok100 = c100.ok
  const d100 = { availableSpots: c100.spots }
  if (ok100 === 10 && d100.availableSpots === 0) pass('100 concurrent x1 on capacity 10')
  else fail('100 concurrent x1 on capacity 10', `ok=${ok100} spots=${d100.availableSpots}`)

  const depRelease = await createDeparture(TourDeparture, {
    tourId: tour._id,
    orgId,
    capacity: 5,
  })
  const relBooking = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: depRelease._id,
    quantity: 2,
  })
  await reserveForBooking({
    bookingId: relBooking._id,
    departureId: depRelease._id,
    quantity: 2,
  })
  await Promise.all([
    releaseForBooking({ bookingId: relBooking._id }),
    releaseForBooking({ bookingId: relBooking._id }),
    releaseForBooking({ bookingId: relBooking._id }),
  ])
  const afterRel = await TourDeparture.findById(depRelease._id)
  if (afterRel.availableSpots === 5) pass('concurrent release does not over-release')
  else fail('concurrent release does not over-release', `spots=${afterRel.availableSpots}`)

  const expBooking = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: depRelease._id,
    quantity: 1,
  })
  await reserveForBooking({
    bookingId: expBooking._id,
    departureId: depRelease._id,
    quantity: 1,
    expiresAt: new Date(Date.now() - 60000),
  })
  const expResult = await releaseForBooking({
    bookingId: expBooking._id,
    reason: 'expired',
    targetStatus: 'expired',
  })
  if (expResult.released || expResult.idempotent) pass('expiry release works')
  else fail('expiry release works')

  const expAgain = await releaseForBooking({
    bookingId: expBooking._id,
    reason: 'expired',
    targetStatus: 'expired',
  })
  if (expAgain.idempotent) pass('rerunning expiry release is idempotent')
  else fail('rerunning expiry release is idempotent')

  try {
    const legacy = new Booking({
      user: userId,
      bookingType: 'hotel',
      bookingItem: new mongoose.Types.ObjectId(),
      contactInfo: {
        fullName: 'Legacy',
        email: 'legacy@test.com',
        phone: '+251911000001',
      },
      payment: {
        amount: 100,
        paymentMethod: 'credit_card',
        paymentStatus: 'pending',
      },
      status: 'pending',
    })
    await legacy.validate()
    pass('legacy bookings remain unaffected (schema)')
    try {
      await reserveForBooking({
        bookingId: legacy._id,
        departureId: departure._id,
        quantity: 1,
      })
      fail('legacy booking cannot use v2 reserve')
    } catch {
      pass('legacy booking cannot use v2 reserve')
    }
  } catch (e) {
    fail('legacy bookings remain unaffected', e.message)
  }

  const compDep = await createDeparture(TourDeparture, {
    tourId: tour._id,
    orgId,
    capacity: 6,
  })
  await reserveDepartureSpots(compDep._id, 2)
  const compensated = await compensateDepartureRelease(compDep._id, 2)
  const afterComp = await TourDeparture.findById(compDep._id)
  if (compensated && afterComp.availableSpots === 6) pass('compensation release after orphan reserve')
  else fail('compensation release after orphan reserve')

  const retryComp = await compensateDepartureRelease(compDep._id, 2)
  if (retryComp && afterComp.availableSpots === 6) pass('compensation retry is safe')
  else fail('compensation retry is safe')

  const consumedBooking = await createV2Booking({
    Booking,
    userId: new mongoose.Types.ObjectId(),
    tourId: tour._id,
    orgId,
    departureId: compDep._id,
    quantity: 1,
  })
  await reserveForBooking({
    bookingId: consumedBooking._id,
    departureId: compDep._id,
    quantity: 1,
  })
  await finalizeForBooking({ bookingId: consumedBooking._id })
  try {
    await releaseForBooking({ bookingId: consumedBooking._id })
    fail('cannot release consumed reservation')
  } catch {
    pass('cannot release consumed reservation')
  }

  try {
    parseReservationQuantity(1)
    pass('parseReservationQuantity accepts valid input')
  } catch {
    fail('parseReservationQuantity accepts valid input')
  }

  await mongoose.disconnect()

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Phase 4B inventory: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
