/**
 * Admin console API (Prisma): access control, overview KPIs, booking/payment
 * listings, flagged-payment review, user role/suspension guards and audit log.
 *
 * Usage: node scripts/admin-console-prisma.js   (LOCAL database only)
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'config.env') })

process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'
process.env.CATALOG_DB = 'prisma'
process.env.SKIP_MONGO = 'true'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'admin-console-test-secret-0123456789abcdef'

if (!process.env.DATABASE_URL || !/@(127\.0\.0\.1|localhost):\d+\//.test(process.env.DATABASE_URL)) {
  console.error('A LOCAL DATABASE_URL is required')
  process.exit(1)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const { generateObjectId } = await import('../utils/objectId.js')
const { hashPassword } = await import('../services/passwordService.js')
const prisma = (await import('../config/prisma.js')).default
const app = (await import('../app.js')).default

const PORT = 4113
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const RUN = generateObjectId().slice(-8)
const pw = `Adm1n-${RUN}-pass!`

const ids = {
  adminA: generateObjectId(),
  adminB: generateObjectId(),
  customer: generateObjectId(),
  booking: generateObjectId(),
  payment: generateObjectId(),
  booking2: generateObjectId(),
  payment2: generateObjectId(),
}
const email = (k) => `adm.${k}.${RUN}@visitethiopia.test`

async function req(method, p, { token, body } = {}) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const server = app.listen(PORT)
try {
  const hash = await hashPassword(pw)
  const user = (id, k, role) => ({
    id, firstName: 'Adm', lastName: k, email: email(k), password: hash, role, isVerified: true, active: true,
  })
  await prisma.user.createMany({
    data: [user(ids.adminA, 'a', 'admin'), user(ids.adminB, 'b', 'admin'), user(ids.customer, 'cust', 'customer')],
  })
  const bookingBase = {
    userId: ids.customer, bookingFlowVersion: 'v2', bookingType: 'hotel', bookingItemId: generateObjectId(),
    contactInfo: { name: 'Adm Cust', email: email('cust') },
    priceSnapshot: { totalMinor: 250000, currency: 'ETB' },
  }
  await prisma.booking.create({ data: { ...bookingBase, id: ids.booking, status: 'expired' } })
  await prisma.booking.create({ data: { ...bookingBase, id: ids.booking2, status: 'confirmed' } })
  await prisma.payment.create({
    data: {
      id: ids.payment, bookingId: ids.booking, amountMinor: 250000, currency: 'ETB', status: 'completed',
      provider: 'mock', completedAt: new Date(), metadata: { needsRefundReview: true, flagged: 'paid_after_expiry' },
    },
  })
  await prisma.payment.create({
    data: { id: ids.payment2, bookingId: ids.booking2, amountMinor: 250000, currency: 'ETB', status: 'completed', provider: 'mock', completedAt: new Date() },
  })

  const login = async (k) => (await req('POST', '/users/login', { body: { email: email(k), password: pw } })).body?.token
  const adminA = await login('a')
  const customer = await login('cust')
  check('logins ok', Boolean(adminA && customer))

  // --- access control -------------------------------------------------------
  for (const p of ['/admin/overview', '/admin/payments', '/admin/users', '/admin/audit-log', '/admin/console/bookings', '/admin/assistant-insights']) {
    const anon = await req('GET', p)
    const cust = await req('GET', p, { token: customer })
    check(`${p}: anonymous 401, customer 403`, anon.status === 401 && cust.status === 403, `${anon.status}/${cust.status}`)
  }
  check('existing /admin/bookings still served by reconciliation router',
    (await req('GET', '/admin/bookings', { token: adminA })).status === 200)

  // --- overview ---------------------------------------------------------------
  const ov = await req('GET', '/admin/overview?days=30', { token: adminA })
  const o = ov.body?.data
  check('overview 200', ov.status === 200, JSON.stringify(ov.body).slice(0, 200))
  check('overview has 30-day series', o?.series?.length === 30)
  check('overview counts flagged payment in queues', o?.queues?.flaggedPayments >= 1)
  check('overview revenue includes seeded ETB payments', (o?.revenue?.periodMinor?.ETB || 0) >= 500000)
  check('overview users byRole includes admins', (o?.users?.byRole?.admin || 0) >= 2)

  // --- bookings ---------------------------------------------------------------
  const custQ = encodeURIComponent(email('cust'))
  const bl = await req('GET', `/admin/console/bookings?search=${custQ}`, { token: adminA })
  check('bookings search by customer email finds both', bl.body?.data?.total === 2, `total=${bl.body?.data?.total}`)
  const bf = await req('GET', `/admin/console/bookings?search=${custQ}&status=expired`, { token: adminA })
  check('bookings status filter', bf.body?.data?.total === 1 && bf.body.data.data[0].payment?.flagged === true)
  check('bookings invalid status -> 400', (await req('GET', '/admin/console/bookings?status=bogus', { token: adminA })).status === 400)
  const bd = await req('GET', `/admin/console/bookings/${ids.booking}`, { token: adminA })
  check('booking detail includes payments', bd.status === 200 && bd.body?.data?.booking?.payments?.length === 1)

  // --- payments + flagged review ----------------------------------------------
  const fl = await req('GET', '/admin/payments?flagged=true&limit=100', { token: adminA })
  const flRows = fl.body?.data?.data || []
  check('flagged filter lists the flagged payment only',
    flRows.some((p) => p._id === ids.payment) && !flRows.some((p) => p._id === ids.payment2))
  const resolveUrl = `/admin/payments/${ids.payment}/resolve-review`
  check('resolve with invalid resolution -> 400',
    (await req('POST', resolveUrl, { token: adminA, body: { resolution: 'whatever', note: 'x' } })).status === 400)
  check('resolve without note -> 400',
    (await req('POST', resolveUrl, { token: adminA, body: { resolution: 'refunded_externally' } })).status === 400)
  check('customer cannot resolve -> 403',
    (await req('POST', resolveUrl, { token: customer, body: { resolution: 'refunded_externally', note: 'n' } })).status === 403)
  const res1 = await req('POST', resolveUrl, { token: adminA, body: { resolution: 'refunded_externally', note: 'Refunded via Chapa dashboard' } })
  check('resolve flagged payment -> 200', res1.status === 200, JSON.stringify(res1.body).slice(0, 200))
  const res2 = await req('POST', resolveUrl, { token: adminA, body: { resolution: 'refunded_externally', note: 'again' } })
  check('second resolve -> 409', res2.status === 409)
  const pAfter = await prisma.payment.findUnique({ where: { id: ids.payment } })
  check('resolve records decision without touching money', pAfter.metadata.needsRefundReview === false
    && pAfter.metadata.refundReview?.resolvedBy === ids.adminA && pAfter.status === 'completed' && pAfter.amountRefundedMinor === 0)
  check('verify on a mock payment is rejected (409)',
    (await req('POST', `/admin/payments/${ids.payment2}/verify`, { token: adminA })).status === 409)

  // --- users ------------------------------------------------------------------
  const us = await req('GET', `/admin/users?search=${RUN}`, { token: adminA })
  check('users search', us.body?.data?.total === 3, `total=${us.body?.data?.total}`)
  check('users list never exposes password hashes', !JSON.stringify(us.body).includes(hash))
  const cu = (us.body?.data?.data || []).find((u) => u._id === ids.customer)
  check('users list includes booking count', cu?.bookingsCount === 2)
  const patch = (id, body, token = adminA) => req('PATCH', `/admin/users/${id}`, { token, body })
  check('invalid role -> 400', (await patch(ids.customer, { role: 'superuser' })).status === 400)
  check('unsupported field -> 400', (await patch(ids.customer, { email: 'x@y.z' })).status === 400)
  check('self role change -> 403', (await patch(ids.adminA, { role: 'customer' })).status === 403)
  check('self suspend -> 403', (await patch(ids.adminA, { active: false })).status === 403)
  check('legacy PATCH /users/:id self role change -> 403',
    (await req('PATCH', `/users/${ids.adminA}`, { token: adminA, body: { role: 'customer' } })).status === 403)
  check('legacy PATCH /users/:id invalid role -> 400',
    (await req('PATCH', `/users/${ids.customer}`, { token: adminA, body: { role: 'god' } })).status === 400)

  const sus = await patch(ids.customer, { active: false })
  check('suspend customer -> 200', sus.status === 200 && sus.body?.data?.user?.active === false)
  check('suspended customer cannot log in', !(await login('cust')))
  const rea = await patch(ids.customer, { active: true })
  check('reactivate customer -> 200', rea.status === 200 && rea.body?.data?.user?.active === true)
  const dem = await patch(ids.adminB, { role: 'customer' })
  check('demote another admin while others remain -> 200', dem.status === 200 && dem.body?.data?.user?.role === 'customer')

  // Last-admin guard: temporarily deactivate the other LOCAL admins (restored below).
  const { updateUserByAdmin } = await import('../services/adminService.js')
  const others = await prisma.user.findMany({
    where: { role: 'admin', active: true, id: { not: ids.adminA } },
    select: { id: true },
  })
  try {
    if (others.length) {
      await prisma.user.updateMany({ where: { id: { in: others.map((u) => u.id) } }, data: { active: false } })
    }
    let code = null
    try {
      await updateUserByAdmin({ _id: ids.adminB }, ids.adminA, { role: 'customer' })
    } catch (e) {
      code = e.statusCode
    }
    check('cannot demote the last active admin -> 409', code === 409, `code=${code}`)
    code = null
    try {
      await updateUserByAdmin({ _id: ids.adminB }, ids.adminA, { active: false })
    } catch (e) {
      code = e.statusCode
    }
    check('cannot suspend the last active admin -> 409', code === 409, `code=${code}`)
  } finally {
    if (others.length) {
      await prisma.user.updateMany({ where: { id: { in: others.map((u) => u.id) } }, data: { active: true } })
    }
  }
  const adminRow = await prisma.user.findUnique({ where: { id: ids.adminA } })
  check('last admin unchanged after rejected attempts', adminRow.role === 'admin' && adminRow.active === true)

  // --- audit log --------------------------------------------------------------
  const al = await req('GET', '/admin/audit-log?limit=50', { token: adminA })
  const mine = (al.body?.data?.data || []).filter((r) => [ids.payment, ids.customer, ids.adminB].includes(r.targetId))
  check('audit log records review + user changes', mine.some((r) => r.action === 'payment.refund_review_resolved')
    && mine.filter((r) => r.action === 'user.updated').length >= 3, mine.map((r) => r.action).join(','))
  check('audit log shows actor email', mine.length > 0 && mine.every((r) => r.actorEmail === email('a')))

  const ai = await req('GET', '/admin/assistant-insights', { token: adminA })
  check('assistant insights 200', ai.status === 200 && typeof ai.body?.data?.total === 'number')
} catch (err) {
  check('suite crashed', false, err.stack || String(err))
} finally {
  server.close()
  try {
    const userIds = [ids.adminA, ids.adminB, ids.customer]
    await prisma.adminAuditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] } })
    await prisma.payment.deleteMany({ where: { id: { in: [ids.payment, ids.payment2] } } })
    await prisma.booking.deleteMany({ where: { id: { in: [ids.booking, ids.booking2] } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  } catch (e) {
    console.error('cleanup failed', e.message)
  }
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(`\n=== Admin console Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
process.exitCode = failed ? 1 : 0
