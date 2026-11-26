/**
 * Hotel booking + daily inventory — Prisma-only HTTP tests.
 * Usage: node scripts/hotel-booking-prisma.js
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
  process.env.JWT_SECRET || 'hotel-booking-prisma-test-secret'
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

const PORT = 4104
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
const legacyHotelId = generateObjectId()
const publicHotelId = generateObjectId()
const draftHotelId = generateObjectId()
const inactiveHotelId = generateObjectId()
const privateOrgHotelId = generateObjectId()
const passwordPlain = 'HotelBookPass1!'
const passwordHash = await hashPassword(passwordPlain)

const cover =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'
const loc = { address: '1 Test', city: 'Addis Ababa', region: 'Addis Ababa' }
const contact = {
  phone: '+251911000000',
  email: `hotel.book.${RUN}@visitethiopia.test`,
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
  {
    key: 'deluxe',
    type: 'Deluxe Room',
    name: 'Deluxe Room',
    description: 'Better',
    capacity: 3,
    price: 80,
    priceMinor: 8000,
    currency: 'ETB',
    amenities: [],
    images: [],
    availableRooms: 0,
    active: false,
  },
]

function hotelData(id, { status, organizationId, createdById, name }) {
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
    status,
  }
}

async function seedInventory(hotelId, organizationId, date, total, available, override = null) {
  await prisma.hotelDailyInventory.create({
    data: {
      id: generateObjectId(),
      hotelId,
      organizationId: organizationId || orgId,
      roomTypeKey: 'standard',
      date: new Date(`${date}T00:00:00.000Z`),
      totalRooms: total,
      availableRooms: available,
      reservedRooms: total - available,
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
        firstName: 'Hotel',
        lastName: 'Guest',
        email: `hotel.book.guest.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'user',
        isVerified: true,
        active: true,
      },
      {
        id: ownerId,
        firstName: 'Hotel',
        lastName: 'Owner',
        email: `hotel.book.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
      {
        id: otherOwnerId,
        firstName: 'Other',
        lastName: 'Owner',
        email: `hotel.book.other.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
    ],
  })

  await prisma.organization.create({
    data: {
      id: otherOrgId,
      name: `Private Hotel Org ${RUN}`,
      slug: `private-hotel-org-${RUN}`,
      providerTypes: ['hotel'],
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
      name: `Public Hotel Org ${RUN}`,
      slug: `public-hotel-org-${RUN}`,
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

  await prisma.hotel.createMany({
    data: [
      hotelData(legacyHotelId, {
        status: 'active',
        organizationId: null,
        createdById: ownerId,
        name: `Legacy Hotel ${RUN}`,
      }),
      hotelData(draftHotelId, {
        status: 'draft',
        organizationId: orgId,
        createdById: ownerId,
        name: `Draft Hotel ${RUN}`,
      }),
      hotelData(inactiveHotelId, {
        status: 'inactive',
        organizationId: orgId,
        createdById: ownerId,
        name: `Inactive Hotel ${RUN}`,
      }),
      hotelData(privateOrgHotelId, {
        status: 'active',
        organizationId: otherOrgId,
        createdById: otherOwnerId,
        name: `Private Org Hotel ${RUN}`,
      }),
    ],
  })

  await prisma.providerVersion.create({
    data: {
      id: versionId,
      organizationId: orgId,
      versionNumber: 1,
      status: 'approved',
      snapshot: { name: `Public Hotel Org ${RUN}`, providerTypes: ['hotel'] },
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
  await prisma.hotel.create({
    data: hotelData(publicHotelId, {
      status: 'active',
      organizationId: orgId,
      createdById: ownerId,
      name: `Public Org Hotel ${RUN}`,
    }),
  })

  // Inventory fixtures (checkout night 2031-07-04 must NOT be reserved for 07-01..07-04 stay)
  for (const d of ['2031-07-01', '2031-07-02', '2031-07-03']) {
    await seedInventory(publicHotelId, orgId, d, 10, 10, d === '2031-07-02' ? 6000 : null)
  }
  await seedInventory(publicHotelId, orgId, '2031-07-04', 10, 10) // checkout — must stay untouched
  await seedInventory(legacyHotelId, orgId, '2031-08-01', 5, 5)
  // Multi-night rollback: night1=1, night2=10
  await seedInventory(publicHotelId, orgId, '2031-09-01', 10, 1)
  await seedInventory(publicHotelId, orgId, '2031-09-02', 10, 10)
  // Concurrency night
  await seedInventory(publicHotelId, orgId, '2031-10-01', 10, 10)

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const guestLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.book.guest.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const ownerLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.book.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const otherLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.book.other.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  check('guest login', guestLogin.status === 200)
  const guestToken = guestLogin.data?.token
  const ownerToken = ownerLogin.data?.token
  const otherToken = otherLogin.data?.token

  const contactInfo = {
    fullName: 'Hotel Guest',
    email: `hotel.book.guest.${RUN}@visitethiopia.test`,
    phone: '+251911111111',
  }

  // Visibility gates
  const draftBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `draft-block-${RUN}` },
    body: {
      hotelId: draftHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-02',
      quantity: 1,
      contactInfo,
    },
  })
  check('draft hotel cannot be booked', draftBook.status === 404, `status=${draftBook.status}`)

  const inactiveBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `inactive-block-${RUN}` },
    body: {
      hotelId: inactiveHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-02',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'inactive hotel cannot be booked',
    inactiveBook.status === 404,
    `status=${inactiveBook.status}`
  )

  const privateBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `private-block-${RUN}` },
    body: {
      hotelId: privateOrgHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-02',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'unapproved/private-org hotel cannot be booked',
    privateBook.status === 404,
    `status=${privateBook.status}`
  )

  const badDates = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `baddates-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-05',
      checkOut: '2031-07-01',
      quantity: 1,
      contactInfo,
    },
  })
  check('invalid check-in/out rejected', badDates.status === 400, `status=${badDates.status}`)

  const unknownRt = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `unknownrt-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'penthouse',
      checkIn: '2031-07-01',
      checkOut: '2031-07-02',
      quantity: 1,
      contactInfo,
    },
  })
  check('unknown roomTypeKey rejected', unknownRt.status === 400, `status=${unknownRt.status}`)

  const inactiveRt = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `inactivert-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'deluxe',
      checkIn: '2031-07-01',
      checkOut: '2031-07-02',
      quantity: 1,
      contactInfo,
    },
  })
  check('inactive room type rejected', inactiveRt.status === 400, `status=${inactiveRt.status}`)

  const missingNight = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `missingnight-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-11-01',
      checkOut: '2031-11-02',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'missing inventory night rejected',
    missingNight.status === 409,
    `status=${missingNight.status}`
  )

  // Legacy single-night
  const legacyKey = `legacy-book-${RUN}`
  const legacyBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': legacyKey },
    body: {
      hotelId: legacyHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-08-01',
      checkOut: '2031-08-02',
      quantity: 1,
      contactInfo,
    },
  })
  check(
    'public active legacy hotel can be booked',
    legacyBook.status === 201 && legacyBook.data?.data?.bookingType === 'hotel',
    `status=${legacyBook.status}`
  )

  // Multi-night + price snapshot + checkout not reserved
  const multiKey = `multi-book-${RUN}`
  const multi = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': multiKey },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-04',
      quantity: 2,
      contactInfo,
    },
  })
  const snap = multi.data?.data?.priceSnapshot
  // nights: 5000 + 6000 + 5000 = 16000 unit; ×2 = 32000
  check(
    'successful multi-night booking',
    multi.status === 201 && multi.data?.data?.status === 'payment_pending',
    `status=${multi.status}`
  )
  check(
    'correct nightly price snapshot',
    snap?.totalMinor === 32000 &&
      snap?.unitPriceMinor === 16000 &&
      snap?.nights?.length === 3 &&
      !snap.nights.includes('2031-07-04'),
    `total=${snap?.totalMinor} nights=${JSON.stringify(snap?.nights)}`
  )
  check(
    'daily price override works',
    snap?.nightlyRates?.some((n) => n.date === '2031-07-02' && n.priceMinor === 6000),
    `rates=${JSON.stringify(snap?.nightlyRates)}`
  )

  const n1 = await prisma.hotelDailyInventory.findFirst({
    where: { hotelId: publicHotelId, roomTypeKey: 'standard', date: new Date('2031-07-01T00:00:00.000Z') },
  })
  const checkout = await prisma.hotelDailyInventory.findFirst({
    where: { hotelId: publicHotelId, roomTypeKey: 'standard', date: new Date('2031-07-04T00:00:00.000Z') },
  })
  check(
    'checkout date is not reserved',
    checkout?.availableRooms === 10 && checkout?.reservedRooms === 0,
    `avail=${checkout?.availableRooms} reserved=${checkout?.reservedRooms}`
  )
  check(
    'inventory reserved for stay nights',
    n1?.availableRooms === 8 && n1?.reservedRooms === 2,
    `avail=${n1?.availableRooms} reserved=${n1?.reservedRooms}`
  )

  // Idempotency
  const multiAgain = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': multiKey },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-04',
      quantity: 2,
      contactInfo,
    },
  })
  check(
    'idempotent repeated booking',
    multiAgain.status === 200 && multiAgain.data?.idempotent === true,
    `status=${multiAgain.status}`
  )

  const conflict = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': multiKey },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-03',
      quantity: 2,
      contactInfo,
    },
  })
  check(
    'conflicting idempotency key → 409',
    conflict.status === 409,
    `status=${conflict.status}`
  )

  // Payment success
  const paymentId = multi.data?.data?.payment?._id || multi.data?.data?.paymentId
  const payOk = await req('POST', `/payments/${paymentId}/confirm`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-ok-${RUN}` },
    body: { mockOutcome: 'success' },
  })
  check(
    'payment success lifecycle',
    payOk.status === 200 &&
      (payOk.data?.data?.booking?.status === 'confirmed' ||
        payOk.data?.booking?.status === 'confirmed' ||
        payOk.data?.data?.status === 'completed'),
    `status=${payOk.status} body=${JSON.stringify(payOk.data?.data?.booking?.status || payOk.data?.data?.status)}`
  )

  // Payment failure releases inventory
  const failBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-fail-book-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-01',
      checkOut: '2031-07-02',
      quantity: 1,
      contactInfo,
    },
  })
  const failPayId =
    failBook.data?.data?.payment?._id || failBook.data?.data?.paymentId
  const beforeFail = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-07-01T00:00:00.000Z'),
    },
  })
  const payFail = await req('POST', `/payments/${failPayId}/confirm`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `pay-fail-${RUN}` },
    body: { mockOutcome: 'fail' },
  })
  const afterFail = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-07-01T00:00:00.000Z'),
    },
  })
  check(
    'payment failure releases inventory',
    payFail.status === 200 &&
      afterFail?.availableRooms === beforeFail.availableRooms + 1,
    `before=${beforeFail?.availableRooms} after=${afterFail?.availableRooms} status=${payFail.status}`
  )

  // Cancellation release (new pending booking)
  const cancelBook = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `cancel-book-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-07-02',
      checkOut: '2031-07-03',
      quantity: 1,
      contactInfo,
    },
  })
  const cancelBookingId = cancelBook.data?.data?._id
  const beforeCancel = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-07-02T00:00:00.000Z'),
    },
  })
  const cancel1 = await req('PATCH', `/bookings/${cancelBookingId}/cancel`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `cancel-1-${RUN}` },
    body: { reason: 'changed_mind' },
  })
  const midCancel = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-07-02T00:00:00.000Z'),
    },
  })
  const cancel2 = await req('PATCH', `/bookings/${cancelBookingId}/cancel`, {
    token: guestToken,
    headers: { 'Idempotency-Key': `cancel-2-${RUN}` },
    body: { reason: 'changed_mind' },
  })
  const afterCancel = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-07-02T00:00:00.000Z'),
    },
  })
  check(
    'cancellation releases booked night',
    cancel1.status === 200 &&
      midCancel?.availableRooms === beforeCancel.availableRooms + 1,
    `status=${cancel1.status}`
  )
  check(
    'repeated cancellation does not double-release',
    cancel2.status === 200 &&
      cancel2.data?.idempotent === true &&
      afterCancel?.availableRooms === midCancel?.availableRooms,
    `idempotent=${cancel2.data?.idempotent} avail=${afterCancel?.availableRooms}`
  )

  // Cross-org inventory mutate denied
  const crossInv = await req(
    'POST',
    `/organizations/${orgId}/hotels/${publicHotelId}/inventory`,
    {
      token: otherToken,
      headers: { 'X-Org-Context': orgId },
      body: {
        roomTypeKey: 'standard',
        date: '2031-12-01',
        totalRooms: 1,
        availableRooms: 1,
      },
    }
  )
  check(
    'cross-org inventory access denied',
    crossInv.status === 403,
    `status=${crossInv.status}`
  )

  // Multi-night rollback
  const rollback = await req('POST', '/bookings/hotels', {
    token: guestToken,
    headers: { 'Idempotency-Key': `rollback-${RUN}` },
    body: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      checkIn: '2031-09-01',
      checkOut: '2031-09-03',
      quantity: 2,
      contactInfo,
    },
  })
  const r1 = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-09-01T00:00:00.000Z'),
    },
  })
  const r2 = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-09-02T00:00:00.000Z'),
    },
  })
  check(
    'multi-night rollback when one night lacks capacity',
    rollback.status === 409 &&
      r1?.availableRooms === 1 &&
      r2?.availableRooms === 10,
    `status=${rollback.status} n1=${r1?.availableRooms} n2=${r2?.availableRooms}`
  )

  // Concurrency 20 vs 10
  const concAttempts = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      req('POST', '/bookings/hotels', {
        token: guestToken,
        headers: { 'Idempotency-Key': `conc-${RUN}-${i}` },
        body: {
          hotelId: publicHotelId,
          roomTypeKey: 'standard',
          checkIn: '2031-10-01',
          checkOut: '2031-10-02',
          quantity: 1,
          contactInfo,
        },
      }).then((r) => ({ ok: r.status === 201 || r.status === 200, status: r.status }))
    )
  )
  const ok = concAttempts.filter((a) => a.ok).length
  const fail = concAttempts.filter((a) => !a.ok).length
  const concInv = await prisma.hotelDailyInventory.findFirst({
    where: {
      hotelId: publicHotelId,
      roomTypeKey: 'standard',
      date: new Date('2031-10-01T00:00:00.000Z'),
    },
  })
  check('concurrency: exactly 10 succeed', ok === 10, `ok=${ok}`)
  check('concurrency: exactly 10 fail', fail === 10, `fail=${fail}`)
  check(
    'concurrency: availableRooms = 0 / reserved = 10',
    concInv?.availableRooms === 0 && concInv?.reservedRooms === 10,
    `avail=${concInv?.availableRooms} reserved=${concInv?.reservedRooms}`
  )
  check(
    'inventory never negative',
    concInv?.availableRooms >= 0 && concInv?.reservedRooms >= 0,
    `avail=${concInv?.availableRooms}`
  )

  // Owner can still manage own inventory (happy path)
  const ownInv = await req(
    'GET',
    `/organizations/${orgId}/hotels/${publicHotelId}/inventory`,
    {
      token: ownerToken,
      headers: { 'X-Org-Context': orgId },
    }
  )
  check(
    'provider can list own hotel inventory',
    ownInv.status === 200,
    `status=${ownInv.status}`
  )
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) await new Promise((r) => server.close(r))
  const hotelIds = [
    legacyHotelId,
    publicHotelId,
    draftHotelId,
    inactiveHotelId,
    privateOrgHotelId,
  ]
  await prisma.inventoryHold
    .deleteMany({ where: { hotelId: { in: hotelIds } } })
    .catch(() => {})
  const bookings = await prisma.booking.findMany({
    where: { bookingItemId: { in: hotelIds } },
    select: { id: true, paymentId: true },
  })
  const bookingIds = bookings.map((b) => b.id)
  if (bookingIds.length) {
    await prisma.paymentAttempt
      .deleteMany({
        where: { payment: { bookingId: { in: bookingIds } } },
      })
      .catch(() => {})
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
    await prisma.inventoryHold.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {})
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => {})
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
  `\n=== Hotel booking Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
