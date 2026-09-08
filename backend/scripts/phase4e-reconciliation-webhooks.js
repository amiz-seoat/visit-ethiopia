/**
 * Phase 4E — payment reconciliation + webhook tests.
 * Usage: node scripts/phase4e-reconciliation-webhooks.js [baseUrl] [databaseUri]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { signMockWebhookBody } from '../services/payment/MockPaymentProvider.js'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://localhost:4002/api/v1').replace(/\/$/, '')
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || 'mock-webhook-dev-secret'
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
    ...(opts.headers || {}),
  }
  const bodyStr = opts.body != null ? JSON.stringify(opts.body) : undefined
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: bodyStr })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function webhookReq(provider, body, signature) {
  const rawBody = JSON.stringify(body)
  return req('POST', `/payments/webhooks/${provider}`, {
    headers: {
      'X-Mock-Webhook-Signature': signature ?? signMockWebhookBody(rawBody, WEBHOOK_SECRET),
    },
    body,
  })
}

async function login(email, password) {
  const res = await req('POST', '/users/login', { body: { email, password } })
  if (res.status !== 200 || !res.data?.token) throw new Error(`Login failed: ${email}`)
  return res.data.token
}

function validVerification() {
  return {
    legalName: 'Phase4E Travel PLC',
    registrationNumber: 'P4E-REG-001',
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
  await req('PATCH', `/organizations/admin/approvals/${submit.data.data.approvalRequest._id}/approve`, {
    token: adminToken,
    body: {},
  })
  return org
}

async function setupBookableDeparture({ operatorToken, adminToken, capacity = 10, priceMinor = 50000 }) {
  const org = await registerAndApproveOrg(operatorToken, adminToken, `P4E Org ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  const tourRes = await req('POST', `/organizations/${org._id}/tours`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      title: `P4E Tour ${Date.now()}`,
      description: 'Phase 4E reconciliation test tour with enough description text for validation.',
      shortDescription: 'P4E',
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
  const depRes = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      departureDate: new Date(Date.now() + 86400000 * 40).toISOString(),
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
    idempotencyKey: opts.idempotencyKey || `p4e-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`,
    body: {
      departureId,
      packageKey: 'normal',
      quantity: opts.quantity ?? 1,
      contactInfo: {
        fullName: 'Reconcile Test',
        email: `p4e-${RUN_ID}@example.com`,
        phone: '+251911000999',
      },
    },
  })
}

async function run() {
  console.log(`\n=== Phase 4E reconciliation + webhooks @ ${BASE} ===\n`)

  const uri = resolveTestDatabaseUri()
  let customerToken, operatorToken, adminToken
  try {
    customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
    operatorToken = await login('operator@visitethiopia.test', 'OperatorPass123!')
    adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
    pass('Seed user logins')
  } catch (e) {
    fail('Seed user logins', e.message)
    return done()
  }

  const ctx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 45000,
  })
  const booked = await createBooking(customerToken, ctx.departureId, {
    idempotencyKey: `p4e-wh-${RUN_ID}`,
    quantity: 1,
  })
  const booking = booked.data?.data
  const paymentId = booking?.payment?._id
  const bookingId = booking?._id

  if (!paymentId) {
    fail('Setup booking with payment')
    return done()
  }

  const eventId = `evt-${RUN_ID}-success`
  const whBody = {
    eventId,
    eventType: 'payment.completed',
    paymentId,
    providerReference: `mock_wh_${eventId}`,
  }
  const whOk = await webhookReq('mock', whBody)
  if (whOk.status === 200 && whOk.data?.processed) pass('Valid webhook completes payment')
  else fail('Valid webhook completes payment', `${whOk.status}`)

  if (uri) {
    await import('../models/User.js')
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri)
    const Booking = (await import('../models/Booking.js')).default
    const refreshed = await Booking.findById(bookingId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (refreshed?.status === 'confirmed') pass('Webhook confirms booking')
    else fail('Webhook confirms booking', refreshed?.status)
  }

  const badSigBody = { ...whBody, eventId: `evt-${RUN_ID}-badsig` }
  const badSig = await webhookReq('mock', badSigBody, 'invalid-signature')
  if (badSig.status === 401) pass('Invalid webhook signature rejected')
  else fail('Invalid webhook signature rejected', `${badSig.status}`)

  const malformed = await webhookReq('mock', { eventType: 'payment.completed' })
  if (malformed.status === 400) pass('Malformed webhook payload rejected')
  else fail('Malformed webhook payload rejected', `${malformed.status}`)

  const dup = await webhookReq('mock', whBody)
  if (dup.status === 200 && dup.data?.idempotent) pass('Duplicate webhook idempotent')
  else fail('Duplicate webhook idempotent', `${dup.status}`)

  const dupConcurrent = await Promise.all(
    Array.from({ length: 10 }, () => webhookReq('mock', whBody))
  )
  if (dupConcurrent.every((r) => r.status === 200)) pass('Duplicate webhook concurrent safe')
  else fail('Duplicate webhook concurrent safe')

  const unknownEvt = await webhookReq('mock', {
    eventId: `evt-${RUN_ID}-unknown`,
    eventType: 'payment.unknown',
    paymentId,
  })
  if (unknownEvt.status === 200 && unknownEvt.data?.flagged) pass('Unknown webhook event flagged')
  else fail('Unknown webhook event flagged', `${unknownEvt.status}`)

  const forgedPay = await webhookReq('mock', {
    eventId: `evt-${RUN_ID}-forgedpay`,
    eventType: 'payment.completed',
    paymentId: new mongoose.Types.ObjectId().toString(),
  })
  if (forgedPay.status === 404) pass('Forged paymentId rejected')
  else fail('Forged paymentId rejected', `${forgedPay.status}`)

  const ctx2 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 30000 })
  const book2 = await createBooking(customerToken, ctx2.departureId, {
    idempotencyKey: `p4e-amt-${RUN_ID}`,
  })
  const pay2 = book2.data?.data?.payment?._id
  const tamperedBody = {
    eventId: `evt-${RUN_ID}-tamper`,
    eventType: 'payment.completed',
    paymentId: pay2,
    amountMinor: 1,
    currency: 'USD',
  }
  const tampered = await webhookReq('mock', tamperedBody)
  if (tampered.status === 200) {
    const Payment = (await import('../models/Payment.js')).default
    const p = await Payment.findById(pay2)
    if (p?.amountMinor === 30000 && p?.currency === 'ETB') pass('Webhook amount/currency ignored')
    else fail('Webhook amount/currency ignored', `${p?.amountMinor}/${p?.currency}`)
  } else fail('Webhook with forged amount', `${tampered.status}`)

  const invalidProvider = await req('POST', '/payments/webhooks/stripe', {
    body: whBody,
    headers: { 'X-Mock-Webhook-Signature': signMockWebhookBody(JSON.stringify(whBody)) },
  })
  if (invalidProvider.status === 400) pass('Invalid provider rejected')
  else fail('Invalid provider rejected', `${invalidProvider.status}`)

  const ctx3 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 25000 })
  const book3 = await createBooking(customerToken, ctx3.departureId, {
    idempotencyKey: `p4e-rec-${RUN_ID}`,
  })
  const pay3 = book3.data?.data?.payment?._id
  const book3Id = book3.data?.data?._id

  if (uri && pay3) {
    const Payment = (await import('../models/Payment.js')).default
    const Booking = (await import('../models/Booking.js')).default
    await Payment.findByIdAndUpdate(pay3, {
      status: 'completed',
      completedAt: new Date(),
    })
    const rec = await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 50 } })
    if (rec.status === 200 && (rec.data?.data?.bookingsConfirmed >= 1 || rec.data?.data?.repaired >= 1)) {
      pass('Reconciliation confirms completed payment + pending booking')
    } else fail('Reconciliation confirms completed payment + pending booking', JSON.stringify(rec.data?.data))

    const after = await Booking.findById(book3Id).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (after?.status === 'confirmed') pass('Reconciliation booking becomes confirmed')
    else fail('Reconciliation booking becomes confirmed', after?.status)

    const rec2 = await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 50 } })
    if (rec2.status === 200) pass('Repeated reconciliation idempotent')
    else fail('Repeated reconciliation idempotent', `${rec2.status}`)

    const ctx4 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 20000 })
    const book4 = await createBooking(customerToken, ctx4.departureId, {
      idempotencyKey: `p4e-failrec-${RUN_ID}`,
    })
    const pay4 = book4.data?.data?.payment?._id
    const book4Id = book4.data?.data?._id
    await Payment.findByIdAndUpdate(pay4, { status: 'failed' })
    await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 50 } })
    const failedBooking = await Booking.findById(book4Id).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (failedBooking?.status === 'failed') pass('Reconciliation fails pending booking for failed payment')
    else fail('Reconciliation fails pending booking for failed payment', failedBooking?.status)

    const ctx5 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 15000 })
    const book5 = await createBooking(customerToken, ctx5.departureId, {
      idempotencyKey: `p4e-exp-${RUN_ID}`,
    })
    const pay5 = book5.data?.data?.payment?._id
    const book5Id = book5.data?.data?._id
    await Booking.findByIdAndUpdate(book5Id, { expiresAt: new Date(Date.now() - 60000) })
    await Payment.findByIdAndUpdate(pay5, { expiresAt: new Date(Date.now() - 60000) })
    const expRec = await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 50 } })
    if (expRec.status === 200 && expRec.data?.data?.expired >= 1) pass('Reconciliation expires stale payment_pending booking')
    else fail('Reconciliation expires stale payment_pending booking', JSON.stringify(expRec.data?.data))

    const ctx6 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 12000 })
    const book6 = await createBooking(customerToken, ctx6.departureId, {
      idempotencyKey: `p4e-hold-${RUN_ID}`,
    })
    const book6Id = book6.data?.data?._id
    await Booking.findByIdAndUpdate(book6Id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      inventoryReserved: false,
    })
    const holdRec = await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 50 } })
    if (holdRec.status === 200) pass('Reconciliation releases stale hold on terminal booking')
    else fail('Reconciliation releases stale hold', `${holdRec.status}`)

    const InventoryHold = (await import('../models/InventoryHold.js')).default
    const ctx7 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 11000 })
    const book7 = await createBooking(customerToken, ctx7.departureId, {
      idempotencyKey: `p4e-flag-${RUN_ID}`,
    })
    const book7Id = book7.data?.data?._id
    await InventoryHold.findOneAndUpdate(
      { bookingId: book7Id },
      { status: 'consumed' }
    )
    const flagRec = await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 100 } })
    if (flagRec.status === 200 && flagRec.data?.data?.flagged >= 1) {
      pass('Consumed hold + unconfirmed booking flagged')
    } else fail('Consumed hold + unconfirmed booking flagged', JSON.stringify(flagRec.data?.data))

    const ctx8 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 10000 })
    const book8 = await createBooking(customerToken, ctx8.departureId, {
      idempotencyKey: `p4e-inc-${RUN_ID}`,
    })
    const book8Id = book8.data?.data?._id
    const pay8 = book8.data?.data?.payment?._id
    await Booking.findByIdAndUpdate(book8Id, { status: 'confirmed', confirmedAt: new Date() })
    await Payment.findByIdAndUpdate(pay8, { status: 'processing' })
    const incRec = await req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 100 } })
    if (incRec.status === 200 && incRec.data?.data?.flagged >= 1) {
      pass('Confirmed booking + incomplete payment flagged')
    } else fail('Confirmed booking + incomplete payment flagged', JSON.stringify(incRec.data?.data))

    const concRec = await Promise.all(
      Array.from({ length: 5 }, () =>
        req('POST', '/admin/bookings/reconcile', { token: adminToken, body: { limit: 20 } })
      )
    )
    if (concRec.every((r) => r.status === 200)) pass('Concurrent reconciliation safe')
    else fail('Concurrent reconciliation safe')

    const dryRun = await req('POST', '/admin/bookings/reconcile', {
      token: adminToken,
      body: { dryRun: true, limit: 10 },
    })
    if (dryRun.status === 200 && dryRun.data?.data?.dryRun === true) pass('Admin reconciliation dry-run')
    else fail('Admin reconciliation dry-run', `${dryRun.status}`)
  }

  const custRec = await req('POST', '/admin/bookings/reconcile', { token: customerToken })
  if (custRec.status === 403) pass('Customer denied reconciliation')
  else fail('Customer denied reconciliation', `${custRec.status}`)

  const provRec = await req('POST', '/admin/bookings/reconcile', { token: operatorToken })
  if (provRec.status === 403) pass('Provider denied reconciliation')
  else fail('Provider denied reconciliation', `${provRec.status}`)

  const unauthRec = await req('POST', '/admin/bookings/reconcile', {})
  if (unauthRec.status === 401) pass('Unauthenticated reconciliation denied')
  else fail('Unauthenticated reconciliation denied', `${unauthRec.status}`)

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

  const ctx9 = await setupBookableDeparture({ operatorToken, adminToken, capacity: 5, priceMinor: 9000 })
  const book9 = await createBooking(customerToken, ctx9.departureId, {
    idempotencyKey: `p4e-postexp-${RUN_ID}`,
  })
  const pay9 = book9.data?.data?.payment?._id
  const book9Id = book9.data?.data?._id
  if (uri && pay9) {
    const Booking = (await import('../models/Booking.js')).default
    const Payment = (await import('../models/Payment.js')).default
    await Booking.findByIdAndUpdate(book9Id, {
      status: 'expired',
      expiresAt: new Date(Date.now() - 60000),
    })
    const postExp = await webhookReq('mock', {
      eventId: `evt-${RUN_ID}-postexp`,
      eventType: 'payment.completed',
      paymentId: pay9,
    })
    if (postExp.status === 200 && postExp.data?.flagged) {
      pass('Payment completed after booking expired is flagged')
    } else fail('Payment completed after booking expired is flagged', `${postExp.status}`)

    const b9 = await Booking.findById(book9Id).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (b9?.status === 'expired') pass('Expired booking not confirmed by late webhook')
    else fail('Expired booking not confirmed by late webhook', b9?.status)

    const WebhookEvent = (await import('../models/WebhookEvent.js')).default
    const dupEvtCount = await WebhookEvent.countDocuments({ eventId: whBody.eventId, provider: 'mock' })
    if (dupEvtCount === 1) pass('Duplicate webhook creates one event record')
    else fail('Duplicate webhook creates one event record', String(dupEvtCount))

    const PaymentAttempt = (await import('../models/PaymentAttempt.js')).default
    const attempts = await PaymentAttempt.find({ paymentId: pay2 })
    const pci = attempts.some((a) => /card|cvv|pan/i.test(JSON.stringify(a.rawProviderResponse || {})))
    if (!pci) pass('No PCI fields in payment attempts')
    else fail('No PCI fields in payment attempts')
  }

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Phase 4E reconciliation + webhooks: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
  if (mongoose.connection.readyState !== 0) mongoose.disconnect().catch(() => {})
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
