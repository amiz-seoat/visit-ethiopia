/**
 * Transport provider fulfillment ops — Prisma-only HTTP tests.
 * Usage: node scripts/transport-fulfillment-prisma.js
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
  process.env.JWT_SECRET || 'transport-fulfillment-prisma-test-secret'
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

const PORT = 4106
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
const adminId = generateObjectId()
const orgId = generateObjectId()
const otherOrgId = generateObjectId()
const versionId = generateObjectId()
const transportId = generateObjectId()
const otherTransportId = generateObjectId()
const passwordPlain = 'TransportFulfill1!'
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
]

function transportData(id, { organizationId, createdById, name }) {
  return {
    id,
    name,
    description: name,
    type: 'bus',
    vehicleDetails: { model: 'Coach', capacity: 40, images: [] },
    routes,
    contact: { phone: '+251911000000', email: `tf.${RUN}@test.com` },
    createdById,
    organizationId,
    status: 'active',
  }
}

async function seedInventory(tid, date, total = 10) {
  await prisma.transportRouteInventory.create({
    data: {
      id: generateObjectId(),
      transportId: tid,
      organizationId: orgId,
      routeKey: 'addis-bahir-07-00',
      date: new Date(`${date}T00:00:00.000Z`),
      totalSeats: total,
      availableSeats: total,
      reservedSeats: 0,
      currency: 'ETB',
    },
  })
}

async function createConfirmedBooking({
  guestToken,
  travelDate,
  quantity = 1,
  key,
}) {
  const book = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': key },
    body: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      travelDate,
      quantity,
      contactInfo: {
        fullName: 'Fulfill Guest',
        email: `transport.fulfill.guest.${RUN}@visitethiopia.test`,
        phone: '+251911111111',
      },
    },
  })
  if (book.status !== 201 && book.status !== 200) {
    return { book, confirm: null }
  }
  const paymentId = book.data?.data?.payment?._id || book.data?.data?.paymentId
  const confirm = await req('POST', `/payments/${paymentId}/confirm`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-${key}` },
    body: { mockOutcome: 'success' },
  })
  return { book, confirm, bookingId: book.data?.data?._id, paymentId }
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
        firstName: 'Fulfill',
        lastName: 'Guest',
        email: `transport.fulfill.guest.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'user',
        isVerified: true,
        active: true,
      },
      {
        id: ownerId,
        firstName: 'Bus',
        lastName: 'Owner',
        email: `transport.fulfill.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'transport_manager',
        isVerified: true,
        active: true,
      },
      {
        id: otherOwnerId,
        firstName: 'Other',
        lastName: 'Owner',
        email: `transport.fulfill.other.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'transport_manager',
        isVerified: true,
        active: true,
      },
      {
        id: adminId,
        firstName: 'Admin',
        lastName: 'User',
        email: `transport.fulfill.admin.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'admin',
        isVerified: true,
        active: true,
      },
    ],
  })

  await prisma.organization.create({
    data: {
      id: otherOrgId,
      name: `Other Bus Org ${RUN}`,
      slug: `other-bus-org-${RUN}`,
      providerTypes: ['tour_bus_provider'],
      approvalStatus: 'approved',
      visibility: 'public',
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
      name: `Bus Org ${RUN}`,
      slug: `bus-org-${RUN}`,
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

  await prisma.providerVersion.create({
    data: {
      id: versionId,
      organizationId: orgId,
      versionNumber: 1,
      status: 'approved',
      snapshot: { name: `Bus Org ${RUN}`, providerTypes: ['tour_bus_provider'] },
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

  await prisma.transport.createMany({
    data: [
      transportData(transportId, {
        organizationId: orgId,
        createdById: ownerId,
        name: `Fulfill Bus ${RUN}`,
      }),
      transportData(otherTransportId, {
        organizationId: otherOrgId,
        createdById: otherOwnerId,
        name: `Other Bus ${RUN}`,
      }),
    ],
  })

  await seedInventory(transportId, '2033-03-01', 10)
  await seedInventory(transportId, '2033-03-02', 10)
  await seedInventory(transportId, '2033-03-03', 10)
  await seedInventory(transportId, '2033-03-04', 5)

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const guestLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.fulfill.guest.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const ownerLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.fulfill.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const otherLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.fulfill.other.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const adminLogin = await req('POST', '/users/login', {
    body: {
      email: `transport.fulfill.admin.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  check('logins', guestLogin.status === 200 && ownerLogin.status === 200)
  const guestToken = guestLogin.data?.token
  const ownerToken = ownerLogin.data?.token
  const otherToken = otherLogin.data?.token
  const adminToken = adminLogin.data?.token

  const created = await createConfirmedBooking({
    guestToken,
    travelDate: '2033-03-01',
    quantity: 2,
    key: `tf-main-${RUN}`,
  })
  check(
    'paid booking created',
    created.confirm?.status === 200 &&
      created.confirm?.data?.data?.booking?.status === 'confirmed',
    `book=${created.book.status} pay=${created.confirm?.status}`
  )
  const bookingId = created.bookingId

  const beforeFulfill = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2033-03-01T00:00:00.000Z'),
    },
  })
  check(
    'inventory reserved after payment',
    beforeFulfill?.availableSeats === 8 && beforeFulfill?.reservedSeats === 2,
    `avail=${beforeFulfill?.availableSeats}`
  )

  const list = await req('GET', '/provider/bookings?bookingType=transport', {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
  })
  const listIds = (list.data?.data || []).map((b) => b._id)
  check(
    'provider can list own transport bookings',
    list.status === 200 && listIds.includes(bookingId),
    `status=${list.status}`
  )

  const otherList = await req('GET', '/provider/bookings?bookingType=transport', {
    token: otherToken,
    headers: { 'X-Org-Context': otherOrgId },
  })
  const otherIds = (otherList.data?.data || []).map((b) => b._id)
  check(
    'provider cannot list another organization bookings',
    otherList.status === 200 && !otherIds.includes(bookingId),
    `status=${otherList.status}`
  )

  const detail = await req('GET', `/provider/bookings/${bookingId}`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
  })
  check(
    'provider can inspect own booking',
    detail.status === 200 &&
      detail.data?.data?.bookingType === 'transport' &&
      detail.data?.data?.route?.travelDate === '2033-03-01',
    `status=${detail.status}`
  )

  const crossDetail = await req('GET', `/provider/bookings/${bookingId}`, {
    token: otherToken,
    headers: { 'X-Org-Context': otherOrgId },
  })
  check(
    'cross-org booking access → 404',
    crossDetail.status === 404,
    `status=${crossDetail.status}`
  )

  const customerOp = await req('POST', `/provider/bookings/${bookingId}/check-in`, {
    token: guestToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'customer cannot perform provider fulfillment',
    customerOp.status === 403,
    `status=${customerOp.status}`
  )

  const checkIn = await req('POST', `/provider/bookings/${bookingId}/check-in`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'provider can check in valid booking',
    checkIn.status === 200 &&
      checkIn.data?.data?.fulfillmentStatus === 'checked_in',
    `status=${checkIn.status} fs=${checkIn.data?.data?.fulfillmentStatus}`
  )

  const checkInAgain = await req(
    'POST',
    `/provider/bookings/${bookingId}/check-in`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'repeated check-in is idempotent',
    checkInAgain.status === 200 && checkInAgain.data?.idempotent === true,
    `idempotent=${checkInAgain.data?.idempotent}`
  )

  const noShowFromChecked = await req(
    'POST',
    `/provider/bookings/${bookingId}/no-show`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'no-show invalid transition → 409',
    noShowFromChecked.status === 409,
    `status=${noShowFromChecked.status}`
  )

  const afterCheckInInv = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2033-03-01T00:00:00.000Z'),
    },
  })
  check(
    'inventory unchanged after check-in',
    afterCheckInInv?.availableSeats === beforeFulfill.availableSeats &&
      afterCheckInInv?.reservedSeats === beforeFulfill.reservedSeats,
    `avail=${afterCheckInInv?.availableSeats}`
  )

  const complete = await req('POST', `/provider/bookings/${bookingId}/complete`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'provider can complete checked-in booking',
    complete.status === 200 &&
      complete.data?.data?.fulfillmentStatus === 'completed',
    `status=${complete.status}`
  )

  const completeAgain = await req(
    'POST',
    `/provider/bookings/${bookingId}/complete`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'repeated complete is idempotent',
    completeAgain.status === 200 && completeAgain.data?.idempotent === true
  )

  const checkInAfterComplete = await req(
    'POST',
    `/provider/bookings/${bookingId}/check-in`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'check-in invalid transition → 409',
    checkInAfterComplete.status === 409,
    `status=${checkInAfterComplete.status}`
  )

  const afterCompleteInv = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2033-03-01T00:00:00.000Z'),
    },
  })
  check(
    'inventory unchanged after completion',
    afterCompleteInv?.availableSeats === 8 &&
      afterCompleteInv?.reservedSeats === 2
  )

  // No-show path on a fresh booking
  const noShowCreated = await createConfirmedBooking({
    guestToken,
    travelDate: '2033-03-02',
    quantity: 1,
    key: `tf-noshow-${RUN}`,
  })
  const noShowId = noShowCreated.bookingId
  const noShow = await req('POST', `/provider/bookings/${noShowId}/no-show`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'provider can mark valid booking no-show',
    noShow.status === 200 && noShow.data?.data?.fulfillmentStatus === 'no_show',
    `status=${noShow.status}`
  )
  const noShowAgain = await req('POST', `/provider/bookings/${noShowId}/no-show`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'repeated no-show is idempotent',
    noShowAgain.status === 200 && noShowAgain.data?.idempotent === true
  )
  const completeFromNoShow = await req(
    'POST',
    `/provider/bookings/${noShowId}/complete`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'completion invalid transition → 409',
    completeFromNoShow.status === 409,
    `status=${completeFromNoShow.status}`
  )

  // Admin can inspect/operate
  const adminGet = await req('GET', `/admin/bookings/${bookingId}`, {
    token: adminToken,
  })
  check(
    'admin can inspect transport booking',
    adminGet.status === 200 &&
      adminGet.data?.data?.bookingType === 'transport',
    `status=${adminGet.status}`
  )

  const adminBooking = await createConfirmedBooking({
    guestToken,
    travelDate: '2033-03-03',
    quantity: 1,
    key: `tf-admin-${RUN}`,
  })
  const adminCheckIn = await req(
    'POST',
    `/provider/bookings/${adminBooking.bookingId}/check-in`,
    {
      token: adminToken,
      headers: {
        'X-Org-Context': orgId,
        'X-Admin-Org-Bypass': 'true',
      },
      body: {},
    }
  )
  check(
    'admin can operate on transport booking',
    adminCheckIn.status === 200 &&
      adminCheckIn.data?.data?.fulfillmentStatus === 'checked_in',
    `status=${adminCheckIn.status}`
  )

  // Audits
  const audits = await req('GET', `/provider/bookings/${bookingId}/audits`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
  })
  const auditActions = (audits.data?.data || []).map((a) => a.action)
  check(
    'booking operation audits recorded',
    audits.status === 200 &&
      auditActions.includes('check_in') &&
      auditActions.includes('complete'),
    `actions=${JSON.stringify(auditActions)}`
  )

  // Cancellation still releases inventory
  const cancelCreated = await createConfirmedBooking({
    guestToken,
    travelDate: '2033-03-04',
    quantity: 1,
    key: `tf-cancel-${RUN}`,
  })
  // Paid confirmed must use refund cancel — create a payment_pending cancel instead
  const pendingBook = await req('POST', '/bookings/transports', {
    token: guestToken,
    headers: { 'Idempotency-Key': `tf-pending-cancel-${RUN}` },
    body: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      travelDate: '2033-03-04',
      quantity: 1,
      contactInfo: {
        fullName: 'Fulfill Guest',
        email: `transport.fulfill.guest.${RUN}@visitethiopia.test`,
        phone: '+251911111111',
      },
    },
  })
  // After confirmed booking of 1 and this pending of 1, seats were 5 → 4 → 3
  const beforeCancel = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2033-03-04T00:00:00.000Z'),
    },
  })
  const pendingId = pendingBook.data?.data?._id
  const cancel = await req('PATCH', `/bookings/${pendingId}/cancel`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `tf-cancel-act-${RUN}` },
    body: { reason: 'changed_mind' },
  })
  const afterCancel = await prisma.transportRouteInventory.findFirst({
    where: {
      transportId,
      routeKey: 'addis-bahir-07-00',
      date: new Date('2033-03-04T00:00:00.000Z'),
    },
  })
  check(
    'cancellation still releases inventory',
    cancel.status === 200 &&
      afterCancel?.availableSeats === beforeCancel.availableSeats + 1,
    `before=${beforeCancel?.availableSeats} after=${afterCancel?.availableSeats} status=${cancel.status}`
  )

  // Payment status consistency on completed booking
  const paid = await prisma.payment.findFirst({
    where: { bookingId: String(bookingId) },
  })
  const booked = await prisma.booking.findUnique({ where: { id: String(bookingId) } })
  check(
    'paid booking status consistent with payment',
    booked?.status === 'confirmed' && paid?.status === 'completed',
    `booking=${booked?.status} payment=${paid?.status}`
  )

  void cancelCreated
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) await new Promise((r) => server.close(r))
  try {
    const transportIds = [transportId, otherTransportId]
    const bookings = await prisma.booking.findMany({
      where: { bookingItemId: { in: transportIds } },
      select: { id: true },
    })
    const bookingIds = bookings.map((b) => b.id)
    if (bookingIds.length) {
      await prisma.bookingOperationAudit
        .deleteMany({ where: { bookingId: { in: bookingIds } } })
        .catch(() => {})
      await prisma.bookingProviderNote
        .deleteMany({ where: { bookingId: { in: bookingIds } } })
        .catch(() => {})
      await prisma.paymentAttempt
        .deleteMany({ where: { payment: { bookingId: { in: bookingIds } } } })
        .catch(() => {})
      await prisma.payment
        .deleteMany({ where: { bookingId: { in: bookingIds } } })
        .catch(() => {})
      await prisma.inventoryHold
        .deleteMany({ where: { bookingId: { in: bookingIds } } })
        .catch(() => {})
      await prisma.booking
        .deleteMany({ where: { id: { in: bookingIds } } })
        .catch(() => {})
    }
    await prisma.transportRouteInventory
      .deleteMany({ where: { transportId: { in: transportIds } } })
      .catch(() => {})
    await prisma.transport
      .deleteMany({ where: { id: { in: transportIds } } })
      .catch(() => {})
    await prisma.organization
      .updateMany({
        where: { id: { in: [orgId, otherOrgId] } },
        data: { approvedVersionId: null, latestVersionId: null },
      })
      .catch(() => {})
    await prisma.providerVersion
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => {})
    await prisma.organizationMember
      .deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } })
      .catch(() => {})
    await prisma.organization
      .deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({
        where: { id: { in: [visitorId, ownerId, otherOwnerId, adminId] } },
      })
      .catch(() => {})
  } catch {
    // Best-effort cleanup when DB is unavailable.
  }
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Transport fulfillment Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
