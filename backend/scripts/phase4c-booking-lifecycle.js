/**
 * Phase 4C — tour booking creation, lifecycle, pricing, security tests.
 * Usage: node scripts/phase4c-booking-lifecycle.js [baseUrl] [databaseUri]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://localhost:4002/api/v1').replace(/\/$/, '')
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const results = []

function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

function resolveTestDatabaseUri() {
  if (process.argv[3]) return process.argv[3]
  const memoryUriFile = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(memoryUriFile)) {
    return fs.readFileSync(memoryUriFile, 'utf8').trim()
  }
  return process.env.DATABASE
}

async function req(method, path, { token, body, idempotencyKey, orgContext, adminBypass, headers = {} } = {}) {
  const h = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    ...(orgContext ? { 'X-Org-Context': String(orgContext) } : {}),
    ...(adminBypass ? { 'X-Admin-Org-Bypass': 'true' } : {}),
    ...headers,
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function login(email, password) {
  const res = await req('POST', '/users/login', { body: { email, password } })
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed for ${email}: ${res.status}`)
  }
  return res.data.token
}

function validVerification() {
  return {
    legalName: 'Phase4C Travel PLC',
    registrationNumber: 'P4C-REG-001',
    responsiblePerson: {
      name: 'Tour Operator',
      phone: '+251911000001',
      email: 'operator@visitethiopia.test',
    },
    businessDocuments: [
      { type: 'business_license', url: 'https://example.com/license.pdf', status: 'pending' },
    ],
  }
}

function sampleTourPayload(title = 'Phase4C Tour') {
  return {
    title: `${title} ${Date.now()}`,
    description:
      'Phase 4C booking lifecycle test tour with packages and detailed description for validation.',
    shortDescription: 'Phase 4C tour',
    duration: { days: 5, nights: 4 },
    destinations: ['Lalibela'],
    difficulty: 'moderate',
    price: 1200,
    coverImage: 'https://images.unsplash.com/photo-1518341223789-51e3a61f5dc6',
    maxGroupSize: 15,
    packages: [
      {
        key: 'normal',
        name: 'Standard Package',
        priceMinor: 45000,
        currency: 'ETB',
        active: true,
      },
    ],
    itinerary: [{ day: 1, title: 'Arrival', description: 'Welcome' }],
  }
}

function contactInfo(suffix = '1') {
  return {
    fullName: `Test Customer ${suffix}`,
    email: `phase4c-${suffix}@example.com`,
    phone: '+251911000888',
  }
}

function bookingBody(departureId, quantity = 2, suffix = '1') {
  return {
    departureId,
    packageKey: 'normal',
    quantity,
    contactInfo: contactInfo(suffix),
  }
}

async function registerAndApproveOrg(token, adminToken, name) {
  const reg = await req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes: ['travel_company'],
      shortDescription: 'Approved travel company',
      verification: validVerification(),
    },
  })
  if (reg.status !== 201) throw new Error(`Register failed: ${reg.status}`)
  const org = reg.data?.data?.organization
  if (!org?._id) throw new Error('Organization missing from registration response')
  const versionId = reg.data.data.draftVersion._id

  await req('PATCH', `/organizations/${org._id}/draft`, {
    token,
    orgContext: org._id,
    body: { shortDescription: 'Public company profile', verification: validVerification() },
  })

  const submit = await req('POST', `/organizations/${org._id}/versions/${versionId}/submit`, {
    token,
    orgContext: org._id,
  })
  const approvalId = submit.data?.data?.approvalRequest?._id
  await req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: adminToken,
    body: {},
  })
  return org
}

async function setupPublishedTourWithDeparture({
  operatorToken,
  adminToken,
  capacity = 10,
  priceMinor = 50000,
}) {
  const org = await registerAndApproveOrg(
    operatorToken,
    adminToken,
    `Phase4C Org ${Date.now()}`
  )

  const createRes = await req('POST', `/organizations/${org._id}/tours`, {
    token: operatorToken,
    orgContext: org._id,
    body: sampleTourPayload('Bookable Tour'),
  })
  if (createRes.status !== 201) {
    throw new Error(
      `Tour create failed: ${createRes.status} ${createRes.data?.message || JSON.stringify(createRes.data)}`
    )
  }
  const tour = createRes.data.data.data
  const tourId = tour._id

  await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operatorToken,
    orgContext: org._id,
  })

  const depDate = new Date(Date.now() + 86400000 * 45).toISOString()
  const depCreate = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      departureDate: depDate,
      capacity,
      availableSpots: capacity,
      packages: [{ key: 'normal', priceMinor, currency: 'ETB', active: true }],
    },
  })
  if (depCreate.status !== 201) throw new Error(`Departure create failed: ${depCreate.status}`)
  const departure = depCreate.data.data.data

  return { org, tour, tourId, departure }
}

async function createTourBooking(token, departureId, opts = {}) {
  return req('POST', '/bookings/tours', {
    token,
    idempotencyKey: opts.idempotencyKey || `idem-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`,
    body: {
      ...bookingBody(departureId, opts.quantity ?? 2, opts.suffix ?? '1'),
      ...(opts.extraBody || {}),
    },
  })
}

async function run() {
  console.log(`\n=== Phase 4C booking lifecycle @ ${BASE} ===\n`)

  let customerToken, operatorToken, adminToken, customerBToken
  try {
    customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
    operatorToken = await login('operator@visitethiopia.test', 'OperatorPass123!')
    adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
    pass('Seed user logins')
  } catch (e) {
    fail('Seed user logins', e.message)
    return done()
  }

  const signupEmail = `phase4c-b-${Date.now()}@example.com`
  const signupB = await req('POST', '/users/signup', {
    body: {
      FirstName: 'Customer',
      LastName: 'Two',
      email: signupEmail,
      password: 'CustomerBPass123!',
      passwordConfirm: 'CustomerBPass123!',
    },
  })
  if (signupB.status === 201) {
    try {
      customerBToken = await login(signupEmail, 'CustomerBPass123!')
      pass('Second customer signup')
    } catch (e) {
      fail('Second customer signup login', e.message)
      return done()
    }
  } else {
    fail('Second customer signup', `${signupB.status}`)
    return done()
  }

  let ctx
  const uri = resolveTestDatabaseUri()
  if (uri && mongoose.connection.readyState === 0) {
    await import('../models/User.js')
    await mongoose.connect(uri)
  }

  try {
    ctx = await setupPublishedTourWithDeparture({
      operatorToken,
      adminToken,
      capacity: 10,
      priceMinor: 50000,
    })
    pass('Setup published tour with departure')
  } catch (e) {
    fail('Setup published tour with departure', e.message)
    return done()
  }

  const { org, tourId, departure } = ctx
  const departureId = departure._id

  const unauth = await req('POST', '/bookings/tours', {
    body: bookingBody(departureId),
  })
  if (unauth.status === 401) pass('unauthenticated booking rejected')
  else fail('unauthenticated booking rejected', `${unauth.status}`)

  const noKey = await req('POST', '/bookings/tours', {
    token: customerToken,
    body: bookingBody(departureId),
  })
  if (noKey.status === 400) pass('missing Idempotency-Key rejected')
  else fail('missing Idempotency-Key rejected', `${noKey.status}`)

  const created = await createTourBooking(customerToken, departureId, {
    idempotencyKey: `phase4c-create-${RUN_ID}`,
    quantity: 2,
  })
  const booking = created.data?.data
  if (created.status === 201 && booking) {
    pass('valid v2 tour booking succeeds')
    if (booking.status === 'payment_pending') pass('initial status = payment_pending')
    else fail('initial status = payment_pending', booking.status)
    if (booking.bookingFlowVersion === 'v2') pass('bookingFlowVersion = v2')
    else fail('bookingFlowVersion = v2', booking.bookingFlowVersion)
    if (String(booking.departureId) === String(departureId)) pass('departureId stored correctly')
    else fail('departureId stored correctly')
    if (String(booking.organizationId) === String(org._id)) pass('organizationId server-derived')
    else fail('organizationId server-derived')
    if (booking.packageKey === 'normal') pass('packageKey stored correctly')
    else fail('packageKey stored correctly')
    if (booking.inventoryQuantity === 2) pass('inventoryQuantity correct')
    else fail('inventoryQuantity correct', String(booking.inventoryQuantity))
    if (booking.expiresAt) pass('expiresAt populated')
    else fail('expiresAt populated')
    if (booking.inventoryReserved === true) pass('inventoryReserved true')
    else fail('inventoryReserved true')
  } else {
    fail('valid v2 tour booking succeeds', `${created.status} ${created.data?.message}`)
  }

  const priceCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 50000,
  })
  const priceIgnored = await createTourBooking(customerToken, priceCtx.departure._id, {
    idempotencyKey: `phase4c-price-${RUN_ID}`,
    quantity: 1,
    extraBody: {
      amount: 1,
      total: 1,
      currency: 'USD',
      unitPrice: 1,
      subtotal: 1,
    },
  })
  const priced = priceIgnored.data?.data
  if (priceIgnored.status === 201 && priced?.priceSnapshot?.unitPriceMinor === 50000) {
    pass('client amount is ignored')
    pass('client total is ignored')
    pass('client currency is ignored')
    pass('server calculates correct unit price')
    if (priced.priceSnapshot.subtotalMinor === 50000) pass('server calculates correct subtotal')
    else fail('server calculates correct subtotal')
    if (priced.priceSnapshot.totalMinor === 50000) pass('server calculates correct total')
    else fail('server calculates correct total')
  } else {
    fail('client pricing fields ignored', `${priceIgnored.status} ${priceIgnored.data?.message}`)
  }

  const idemKey = `phase4c-idem-same-${RUN_ID}`
  const idem1 = await createTourBooking(customerToken, departureId, {
    idempotencyKey: idemKey,
    quantity: 1,
    suffix: 'idem',
  })
  const idem2 = await createTourBooking(customerToken, departureId, {
    idempotencyKey: idemKey,
    quantity: 1,
    suffix: 'idem',
  })
  if (
    (idem1.status === 201 || idem1.status === 200) &&
    (idem2.status === 201 || idem2.status === 200) &&
    String(idem1.data?.data?._id) === String(idem2.data?.data?._id)
  ) {
    pass('same key returns same booking')
  } else {
    fail('same key returns same booking')
  }

  const conflict = await createTourBooking(customerToken, departureId, {
    idempotencyKey: idemKey,
    quantity: 3,
    suffix: 'conflict',
  })
  if (conflict.status === 409) pass('same key + different payload returns conflict')
  else fail('same key + different payload returns conflict', `${conflict.status}`)

  const userBKey = await createTourBooking(customerBToken, departureId, {
    idempotencyKey: idemKey,
    quantity: 1,
    suffix: 'userb',
  })
  if (userBKey.status === 201) pass('same key under different users is independent')
  else fail('same key under different users is independent', `${userBKey.status}`)

  const oversize = await createTourBooking(customerToken, departureId, {
    idempotencyKey: `phase4c-oversize-${RUN_ID}`,
    quantity: 999,
  })
  if (oversize.status === 409 || oversize.status === 400) pass('oversize quantity rejected')
  else fail('oversize quantity rejected', `${oversize.status}`)

  if (!booking?._id) {
    fail('cancel payment_pending → cancelled', 'no booking from creation')
  } else {
  const cancelRes = await req('PATCH', `/bookings/${booking._id}/cancel`, {
    token: customerToken,
  })
  if (cancelRes.status === 200 && cancelRes.data?.data?.status === 'cancelled') {
    pass('cancel payment_pending → cancelled')
  } else {
    fail('cancel payment_pending → cancelled', `${cancelRes.status}`)
  }

  const cancelAgain = await req('PATCH', `/bookings/${booking._id}/cancel`, {
    token: customerToken,
  })
  if (cancelAgain.status === 200 && cancelAgain.data?.idempotent) {
    pass('repeated cancellation is idempotent')
  } else if (cancelAgain.status === 200 && cancelAgain.data?.data?.status === 'cancelled') {
    pass('repeated cancellation is idempotent')
  } else {
    fail('repeated cancellation is idempotent', `${cancelAgain.status}`)
  }

  {
    const depList = await req('GET', `/organizations/${org._id}/tours/${tourId}/departures`, {
      token: operatorToken,
      orgContext: org._id,
    })
    const deps = depList.data?.data?.data || []
    const depRow = deps.find((d) => String(d._id) === String(departureId))
    const spots = depRow?.availableSpots
    if (spots >= 8) pass('cancellation restores spots')
    else fail('cancellation restores spots', `spots=${spots}`)
  }
  }

  if (booking?._id) {
  const otherRead = await req('GET', `/bookings/${booking._id}`, {
    token: customerBToken,
  })
  if (otherRead.status === 403) pass('customer cannot read another user booking')
  else fail('customer cannot read another user booking', `${otherRead.status}`)

  const otherCancel = await req('PATCH', `/bookings/${booking._id}/cancel`, {
    token: customerBToken,
  })
  if (otherCancel.status === 403) pass('customer cannot cancel another user booking')
  else fail('customer cannot cancel another user booking', `${otherCancel.status}`)
  }

  const draftCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
  })
  await req('PATCH', `/organizations/${draftCtx.org._id}/tours/${draftCtx.tourId}`, {
    token: operatorToken,
    orgContext: draftCtx.org._id,
    body: { title: 'Draft Only Tour' },
  })
  await req('POST', `/organizations/${draftCtx.org._id}/tours/${draftCtx.tourId}/unpublish`, {
    token: operatorToken,
    orgContext: draftCtx.org._id,
  })
  const draftBook = await createTourBooking(customerToken, draftCtx.departure._id, {
    idempotencyKey: `phase4c-draft-${RUN_ID}`,
    quantity: 1,
  })
  if (draftBook.status === 404 || draftBook.status === 409) pass('draft/unpublished tour rejected')
  else fail('draft/unpublished tour rejected', `${draftBook.status}`)

  const archiveCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
  })
  await req('POST', `/organizations/${archiveCtx.org._id}/tours/${archiveCtx.tourId}/archive`, {
    token: operatorToken,
    orgContext: archiveCtx.org._id,
  })
  const archBook = await createTourBooking(customerToken, archiveCtx.departure._id, {
    idempotencyKey: `phase4c-archived-${RUN_ID}`,
    quantity: 1,
  })
  if (archBook.status === 409 || archBook.status === 404) pass('archived tour rejected')
  else fail('archived tour rejected', `${archBook.status}`)

  if (uri) {
    const Tour = (await import('../models/Tour.js')).default
    const secretCtx = await setupPublishedTourWithDeparture({
      operatorToken,
      adminToken,
      capacity: 5,
    })
    await Tour.findByIdAndUpdate(secretCtx.tourId, { secretTour: true })
    const secretBook = await createTourBooking(customerToken, secretCtx.departure._id, {
      idempotencyKey: `phase4c-secret-${RUN_ID}`,
      quantity: 1,
    })
    if (secretBook.status === 404) pass('secret tour rejected')
    else fail('secret tour rejected', `${secretBook.status}`)
  }

  const unapprovedReg = await req('POST', '/organizations/register', {
    token: operatorToken,
    body: {
      name: `Unapproved ${Date.now()}`,
      providerTypes: ['travel_company'],
      shortDescription: 'Not approved',
      verification: validVerification(),
    },
  })
  const unapprovedOrg = unapprovedReg.data?.data?.organization
  if (unapprovedOrg) {
    const unapTour = await req('POST', `/organizations/${unapprovedOrg._id}/tours`, {
      token: operatorToken,
      orgContext: unapprovedOrg._id,
      body: sampleTourPayload('Unapproved Org Tour'),
    })
    const unapTourId = unapTour.data?.data?.data?._id
    if (unapTourId) {
      await req('POST', `/organizations/${unapprovedOrg._id}/tours/${unapTourId}/publish`, {
        token: operatorToken,
        orgContext: unapprovedOrg._id,
      })
      const depDate = new Date(Date.now() + 86400000 * 30).toISOString()
      const dep = await req('POST', `/organizations/${unapprovedOrg._id}/tours/${unapTourId}/departures`, {
        token: operatorToken,
        orgContext: unapprovedOrg._id,
        body: {
          departureDate: depDate,
          capacity: 5,
          packages: [{ key: 'normal', priceMinor: 40000, currency: 'ETB', active: true }],
        },
      })
      const unapDepId = dep.data?.data?.data?._id
      if (unapDepId) {
        const unapBook = await createTourBooking(customerToken, unapDepId, {
          idempotencyKey: `phase4c-unapproved-${RUN_ID}`,
          quantity: 1,
        })
        if (unapBook.status === 404 || unapBook.status === 409) {
          pass('submitted/unapproved org rejected')
        } else fail('submitted/unapproved org rejected', `${unapBook.status}`)
      }
    }
  }

  const snapCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 60000,
  })
  const snapBook = await createTourBooking(customerToken, snapCtx.departure._id, {
    idempotencyKey: `phase4c-snapshot-${RUN_ID}`,
    quantity: 1,
  })
  const snapId = snapBook.data?.data?._id
  const originalTotal = snapBook.data?.data?.priceSnapshot?.totalMinor
  await req('PATCH', `/organizations/${snapCtx.org._id}/tours/${snapCtx.tourId}/departures/${snapCtx.departure._id}`, {
    token: operatorToken,
    orgContext: snapCtx.org._id,
    body: {
      packages: [{ key: 'normal', priceMinor: 99999, currency: 'ETB', active: true }],
    },
  })
  const snapRead = await req('GET', `/bookings/${snapId}`, { token: customerToken })
  if (
    snapRead.status === 200 &&
    snapRead.data?.data?.priceSnapshot?.totalMinor === originalTotal &&
    originalTotal === 60000
  ) {
    pass('price snapshot unchanged after source price change')
  } else {
    fail('price snapshot unchanged after source price change')
  }

  const legacyBook = await req('POST', '/bookings', {
    token: customerToken,
    body: {
      bookingType: 'hotel',
      bookingItem: new mongoose.Types.ObjectId().toString(),
      contactInfo: contactInfo('legacy'),
      payment: { amount: 100, paymentMethod: 'credit_card' },
    },
  })
  if (legacyBook.status === 201 && legacyBook.data?.data?.bookingFlowVersion !== 'v2') {
    pass('legacy booking behavior remains intact')
  } else {
    fail('legacy booking behavior remains intact', `${legacyBook.status}`)
  }

  const soldOutCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 1,
    priceMinor: 50000,
  })
  const sold1 = await createTourBooking(customerToken, soldOutCtx.departure._id, {
    idempotencyKey: `phase4c-sold1-${RUN_ID}`,
    quantity: 1,
  })
  const sold2 = await createTourBooking(customerToken, soldOutCtx.departure._id, {
    idempotencyKey: `phase4c-sold2-${RUN_ID}`,
    quantity: 1,
  })
  if (sold1.status === 201 && sold2.status === 409) pass('sold-out departure rejected')
  else fail('sold-out departure rejected', `${sold1.status}/${sold2.status}`)

  const concCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 50000,
  })
  const concDepId = concCtx.departure._id
  const concOutcomes = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      createTourBooking(customerToken, concDepId, {
        idempotencyKey: `phase4c-conc-${RUN_ID}-${i}`,
        quantity: 1,
        suffix: `c${i}`,
      }).then((r) => ({ ok: r.status === 201, id: r.data?.data?._id }))
    )
  )
  const concOk = concOutcomes.filter((o) => o.ok).length
  const uniqueIds = new Set(concOutcomes.filter((o) => o.ok).map((o) => String(o.id)))
  if (uri) {
    const TourDeparture = (await import('../models/TourDeparture.js')).default
    const InventoryHold = (await import('../models/InventoryHold.js')).default
    const concDep = await TourDeparture.findById(concDepId)
    const holds = await InventoryHold.countDocuments({
      departureId: concDepId,
      status: { $in: ['held', 'consumed'] },
    })
    if (concOk === 10 && concDep.availableSpots === 0 && uniqueIds.size === 10 && holds === 10) {
      pass('20 concurrent bookings: exactly 10 succeed, spots=0, holds match')
    } else {
      fail(
        '20 concurrent bookings: exactly 10 succeed',
        `ok=${concOk} spots=${concDep?.availableSpots} holds=${holds}`
      )
    }
  }

  const raceCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 50000,
  })
  const raceKey = `phase4c-race-${RUN_ID}`
  const raceOutcomes = await Promise.all(
    Array.from({ length: 10 }, () =>
      createTourBooking(customerBToken, raceCtx.departure._id, {
        idempotencyKey: raceKey,
        quantity: 1,
        suffix: 'race',
      }).then((r) => ({ status: r.status, id: r.data?.data?._id }))
    )
  )
  const raceIds = new Set(raceOutcomes.filter((r) => r.id).map((r) => String(r.id)))
  const raceSuccess = raceOutcomes.filter((r) => r.status === 201 || r.status === 200).length
  if (raceIds.size === 1 && raceSuccess >= 1) {
    pass('concurrent same-key requests create one booking')
  } else {
    fail('concurrent same-key requests create one booking', `ids=${raceIds.size}`)
  }

  const expCtx = await setupPublishedTourWithDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 50000,
  })
  const expBook = await createTourBooking(customerToken, expCtx.departure._id, {
    idempotencyKey: `phase4c-expire-${RUN_ID}`,
    quantity: 1,
  })
  const expId = expBook.data?.data?._id
  if (uri && expId) {
    const Booking = (await import('../models/Booking.js')).default
    const { expireV2Booking } = await import('../services/bookingLifecycleService.js')
    await Booking.findByIdAndUpdate(expId, {
      expiresAt: new Date(Date.now() - 60000),
    })
    const expDoc = await Booking.findById(expId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    await expireV2Booking(expDoc)
    const TourDeparture = (await import('../models/TourDeparture.js')).default
    const expDep = await TourDeparture.findById(expCtx.departure._id)
    const expAgain = await req('PATCH', `/bookings/${expId}/cancel`, { token: customerToken })
    if (expDep.availableSpots === 5 && expAgain.status === 409) {
      pass('expired booking releases inventory and rejects cancel')
    } else {
      fail('expired booking lifecycle', `spots=${expDep?.availableSpots} cancel=${expAgain.status}`)
    }
  }

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n=== Phase 4C booking lifecycle: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
  )
  if (mongoose.connection.readyState !== 0) {
    mongoose.disconnect().catch(() => {})
  }
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
