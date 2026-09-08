/**
 * Phase 4F — refunds + paid cancellation tests.
 * Usage: node scripts/phase4f-refunds.js [baseUrl] [databaseUri]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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

async function req(method, pathName, opts = {}) {
  const h = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    ...(opts.orgContext ? { 'X-Org-Context': String(opts.orgContext) } : {}),
    ...(opts.mockRefundOutcome
      ? { 'X-Mock-Refund-Outcome': opts.mockRefundOutcome }
      : {}),
    ...(opts.headers || {}),
  }
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: h,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function webhookReq(provider, body, signature) {
  const rawBody = JSON.stringify(body)
  return req('POST', `/payments/webhooks/${provider}`, {
    headers: {
      'X-Mock-Webhook-Signature':
        signature ?? signMockWebhookBody(rawBody, WEBHOOK_SECRET),
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
    legalName: 'Phase4F Travel PLC',
    registrationNumber: 'P4F-REG-001',
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

async function setupBookableDeparture({
  operatorToken,
  adminToken,
  capacity = 10,
  priceMinor = 50000,
  daysUntilDeparture = 40,
}) {
  const org = await registerAndApproveOrg(
    operatorToken,
    adminToken,
    `P4F Org ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  )
  const tourRes = await req('POST', `/organizations/${org._id}/tours`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      title: `P4F Tour ${Date.now()}`,
      description: 'Phase 4F refund test tour with enough description text for validation.',
      shortDescription: 'P4F',
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
      departureDate: new Date(Date.now() + 86400000 * daysUntilDeparture).toISOString(),
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
    idempotencyKey: opts.idempotencyKey || `p4f-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`,
    body: {
      departureId,
      packageKey: 'normal',
      quantity: opts.quantity ?? 1,
      contactInfo: {
        fullName: 'Refund Test',
        email: `p4f-${RUN_ID}@example.com`,
        phone: '+251911000999',
      },
    },
  })
}

async function bookAndConfirm(customerToken, ctx, key) {
  const booked = await createBooking(customerToken, ctx.departureId, {
    idempotencyKey: key,
    quantity: 1,
  })
  const paymentId = booked.data?.data?.payment?._id
  const bookingId = booked.data?.data?._id
  const confirm = await req('POST', `/payments/${paymentId}/confirm`, {
    token: customerToken,
  })
  return {
    booked,
    confirm,
    paymentId,
    bookingId,
    amountMinor: booked.data?.data?.payment?.amountMinor,
  }
}

async function run() {
  console.log(`\n=== Phase 4F refunds + paid cancellation @ ${BASE} ===\n`)

  const uri = resolveTestDatabaseUri()
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

  const signupEmail = `p4f-b-${RUN_ID}@example.com`
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

  if (uri) {
    await import('../models/User.js')
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri)
  }

  // --- Unpaid / failed cannot refund ---
  const ctxUnpaid = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 40000,
  })
  const unpaid = await createBooking(customerToken, ctxUnpaid.departureId, {
    idempotencyKey: `p4f-unpaid-${RUN_ID}`,
  })
  const unpaidPay = unpaid.data?.data?.payment?._id
  const unpaidBook = unpaid.data?.data?._id
  const unpaidRefund = await req('POST', `/payments/${unpaidPay}/refund`, {
    token: customerToken,
    idempotencyKey: `p4f-unref-${RUN_ID}`,
  })
  if (unpaidRefund.status === 409) pass('Unpaid booking cannot refund')
  else fail('Unpaid booking cannot refund', `${unpaidRefund.status}`)

  const failCtx = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 35000,
  })
  const failBook = await createBooking(customerToken, failCtx.departureId, {
    idempotencyKey: `p4f-failpay-${RUN_ID}`,
  })
  const failPay = failBook.data?.data?.payment?._id
  await req('POST', `/payments/${failPay}/confirm`, {
    token: customerToken,
    headers: { 'X-Mock-Payment-Outcome': 'fail' },
  })
  const failRefund = await req('POST', `/payments/${failPay}/refund`, {
    token: customerToken,
    idempotencyKey: `p4f-failref-${RUN_ID}`,
  })
  if (failRefund.status === 409) pass('Failed payment cannot refund')
  else fail('Failed payment cannot refund', `${failRefund.status}`)

  // --- Happy path full refund cancel ---
  const ctxOk = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 8,
    priceMinor: 50000,
    daysUntilDeparture: 40,
  })
  const paid = await bookAndConfirm(customerToken, ctxOk, `p4f-ok-${RUN_ID}`)
  if (paid.confirm.status === 200 && paid.confirm.data?.data?.booking?.status === 'confirmed') {
    pass('Confirmed paid booking can refund')
  } else fail('Confirmed paid booking setup', `${paid.confirm.status}`)

  const forgedCancel = await req('PATCH', `/bookings/${paid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-forge-${RUN_ID}`,
    body: {
      amount: 1,
      amountMinor: 1,
      refundAmount: 1,
      currency: 'USD',
      status: 'completed',
      provider: 'stripe',
      paymentId: new mongoose.Types.ObjectId().toString(),
      bookingId: new mongoose.Types.ObjectId().toString(),
    },
  })
  if (forgedCancel.status === 400) pass('Forged refund fields rejected')
  else fail('Forged refund fields rejected', `${forgedCancel.status}`)

  const cancelOk = await req('PATCH', `/bookings/${paid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-cancel-${RUN_ID}`,
  })
  if (
    cancelOk.status === 200 &&
    cancelOk.data?.data?.status === 'cancelled' &&
    cancelOk.data?.refund?.status === 'completed'
  ) {
    pass('Owner cancels confirmed booking with refund')
  } else fail('Owner cancels confirmed booking with refund', `${cancelOk.status}`)

  if (cancelOk.data?.payment?.status === 'refunded') pass('Payment → refunded')
  else fail('Payment → refunded', cancelOk.data?.payment?.status)

  if (cancelOk.data?.payment?.amountRefundedMinor === paid.amountMinor) {
    pass('refundedAmountMinor correct')
  } else fail('refundedAmountMinor correct', String(cancelOk.data?.payment?.amountRefundedMinor))

  if (uri) {
    const InventoryHold = (await import('../models/InventoryHold.js')).default
    const hold = await InventoryHold.findOne({ bookingId: paid.bookingId })
    if (hold?.status === 'released') pass('Consumed hold restored exactly once')
    else fail('Consumed hold restored exactly once', hold?.status)
  }

  const depList = await req('GET', `/organizations/${ctxOk.org._id}/tours/${ctxOk.tourId}/departures`, {
    token: operatorToken,
    orgContext: ctxOk.org._id,
  })
  const depRow = (depList.data?.data?.data || []).find(
    (d) => String(d._id) === String(ctxOk.departureId)
  )
  if (depRow?.availableSpots === 8) pass('Inventory spots restored after refund')
  else fail('Inventory spots restored after refund', `spots=${depRow?.availableSpots}`)

  const cancelDup = await req('PATCH', `/bookings/${paid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-cancel-${RUN_ID}`,
  })
  if (cancelDup.status === 200 && cancelDup.data?.idempotent) {
    pass('Duplicate cancellation idempotent')
  } else fail('Duplicate cancellation idempotent', `${cancelDup.status}`)

  const refundAgain = await req('POST', `/payments/${paid.paymentId}/refund`, {
    token: customerToken,
    idempotencyKey: `p4f-again-${RUN_ID}`,
  })
  if (refundAgain.status === 409) pass('Already refunded cannot refund again')
  else fail('Already refunded cannot refund again', `${refundAgain.status}`)

  // --- Auth ---
  const ctxAuth = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 22000,
  })
  const authPaid = await bookAndConfirm(customerToken, ctxAuth, `p4f-auth-${RUN_ID}`)
  const otherCancel = await req('PATCH', `/bookings/${authPaid.bookingId}/cancel`, {
    token: customerBToken,
    idempotencyKey: `p4f-other-${RUN_ID}`,
  })
  if (otherCancel.status === 404 || otherCancel.status === 403) {
    pass('Other user denied refund cancel')
  } else fail('Other user denied refund cancel', `${otherCancel.status}`)

  const unauthCancel = await req('PATCH', `/bookings/${authPaid.bookingId}/cancel`, {
    idempotencyKey: `p4f-unauth-${RUN_ID}`,
  })
  if (unauthCancel.status === 401) pass('Unauthenticated cancel denied')
  else fail('Unauthenticated cancel denied', `${unauthCancel.status}`)

  const adminCancel = await req('PATCH', `/bookings/${authPaid.bookingId}/cancel`, {
    token: adminToken,
    idempotencyKey: `p4f-admin-${RUN_ID}`,
  })
  if (adminCancel.status === 200 && adminCancel.data?.data?.status === 'cancelled') {
    pass('Admin can cancel/refund confirmed booking')
  } else fail('Admin can cancel/refund confirmed booking', `${adminCancel.status}`)

  // --- Provider cannot refund another's booking ---
  const ctxProv = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 21000,
  })
  const provPaid = await bookAndConfirm(customerToken, ctxProv, `p4f-prov-${RUN_ID}`)
  const provCancel = await req('PATCH', `/bookings/${provPaid.bookingId}/cancel`, {
    token: operatorToken,
    idempotencyKey: `p4f-provdeny-${RUN_ID}`,
  })
  if (provCancel.status === 404 || provCancel.status === 403) {
    pass('Provider denied customer refund')
  } else fail('Provider denied customer refund', `${provCancel.status}`)

  // --- Cutoff non-refundable ---
  const ctxNear = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 18000,
    daysUntilDeparture: 1,
  })
  const nearPaid = await bookAndConfirm(customerToken, ctxNear, `p4f-near-${RUN_ID}`)
  const nearCancel = await req('PATCH', `/bookings/${nearPaid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-near-c-${RUN_ID}`,
  })
  if (nearCancel.status === 409) pass('Inside cutoff non-refundable for customer')
  else fail('Inside cutoff non-refundable for customer', `${nearCancel.status}`)

  const nearAdmin = await req('PATCH', `/bookings/${nearPaid.bookingId}/cancel`, {
    token: adminToken,
    idempotencyKey: `p4f-near-a-${RUN_ID}`,
  })
  if (nearAdmin.status === 200 && nearAdmin.data?.data?.status === 'cancelled') {
    pass('Admin can override inside-cutoff cancellation')
  } else fail('Admin can override inside-cutoff cancellation', `${nearAdmin.status}`)

  // --- Failed refund does not restore inventory ---
  const ctxFailRef = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 17000,
  })
  const failRefPaid = await bookAndConfirm(customerToken, ctxFailRef, `p4f-fr-${RUN_ID}`)
  const failRef = await req('PATCH', `/bookings/${failRefPaid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-fr-c-${RUN_ID}`,
    mockRefundOutcome: 'fail',
  })
  if (failRef.status === 200 && failRef.data?.failed && failRef.data?.refund?.status === 'failed') {
    pass('Mock refund failure path')
  } else fail('Mock refund failure path', `${failRef.status}`)

  if (failRef.data?.data?.status === 'confirmed') pass('Failed refund keeps booking confirmed')
  else fail('Failed refund keeps booking confirmed', failRef.data?.data?.status)

  if (uri) {
    const InventoryHold = (await import('../models/InventoryHold.js')).default
    const hold = await InventoryHold.findOne({ bookingId: failRefPaid.bookingId })
    if (hold?.status === 'consumed') pass('Failed refund does not restore inventory')
    else fail('Failed refund does not restore inventory', hold?.status)
  }

  const failRetry = await req('PATCH', `/bookings/${failRefPaid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-fr-c-${RUN_ID}`,
  })
  if (failRetry.status === 200 && failRetry.data?.data?.status === 'cancelled') {
    pass('Failed refund retry with same key can succeed')
  } else fail('Failed refund retry with same key can succeed', `${failRetry.status}`)

  // --- Idempotency key conflicts ---
  const ctxIdem = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 16000,
  })
  const idemPaid = await bookAndConfirm(customerToken, ctxIdem, `p4f-idem-${RUN_ID}`)
  const idem1 = await req('PATCH', `/bookings/${idemPaid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-idem-key-${RUN_ID}`,
  })
  if (idem1.status === 200) pass('Same key same payload succeeds')
  else fail('Same key same payload succeeds', `${idem1.status}`)

  const ctxIdem2 = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 15000,
  })
  const idemPaid2 = await bookAndConfirm(customerToken, ctxIdem2, `p4f-idem2-${RUN_ID}`)
  await req('PATCH', `/bookings/${idemPaid2.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-conflict-${RUN_ID}`,
  })
  // Reuse same key on a different booking → unique index is per user+booking+key, so different booking OK.
  // Same booking different payload is blocked via amount check on existing key.
  const sameKeyDiff = await req('PATCH', `/bookings/${idemPaid.bookingId}/cancel`, {
    token: customerToken,
    idempotencyKey: `p4f-idem-key-${RUN_ID}`,
    body: { reason: 'different_reason_only' },
  })
  if (sameKeyDiff.status === 200 && sameKeyDiff.data?.idempotent) {
    pass('Same key repeated cancel is idempotent')
  } else fail('Same key repeated cancel is idempotent', `${sameKeyDiff.status}`)

  // --- Concurrent identical cancels ---
  const ctxConc = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 10,
    priceMinor: 14000,
  })
  const concPaid = await bookAndConfirm(customerToken, ctxConc, `p4f-conc-${RUN_ID}`)
  const concOutcomes = await Promise.all(
    Array.from({ length: 10 }, () =>
      req('PATCH', `/bookings/${concPaid.bookingId}/cancel`, {
        token: customerToken,
        idempotencyKey: `p4f-conc-key-${RUN_ID}`,
      })
    )
  )
  const concOk = concOutcomes.filter(
    (r) => r.status === 200 && r.data?.data?.status === 'cancelled'
  ).length
  const concRefunded = concOutcomes.filter(
    (r) => r.data?.refund?.status === 'completed' || r.data?.payment?.status === 'refunded'
  ).length
  if (
    concOk >= 1 &&
    concOutcomes.every((r) => r.status === 200 || r.status === 409) &&
    concRefunded >= 1
  ) {
    pass('Concurrent identical refund requests safe')
  } else fail('Concurrent identical refund requests safe', `ok=${concOk}`)

  if (uri) {
    const Refund = (await import('../models/Refund.js')).default
    const completed = await Refund.countDocuments({
      bookingId: concPaid.bookingId,
      status: 'completed',
    })
    if (completed === 1) pass('Exactly one completed refund under concurrency')
    else fail('Exactly one completed refund under concurrency', String(completed))
  }

  // --- Missing idempotency key on paid cancel ---
  const ctxNoKey = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 13000,
  })
  const noKeyPaid = await bookAndConfirm(customerToken, ctxNoKey, `p4f-nokey-${RUN_ID}`)
  const noKey = await req('PATCH', `/bookings/${noKeyPaid.bookingId}/cancel`, {
    token: customerToken,
  })
  if (noKey.status === 400) pass('Paid cancel requires Idempotency-Key')
  else fail('Paid cancel requires Idempotency-Key', `${noKey.status}`)

  // --- Legacy isolation ---
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
    pass('Legacy booking creation unchanged')
  } else fail('Legacy booking creation unchanged')

  const legacyId = legacy.data?.data?._id
  const legacyCancel = await req('PATCH', `/bookings/${legacyId}/cancel`, {
    token: customerToken,
  })
  if (legacyCancel.status === 200 && legacyCancel.data?.data?.status === 'cancelled') {
    pass('Legacy cancel behavior unchanged')
  } else fail('Legacy cancel behavior unchanged', `${legacyCancel.status}`)

  if (uri) {
    const Refund = (await import('../models/Refund.js')).default
    const legacyRefunds = await Refund.countDocuments({ bookingId: legacyId })
    if (legacyRefunds === 0) pass('Legacy cancel creates no Refund documents')
    else fail('Legacy cancel creates no Refund documents')
  }

  // --- Refund webhook scaffolding ---
  const ctxWh = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 12000,
  })
  const whPaid = await bookAndConfirm(customerToken, ctxWh, `p4f-wh-${RUN_ID}`)
  // Create a pending refund manually then complete via webhook
  if (uri) {
    const Refund = (await import('../models/Refund.js')).default
    const Payment = (await import('../models/Payment.js')).default
    const payment = await Payment.findById(whPaid.paymentId)
    const refund = await Refund.create({
      bookingId: whPaid.bookingId,
      paymentId: whPaid.paymentId,
      userId: (await (await import('../models/User.js')).default.findOne({
        email: 'customer@visitethiopia.test',
      }))._id,
      organizationId: payment.organizationId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      provider: 'mock',
      status: 'pending',
      reason: 'webhook_test',
      idempotencyKey: `p4f-wh-ref-${RUN_ID}`,
    })

    const badSig = await webhookReq(
      'mock',
      {
        eventId: `evt-ref-bad-${RUN_ID}`,
        eventType: 'refund.completed',
        paymentId: whPaid.paymentId,
        refundId: refund._id.toString(),
      },
      'bad-signature'
    )
    if (badSig.status === 401) pass('Invalid refund webhook signature rejected')
    else fail('Invalid refund webhook signature rejected', `${badSig.status}`)

    const whBody = {
      eventId: `evt-ref-ok-${RUN_ID}`,
      eventType: 'refund.completed',
      paymentId: whPaid.paymentId,
      refundId: refund._id.toString(),
      amountMinor: 1,
      currency: 'USD',
    }
    const whOk = await webhookReq('mock', whBody)
    if (whOk.status === 200 && whOk.data?.processed) pass('Valid refund webhook processed')
    else fail('Valid refund webhook processed', `${whOk.status}`)

    const paymentAfter = await Payment.findById(whPaid.paymentId)
    if (paymentAfter?.amountRefundedMinor === payment.amountMinor) {
      pass('Webhook amount ignored; server Refund amount used')
    } else fail('Webhook amount ignored; server Refund amount used')

    const whDup = await webhookReq('mock', whBody)
    if (whDup.status === 200 && whDup.data?.idempotent) pass('Duplicate refund webhook idempotent')
    else fail('Duplicate refund webhook idempotent', `${whDup.status}`)
  }

  // --- Reconciliation: refunded payment + confirmed booking ---
  const ctxRec = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 11000,
  })
  const recPaid = await bookAndConfirm(customerToken, ctxRec, `p4f-rec-${RUN_ID}`)
  if (uri) {
    const Payment = (await import('../models/Payment.js')).default
    const Refund = (await import('../models/Refund.js')).default
    const User = (await import('../models/User.js')).default
    const user = await User.findOne({ email: 'customer@visitethiopia.test' })
    const payment = await Payment.findById(recPaid.paymentId)
    await Refund.create({
      bookingId: recPaid.bookingId,
      paymentId: recPaid.paymentId,
      userId: user._id,
      organizationId: payment.organizationId,
      amountMinor: payment.amountMinor,
      currency: 'ETB',
      provider: 'mock',
      status: 'completed',
      reason: 'recon_test',
      idempotencyKey: `p4f-rec-ref-${RUN_ID}`,
      completedAt: new Date(),
      providerRefundId: `mock_recon_${RUN_ID}`,
    })
    await Payment.findByIdAndUpdate(recPaid.paymentId, {
      status: 'refunded',
      amountRefundedMinor: payment.amountMinor,
    })
    // booking still confirmed — reconcile should cancel + restore inventory
    const rec = await req('POST', '/admin/bookings/reconcile', {
      token: adminToken,
      body: { limit: 100 },
    })
    if (rec.status === 200) pass('Refund reconciliation endpoint reachable')
    else fail('Refund reconciliation endpoint reachable', `${rec.status}`)

    const Booking = (await import('../models/Booking.js')).default
    const after = await Booking.findById(recPaid.bookingId).setOptions({
      skipUserPopulate: true,
      skipBookingItemPopulate: true,
    })
    if (after?.status === 'cancelled') pass('Reconciliation cancels after completed refund')
    else fail('Reconciliation cancels after completed refund', after?.status)

    const InventoryHold = (await import('../models/InventoryHold.js')).default
    const hold = await InventoryHold.findOne({ bookingId: recPaid.bookingId })
    if (hold?.status === 'released') pass('Reconciliation restores consumed inventory')
    else fail('Reconciliation restores consumed inventory', hold?.status)
  }

  // --- State: payment_pending cancel still works without refund ---
  const ctxPend = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 10000,
  })
  const pend = await createBooking(customerToken, ctxPend.departureId, {
    idempotencyKey: `p4f-pend-${RUN_ID}`,
  })
  const pendCancel = await req('PATCH', `/bookings/${pend.data?.data?._id}/cancel`, {
    token: customerToken,
  })
  if (pendCancel.status === 200 && pendCancel.data?.data?.status === 'cancelled') {
    pass('payment_pending cancel remains intact')
  } else fail('payment_pending cancel remains intact', `${pendCancel.status}`)

  if (!pendCancel.data?.refund) pass('Unpaid cancel does not create refund payload')
  else fail('Unpaid cancel does not create refund payload')

  // --- Malformed payment refund ---
  const badPay = await req('POST', '/payments/not-an-id/refund', {
    token: customerToken,
    idempotencyKey: `p4f-badid-${RUN_ID}`,
  })
  if (badPay.status === 404) pass('Malformed payment ID rejected for refund')
  else fail('Malformed payment ID rejected for refund', `${badPay.status}`)

  // --- Never exceed payment amount ---
  if (uri) {
    const Payment = (await import('../models/Payment.js')).default
    const payments = await Payment.find({ status: 'refunded' }).limit(20)
    const ok = payments.every((p) => (p.amountRefundedMinor || 0) <= p.amountMinor)
    if (ok) pass('refundedAmountMinor never exceeds payment amount')
    else fail('refundedAmountMinor never exceeds payment amount')
  }

  // --- Concurrent 5 ---
  const ctxConc5 = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 9000,
  })
  const c5 = await bookAndConfirm(customerToken, ctxConc5, `p4f-c5-${RUN_ID}`)
  const c5Out = await Promise.all(
    Array.from({ length: 5 }, () =>
      req('PATCH', `/bookings/${c5.bookingId}/cancel`, {
        token: customerToken,
        idempotencyKey: `p4f-c5-key-${RUN_ID}`,
      })
    )
  )
  if (c5Out.every((r) => r.status === 200 || r.status === 409)) {
    pass('5 concurrent identical refund requests safe')
  } else fail('5 concurrent identical refund requests safe')

  // --- Concurrent 2 ---
  const ctxConc2 = await setupBookableDeparture({
    operatorToken,
    adminToken,
    capacity: 5,
    priceMinor: 8000,
  })
  const c2 = await bookAndConfirm(customerToken, ctxConc2, `p4f-c2-${RUN_ID}`)
  const c2Out = await Promise.all([
    req('PATCH', `/bookings/${c2.bookingId}/cancel`, {
      token: customerToken,
      idempotencyKey: `p4f-c2-key-${RUN_ID}`,
    }),
    req('PATCH', `/bookings/${c2.bookingId}/cancel`, {
      token: customerToken,
      idempotencyKey: `p4f-c2-key-${RUN_ID}`,
    }),
  ])
  if (c2Out.every((r) => r.status === 200 || r.status === 409)) {
    pass('2 concurrent identical refund requests safe')
  } else fail('2 concurrent identical refund requests safe')

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n=== Phase 4F refunds: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
  )
  if (mongoose.connection.readyState !== 0) mongoose.disconnect().catch(() => {})
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
