/**
 * Chapa payment integration — Prisma-only HTTP tests with a mocked Chapa API.
 * No network calls to Chapa are made; the provider's HTTP layer is replaced.
 *
 * Usage: node scripts/chapa-payment-prisma.js   (npm run prisma:chapa)
 */
import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'config.env') })

process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'
process.env.CATALOG_DB = 'prisma'
process.env.SKIP_MONGO = 'true'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'chapa-prisma-test-secret'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'
process.env.JWT_COOKIE_EXPIRES_IN = process.env.JWT_COOKIE_EXPIRES_IN || '1'
process.env.PAYMENT_PROVIDER = 'chapa'
process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-unit-test-fake-key'
process.env.CHAPA_WEBHOOK_SECRET = 'unit-test-webhook-secret-hash'
process.env.PUBLIC_BACKEND_URL = 'https://api.example.test'
process.env.FRONTEND_URL = 'https://web.example.test'
delete process.env.ALLOW_MOCK_PAYMENTS

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const { generateObjectId } = await import('../utils/objectId.js')
const { hashPassword } = await import('../services/passwordService.js')
const { permissionsForProviderTypes } = await import('../utils/organizationPermissions.js')
const { getPaymentProvider } = await import('../services/payment/paymentProviderRegistry.js')
const { runPaymentReconciliation } = await import('../services/paymentReconciliationService.js')
const prisma = (await import('../config/prisma.js')).default
const app = (await import('../app.js')).default

// ---------------------------------------------------------------------------
// Fake Chapa API
// ---------------------------------------------------------------------------
const chapaTx = new Map() // tx_ref -> { status, amount, currency }
const chapaCalls = []
async function fakeChapaFetch(url, init = {}) {
  const u = new URL(url)
  const body = init.body ? JSON.parse(init.body) : null
  chapaCalls.push({ method: init.method, path: u.pathname, body, auth: init.headers?.Authorization })
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data })

  if (u.pathname.endsWith('/transaction/initialize')) {
    chapaTx.set(body.tx_ref, { status: 'pending', amount: body.amount, currency: body.currency })
    return json(200, {
      message: 'Hosted Link',
      status: 'success',
      data: { checkout_url: `https://checkout.chapa.test/pay/${body.tx_ref}` },
    })
  }
  const m = /\/transaction\/verify\/(.+)$/.exec(u.pathname)
  if (m) {
    const ref = decodeURIComponent(m[1])
    const tx = chapaTx.get(ref)
    if (!tx) return json(404, { message: 'Invalid transaction or Transaction not found', status: 'failed', data: null })
    return json(200, {
      message: 'Payment details',
      status: 'success',
      data: { tx_ref: ref, status: tx.status, amount: tx.amount, currency: tx.currency, reference: `CH${ref.slice(-6)}`, mode: 'test' },
    })
  }
  return json(404, { status: 'failed', message: 'not found' })
}
getPaymentProvider('chapa').setFetch(fakeChapaFetch)

function signWebhook(raw) {
  return crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET).update(raw).digest('hex')
}

// ---------------------------------------------------------------------------
const PORT = 4111
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const RUN = generateObjectId().slice(0, 8)

async function req(method, urlPath, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

const guestId = generateObjectId()
const otherGuestId = generateObjectId()
const ownerId = generateObjectId()
const orgId = generateObjectId()
const versionId = generateObjectId()
const transportId = generateObjectId()
const pw = 'ChapaTestPass1!'
const pwHash = await hashPassword(pw)
const ROUTE = 'addis-hawassa-08-00'
const DATE = '2034-05-10'

async function inventory() {
  return prisma.transportRouteInventory.findFirst({
    where: { transportId, routeKey: ROUTE, date: new Date(`${DATE}T00:00:00.000Z`) },
  })
}

async function book(token, key) {
  return req('POST', '/bookings/transports', {
    token,
    headers: { 'Idempotency-Key': key },
    body: {
      transportId,
      routeKey: ROUTE,
      travelDate: DATE,
      quantity: 2,
      contactInfo: { fullName: 'Chapa Guest', email: `chapa.guest.${RUN}@visitethiopia.test`, phone: '+251911222333' },
    },
  })
}

let server
try {
  await prisma.user.createMany({
    data: [
      { id: guestId, firstName: 'Chapa', lastName: 'Guest', email: `chapa.guest.${RUN}@visitethiopia.test`, password: pwHash, role: 'user', isVerified: true, active: true },
      { id: otherGuestId, firstName: 'Other', lastName: 'Guest', email: `chapa.other.${RUN}@visitethiopia.test`, password: pwHash, role: 'user', isVerified: true, active: true },
      { id: ownerId, firstName: 'Bus', lastName: 'Owner', email: `chapa.owner.${RUN}@visitethiopia.test`, password: pwHash, role: 'transport_manager', isVerified: true, active: true },
    ],
  })
  await prisma.organization.create({
    data: {
      id: orgId, name: `Chapa Bus ${RUN}`, slug: `chapa-bus-${RUN}`, providerTypes: ['tour_bus_provider'],
      approvalStatus: 'draft', visibility: 'private', description: '', shortDescription: '',
      uniqueSellingPoints: [], services: [], gallery: [], portfolioPhotos: [], ownerUserId: ownerId, verification: {},
    },
  })
  await prisma.organizationMember.create({
    data: {
      id: generateObjectId(), organizationId: orgId, userId: ownerId, orgRole: 'owner',
      permissions: permissionsForProviderTypes(['tour_bus_provider']), membershipRoles: ['tour_bus_provider'], status: 'active',
    },
  })
  await prisma.providerVersion.create({
    data: {
      id: versionId, organizationId: orgId, versionNumber: 1, status: 'approved',
      snapshot: { name: `Chapa Bus ${RUN}`, providerTypes: ['tour_bus_provider'] }, changedFields: [], requiresReapproval: false, approvedAt: new Date(),
    },
  })
  await prisma.organization.update({
    where: { id: orgId },
    data: { approvalStatus: 'approved', visibility: 'public', approvedVersionId: versionId, latestVersionId: versionId },
  })
  await prisma.transport.create({
    data: {
      id: transportId, name: `Chapa Coach ${RUN}`, description: 'Coach', type: 'bus',
      vehicleDetails: { model: 'Coach', capacity: 40, images: [] },
      routes: [{ key: ROUTE, from: 'Addis Ababa', to: 'Hawassa', departureTime: '08:00', arrivalTime: '13:00', duration: '5h', price: 650, priceMinor: 65000, currency: 'ETB', availableSeats: 40, active: true }],
      contact: { phone: '+251911000000', email: `chapa.${RUN}@test.com` },
      createdById: ownerId, organizationId: orgId, status: 'active',
    },
  })
  await prisma.transportRouteInventory.create({
    data: {
      id: generateObjectId(), transportId, organizationId: orgId, routeKey: ROUTE,
      date: new Date(`${DATE}T00:00:00.000Z`), totalSeats: 10, availableSeats: 10, reservedSeats: 0, currency: 'ETB',
    },
  })

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const login = async (email) =>
    (await req('POST', '/users/login', { body: { email, password: pw } })).data?.token
  const guest = await login(`chapa.guest.${RUN}@visitethiopia.test`)
  const other = await login(`chapa.other.${RUN}@visitethiopia.test`)
  check('logins ok', Boolean(guest && other))

  // --- config -------------------------------------------------------------
  const cfg = await req('GET', '/payments/config')
  check('payment config reports chapa test mode', cfg.data?.data?.provider === 'chapa' && cfg.data?.data?.testMode === true && cfg.data?.data?.configured === true, JSON.stringify(cfg.data?.data))
  check('payment config does not leak secret', !JSON.stringify(cfg.data).includes('CHASECK'))

  // --- booking creates chapa payment --------------------------------------
  const b1 = await book(guest, `chapa-b1-${RUN}`)
  const bookingId = b1.data?.data?._id
  const paymentId = b1.data?.data?.payment?._id || b1.data?.data?.paymentId
  check('booking created', [200, 201].includes(b1.status) && Boolean(paymentId), `status=${b1.status}`)
  const p1 = await prisma.payment.findUnique({ where: { id: paymentId } })
  check('payment uses chapa provider', p1?.provider === 'chapa' && p1?.status === 'pending' && p1?.amountMinor === 130000, `${p1?.provider} ${p1?.status} ${p1?.amountMinor}`)
  check('inventory reserved on booking', (await inventory())?.availableSeats === 8)

  // --- mock confirm is refused for chapa payments ---------------------------
  const conf = await req('POST', `/payments/${paymentId}/confirm`, { token: guest, headers: { 'Idempotency-Key': `conf-${RUN}-x` } })
  check('direct /confirm rejected for chapa payment', conf.status === 409, `status=${conf.status}`)

  // --- access control -------------------------------------------------------
  const otherCheckout = await req('POST', `/payments/${paymentId}/checkout`, { token: other })
  check('other user cannot start checkout', otherCheckout.status === 404, `status=${otherCheckout.status}`)
  const otherVerify = await req('POST', `/payments/${paymentId}/verify`, { token: other })
  check('other user cannot verify', otherVerify.status === 404, `status=${otherVerify.status}`)
  const anonCheckout = await req('POST', `/payments/${paymentId}/checkout`)
  check('anonymous checkout rejected', anonCheckout.status === 401, `status=${anonCheckout.status}`)

  // --- checkout -------------------------------------------------------------
  const co = await req('POST', `/payments/${paymentId}/checkout`, { token: guest, body: { amount: 1, currency: 'USD' } })
  const txFromUrl = (r) => String(r.data?.data?.checkoutUrl || '').split('/pay/')[1]
  const tx1 = txFromUrl(co)
  check('checkout returns chapa url', co.status === 200 && new RegExp(`^ve-${paymentId}-[0-9]+$`).test(tx1 || ''), `status=${co.status} ${co.data?.message || ''}`)
  const initCall = chapaCalls.find((c) => c.path.endsWith('/initialize'))
  check('init uses server amount/currency (ignores body)', initCall?.body?.amount === '1300.00' && initCall?.body?.currency === 'ETB', JSON.stringify(initCall?.body?.amount))
  check('init uses secret key bearer auth', initCall?.auth === 'Bearer CHASECK_TEST-unit-test-fake-key')
  check('init callback/return urls are server-configured', initCall?.body?.callback_url === 'https://api.example.test/api/v1/payments/chapa/callback' && initCall?.body?.return_url === `https://web.example.test/bookings/${bookingId}?payment=return`)
  const co2 = await req('POST', `/payments/${paymentId}/checkout`, { token: guest })
  check('repeat checkout reuses pending link', co2.data?.data?.reused === true && chapaCalls.filter((c) => c.path.endsWith('/initialize')).length === 1)

  // --- pending verification & forged redirect -------------------------------
  const v1 = await req('POST', `/payments/${paymentId}/verify`, { token: guest })
  check('verify while pending keeps booking pending', v1.data?.data?.outcome === 'pending' && v1.data?.data?.booking?.status === 'payment_pending', JSON.stringify(v1.data?.data?.outcome))
  const forged = await req('GET', `/payments/chapa/callback?trx_ref=${tx1}&status=success`)
  const afterForged = await prisma.booking.findUnique({ where: { id: bookingId } })
  check('forged success callback does not confirm booking', forged.status === 200 && afterForged.status === 'payment_pending', `outcome=${forged.data?.outcome}`)
  const badRef = await req('GET', `/payments/chapa/callback?trx_ref=not-ours`)
  check('callback with unknown ref rejected', badRef.status === 400)

  // --- webhook signature ------------------------------------------------------
  const whBody = JSON.stringify({ event: 'charge.success', tx_ref: tx1, status: 'success', amount: '1300.00', currency: 'ETB', reference: 'APfake' })
  const unsigned = await req('POST', '/payments/webhooks/chapa', { raw: whBody })
  check('unsigned webhook rejected', unsigned.status === 401, `status=${unsigned.status}`)
  const badSig = await req('POST', '/payments/webhooks/chapa', { raw: whBody, headers: { 'x-chapa-signature': 'a'.repeat(64) } })
  check('bad-signature webhook rejected', badSig.status === 401)
  const signedButUnpaid = await req('POST', '/payments/webhooks/chapa', { raw: whBody, headers: { 'x-chapa-signature': signWebhook(whBody) } })
  const afterSigned = await prisma.booking.findUnique({ where: { id: bookingId } })
  check('signed webhook still re-verifies (Chapa says pending → no confirm)', signedButUnpaid.status === 200 && afterSigned.status === 'payment_pending')

  // --- failed attempt is retryable -------------------------------------------
  chapaTx.get(tx1).status = 'failed'
  const vFail = await req('POST', `/payments/${paymentId}/verify`, { token: guest })
  const pAfterFail = await prisma.payment.findUnique({ where: { id: paymentId } })
  check('failed chapa attempt is retryable', vFail.data?.data?.outcome === 'failed_retryable' && pAfterFail.status === 'pending' && vFail.data?.data?.booking?.status === 'payment_pending')
  const coRetry = await req('POST', `/payments/${paymentId}/checkout`, { token: guest })
  const tx2 = txFromUrl(coRetry)
  check('retry creates new tx_ref', Boolean(tx2) && tx2 !== tx1 && chapaTx.has(tx2), coRetry.data?.data?.checkoutUrl)

  // --- amount mismatch is flagged, not confirmed -----------------------------
  chapaTx.get(tx2).status = 'success'
  chapaTx.get(tx2).amount = '1.00'
  const vMismatch = await req('POST', `/payments/${paymentId}/verify`, { token: guest })
  const bMismatch = await prisma.booking.findUnique({ where: { id: bookingId } })
  check('amount mismatch flagged and not confirmed', vMismatch.data?.data?.outcome === 'flagged' && bMismatch.status === 'payment_pending', vMismatch.data?.data?.outcome)

  // --- success via signed webhook -------------------------------------------
  const coOk = await req('POST', `/payments/${paymentId}/checkout`, { token: guest })
  const tx3 = txFromUrl(coOk)
  check('third checkout attempt', Boolean(tx3) && ![tx1, tx2].includes(tx3) && chapaTx.has(tx3), coOk.data?.data?.checkoutUrl)
  chapaTx.get(tx3).status = 'success'
  const okBody = JSON.stringify({ event: 'charge.success', tx_ref: tx3, status: 'success', amount: '1300.00', currency: 'ETB', reference: 'APok1' })
  const whOk = await req('POST', '/payments/webhooks/chapa', { raw: okBody, headers: { 'chapa-signature': signWebhook(okBody) } })
  const bOk = await prisma.booking.findUnique({ where: { id: bookingId } })
  const pOk = await prisma.payment.findUnique({ where: { id: paymentId } })
  check('signed + verified webhook confirms booking', whOk.status === 200 && bOk.status === 'confirmed' && pOk.status === 'completed' && pOk.providerPaymentId === tx3, `wh=${whOk.status} booking=${bOk.status} payment=${pOk.status}`)
  const inv = await inventory()
  check('inventory consumed (not released) after payment', inv.availableSeats === 8, `available=${inv.availableSeats} reserved=${inv.reservedSeats}`)
  const whDup = await req('POST', '/payments/webhooks/chapa', { raw: okBody, headers: { 'x-chapa-signature': signWebhook(okBody) } })
  check('duplicate webhook is idempotent', whDup.status === 200 && whDup.data?.idempotent === true)
  const vAfter = await req('POST', `/payments/${paymentId}/verify`, { token: guest })
  check('verify after success is idempotent', vAfter.data?.data?.outcome === 'success' && vAfter.data?.data?.booking?.status === 'confirmed')
  const coPaid = await req('POST', `/payments/${paymentId}/checkout`, { token: guest })
  check('checkout after payment reports alreadyPaid', coPaid.data?.data?.alreadyPaid === true)
  const attempts = await prisma.paymentAttempt.findMany({ where: { paymentId }, orderBy: { attemptNumber: 'asc' } })
  check('payment attempts audit trail recorded', attempts.length >= 4 && attempts.some((a) => a.status === 'succeeded') && attempts.some((a) => a.failureCode === 'CHAPA_VERIFY_MISMATCH'), `count=${attempts.length}`)

  // --- late payment after expiry is flagged ----------------------------------
  const b2 = await book(guest, `chapa-b2-${RUN}`)
  const booking2 = b2.data?.data?._id
  const payment2 = b2.data?.data?.payment?._id || b2.data?.data?.paymentId
  const tx21 = txFromUrl(await req('POST', `/payments/${payment2}/checkout`, { token: guest }))
  await prisma.booking.update({ where: { id: booking2 }, data: { expiresAt: new Date(Date.now() - 60_000) } })
  await prisma.payment.update({ where: { id: payment2 }, data: { expiresAt: new Date(Date.now() - 60_000) } })
  await runPaymentReconciliation({ limit: 1000 })
  const b2Expired = await prisma.booking.findUnique({ where: { id: booking2 } })
  check('stale unpaid booking expired by reconciliation', b2Expired.status === 'expired', b2Expired.status)
  check('expired booking released inventory', (await inventory()).availableSeats === 8)
  chapaTx.get(tx21).status = 'success'
  const cb = await req('GET', `/payments/chapa/callback?trx_ref=${tx21}`)
  const p2 = await prisma.payment.findUnique({ where: { id: payment2 } })
  const b2After = await prisma.booking.findUnique({ where: { id: booking2 } })
  check('late payment flagged for refund review, booking not revived', cb.status === 200 && b2After.status === 'expired' && p2.metadata?.needsRefundReview === true, `outcome=${cb.data?.outcome} booking=${b2After.status}`)

  // --- production guards ------------------------------------------------------
  process.env.PAYMENT_PROVIDER = 'mock'
  const b3 = await book(guest, `chapa-b3-${RUN}`)
  const payment3 = b3.data?.data?.payment?._id || b3.data?.data?.paymentId
  process.env.NODE_ENV = 'production'
  const cfgProd = await req('GET', '/payments/config')
  check('production without ALLOW_MOCK_PAYMENTS reports not configured', cfgProd.data?.data?.configured === false)
  const bProd = await book(guest, `chapa-b4-${RUN}`)
  check('production refuses bookings when payments unavailable', bProd.status === 503, `status=${bProd.status}`)
  const confProd = await req('POST', `/payments/${payment3}/confirm`, { token: guest, headers: { 'Idempotency-Key': `conf-prod-${RUN}` } })
  check('production refuses mock confirm', confProd.status === 403, `status=${confProd.status}`)
  const mockWh = await req('POST', '/payments/webhooks/mock', { raw: JSON.stringify({ eventId: `e-${RUN}`, eventType: 'payment.completed', paymentId: payment3 }) })
  check('production refuses mock webhooks', mockWh.status === 403, `status=${mockWh.status}`)
  process.env.ALLOW_MOCK_PAYMENTS = 'true'
  const confDemo = await req('POST', `/payments/${payment3}/confirm`, { token: guest, headers: { 'Idempotency-Key': `conf-demo-${RUN}` } })
  check('production demo mode allows mock confirm when explicitly enabled', confDemo.status === 200 && confDemo.data?.data?.booking?.status === 'confirmed', `status=${confDemo.status}`)
  process.env.NODE_ENV = 'development'
  delete process.env.ALLOW_MOCK_PAYMENTS
  process.env.PAYMENT_PROVIDER = 'chapa'
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  process.env.NODE_ENV = 'development'
  if (server) await new Promise((r) => server.close(r))
  try {
    const bookings = await prisma.booking.findMany({ where: { bookingItemId: transportId }, select: { id: true } })
    const bookingIds = bookings.map((b) => b.id)
    if (bookingIds.length) {
      const pays = await prisma.payment.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true } })
      await prisma.webhookEvent.deleteMany({ where: { paymentId: { in: pays.map((p) => p.id) } } }).catch(() => {})
      await prisma.bookingOperationAudit.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
      await prisma.refund.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
      await prisma.paymentAttempt.deleteMany({ where: { payment: { bookingId: { in: bookingIds } } } }).catch(() => {})
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
      await prisma.inventoryHold.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => {})
    }
    await prisma.transportRouteInventory.deleteMany({ where: { transportId } }).catch(() => {})
    await prisma.transport.deleteMany({ where: { id: transportId } }).catch(() => {})
    await prisma.organization.update({ where: { id: orgId }, data: { approvedVersionId: null, latestVersionId: null } }).catch(() => {})
    await prisma.providerVersion.deleteMany({ where: { organizationId: orgId } }).catch(() => {})
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } }).catch(() => {})
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [guestId, otherGuestId, ownerId] } } }).catch(() => {})
  } catch {
    /* best effort */
  }
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(`\n=== Chapa payment Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
process.exitCode = failed ? 1 : 0
