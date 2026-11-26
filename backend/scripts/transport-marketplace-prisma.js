/**
 * Transport marketplace lifecycle + route inventory + booking — Prisma-only HTTP tests.
 * Usage: node scripts/transport-marketplace-prisma.js
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'config.env') })

process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'
process.env.CATALOG_DB = 'prisma'
process.env.SKIP_MONGO = 'true'
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'transport-marketplace-prisma-test-secret'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'
process.env.JWT_COOKIE_EXPIRES_IN = process.env.JWT_COOKIE_EXPIRES_IN || '1'

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
const { permissionsForProviderTypes } = await import(
  '../utils/organizationPermissions.js'
)
const prisma = (await import('../config/prisma.js')).default
const app = (await import('../app.js')).default

const PORT = 4105
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const RUN = generateObjectId().slice(0, 8)

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

const visitorId = generateObjectId()
const ownerId = generateObjectId()
const otherOwnerId = generateObjectId()
const orgId = generateObjectId()
const otherOrgId = generateObjectId()
const versionId = generateObjectId()
const legacyTransportId = generateObjectId()
const publicTransportId = generateObjectId()
const draftTransportId = generateObjectId()
const inactiveTransportId = generateObjectId()
const privateOrgTransportId = generateObjectId()
const passwordPlain = 'TransportPass1!'
const passwordHash = await hashPassword(passwordPlain)

const routes = [
  {
    key: 'addis-bahir-07-00',
    from: 'Addis Ababa',
    to: 'Bahir Dar',
    departureTime: '07:00',
    arrivalTime: '15:00',
    duration: '8h',
    price: 800,
    priceMinor: 80000,
    currency: 'ETB',
    availableSeats: 40,
    active: true,
  },
  {
    key: 'addis-gondar-night',
    from: 'Addis Ababa',
    to: 'Gondar',
    departureTime: '20:00',
    arrivalTime: '06:00',
    duration: '10h',
    price: 900,
    priceMinor: 90000,
    currency: 'ETB',
    availableSeats: 30,
    active: false,
  },
]

const contact = {
  phone: '+251911000000',
  email: `transport.${RUN}@visitethiopia.test`,
}

function transportData(id, { status, organizationId, createdById, name }) {
  return {
    id,
    name,
    description: name,
    type: 'bus',
    vehicleDetails: { model: 'Coach', capacity: 40, images: [] },
    routes,
    contact,
    createdById,
    organizationId,
    status,
  }
}

async function seedInventory(transportId, organizationId, date, total, available, override = null) {
  await prisma.transportRouteInventory.create({
    data: {
      id: generateObjectId(),
      transportId,
      organizationId,
      routeKey: 'addis-bahir-07-00',
      date: new Date(`${date}T00:00:00.000Z`),
      totalSeats: total,
      availableSeats: available,
      reservedSeats: total - available,
      priceOverrideMinor: override,
      currency: 'ETB',
    },
  })
}

let server
try {
  await prisma.$queryRaw`SELECT 1`
  check(
    'mongo not connected',
    (await import('mongoose')).default.connection.readyState !== 1
  )

  await prisma.user.createMany({
    data: [
      {
        id: visitorId,
        firstName: 'Transport',
        lastName: 'Guest',
        email: `transport.guest.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'user',
        isVerified: true,
        active: true,
      },
      {
        id: ownerId,
        firstName: 'Transport',
        lastName: 'Owner',
        email: `transport.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'transport_manager',
        isVerified: true,
        active: true,
      },
      {
        id: otherOwnerId,
        firstName: 'Other',
        lastName: 'Owner',
        email: `transport.other.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'transport_manager',
        isVerified: true,
        active: true,
      },
    ],
  })

  await prisma.organization.create({
    data: {
      id: otherOrgId,
      name: `Private Transport Org ${RUN}`,
      slug: `private-transport-org-${RUN}`,
      providerTypes: ['tour_bus_provider'],
      approvalStatus: 'draft',
      visibility: 'private',
      description: '',
      shortDescription: '',
      uniqueSellingPoints: [],
      services: [],
      gallery: [],
      portfolioPhotos: [],
      ownerUserId: otherOwnerId,
      verification: {},
    },
  })
  await prisma.organization.create({
    data: {
      id: orgId,
      name: `Public Transport Org ${RUN}`,
      slug: `public-transport-org-${RUN}`,
      providerTypes: ['tour_bus_provider'],
      approvalStatus: 'draft',
      visibility: 'private',
      description: '',
      shortDescription: '',
      uniqueSellingPoints: [],
      services: [],
      gallery: [],
      portfolioPhotos: [],
      ownerUserId: ownerId,
      verification: {},
    },
  })
  await prisma.organizationMember.createMany({
    data: [
      {
        id: generateObjectId(),
        organizationId: orgId,
        userId: ownerId,
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(['tour_bus_provider']),
        membershipRoles: ['tour_bus_provider'],
        status: 'active',
      },
      {
        id: generateObjectId(),
        organizationId: otherOrgId,
        userId: otherOwnerId,
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(['tour_bus_provider']),
        membershipRoles: ['tour_bus_provider'],
        status: 'active',
      },
    ],
  })

  await prisma.transport.createMany({
    data: [
      transportData(legacyTransportId, {
        status: 'active',
        organizationId: null,
        createdById: ownerId,
        name: `Legacy Transport ${RUN}`,
      }),
      transportData(draftTransportId, {
        status: 'draft',
        organizationId: orgId,
        createdById: ownerId,
        name: `Draft Transport ${RUN}`,
      }),
      transportData(inactiveTransportId, {
        status: 'inactive',
        organizationId: orgId,
        createdById: ownerId,
        name: `Inactive Transport ${RUN}`,
      }),
      transportData(privateOrgTransportId, {
        status: 'active',
        organizationId: otherOrgId,
        createdById: otherOwnerId,
        name: `Private Org Transport ${RUN}`,
      }),
    ],
  })

  await prisma.providerVersion.create({
    data: {
      id: versionId,
      organizationId: orgId,
      versionNumber: 1,
      status: 'approved',
      snapshot: {
        name: `Public Transport Org ${RUN}`,
        providerTypes: ['tour_bus_provider'],
      },
      changedFields: [],
      requiresReapproval: false,
      approvedAt: new Date(),
    },
  })
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      approvalStatus: 'approved',
      visibility: 'public',
      approvedVersionId: versionId,
      latestVersionId: versionId,
    },
  })
  await prisma.transport.create({
    data: transportData(publicTransportId, {
      status: 'active',
      organizationId: orgId,
      createdById: ownerId,
      name: `Public Org Transport ${RUN}`,
    }),
  })

  // Inventory for booking tests (legacy uses orgId FK even though transport is null-org)
  await seedInventory(publicTransportId, orgId, '2032-05-01', 10, 10)
  await seedInventory(publicTransportId, orgId, '2032-05-02', 10, 10, 85000)
  await seedInventory(legacyTransportId, orgId, '2032-06-01', 5, 5)
  await seedInventory(publicTransportId, orgId, '2032-07-01', 10, 10)

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const guestLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.guest.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const ownerLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const otherLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.other.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  check('guest login', guestLogin.status === 200)
  const guestToken = guestLogin.data?.token
  const ownerToken = ownerLogin.data?.token
  const otherToken = otherLogin.data?.token

  const contactInfo = {
    fullName: 'Transport Guest',
    email: `transport.guest.${RUN}@visitethiopia.test`,
    phone: '+251911111111',
  }

  // Visibility
  const list = await req('GET', '/transports?status=active')
  const listIds = (list.data?.data?.data || []).map((t) => t._id || t.id)
  check(
    'public list hides draft',
    list.status === 200 && !listIds.includes(draftTransportId),
    `found=${listIds.includes(draftTransportId)}`
  )
  check(
    'public list hides inactive',
    !listIds.includes(inactiveTransportId)
  )
  check(
    'public list hides unapproved/private-org',
    !listIds.includes(privateOrgTransportId)
  )
  check(
    'public list shows approved/public org transport',
    listIds.includes(publicTransportId)
  )
  check(
    'public list shows legacy active transport',
    listIds.includes(legacyTransportId)
  )

  const draftDetail = await req('GET', `/transports/${draftTransportId}`)
  check('public detail hides draft', draftDetail.status === 404)

  const inactiveDetail = await req('GET', `/transports/${inactiveTransportId}`)
  check('public detail hides inactive', inactiveDetail.status === 404)

  const privateDetail = await req('GET', `/transports/${privateOrgTransportId}`)
  check('public detail hides private-org', privateDetail.status === 404)

  const publicDetail = await req('GET', `/transports/${publicTransportId}`)
  check(
    'approved/public org transport is visible',
    publicDetail.status === 200,
    `status=${publicDetail.status}`
  )

  const ownDraft = await req(
    'GET',
    `/organizations/${orgId}/transports/${draftTransportId}`,
    { token: ownerToken, headers: { 'X-Org-Context': orgId } }
  )
  check('provider can access own transport', ownDraft.status === 200)

  const crossGet = await req(
    'GET',
    `/organizations/${orgId}/transports/${draftTransportId}`,
    { token: otherToken, headers: { 'X-Org-Context': orgId } }
  )
  check(
    'provider cannot access another org transport',
    crossGet.status === 403,
    `status=${crossGet.status}`
  )

  // Publish draft → then unpublish
  const published = await req(
    'POST',
    `/organizations/${orgId}/transports/${draftTransportId}/publish`,
    { token: ownerToken, headers: { 'X-Org-Context': orgId } }
  )
  check(
    'publish draft → active',
    published.status === 200 &&
      published.data?.data?.data?.status === 'active',
    `status=${published.status}`
  )
  await req(
    'POST',
    `/organizations/${orgId}/transports/${draftTransportId}/unpublish`,
    { token: ownerToken, headers: { 'X-Org-Context': orgId } }
  )

  // Inventory create / upsert / cross-org
  const invCreate = await req(
    'POST',
    `/organizations/${orgId}/transports/${publicTransportId}/inventory`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {
        routeKey: 'addis-bahir-07-00',
        date: '2032-08-01',
        totalSeats: 20,
        availableSeats: 20,
      },
    }
  )
  check(
    'inventory creation works',
    invCreate.status === 201,
    `status=${invCreate.status}`
  )
  const invId = invCreate.data?.data?.data?._id
  const invUpsert = await req(
    'POST',
    `/organizations/${orgId}/transports/${publicTransportId}/inventory`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {
        routeKey: 'addis-bahir-07-00',
        date: '2032-08-01',
        totalSeats: 22,
        availableSeats: 22,
      },
    }
  )
  check(
    'inventory uniqueness/upsert works',
    invUpsert.status === 201 &&
      String(invUpsert.data?.data?.data?._id) === String(invId),
    `ids=${invId}/${invUpsert.data?.data?.data?._id}`
  )

  const crossInv = await req(
    'POST',
    `/organizations/${orgId}/transports/${publicTransportId}/inventory`,
    {
      token: otherToken,
      headers: { 'X-Org-Context': orgId },
      body: {
        routeKey: 'addis-bahir-07-00',
        date: '2032-08-02',
        totalSeats: 1,
        availableSeats: 1,
      },
    }
  )
  check(
    'provider cannot modify another org inventory',
    crossInv.status === 403,
    `status=${crossInv.status}`
  )

  const avail = await req(
    'GET',
    `/transports/${publicTransportId}/availability?travelDate=2032-05-01&routeKey=addis-bahir-07-00`
  )
  check(
    'availability calculation works',
    avail.status === 200 &&
      avail.data?.data?.availability?.[0]?.availableSeats === 10,
    `status=${avail.status} seats=${avail.data?.data?.availability?.[0]?.availableSeats}`
  )

  // Booking gates
  const draftBook = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `draft-block-${RUN}` },
    body: {
      transportId: draftTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-05-01',
      quantity: 1,
      contactInfo,
    },
  })
  check('hidden transport cannot be booked', draftBook.status === 404)

  const inactiveRt = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `inactive-rt-${RUN}` },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-gondar-night',
      travelDate: '2032-05-01',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'inactive route rejected',
    inactiveRt.status === 400,
    `status=${inactiveRt.status}`
  )

  const missingInv = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `missing-inv-${RUN}` },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-12-01',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'insufficient/missing inventory → 409',
    missingInv.status === 409,
    `status=${missingInv.status}`
  )

  // Successful booking + price override day
  const bookKey = `book-${RUN}`
  const book = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': bookKey },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-05-02',
      quantity: 2,
      contactInfo,
    },
  })
  const snap = book.data?.data?.priceSnapshot
  check(
    'booking creates correctly',
    book.status === 201 &&
      book.data?.data?.bookingType === 'transport' &&
      book.data?.data?.status === 'payment_pending',
    `status=${book.status}`
  )
  check(
    'price snapshot uses override',
    snap?.unitPriceMinor === 85000 && snap?.totalMinor === 170000,
    `unit=${snap?.unitPriceMinor} total=${snap?.totalMinor}`
  )

  const afterBook = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2032-05-02T00:00:00.000Z'),
    },
  })
  check(
    'inventory atomically reserved',
    afterBook?.availableSeats === 8 && afterBook?.reservedSeats === 2,
    `avail=${afterBook?.availableSeats} reserved=${afterBook?.reservedSeats}`
  )

  const again = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': bookKey },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-05-02',
      quantity: 2,
      contactInfo,
    },
  })
  check(
    'idempotent retry returns same booking',
    again.status === 200 && again.data?.idempotent === true,
    `status=${again.status}`
  )

  const conflict = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': bookKey },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-05-02',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'same idempotency key + different payload → 409',
    conflict.status === 409,
    `status=${conflict.status}`
  )

  const paymentId = book.data?.data?.payment?._id || book.data?.data?.paymentId
  const payOk = await req('POST', `/payments/${paymentId}/confirm`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-ok-${RUN}` },
    body: { mockOutcome: 'success' },
  })
  check(
    'payment success works',
    payOk.status === 200 &&
      payOk.data?.data?.booking?.status === 'confirmed',
    `status=${payOk.status}`
  )

  const failBook = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-fail-book-${RUN}` },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-05-01',
      quantity: 1,
      contactInfo,
    },
  })
  const beforeFail = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2032-05-01T00:00:00.000Z'),
    },
  })
  const failPayId =
    failBook.data?.data?.payment?._id || failBook.data?.data?.paymentId
  const payFail = await req('POST', `/payments/${failPayId}/confirm`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-fail-${RUN}` },
    body: { mockOutcome: 'fail' },
  })
  const afterFail = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2032-05-01T00:00:00.000Z'),
    },
  })
  check(
    'payment failure works (releases inventory)',
    payFail.status === 200 &&
      afterFail?.availableSeats === beforeFail.availableSeats + 1,
    `before=${beforeFail?.availableSeats} after=${afterFail?.availableSeats}`
  )

  const cancelBook = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `cancel-book-${RUN}` },
    body: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-05-01',
      quantity: 1,
      contactInfo,
    },
  })
  const cancelId = cancelBook.data?.data?._id
  const beforeCancel = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2032-05-01T00:00:00.000Z'),
    },
  })
  const cancel1 = await req('PATCH', `/bookings/${cancelId}/cancel`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `cancel-1-${RUN}` },
    body: { reason: 'changed_mind' },
  })
  const midCancel = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2032-05-01T00:00:00.000Z'),
    },
  })
  const cancel2 = await req('PATCH', `/bookings/${cancelId}/cancel`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `cancel-2-${RUN}` },
    body: { reason: 'changed_mind' },
  })
  check(
    'cancellation releases inventory',
    cancel1.status === 200 &&
      midCancel?.availableSeats === beforeCancel.availableSeats + 1,
    `status=${cancel1.status}`
  )
  check(
    'repeated cancel does not double-release',
    cancel2.status === 200 &&
      cancel2.data?.idempotent === true &&
      midCancel?.availableSeats ===
        (
          await prisma.transportRouteInventory.findFirst({
            where: {
              transportId: publicTransportId,
              routeKey: 'addis-bahir-07-00',
              date: new Date('2032-05-01T00:00:00.000Z'),
            },
          })
        )?.availableSeats
  )

  // Legacy can book
  const legacyBook = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `legacy-book-${RUN}` },
    body: {
      transportId: legacyTransportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2032-06-01',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'legacy active transport can be booked',
    legacyBook.status === 201,
    `status=${legacyBook.status}`
  )

  // Concurrency 20 vs 10
  const concAttempts = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      req('POST', '/bookings/transports', {
        token: guestToken,
        headers: { 'Idempotency-Key': `conc-${RUN}-${i}` },
        body: {
          transportId: publicTransportId,
          routeKey: 'addis-bahir-07-00',
          travelDate: '2032-07-01',
          quantity: 1,
          contactInfo,
        },
      }).then((r) => ({ ok: r.status === 201 || r.status === 200, status: r.status }))
    )
  )
  const ok = concAttempts.filter((a) => a.ok).length
  const fail = concAttempts.filter((a) => !a.ok).length
  const concInv = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId: publicTransportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2032-07-01T00:00:00.000Z'),
    },
  })
  check('concurrency: exactly 10 succeed', ok === 10, `ok=${ok}`)
  check('concurrency: exactly 10 fail', fail === 10, `fail=${fail}`)
  check(
    'concurrency: availableSeats = 0 / reserved = 10',
    concInv?.availableSeats === 0 && concInv?.reservedSeats === 10,
    `avail=${concInv?.availableSeats} reserved=${concInv?.reservedSeats}`
  )
  check(
    'inventory never negative',
    concInv?.availableSeats >= 0 && concInv?.reservedSeats >= 0
  )
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) await new Promise((r) => server.close(r))
  const transportIds = [
    legacyTransportId,
    publicTransportId,
    draftTransportId,
    inactiveTransportId,
    privateOrgTransportId,
  ]
  await prisma.inventoryHold
    .deleteMany({ where: { transportId: { in: transportIds } } })
    .catch(() => {})
  const bookings = await prisma.booking.findMany({
    where: { bookingItemId: { in: transportIds } },
    select: { id: true },
  })
  const bookingIds = bookings.map((b) => b.id)
  if (bookingIds.length) {
    await prisma.paymentAttempt
      .deleteMany({ where: { payment: { bookingId: { in: bookingIds } } } })
      .catch(() => {})
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
    await prisma.inventoryHold.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => {})
  }
  await prisma.transportRouteInventory
    .deleteMany({ where: { transportId: { in: transportIds } } })
    .catch(() => {})
  await prisma.transport.deleteMany({ where: { id: { in: transportIds } } }).catch(() => {})
  await prisma.organization
    .updateMany({
      where: { id: { in: [orgId, otherOrgId] } },
      data: { approvedVersionId: null, latestVersionId: null },
    })
    .catch(() => {})
  await prisma.providerVersion.deleteMany({ where: { organizationId: orgId } }).catch(() => {})
  await prisma.organizationMember
    .deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } })
    .catch(() => {})
  await prisma.organization
    .deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
    .catch(() => {})
  await prisma.user
    .deleteMany({ where: { id: { in: [visitorId, ownerId, otherOwnerId] } } })
    .catch(() => {})
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Transport marketplace Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
