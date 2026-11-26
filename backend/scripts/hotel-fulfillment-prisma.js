/**
 * Hotel provider fulfillment ops — Prisma-only HTTP tests.
 * Usage: node scripts/hotel-fulfillment-prisma.js
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
  process.env.JWT_SECRET || 'hotel-fulfillment-prisma-test-secret'
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

const PORT = 4107
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const RUN = generateObjectId().slice(0, 8)

function utcTodayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function addUtcDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

const TODAY = utcTodayYmd()
const TOMORROW = addUtcDays(TODAY, 1)
const DAY_AFTER = addUtcDays(TODAY, 2)
const FUTURE_IN = '2034-06-10'
const FUTURE_OUT = '2034-06-12'
const CANCEL_IN = '2034-06-20'
const CANCEL_OUT = '2034-06-21'

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
const hotelId = generateObjectId()
const otherHotelId = generateObjectId()
const passwordPlain = 'HotelFulfill1!'
const passwordHash = await hashPassword(passwordPlain)

const cover =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'
const loc = { address: '1 Test', city: 'Addis Ababa', region: 'Addis Ababa' }
const contact = {
  phone: '+251911000000',
  email: `hotel.fulfill.${RUN}@visitethiopia.test`,
}
const roomTypes = [
  {
    key: 'standard',
    type: 'Standard Room',
    name: 'Standard Room',
    description: 'Nice',
    capacity: 2,
    price: 50,
    priceMinor: 5000,
    currency: 'ETB',
    amenities: [],
    images: [],
    availableRooms: 0,
    active: true,
  },
]

function hotelData(id, { organizationId, createdById, name }) {
  return {
    id,
    name,
    description: name,
    shortDescription: name,
    location: loc,
    coverImage: cover,
    contact,
    roomTypes,
    amenities: [],
    images: [],
    createdById,
    organizationId,
    status: 'active',
  }
}

async function seedInventory(hid, organizationId, date, total = 10) {
  await prisma.hotelDailyInventory.create({
    data: {
      id: generateObjectId(),
      hotelId: hid,
      organizationId,
      roomTypeKey: 'standard',
      date: new Date(`${date}T00:00:00.000Z`),
      totalRooms: total,
      availableRooms: total,
      reservedRooms: 0,
      currency: 'ETB',
    },
  })
}

async function invFor(hid, date) {
  return prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: hid,
      roomTypeKey: 'standard',
      date: new Date(`${date}T00:00:00.000Z`),
    },
  })
}

async function createConfirmedHotelBooking({
  guestToken,
  checkIn,
  checkOut,
  quantity = 1,
  key,
  hotel = hotelId,
}) {
  const book = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': key },
    body: {
      hotelId: hotel,
      roomTypeKey: 'standard',
      checkIn,
      checkOut,
      quantity,
      contactInfo: {
        fullName: 'Hotel Fulfill Guest',
        email: `hotel.fulfill.guest.${RUN}@visitethiopia.test`,
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
        firstName: 'Hotel',
        lastName: 'Guest',
        email: `hotel.fulfill.guest.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'user',
        isVerified: true,
        active: true,
      },
      {
        id: ownerId,
        firstName: 'Hotel',
        lastName: 'Owner',
        email: `hotel.fulfill.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
      {
        id: otherOwnerId,
        firstName: 'Other',
        lastName: 'Owner',
        email: `hotel.fulfill.other.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
      {
        id: adminId,
        firstName: 'Admin',
        lastName: 'User',
        email: `hotel.fulfill.admin.${RUN}@visitethiopia.test`,
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
      name: `Other Hotel Org ${RUN}`,
      slug: `other-hotel-org-${RUN}`,
      providerTypes: ['hotel'],
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
      name: `Hotel Org ${RUN}`,
      slug: `hotel-org-${RUN}`,
      providerTypes: ['hotel'],
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
        permissions: permissionsForProviderTypes(['hotel']),
        membershipRoles: ['hotel_manager'],
        status: 'active',
      },
      {
        id: generateObjectId(),
        organizationId: otherOrgId,
        userId: otherOwnerId,
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(['hotel']),
        membershipRoles: ['hotel_manager'],
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
      snapshot: { name: `Hotel Org ${RUN}`, providerTypes: ['hotel'] },
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

  await prisma.hotel.createMany({
    data: [
      hotelData(hotelId, {
        organizationId: orgId,
        createdById: ownerId,
        name: `Fulfill Hotel ${RUN}`,
      }),
      hotelData(otherHotelId, {
        organizationId: otherOrgId,
        createdById: otherOwnerId,
        name: `Other Hotel ${RUN}`,
      }),
    ],
  })

  for (const day of [TODAY, TOMORROW, DAY_AFTER, FUTURE_IN, addUtcDays(FUTURE_IN, 1), CANCEL_IN]) {
    await seedInventory(hotelId, orgId, day, 10)
  }
  await seedInventory(otherHotelId, otherOrgId, TODAY, 5)

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const guestLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.fulfill.guest.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const ownerLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.fulfill.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const otherLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.fulfill.other.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const adminLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.fulfill.admin.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  check(
    'logins',
    guestLogin.status === 200 &&
      ownerLogin.status === 200 &&
      otherLogin.status === 200 &&
      adminLogin.status === 200
  )
  const guestToken = guestLogin.data?.token
  const ownerToken = ownerLogin.data?.token
  const otherToken = otherLogin.data?.token
  const adminToken = adminLogin.data?.token

  const created = await createConfirmedHotelBooking({
    guestToken,
    checkIn: TODAY,
    checkOut: DAY_AFTER,
    quantity: 2,
    key: `hf-main-${RUN}`,
  })
  check(
    'paid booking created',
    created.confirm?.status === 200 &&
      created.confirm?.data?.data?.booking?.status === 'confirmed',
    `book=${created.book.status} pay=${created.confirm?.status}`
  )
  const bookingId = created.bookingId

  const beforeFulfill = await invFor(hotelId, TODAY)
  check(
    'inventory reserved after payment',
    beforeFulfill?.availableRooms === 8 && beforeFulfill?.reservedRooms === 2,
    `avail=${beforeFulfill?.availableRooms}`
  )

  const list = await req('GET', '/provider/bookings?bookingType=hotel', {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
  })
  const listIds = (list.data?.data || []).map((b) => b._id)
  check(
    'hotel provider can list its bookings',
    list.status === 200 && listIds.includes(bookingId),
    `status=${list.status}`
  )

  const otherList = await req('GET', '/provider/bookings?bookingType=hotel', {
    token: otherToken,
    headers: { 'X-Org-Context': otherOrgId },
  })
  const otherIds = (otherList.data?.data || []).map((b) => b._id)
  check(
    'hotel provider cannot access another organization bookings',
    otherList.status === 200 && !otherIds.includes(bookingId),
    `status=${otherList.status}`
  )

  const detail = await req('GET', `/provider/bookings/${bookingId}`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
  })
  check(
    'provider can inspect its own booking',
    detail.status === 200 &&
      detail.data?.data?.bookingType === 'hotel' &&
      detail.data?.data?.stay?.checkIn === TODAY &&
      detail.data?.data?.hotel?.name,
    `status=${detail.status}`
  )

  const crossDetail = await req('GET', `/provider/bookings/${bookingId}`, {
    token: otherToken,
    headers: { 'X-Org-Context': otherOrgId },
  })
  check(
    'cross-organization access is denied',
    crossDetail.status === 404,
    `status=${crossDetail.status}`
  )

  const customerOp = await req('POST', `/provider/bookings/${bookingId}/check-in`, {
    token: guestToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'customer cannot perform hotel fulfillment',
    customerOp.status === 403,
    `status=${customerOp.status}`
  )

  // Premature check-in on future stay
  const prematureCreated = await createConfirmedHotelBooking({
    guestToken,
    checkIn: FUTURE_IN,
    checkOut: FUTURE_OUT,
    quantity: 1,
    key: `hf-premature-${RUN}`,
  })
  const prematureCheckIn = await req(
    'POST',
    `/provider/bookings/${prematureCreated.bookingId}/check-in`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'premature check-in is rejected',
    prematureCheckIn.status === 409,
    `status=${prematureCheckIn.status}`
  )

  const checkOutBefore = await req(
    'POST',
    `/provider/bookings/${bookingId}/check-out`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'check-out before check-in is rejected',
    checkOutBefore.status === 409,
    `status=${checkOutBefore.status}`
  )

  const checkIn = await req('POST', `/provider/bookings/${bookingId}/check-in`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'valid check-in succeeds',
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
    'repeated check-in behaves safely',
    checkInAgain.status === 200 && checkInAgain.data?.idempotent === true,
    `idempotent=${checkInAgain.data?.idempotent}`
  )

  const afterCheckInInv = await invFor(hotelId, TODAY)
  check(
    'inventory remains correct after check-in',
    afterCheckInInv?.availableRooms === beforeFulfill.availableRooms &&
      afterCheckInInv?.reservedRooms === beforeFulfill.reservedRooms,
    `avail=${afterCheckInInv?.availableRooms}`
  )

  const checkOut = await req('POST', `/provider/bookings/${bookingId}/check-out`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'check-out succeeds after check-in',
    checkOut.status === 200 &&
      checkOut.data?.data?.fulfillmentStatus === 'completed',
    `status=${checkOut.status}`
  )

  const checkOutAgain = await req(
    'POST',
    `/provider/bookings/${bookingId}/check-out`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'repeated check-out behaves safely',
    checkOutAgain.status === 200 && checkOutAgain.data?.idempotent === true
  )

  const afterCheckOutInv = await invFor(hotelId, TODAY)
  check(
    'inventory remains correct after check-out',
    afterCheckOutInv?.availableRooms === 8 &&
      afterCheckOutInv?.reservedRooms === 2
  )

  const checkInAfterOut = await req(
    'POST',
    `/provider/bookings/${bookingId}/check-in`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'check-in after check-out rejected',
    checkInAfterOut.status === 409,
    `status=${checkInAfterOut.status}`
  )

  // No-show path
  const noShowCreated = await createConfirmedHotelBooking({
    guestToken,
    checkIn: TODAY,
    checkOut: TOMORROW,
    quantity: 1,
    key: `hf-noshow-${RUN}`,
  })
  const noShowId = noShowCreated.bookingId
  const noShow = await req('POST', `/provider/bookings/${noShowId}/no-show`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
    body: {},
  })
  check(
    'valid no-show succeeds',
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

  const invalidNoShow = await req(
    'POST',
    `/provider/bookings/${bookingId}/no-show`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'invalid no-show is rejected',
    invalidNoShow.status === 409,
    `status=${invalidNoShow.status}`
  )

  const prematureNoShow = await req(
    'POST',
    `/provider/bookings/${prematureCreated.bookingId}/no-show`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
      body: {},
    }
  )
  check(
    'premature no-show rejected',
    prematureNoShow.status === 409,
    `status=${prematureNoShow.status}`
  )

  const adminGet = await req('GET', `/admin/bookings/${bookingId}`, {
    token: adminToken,
  })
  check(
    'admin operations work',
    adminGet.status === 200 && adminGet.data?.data?.bookingType === 'hotel',
    `status=${adminGet.status}`
  )

  const adminBooking = await createConfirmedHotelBooking({
    guestToken,
    checkIn: TODAY,
    checkOut: TOMORROW,
    quantity: 1,
    key: `hf-admin-${RUN}`,
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
    'admin can operate hotel booking',
    adminCheckIn.status === 200 &&
      adminCheckIn.data?.data?.fulfillmentStatus === 'checked_in',
    `status=${adminCheckIn.status}`
  )

  const audits = await req('GET', `/provider/bookings/${bookingId}/audits`, {
    token: ownerToken,
    headers: { 'X-Org-Context': orgId },
  })
  const auditActions = (audits.data?.data || []).map((a) => a.action)
  check(
    'audit records are correct',
    audits.status === 200 &&
      auditActions.includes('check_in') &&
      auditActions.includes('check_out'),
    `actions=${JSON.stringify(auditActions)}`
  )

  const pendingBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `hf-pending-cancel-${RUN}` },
    body: {
      hotelId,
      roomTypeKey: 'standard',
      checkIn: CANCEL_IN,
      checkOut: CANCEL_OUT,
      quantity: 1,
      contactInfo: {
        fullName: 'Hotel Fulfill Guest',
        email: `hotel.fulfill.guest.${RUN}@visitethiopia.test`,
        phone: '+251911111111',
      },
    },
  })
  const beforeCancel = await invFor(hotelId, CANCEL_IN)
  const pendingId = pendingBook.data?.data?._id
  const cancel = await req('PATCH', `/bookings/${pendingId}/cancel`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `hf-cancel-act-${RUN}` },
    body: { reason: 'changed_mind' },
  })
  const afterCancel = await invFor(hotelId, CANCEL_IN)
  check(
    'cancellation still releases inventory',
    cancel.status === 200 &&
      afterCancel?.availableRooms === beforeCancel.availableRooms + 1,
    `before=${beforeCancel?.availableRooms} after=${afterCancel?.availableRooms} status=${cancel.status}`
  )

  const paid = await prisma.payment.findFirst({
    where: { bookingId: String(bookingId) },
  })
  const booked = await prisma.booking.findUnique({
    where: { id: String(bookingId) },
  })
  check(
    'payment status remains consistent',
    booked?.status === 'confirmed' && paid?.status === 'completed',
    `booking=${booked?.status} payment=${paid?.status}`
  )

  check(
    'Prisma mode never falls back to Mongo',
    (await import('mongoose')).default.connection.readyState !== 1
  )
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) await new Promise((r) => server.close(r))
  try {
    const hotelIds = [hotelId, otherHotelId]
    const bookings = await prisma.booking.findMany({
      where: { bookingItemId: { in: hotelIds } },
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
    await prisma.hotelDailyInventory
      .deleteMany({ where: { hotelId: { in: hotelIds } } })
      .catch(() => {})
    await prisma.hotel.deleteMany({ where: { id: { in: hotelIds } } }).catch(() => {})
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
  `\n=== Hotel fulfillment Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
