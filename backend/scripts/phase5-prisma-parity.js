/**
 * Phase 5 smoke — Prisma-only API against local PostgreSQL (no Mongo).
 *
 * Requires: Docker PG, migrated schema, seed.
 * Usage: npm run prisma:phase5
 *
 * Starts its own Prisma-only HTTP server on an ephemeral port.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'config.env') })

// Force local test mode (config.env may set NODE_ENV=production)
process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'
process.env.CATALOG_DB = 'prisma'
process.env.SKIP_MONGO = 'true'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase5-local-test-secret'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '90d'
process.env.JWT_COOKIE_EXPIRES_IN = process.env.JWT_COOKIE_EXPIRES_IN || '90'
process.env.MOCK_WEBHOOK_SECRET =
  process.env.MOCK_WEBHOOK_SECRET || 'mock-webhook-dev-secret'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const prisma = (await import('../config/prisma.js')).default
const app = (await import('../app.js')).default

const PORT = 4099
const BASE = `http://127.0.0.1:${PORT}/api/v1`

async function req(method, urlPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
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

let server
try {
  await prisma.$queryRaw`SELECT 1`
  check('postgres connectivity', true)

  const mongoose = (await import('mongoose')).default
  check(
    'mongo not connected in prisma-only',
    mongoose.connection.readyState !== 1
  )

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const health = await req('GET', '/tours?limit=5')
  check(
    'catalog tours without mongo',
    health.status === 200,
    `status=${health.status}`
  )

  const email = `phase5.smoke.${Date.now()}@visitethiopia.test`
  const signup = await req('POST', '/users/signup', {
    body: {
      FirstName: 'Phase',
      LastName: 'Five',
      email,
      password: 'ValidPass123!',
      passwordConfirm: 'ValidPass123!',
    },
  })
  check(
    'signup on prisma',
    signup.status === 201,
    signup.data?.message || String(signup.status)
  )

  const login = await req('POST', '/users/login', {
    body: { email, password: 'ValidPass123!' },
  })
  check('login on prisma', login.status === 200 && Boolean(login.data?.token))
  const token = login.data?.token

  const me = await req('GET', '/users/profile', { token })
  const meId =
    me.data?.data?.data?._id ||
    me.data?.data?._id ||
    me.data?.data?.user?._id
  check(
    'profile on prisma',
    me.status === 200 && Boolean(meId),
    `status=${me.status}`
  )

  const dests = await req('GET', '/destinations')
  check('destinations list', dests.status === 200)

  const hotels = await req('GET', '/hotels?limit=3')
  check('hotels list', hotels.status === 200)

  const seedPassword =
    process.env.SEED_LOCAL_PASSWORD || 'Phase3LocalSeedOnly!x'

  const adminLogin = await req('POST', '/users/login', {
    body: {
      email: 'prisma.admin@visitethiopia.test',
      password: seedPassword,
    },
  })
  check(
    'seed admin login',
    adminLogin.status === 200 && Boolean(adminLogin.data?.token),
    `status=${adminLogin.status}`
  )
  const adminToken = adminLogin.data?.token

  if (adminToken) {
    const stats = await req('GET', '/stats', { token: adminToken })
    check('admin stats prisma', stats.status === 200, `status=${stats.status}`)

    const bookingsAdmin = await req('GET', '/bookings', { token: adminToken })
    check(
      'admin bookings list',
      bookingsAdmin.status === 200,
      `status=${bookingsAdmin.status}`
    )
  }

  const visitorLogin = await req('POST', '/users/login', {
    body: {
      email: 'prisma.catalog.visitor@visitethiopia.test',
      password: seedPassword,
    },
  })
  const visitorToken = visitorLogin.data?.token
  check(
    'seed visitor login',
    visitorLogin.status === 200 && Boolean(visitorToken),
    `status=${visitorLogin.status}`
  )

  // Booking + payment E2E against seed org tour departure
  const org = await prisma.organization.findFirst({
    where: { approvalStatus: 'approved', visibility: 'public' },
  })
  const tour = org
    ? await prisma.tour.findFirst({
        where: { organizationId: org.id, status: 'published' },
      })
    : null
  const departure = tour
    ? await prisma.tourDeparture.findFirst({
        where: { tourId: tour.id, status: 'open' },
      })
    : null

  if (visitorToken && departure) {
    const spotsBefore = departure.availableSpots
    const idem = `phase5-book-${Date.now()}`
    const book = await req('POST', '/bookings/tours', {
      token: visitorToken,
      headers: { 'Idempotency-Key': idem },
      body: {
        departureId: departure.id,
        packageKey: 'standard',
        quantity: 1,
        contactInfo: {
          fullName: 'Phase Five Visitor',
          email: 'prisma.catalog.visitor@visitethiopia.test',
          phone: '+251900000099',
        },
      },
    })
    check(
      'create tour booking',
      book.status === 201 || book.status === 200,
      `status=${book.status} ${book.data?.message || ''}`
    )

    const bookingId = book.data?.data?._id || book.data?.data?.booking?._id
    const paymentId =
      book.data?.data?.payment?._id ||
      book.data?.data?.paymentId ||
      book.data?.payment?._id

    const myBookings = await req('GET', '/bookings/me', {
      token: visitorToken,
    })
    check(
      'my bookings list',
      myBookings.status === 200,
      `status=${myBookings.status}`
    )

    if (paymentId) {
      const confirm = await req('POST', `/payments/${paymentId}/confirm`, {
        token: visitorToken,
        body: { mockOutcome: 'success' },
      })
      check(
        'payment confirm',
        confirm.status === 200,
        `status=${confirm.status}`
      )
    } else {
      check('payment confirm', false, 'no payment id from booking create')
    }

    const afterDep = await prisma.tourDeparture.findUnique({
      where: { id: departure.id },
    })
    check(
      'inventory decreased or held',
      afterDep.availableSpots <= spotsBefore,
      `before=${spotsBefore} after=${afterDep.availableSpots}`
    )

    if (bookingId) {
      const getOne = await req('GET', `/bookings/${bookingId}`, {
        token: visitorToken,
      })
      check('get booking by id', getOne.status === 200)
    }
  } else {
    check(
      'booking e2e (needs seed departure)',
      false,
      're-run npm run prisma:seed'
    )
  }

  // Concurrency CAS
  if (org && tour) {
    const {
      reserveSpotsAtomic,
      releaseSpotsAtomic,
      createDepartureRecord,
      findDepartureById,
    } = await import(
      '../repositories/booking/prismaDepartureInventoryRepository.js'
    )

    const dep = await createDepartureRecord({
      tourId: tour.id,
      organizationId: org.id,
      departureDate: new Date(Date.now() + 30 * 86400000),
      capacity: 5,
      availableSpots: 5,
      status: 'open',
      packages: [
        { key: 'standard', priceMinor: 50000, currency: 'ETB', active: true },
      ],
      notes: 'phase5-smoke',
    })
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => reserveSpotsAtomic(dep._id, 1))
    )
    const ok = attempts.filter((a) => a.status === 'fulfilled').length
    const after = await findDepartureById(dep._id)
    check('concurrency CAS 5/10', ok === 5 && after.availableSpots === 0)
    for (let i = 0; i < 5; i++) await releaseSpotsAtomic(dep._id, 1)
    await prisma.tourDeparture.delete({ where: { id: dep._id } }).catch(() => {})
  } else {
    check('concurrency CAS', false, 'missing approved org+tour')
  }

  // Public org visibility
  if (org?.slug) {
    const publicOrg = await req('GET', `/organizations/${org.slug}`)
    check(
      'public approved org visible',
      publicOrg.status === 200,
      `status=${publicOrg.status}`
    )
  }
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) {
    await new Promise((r) => server.close(r))
  }
  await prisma.$disconnect()
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Phase 5 Prisma parity smoke: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
