/**
 * Hotel marketplace lifecycle + inventory — Prisma-only HTTP tests.
 *
 * Usage: node scripts/hotel-marketplace-prisma.js
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
  process.env.JWT_SECRET || 'hotel-marketplace-prisma-test-secret'
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
const { reserveRoomsAtomic } = await import(
  '../repositories/prisma/hotelInventoryRepository.js'
)
const prisma = (await import('../config/prisma.js')).default
const app = (await import('../app.js')).default

const PORT = 4103
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

const ownerId = generateObjectId()
const otherOwnerId = generateObjectId()
const orgId = generateObjectId()
const otherOrgId = generateObjectId()
const versionId = generateObjectId()
const draftHotelId = generateObjectId()
const privateActiveHotelId = generateObjectId()
const publicHotelId = generateObjectId()
const inactiveHotelId = generateObjectId()
const otherDraftHotelId = generateObjectId()
const passwordPlain = 'HotelMarketPass1!'
const passwordHash = await hashPassword(passwordPlain)

let server
const cleanupInventoryIds = []

try {
  await prisma.$queryRaw`SELECT 1`
  const mongoose = (await import('mongoose')).default
  check(
    'mongo not connected (prisma-only)',
    mongoose.connection.readyState !== 1
  )

  await prisma.user.createMany({
    data: [
      {
        id: ownerId,
        firstName: 'Hotel',
        lastName: 'Owner',
        email: `hotel.mkt.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
      {
        id: otherOwnerId,
        firstName: 'Other',
        lastName: 'Owner',
        email: `hotel.mkt.other.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
    ],
  })

  // Unapproved org (private) — owns draft + active-but-private hotels
  await prisma.organization.create({
    data: {
      id: orgId,
      name: `Hotel Mkt Org ${RUN}`,
      slug: `hotel-mkt-org-${RUN}`,
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

  // Second org for cross-org checks
  await prisma.organization.create({
    data: {
      id: otherOrgId,
      name: `Hotel Mkt Other ${RUN}`,
      slug: `hotel-mkt-other-${RUN}`,
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

  const cover =
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'
  const loc = {
    address: '1 Test',
    city: 'Addis Ababa',
    region: 'Addis Ababa',
  }
  const contact = {
    phone: '+251911000000',
    email: `hotel.mkt.${RUN}@visitethiopia.test`,
  }
  const roomTypes = [
    {
      key: 'standard',
      type: 'Standard Room',
      name: 'Standard Room',
      description: 'Nice',
      capacity: 2,
      price: 100,
      priceMinor: 10000,
      currency: 'ETB',
      amenities: ['wifi'],
      images: [],
      availableRooms: 0,
      active: true,
    },
  ]

  await prisma.hotel.createMany({
    data: [
      {
        id: draftHotelId,
        name: `Draft Hotel ${RUN}`,
        description: 'draft',
        shortDescription: 'draft',
        location: loc,
        coverImage: cover,
        contact,
        roomTypes,
        amenities: [],
        images: [],
        createdById: ownerId,
        organizationId: orgId,
        status: 'draft',
      },
      {
        id: privateActiveHotelId,
        name: `Private Active Hotel ${RUN}`,
        description: 'active but org private',
        shortDescription: 'private-active',
        location: loc,
        coverImage: cover,
        contact,
        roomTypes,
        amenities: [],
        images: [],
        createdById: ownerId,
        organizationId: orgId,
        status: 'active',
      },
      {
        id: inactiveHotelId,
        name: `Inactive Hotel ${RUN}`,
        description: 'inactive',
        shortDescription: 'inactive',
        location: loc,
        coverImage: cover,
        contact,
        roomTypes,
        amenities: [],
        images: [],
        createdById: ownerId,
        organizationId: orgId,
        status: 'inactive',
      },
      {
        id: otherDraftHotelId,
        name: `Other Draft Hotel ${RUN}`,
        description: 'other org draft',
        shortDescription: 'other-draft',
        location: loc,
        coverImage: cover,
        contact,
        roomTypes,
        amenities: [],
        images: [],
        createdById: otherOwnerId,
        organizationId: otherOrgId,
        status: 'draft',
      },
    ],
  })

  // Approve org + create public hotel
  await prisma.providerVersion.create({
    data: {
      id: versionId,
      organizationId: orgId,
      versionNumber: 1,
      status: 'approved',
      snapshot: {
        name: `Hotel Mkt Org ${RUN}`,
        providerTypes: ['hotel'],
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

  await prisma.hotel.create({
    data: {
      id: publicHotelId,
      name: `Public Hotel ${RUN}`,
      description: 'public',
      shortDescription: 'public',
      location: loc,
      coverImage: cover,
      contact,
      roomTypes,
      amenities: [],
      images: [],
      createdById: ownerId,
      organizationId: orgId,
      status: 'active',
      isFeatured: false,
    },
  })

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const ownerLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.mkt.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const otherLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.mkt.other.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  check('owner login', ownerLogin.status === 200)
  check('other login', otherLogin.status === 200)
  const ownerToken = ownerLogin.data?.token
  const otherToken = otherLogin.data?.token
  const orgHeaders = { 'X-Org-Context': orgId }

  // 1) public list hides draft
  const list = await req('GET', '/hotels')
  const listIds = (list.data?.data?.data || []).map((h) => h._id || h.id)
  check(
    'public list hides draft hotel',
    list.status === 200 && !listIds.includes(draftHotelId),
    `found=${listIds.includes(draftHotelId)}`
  )

  // 2) public detail hides draft
  const draftDetail = await req('GET', `/hotels/${draftHotelId}`)
  check(
    'public detail by ID hides draft hotel',
    draftDetail.status === 404,
    `status=${draftDetail.status}`
  )

  // 3) active hotel with unapproved/private org was already approved — test privateActive before was public...
  // privateActiveHotelId is active under now-approved org, so it WOULD become public.
  // Re-test approval bypass using otherOrg's active hotel: create one quickly.
  const unapprovedActiveId = generateObjectId()
  await prisma.hotel.create({
    data: {
      id: unapprovedActiveId,
      name: `Unapproved Active ${RUN}`,
      description: 'should hide',
      shortDescription: 'hide',
      location: loc,
      coverImage: cover,
      contact,
      roomTypes,
      amenities: [],
      images: [],
      createdById: otherOwnerId,
      organizationId: otherOrgId,
      status: 'active',
    },
  })
  const bypass = await req('GET', `/hotels/${unapprovedActiveId}`)
  check(
    'public detail cannot bypass approval using ID',
    bypass.status === 404,
    `status=${bypass.status}`
  )

  // 4) approved hotel visible
  const pub = await req('GET', `/hotels/${publicHotelId}`)
  check(
    'approved hotel is visible',
    pub.status === 200 &&
      (pub.data?.data?.data?._id === publicHotelId ||
        pub.data?.data?.data?.id === publicHotelId),
    `status=${pub.status}`
  )
  const list2 = await req('GET', '/hotels')
  const list2Ids = (list2.data?.data?.data || []).map((h) => h._id || h.id)
  check(
    'approved hotel on public list',
    list2Ids.includes(publicHotelId),
    `found=${list2Ids.includes(publicHotelId)}`
  )

  // 5) suspended/inactive hidden
  const inactiveDetail = await req('GET', `/hotels/${inactiveHotelId}`)
  check(
    'suspended hotel is hidden',
    inactiveDetail.status === 404,
    `status=${inactiveDetail.status}`
  )

  // 6) owner can access own draft via org route
  const ownDraft = await req('GET', `/organizations/${orgId}/hotels/${draftHotelId}`, {
    token: ownerToken,
    headers: orgHeaders,
  })
  check(
    'owner/provider can access own draft',
    ownDraft.status === 200,
    `status=${ownDraft.status}`
  )

  // 7) unrelated provider cannot access other org draft
  const crossDraft = await req(
    'GET',
    `/organizations/${orgId}/hotels/${draftHotelId}`,
    {
      token: otherToken,
      headers: { 'X-Org-Context': orgId },
    }
  )
  check(
    'unrelated provider cannot access another org draft',
    crossDraft.status === 403,
    `status=${crossDraft.status}`
  )

  // publish / unpublish
  const published = await req(
    'POST',
    `/organizations/${orgId}/hotels/${draftHotelId}/publish`,
    { token: ownerToken, headers: orgHeaders }
  )
  check(
    'publish draft → active',
    published.status === 200 &&
      published.data?.data?.data?.status === 'active',
    `status=${published.status}`
  )
  const unpublished = await req(
    'POST',
    `/organizations/${orgId}/hotels/${draftHotelId}/unpublish`,
    { token: ownerToken, headers: orgHeaders }
  )
  check(
    'unpublish → inactive (hidden)',
    unpublished.status === 200 &&
      unpublished.data?.data?.data?.status === 'inactive',
    `status=${unpublished.status}`
  )
  const afterUnpub = await req('GET', `/hotels/${draftHotelId}`)
  check(
    'unpublished hotel not public',
    afterUnpub.status === 404,
    `status=${afterUnpub.status}`
  )
  // restore to draft for cleanup clarity
  await prisma.hotel.update({
    where: { id: draftHotelId },
    data: { status: 'draft' },
  })

  // Inventory upsert + uniqueness (second upsert updates)
  const inv1 = await req(
    'POST',
    `/organizations/${orgId}/hotels/${publicHotelId}/inventory`,
    {
      token: ownerToken,
      headers: orgHeaders,
      body: {
        roomTypeKey: 'standard',
        date: '2030-06-01',
        totalRooms: 10,
        availableRooms: 10,
      },
    }
  )
  const invRow = inv1.data?.data?.data
  const invId = invRow?._id || invRow?.id
  if (invId) cleanupInventoryIds.push(invId)
  check(
    'provider can create inventory',
    inv1.status === 201 && invRow?.availableRooms === 10,
    `status=${inv1.status}`
  )

  const invUpsert = await req(
    'POST',
    `/organizations/${orgId}/hotels/${publicHotelId}/inventory`,
    {
      token: ownerToken,
      headers: orgHeaders,
      body: {
        roomTypeKey: 'standard',
        date: '2030-06-01',
        totalRooms: 10,
        availableRooms: 10,
      },
    }
  )
  const invUpsertId = invUpsert.data?.data?.data?._id || invUpsert.data?.data?.data?.id
  check(
    'duplicate day upserts same row (unique key)',
    invUpsert.status === 201 && invUpsertId === invId,
    `ids=${invId}/${invUpsertId}`
  )

  // cross-org inventory mutate forbidden
  const crossInv = await req(
    'POST',
    `/organizations/${orgId}/hotels/${publicHotelId}/inventory`,
    {
      token: otherToken,
      headers: { 'X-Org-Context': orgId },
      body: {
        roomTypeKey: 'standard',
        date: '2030-06-02',
        totalRooms: 5,
        availableRooms: 5,
      },
    }
  )
  check(
    'unrelated provider cannot mutate inventory',
    crossInv.status === 403,
    `status=${crossInv.status}`
  )

  // 9) concurrency CAS
  const attempts = await Promise.all(
    Array.from({ length: 20 }, () =>
      reserveRoomsAtomic(invId, 1)
        .then(() => ({ ok: true }))
        .catch((e) => ({ ok: false, message: e.message }))
    )
  )
  const okCount = attempts.filter((a) => a.ok).length
  const failCount = attempts.filter((a) => !a.ok).length
  const after = await prisma.hotelDailyInventory.findUnique({
    where: { id: invId },
  })
  check(
    'concurrency: exactly 10 succeed',
    okCount === 10,
    `ok=${okCount}`
  )
  check(
    'concurrency: exactly 10 fail',
    failCount === 10,
    `fail=${failCount}`
  )
  check(
    'concurrency: availableRooms = 0',
    after?.availableRooms === 0,
    `available=${after?.availableRooms}`
  )
  check(
    'concurrency: availableRooms never negative',
    after?.availableRooms != null && after.availableRooms >= 0,
    `available=${after?.availableRooms}`
  )

  // 10) public availability
  await prisma.hotelDailyInventory.update({
    where: { id: invId },
    data: { availableRooms: 3, reservedRooms: 7 },
  })
  // need night 2030-06-01 covered for checkIn 2030-06-01 checkOut 2030-06-02
  const avail = await req(
    'GET',
    `/hotels/${publicHotelId}/availability?checkIn=2030-06-01&checkOut=2030-06-02&roomTypeKey=standard`
  )
  check(
    'public availability for public hotel',
    avail.status === 200 &&
      avail.data?.data?.roomTypes?.[0]?.minAvailableRooms === 3,
    `status=${avail.status} min=${avail.data?.data?.roomTypes?.[0]?.minAvailableRooms}`
  )

  const availDraft = await req(
    'GET',
    `/hotels/${draftHotelId}/availability?checkIn=2030-06-01&checkOut=2030-06-02`
  )
  check(
    'public availability hidden for draft hotel',
    availDraft.status === 404,
    `status=${availDraft.status}`
  )

  const badDates = await req(
    'GET',
    `/hotels/${publicHotelId}/availability?checkIn=2030-06-05&checkOut=2030-06-01`
  )
  check(
    'availability rejects inverted dates',
    badDates.status === 400,
    `status=${badDates.status}`
  )

  // workspace hotel inventory summary fields
  const ws = await req('GET', `/organizations/${orgId}/workspace`, {
    token: ownerToken,
    headers: orgHeaders,
  })
  check(
    'workspace includes hotel inventory summary fields',
    ws.status === 200 &&
      typeof ws.data?.data?.summary?.inventoryDayCount === 'number' &&
      typeof ws.data?.data?.summary?.activeRoomTypeCount === 'number',
    `summary=${JSON.stringify(ws.data?.data?.summary)}`
  )

  // cleanup extra hotel
  await prisma.hotel.delete({ where: { id: unapprovedActiveId } }).catch(() => {})
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) await new Promise((r) => server.close(r))

  // Always clean hotel-mkt leftovers even if suite crashes mid-run
  try {
    const leftovers = await prisma.organization.findMany({
      where: { slug: { startsWith: `hotel-mkt-` } },
      select: { id: true },
    })
    // Prefer RUN-scoped cleanup; also wipe any hotel-mkt-* from this process if present
    const orgIds = [orgId, otherOrgId, ...leftovers.map((o) => o.id)].filter(
      (v, i, a) => a.indexOf(v) === i
    )
    for (const oid of orgIds) {
      if (prisma.hotelDailyInventory) {
        await prisma.hotelDailyInventory
          .deleteMany({ where: { organizationId: oid } })
          .catch(() => {})
      }
      await prisma.hotel.deleteMany({ where: { organizationId: oid } }).catch(() => {})
      await prisma.organizationMember
        .deleteMany({ where: { organizationId: oid } })
        .catch(() => {})
      await prisma.organization
        .updateMany({
          where: { id: oid },
          data: { approvedVersionId: null, latestVersionId: null },
        })
        .catch(() => {})
      await prisma.providerVersion
        .deleteMany({ where: { organizationId: oid } })
        .catch(() => {})
      await prisma.organization.delete({ where: { id: oid } }).catch(() => {})
    }
  } catch {
    // ignore cleanup errors
  }

  if (prisma.hotelDailyInventory) {
    await prisma.hotelDailyInventory
      .deleteMany({
        where: {
          OR: [
            { hotelId: { in: [publicHotelId, draftHotelId, inactiveHotelId] } },
            { id: { in: cleanupInventoryIds } },
          ],
        },
      })
      .catch(() => {})
  }

  await prisma.hotel
    .deleteMany({
      where: {
        id: {
          in: [
            draftHotelId,
            privateActiveHotelId,
            publicHotelId,
            inactiveHotelId,
            otherDraftHotelId,
          ],
        },
      },
    })
    .catch(() => {})

  await prisma.user
    .deleteMany({
      where: {
        OR: [
          { id: { in: [ownerId, otherOwnerId] } },
          { email: { contains: `hotel.mkt.` } },
        ],
      },
    })
    .catch(() => {})
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Hotel marketplace Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
