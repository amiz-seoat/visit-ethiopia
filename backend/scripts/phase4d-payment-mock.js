/**
 * Phase 4D — mock payment + confirmation tests.
 * Usage: node scripts/phase4d-payment-mock.js [baseUrl] [databaseUri]
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
  if (fs.existsSync(memoryUriFile)) return fs.readFileSync(memoryUriFile, 'utf8').trim()
  return process.env.DATABASE
}

async function req(method, path, opts = {}) {
  const h = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    ...(opts.orgContext ? { 'X-Org-Context': String(opts.orgContext) } : {}),
    ...(opts.mockOutcome ? { 'X-Mock-Payment-Outcome': opts.mockOutcome } : {}),
    ...(opts.headers || {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function login(email, password) {
  const res = await req('POST', '/users/login', { body: { email, password } })
  if (res.status !== 200 || !res.data?.token) throw new Error(`Login failed: ${email}`)
  return res.data.token
}

function validVerification() {
  return {
    legalName: 'Phase4D Travel PLC',
    registrationNumber: 'P4D-REG-001',
    responsiblePerson: {
      name: 'Operator',
      phone: '+251911000001',
      email: 'operator@visitethiopia.test',
    },
    businessDocuments: [
      { type: 'business_license', url: 'https://example.com/license.pdf', status: 'pending' },
    ],
  }
}

async function registerAndApproveOrg(token, adminToken, name) {
  const reg = await req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes: ['travel_company'],
      shortDescription: 'Approved',
      verification: validVerification(),
    },
  })
  const org = reg.data?.data?.organization
  if (!org?._id) throw new Error('Org register failed')
  const versionId = reg.data.data.draftVersion._id
  await req('PATCH', `/organizations/${org._id}/draft`, {
    token,
    orgContext: org._id,
    body: { shortDescription: 'Public', verification: validVerification() },
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

async function setupBookableDeparture({ operatorToken, adminToken, capacity = 10, priceMinor = 50000 }) {
  const org = await registerAndApproveOrg(operatorToken, adminToken, `P4D Org ${Date.now()}`)
  const tourRes = await req('POST', `/organizations/${org._id}/tours`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      title: `P4D Tour ${Date.now()}`,
      description: 'Phase 4D payment test tour with enough description text for validation.',
      shortDescription: 'P4D',
      duration: { days: 3, nights: 2 },
      destinations: ['Addis'],
      difficulty: 'easy',
      price: 500,
      coverImage: 'https://example.com/img.jpg',
      maxGroupSize: 12,
      itinerary: [{ day: 1, title: 'Day 1', description: 'Start' }],
    },
  })
  const tourId = tourRes.data?.data?.data?._id
  await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operatorToken,
    orgContext: org._id,
  })
  const depDate = new Date(Date.now() + 86400000 * 40).toISOString()
  const depRes = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      departureDate: depDate,
      capacity,
      availableSpots: capacity,
      packages: [{ key: 'normal', priceMinor, currency: 'ETB', active: true }],
    },
  })
  return {
    org,
    tourId,
    departureId: depRes.data?.data?.data?._id,
    priceMinor,
  }
}

async function createBooking(token, departureId, opts = {}) {
  return req('POST', '/bookings/tours', {
    token,
    idempotencyKey: opts.idempotencyKey || `p4d-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`,
    body: {
      departureId,
      packageKey: 'normal',
      quantity: opts.quantity ?? 2,
      contactInfo: {
        fullName: 'Pay Test',
        email: `pay-${RUN_ID}@example.com`,
        phone: '+251911000999',
      },
    },
  })
}

async function run() {
  console.log(`\n=== Phase 4D payment mock @ ${BASE} ===\n`)

  let customerToken, customerBToken, operatorToken, adminToken
  try {
    customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
    operatorToken = await login('operator@visitethiopia.test', 'OperatorPass123!')
    adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
    pass('Seed user logins')
  } catch (e) {
    fail('Seed user logins', e.message)
    return done()
  }

  const signupEmail = `p4d-b-${RUN_ID}@example.com`
  await req('POST', '/users/signup', {
    body: {
      FirstName: 'B',
      LastName: 'User',
      email: signupEmail,
      password: 'CustomerBPass123!',
      passwordConfirm: 'CustomerBPass123!',
    },
  })
  customerBToken = await login(signupEmail, 'CustomerBPass123!')

  const ctx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 50000,
  })

  const booked = await createBooking(customerToken, ctx.departureId, {
    idempotencyKey: `p4d-book-${RUN_ID}`,
    quantity: 2,
  })
  const booking = booked.data?.data
  const payment = booking?.payment
  const paymentId = payment?._id

  if (booked.status === 201 && payment && paymentId) pass('Payment created for valid v2 booking')
  else fail('Payment created for valid v2 booking', `${booked.status}`)

  if (payment?.amountMinor === 100000) pass('Correct server-side amount')
  else fail('Correct server-side amount', String(payment?.amountMinor))

  if (payment?.currency === 'ETB') pass('Correct server-side currency')
  else fail('Correct server-side currency', payment?.currency)

  if (String(payment?.bookingId) === String(booking?._id)) pass('Payment linked to correct booking')
  else fail('Payment linked to correct booking')

  if (String(payment?.organizationId) === String(booking?.organizationId)) {
    pass('Payment linked to correct organization')
  } else fail('Payment linked to correct organization')

  const getPay = await req('GET', `/payments/${paymentId}`, { token: customerToken })
  if (getPay.status === 200 && getPay.data?.data?.payment?._id === paymentId) {
    pass('Owner can GET own payment')
  } else fail('Owner can GET own payment', `${getPay.status}`)

  const forged = await req('POST', `/payments/${paymentId}/confirm`, {
    token: customerToken,
    body: {
      amount: 1,
      amountMinor: 1,
      currency: 'USD',
      status: 'completed',
      provider: 'stripe',
      bookingId: new mongoose.Types.ObjectId().toString(),
    },
  })
  if (forged.status === 400) pass('Forged payment fields rejected on confirm')
  else fail('Forged payment fields rejected', `${forged.status}`)

  const confirm1 = await req('POST', `/payments/${paymentId}/confirm`, { token: customerToken })
  if (confirm1.status === 200 && confirm1.data?.data?.payment?.status === 'completed') {
    pass('Owner can confirm payment')
    pass('Successful confirmation')
  } else fail('Owner can confirm payment', `${confirm1.status}`)

  if (confirm1.data?.data?.booking?.status === 'confirmed') pass('Booking becomes confirmed')
  else fail('Booking becomes confirmed')

  const uri = resolveTestDatabaseUri()
  if (uri) {
    await import('../models/User.js')
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri)
    const InventoryHold = (await import('../models/InventoryHold.js')).default
    const hold = await InventoryHold.findOne({ bookingId: booking._id })
    if (hold?.status === 'consumed') pass('Inventory hold becomes consumed')
    else fail('Inventory hold becomes consumed', hold?.status)
  }

  const depList = await req('GET', `/organizations/${ctx.org._id}/tours/${ctx.tourId}/departures`, {
    token: operatorToken,
    orgContext: ctx.org._id,
  })
  const depRow = (depList.data?.data?.data || []).find(
    (d) => String(d._id) === String(ctx.departureId)
  )
  if (depRow?.availableSpots === 8) pass('Available spots remain decremented after confirm')
  else fail('Available spots remain decremented', `spots=${depRow?.availableSpots}`)

  const confirmDup = await req('POST', `/payments/${paymentId}/confirm`, { token: customerToken })
  if (confirmDup.status === 200 && confirmDup.data?.idempotent) pass('Duplicate confirmation idempotent')
  else fail('Duplicate confirmation idempotent')

  if (confirmDup.data?.data?.payment?.status === 'completed') {
    pass('Duplicate confirmation does not change completed payment')
  } else fail('Duplicate confirmation payment state')

  const otherConfirm = await req('POST', `/payments/${paymentId}/confirm`, {
    token: customerBToken,
  })
  if (otherConfirm.status === 404 || otherConfirm.status === 403) {
    pass('Other user cannot confirm payment')
  } else fail('Other user cannot confirm payment', `${otherConfirm.status}`)

  const otherGet = await req('GET', `/payments/${paymentId}`, { token: customerBToken })
  if (otherGet.status === 404 || otherGet.status === 403) pass('Other user cannot access payment')
  else fail('Other user cannot access payment', `${otherGet.status}`)

  const unauth = await req('POST', `/payments/${paymentId}/confirm`, {})
  if (unauth.status === 401) pass('Unauthenticated confirm rejected')
  else fail('Unauthenticated confirm rejected', `${unauth.status}`)

  const failCtx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 40000,
  })
  const failBook = await createBooking(customerToken, failCtx.departureId, {
    quantity: 1,
    idempotencyKey: `p4d-fail-${RUN_ID}`,
  })
  const failPaymentId = failBook.data?.data?.payment?._id
  const failConfirm = await req('POST', `/payments/${failPaymentId}/confirm`, {
    token: customerToken,
    mockOutcome: 'fail',
  })
  if (failConfirm.status === 200 && failConfirm.data?.failed) pass('Payment failure path')
  else fail('Payment failure path', `${failConfirm.status}`)

  if (failConfirm.data?.data?.booking?.status === 'failed') pass('Failed payment marks booking failed')
  else fail('Failed payment marks booking failed')

  const failRetry = await req('POST', `/payments/${failPaymentId}/confirm`, {
    token: customerToken,
    mockOutcome: 'success',
  })
  if (failRetry.status === 409) pass('Failed payment cannot be re-confirmed')
  else fail('Failed payment cannot be re-confirmed', `${failRetry.status}`)

  const failDepList = await req('GET', `/organizations/${failCtx.org._id}/tours/${failCtx.tourId}/departures`, {
    token: operatorToken,
    orgContext: failCtx.org._id,
  })
  const failDep = (failDepList.data?.data?.data || []).find(
    (d) => String(d._id) === String(failCtx.departureId)
  )
  if (failDep?.availableSpots === 5) pass('Failed payment releases inventory once')
  else fail('Failed payment releases inventory once', `spots=${failDep?.availableSpots}`)

  const failAgain = await req('POST', `/payments/${failPaymentId}/confirm`, {
    token: customerToken,
    mockOutcome: 'fail',
  })
  if (failAgain.status === 409) pass('Duplicate failure does not release twice')
  else fail('Duplicate failure handling', `${failAgain.status}`)

  const expCtx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 30000,
  })
  const expBook = await createBooking(customerToken, expCtx.departureId, {
    quantity: 1,
    idempotencyKey: `p4d-exp-${RUN_ID}`,
  })
  const expPaymentId = expBook.data?.data?.payment?._id
  const expBookingId = expBook.data?.data?._id
  if (uri && expBookingId) {
    const Booking = (await import('../models/Booking.js')).default
    const { expireV2Booking } = await import('../services/bookingLifecycleService.js')
    await Booking.findByIdAndUpdate(expBookingId, {
      expiresAt: new Date(Date.now() - 60000),
    })
    const expDoc = await Booking.findById(expBookingId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    await expireV2Booking(expDoc)
    const expPay = await req('POST', `/payments/${expPaymentId}/confirm`, {
      token: customerToken,
    })
    if (expPay.status === 409) pass('Expired booking cannot be paid')
    else fail('Expired booking cannot be paid', `${expPay.status}`)
  }

  const cancelCtx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 25000,
  })
  const cancelBook = await createBooking(customerToken, cancelCtx.departureId, {
    quantity: 1,
    idempotencyKey: `p4d-cancel-${RUN_ID}`,
  })
  const cancelPaymentId = cancelBook.data?.data?.payment?._id
  const cancelBookingId = cancelBook.data?.data?._id
  await req('PATCH', `/bookings/${cancelBookingId}/cancel`, { token: customerToken })
  const cancelPay = await req('POST', `/payments/${cancelPaymentId}/confirm`, {
    token: customerToken,
  })
  if (cancelPay.status === 409) pass('Cancelled booking cannot be paid')
  else fail('Cancelled booking cannot be paid', `${cancelPay.status}`)

  const legacy = await req('POST', '/bookings', {
    token: customerToken,
    body: {
      bookingType: 'hotel',
      bookingItem: new mongoose.Types.ObjectId().toString(),
      contactInfo: { fullName: 'Legacy', email: 'legacy@test.com', phone: '+251911000001' },
      payment: { amount: 100, paymentMethod: 'credit_card' },
    },
  })
  if (legacy.status === 201 && legacy.data?.data?.bookingFlowVersion !== 'v2') {
    pass('Legacy booking isolation')
  } else fail('Legacy booking isolation')

  const badId = await req('POST', '/payments/not-an-id/confirm', { token: customerToken })
  if (badId.status === 404) pass('Malformed payment ID rejected')
  else fail('Malformed payment ID rejected', `${badId.status}`)

  const concCtx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 20000,
  })
  const concBook = await createBooking(customerToken, concCtx.departureId, {
    quantity: 1,
    idempotencyKey: `p4d-conc-${RUN_ID}`,
  })
  const concPaymentId = concBook.data?.data?.payment?._id
  const concOutcomes = await Promise.all(
    Array.from({ length: 8 }, () =>
      req('POST', `/payments/${concPaymentId}/confirm`, { token: customerToken })
    )
  )
  const concOk = concOutcomes.filter(
    (r) => r.status === 200 && r.data?.data?.payment?.status === 'completed'
  ).length
  if (concOk >= 1 && concOutcomes.every((r) => r.status === 200 || r.status === 409)) {
    pass('Concurrent confirmation requests safe')
  } else fail('Concurrent confirmation requests', `ok=${concOk}`)

  if (uri && concPaymentId) {
    const PaymentAttempt = (await import('../models/PaymentAttempt.js')).default
    const attempts = await PaymentAttempt.find({ paymentId: concPaymentId }).sort('attemptNumber')
    if (attempts.length >= 1) pass('Attempt tracking recorded')
    else fail('Attempt tracking recorded')
    const nums = attempts.map((a) => a.attemptNumber)
    if (new Set(nums).size === nums.length) pass('Attempt numbers unique')
    else fail('Attempt numbers unique')

    const pciPattern = /(\d{13,19}|cvv|cvc|pan|cardNumber)/i
    const hasPci = attempts.some((a) => {
      const raw = JSON.stringify(a.rawProviderResponse || {})
      return pciPattern.test(raw)
    })
    if (!hasPci) pass('No PCI fields stored in attempts')
    else fail('No PCI fields stored in attempts')
  }

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Phase 4D payment mock: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
  if (mongoose.connection.readyState !== 0) mongoose.disconnect().catch(() => {})
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
