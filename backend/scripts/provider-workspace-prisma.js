/**
 * Provider workspace foundation — Prisma-only security + happy-path tests.
 *
 * Covers:
 * - member can access own org workspace
 * - unrelated user cannot
 * - cannot switch X-Org-Context to another org
 * - owner/admin vs unauthorized role permissions
 * - org-scoped resource listing
 * - cannot create/update/delete another org's resources
 * - draft provider hotels stay out of default public hotel list
 *
 * Usage: node scripts/provider-workspace-prisma.js
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
  process.env.JWT_SECRET || 'provider-workspace-prisma-test-secret'
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

const PORT = 4102
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

const travelOwnerId = generateObjectId()
const hotelOwnerId = generateObjectId()
const viewerId = generateObjectId()
const strangerId = generateObjectId()
const travelOrgId = generateObjectId()
const hotelOrgId = generateObjectId()
const busOrgId = generateObjectId()
const travelTourId = generateObjectId()
const hotelHotelId = generateObjectId()
const foreignHotelId = generateObjectId()
const passwordPlain = 'WorkspaceTestPass1!'
const passwordHash = await hashPassword(passwordPlain)

const hotelPayload = {
  name: `Workspace Hotel ${RUN}`,
  description: 'Provider workspace hotel fixture',
  shortDescription: 'Workspace hotel',
  location: {
    address: '1 Test St',
    city: 'Addis Ababa',
    region: 'Addis Ababa',
  },
  coverImage:
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  contact: { phone: '+251911000000', email: `hotel.${RUN}@visitethiopia.test` },
  amenities: ['wifi'],
  roomTypes: [],
  images: [],
}

let server
const createdHotelIds = []
const createdTransportIds = []

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
        id: travelOwnerId,
        firstName: 'Travel',
        lastName: 'Owner',
        email: `travel.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'tour_operator',
        isVerified: true,
        active: true,
      },
      {
        id: hotelOwnerId,
        firstName: 'Hotel',
        lastName: 'Owner',
        email: `hotel.owner.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'hotel_manager',
        isVerified: true,
        active: true,
      },
      {
        id: viewerId,
        firstName: 'Viewer',
        lastName: 'Staff',
        email: `viewer.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'user',
        isVerified: true,
        active: true,
      },
      {
        id: strangerId,
        firstName: 'Stranger',
        lastName: 'User',
        email: `stranger.${RUN}@visitethiopia.test`,
        password: passwordHash,
        role: 'user',
        isVerified: true,
        active: true,
      },
    ],
  })

  await prisma.organization.create({
    data: {
      id: travelOrgId,
      name: `Travel Org ${RUN}`,
      slug: `travel-org-${RUN}`,
      providerTypes: ['travel_company'],
      approvalStatus: 'draft',
      visibility: 'private',
      description: '',
      shortDescription: '',
      uniqueSellingPoints: [],
      services: [],
      gallery: [],
      portfolioPhotos: [],
      ownerUserId: travelOwnerId,
      verification: {},
    },
  })
  await prisma.organization.create({
    data: {
      id: hotelOrgId,
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
      ownerUserId: hotelOwnerId,
      verification: {},
    },
  })
  await prisma.organization.create({
    data: {
      id: busOrgId,
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
      ownerUserId: hotelOwnerId,
      verification: {},
    },
  })

  await prisma.organizationMember.createMany({
    data: [
      {
        id: generateObjectId(),
        organizationId: travelOrgId,
        userId: travelOwnerId,
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(['travel_company']),
        membershipRoles: ['tour_operator'],
        status: 'active',
      },
      {
        id: generateObjectId(),
        organizationId: travelOrgId,
        userId: viewerId,
        orgRole: 'viewer',
        permissions: ['org:read', 'tours:read'],
        membershipRoles: ['tour_operator'],
        status: 'active',
      },
      {
        id: generateObjectId(),
        organizationId: hotelOrgId,
        userId: hotelOwnerId,
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(['hotel']),
        membershipRoles: ['hotel_manager'],
        status: 'active',
      },
      {
        id: generateObjectId(),
        organizationId: busOrgId,
        userId: hotelOwnerId,
        orgRole: 'owner',
        permissions: permissionsForProviderTypes(['tour_bus_provider']),
        membershipRoles: ['tour_bus_provider'],
        status: 'active',
      },
    ],
  })

  await prisma.tour.create({
    data: {
      id: travelTourId,
      title: `Workspace Tour ${RUN}`,
      slug: `workspace-tour-${RUN}`,
      description: 'Org-scoped tour',
      shortDescription: 'Org tour',
      durationDays: 2,
      durationNights: 1,
      destinations: ['Test'],
      difficulty: 'easy',
      price: 100,
      priceMinor: 10000,
      currency: 'ETB',
      coverImage:
        'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
      images: [
        'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
      ],
      maxGroupSize: 8,
      createdById: travelOwnerId,
      organizationId: travelOrgId,
      status: 'draft',
      secretTour: false,
    },
  })

  await prisma.hotel.create({
    data: {
      id: hotelHotelId,
      name: `Existing Hotel ${RUN}`,
      description: 'Belongs to hotel org',
      shortDescription: 'Existing',
      location: {
        address: '2 Test St',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      },
      coverImage:
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
      contact: {
        phone: '+251911000001',
        email: `existing.${RUN}@visitethiopia.test`,
      },
      amenities: [],
      roomTypes: [],
      images: [],
      createdById: hotelOwnerId,
      organizationId: hotelOrgId,
      status: 'draft',
    },
  })

  // Hotel that belongs to travel org (to prove hotel listing is org-scoped)
  await prisma.hotel.create({
    data: {
      id: foreignHotelId,
      name: `Foreign Hotel ${RUN}`,
      description: 'Belongs to travel org',
      shortDescription: 'Foreign',
      location: {
        address: '3 Test St',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      },
      coverImage:
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
      contact: {
        phone: '+251911000002',
        email: `foreign.${RUN}@visitethiopia.test`,
      },
      amenities: [],
      roomTypes: [],
      images: [],
      createdById: travelOwnerId,
      organizationId: travelOrgId,
      status: 'draft',
    },
  })

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve)
    server.on('error', reject)
  })

  const travelLogin = await req('POST', '/users/login', {
    body: {
      email: `travel.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const hotelLogin = await req('POST', '/users/login', {
    body: {
      email: `hotel.owner.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const viewerLogin = await req('POST', '/users/login', {
    body: {
      email: `viewer.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })
  const strangerLogin = await req('POST', '/users/login', {
    body: {
      email: `stranger.${RUN}@visitethiopia.test`,
      password: passwordPlain,
    },
  })

  check('travel owner login', travelLogin.status === 200)
  check('hotel owner login', hotelLogin.status === 200)
  check('viewer login', viewerLogin.status === 200)
  check('stranger login', strangerLogin.status === 200)

  const travelToken = travelLogin.data?.token
  const hotelToken = hotelLogin.data?.token
  const viewerToken = viewerLogin.data?.token
  const strangerToken = strangerLogin.data?.token

  // 1) member can access their organization workspace
  const ws = await req('GET', `/organizations/${travelOrgId}/workspace`, {
    token: travelToken,
    headers: { 'X-Org-Context': travelOrgId },
  })
  check(
    'organization member can access workspace',
    ws.status === 200 && Boolean(ws.data?.data?.organization),
    `status=${ws.status}`
  )
  check(
    'workspace includes summary counts',
    ws.status === 200 &&
      ws.data?.data?.summary?.tourCount === 1 &&
      typeof ws.data?.data?.summary?.memberCount === 'number',
    `summary=${JSON.stringify(ws.data?.data?.summary)}`
  )

  // 2) unrelated user cannot access organization
  const strangerWs = await req(
    'GET',
    `/organizations/${travelOrgId}/workspace`,
    {
      token: strangerToken,
      headers: { 'X-Org-Context': travelOrgId },
    }
  )
  check(
    'unrelated user cannot access organization',
    strangerWs.status === 403,
    `status=${strangerWs.status}`
  )

  // 3) member cannot switch X-Org-Context to another organization
  const switchCtx = await req(
    'GET',
    `/organizations/${hotelOrgId}/workspace`,
    {
      token: travelToken,
      headers: { 'X-Org-Context': hotelOrgId },
    }
  )
  check(
    'member cannot switch X-Org-Context to another org',
    switchCtx.status === 403,
    `status=${switchCtx.status}`
  )

  const mismatch = await req(
    'GET',
    `/organizations/${hotelOrgId}/workspace`,
    {
      token: travelToken,
      headers: { 'X-Org-Context': travelOrgId },
    }
  )
  check(
    'URL/context org mismatch forbidden',
    mismatch.status === 403,
    `status=${mismatch.status}`
  )

  // 4) owner can list org tours; 5) viewer without write gets 403 on create
  const toursList = await req('GET', `/organizations/${travelOrgId}/tours`, {
    token: travelToken,
    headers: { 'X-Org-Context': travelOrgId },
  })
  check(
    'owner can list organization tours',
    toursList.status === 200 &&
      Array.isArray(toursList.data?.data?.data) &&
      toursList.data.data.data.every(
        (t) => String(t.organizationId) === String(travelOrgId)
      ),
    `status=${toursList.status} results=${toursList.data?.results}`
  )

  const viewerCreate = await req(
    'POST',
    `/organizations/${travelOrgId}/tours`,
    {
      token: viewerToken,
      headers: { 'X-Org-Context': travelOrgId },
      body: {
        title: `Should Fail ${RUN}`,
        description: 'no',
        shortDescription: 'no',
        durationDays: 1,
        destinations: ['x'],
        coverImage:
          'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
        images: [
          'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
        ],
        price: 10,
        maxGroupSize: 2,
      },
    }
  )
  check(
    'unauthorized role receives 403 on tour create',
    viewerCreate.status === 403,
    `status=${viewerCreate.status}`
  )

  // 6) organization hotel listing contains only that organization's resources
  const hotelList = await req('GET', `/organizations/${hotelOrgId}/hotels`, {
    token: hotelToken,
    headers: { 'X-Org-Context': hotelOrgId },
  })
  const hotelIds = (hotelList.data?.data?.data || []).map((h) => h._id || h.id)
  check(
    'org hotel listing contains only that org resources',
    hotelList.status === 200 &&
      hotelIds.includes(hotelHotelId) &&
      !hotelIds.includes(foreignHotelId),
    `status=${hotelList.status} ids=${hotelIds.join(',')}`
  )

  // 7) cannot create resource for another organization (body orgId ignored)
  const createHotel = await req(
    'POST',
    `/organizations/${hotelOrgId}/hotels`,
    {
      token: hotelToken,
      headers: { 'X-Org-Context': hotelOrgId },
      body: {
        ...hotelPayload,
        organizationId: travelOrgId, // attempt bypass
      },
    }
  )
  const createdHotel =
    createHotel.data?.data?.data || createHotel.data?.data || null
  const createdHotelId = createdHotel?._id || createdHotel?.id
  if (createdHotelId) createdHotelIds.push(createdHotelId)
  check(
    'create hotel forces validated org (ignores client organizationId)',
    createHotel.status === 201 &&
      String(createdHotel?.organizationId) === String(hotelOrgId) &&
      createdHotel?.status === 'draft',
    `status=${createHotel.status} org=${createdHotel?.organizationId} hotelStatus=${createdHotel?.status}`
  )

  // travel owner cannot create hotel on hotel org
  const crossCreate = await req(
    'POST',
    `/organizations/${hotelOrgId}/hotels`,
    {
      token: travelToken,
      headers: { 'X-Org-Context': hotelOrgId },
      body: hotelPayload,
    }
  )
  check(
    'user cannot create resource for another organization',
    crossCreate.status === 403,
    `status=${crossCreate.status}`
  )

  // 8) cannot update another organization's resource
  const crossUpdate = await req(
    'PATCH',
    `/organizations/${hotelOrgId}/hotels/${foreignHotelId}`,
    {
      token: hotelToken,
      headers: { 'X-Org-Context': hotelOrgId },
      body: { shortDescription: 'hijack' },
    }
  )
  check(
    'user cannot update another organization resource',
    crossUpdate.status === 403,
    `status=${crossUpdate.status}`
  )

  // 9) cannot delete another organization's resource
  const crossDelete = await req(
    'DELETE',
    `/organizations/${hotelOrgId}/hotels/${foreignHotelId}`,
    {
      token: hotelToken,
      headers: { 'X-Org-Context': hotelOrgId },
    }
  )
  check(
    'user cannot delete another organization resource',
    crossDelete.status === 403,
    `status=${crossDelete.status}`
  )

  // happy path: owner updates own hotel
  const ownUpdate = await req(
    'PATCH',
    `/organizations/${hotelOrgId}/hotels/${hotelHotelId}`,
    {
      token: hotelToken,
      headers: { 'X-Org-Context': hotelOrgId },
      body: {
        shortDescription: 'updated-own',
        organizationId: travelOrgId, // must be ignored
      },
    }
  )
  check(
    'owner can update own org hotel',
    ownUpdate.status === 200 &&
      ownUpdate.data?.data?.data?.shortDescription === 'updated-own' &&
      String(ownUpdate.data?.data?.data?.organizationId) === String(hotelOrgId),
    `status=${ownUpdate.status}`
  )

  // transport happy path for bus org
  const createTransport = await req(
    'POST',
    `/organizations/${busOrgId}/transports`,
    {
      token: hotelToken,
      headers: { 'X-Org-Context': busOrgId },
      body: {
        name: `Workspace Bus ${RUN}`,
        description: 'Provider transport',
        type: 'bus',
        contact: { phone: '+251911000099' },
        organizationId: travelOrgId,
      },
    }
  )
  const createdTransport =
    createTransport.data?.data?.data || createTransport.data?.data || null
  const createdTransportId = createdTransport?._id || createdTransport?.id
  if (createdTransportId) createdTransportIds.push(createdTransportId)
  check(
    'bus org owner can create draft transport in own org',
    createTransport.status === 201 &&
      String(createdTransport?.organizationId) === String(busOrgId) &&
      createdTransport?.status === 'draft',
    `status=${createTransport.status}`
  )

  // 10) unapproved provider resources remain hidden from public marketplace APIs
  const publicHotels = await req('GET', '/hotels?status=active')
  const publicIds = (publicHotels.data?.data?.data || []).map(
    (h) => h._id || h.id
  )
  check(
    'draft org hotels hidden from public active hotel list',
    publicHotels.status === 200 &&
      !publicIds.includes(createdHotelId) &&
      !publicIds.includes(hotelHotelId),
    `found=${publicIds.includes(createdHotelId)}`
  )

  const publicDefault = await req('GET', '/hotels')
  const defaultIds = (publicDefault.data?.data?.data || []).map(
    (h) => h._id || h.id
  )
  check(
    'draft org hotels hidden from default public hotel list',
    publicDefault.status === 200 &&
      !defaultIds.includes(createdHotelId) &&
      !defaultIds.includes(hotelHotelId),
    `found=${defaultIds.includes(createdHotelId)}`
  )

  const publicDraftOrg = await req('GET', `/organizations/hotel-org-${RUN}`)
  check(
    'unapproved org not public by slug',
    publicDraftOrg.status === 404 || publicDraftOrg.status === 400,
    `status=${publicDraftOrg.status}`
  )

  // viewer can read workspace with org:read
  const viewerWs = await req(
    'GET',
    `/organizations/${travelOrgId}/workspace`,
    {
      token: viewerToken,
      headers: { 'X-Org-Context': travelOrgId },
    }
  )
  check(
    'viewer with org:read can view workspace',
    viewerWs.status === 200,
    `status=${viewerWs.status}`
  )

  // travel org cannot manage hotels (provider type gate)
  const travelHotels = await req(
    'POST',
    `/organizations/${travelOrgId}/hotels`,
    {
      token: travelToken,
      headers: { 'X-Org-Context': travelOrgId },
      body: hotelPayload,
    }
  )
  check(
    'travel_company cannot create hotels without hotel provider type',
    travelHotels.status === 403,
    `status=${travelHotels.status}`
  )
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  if (server) await new Promise((r) => server.close(r))

  const hotelCleanup = [
    hotelHotelId,
    foreignHotelId,
    ...createdHotelIds,
  ]
  const transportCleanup = [...createdTransportIds]

  await prisma.hotel
    .deleteMany({ where: { id: { in: hotelCleanup } } })
    .catch(() => {})
  await prisma.transport
    .deleteMany({ where: { id: { in: transportCleanup } } })
    .catch(() => {})
  await prisma.tour.delete({ where: { id: travelTourId } }).catch(() => {})
  await prisma.organizationMember
    .deleteMany({
      where: {
        organizationId: { in: [travelOrgId, hotelOrgId, busOrgId] },
      },
    })
    .catch(() => {})
  await prisma.organization
    .deleteMany({
      where: { id: { in: [travelOrgId, hotelOrgId, busOrgId] } },
    })
    .catch(() => {})
  await prisma.user
    .deleteMany({
      where: {
        id: { in: [travelOwnerId, hotelOwnerId, viewerId, strangerId] },
      },
    })
    .catch(() => {})
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Provider workspace Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
