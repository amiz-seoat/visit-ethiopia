/**
 * Phase 4H — provider booking management, org authorization, admin visibility.
 * Usage: node scripts/phase4h-provider-bookings.js [baseUrl] [databaseUri]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://localhost:4002/api/v1').replace(/\/$/, '')
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  if (fs.existsSync(memoryUriFile)) {
    return fs.readFileSync(memoryUriFile, 'utf8').trim()
  }
  return process.env.DATABASE
}

async function req(method, pathName, opts = {}) {
  const h = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    ...(opts.orgContext ? { 'X-Org-Context': String(opts.orgContext) } : {}),
    ...(opts.adminBypass ? { 'X-Admin-Org-Bypass': 'true' } : {}),
    ...(opts.headers || {}),
  }
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function login(email, password) {
  const res = await req('POST', '/users/login', { body: { email, password } })
  if (res.status !== 200 || !res.data?.token) throw new Error(`Login failed: ${email}`)
  return res.data.token
}

function validVerification(suffix = 'A') {
  return {
    legalName: `Phase4H Travel ${suffix} PLC`,
    registrationNumber: `P4H-${RUN_ID}-${suffix}`,
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
  const suffix = Math.random().toString(36).slice(2, 6)
  const reg = await req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes: ['travel_company'],
      shortDescription: 'Approved',
      verification: validVerification(suffix),
    },
  })
  const org = reg.data?.data?.organization
  if (!org?._id) {
    throw new Error(`Org register failed: ${reg.status} ${reg.data?.message || ''}`)
  }
  const versionId = reg.data.data.draftVersion._id
  await req('PATCH', `/organizations/${org._id}/draft`, {
    token,
    orgContext: org._id,
    body: { shortDescription: 'Public', verification: validVerification(suffix) },
  })
  const submit = await req('POST', `/organizations/${org._id}/versions/${versionId}/submit`, {
    token,
    orgContext: org._id,
  })
  const approvalId = submit.data?.data?.approvalRequest?._id
  if (!approvalId) throw new Error(`Submit failed: ${submit.status}`)
  const approve = await req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: adminToken,
    body: {},
  })
  if (approve.status !== 200) {
    throw new Error(`Approve failed: ${approve.status} ${approve.data?.message || ''}`)
  }
  return org
}

async function setupBookableDeparture({
  operatorToken,
  adminToken,
  capacity = 10,
  priceMinor = 50000,
}) {
  const org = await registerAndApproveOrg(
    operatorToken,
    adminToken,
    `P4H Org ${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`
  )
  const createRes = await req('POST', `/organizations/${org._id}/tours`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      title: `P4H Tour ${RUN_ID}-${Math.random().toString(36).slice(2, 5)}`,
      shortDescription: 'Short description for marketplace tour',
      description: 'Long description for the Phase 4H bookable tour package.',
      duration: { days: 3, nights: 2 },
      destinations: ['Lalibela'],
      difficulty: 'moderate',
      price: Math.round(priceMinor / 100),
      maxGroupSize: capacity,
      coverImage: 'https://example.com/cover.jpg',
      images: ['https://example.com/cover.jpg'],
      packages: [
        {
          key: 'normal',
          name: 'Standard',
          priceMinor,
          currency: 'ETB',
          active: true,
        },
      ],
      itinerary: [{ day: 1, title: 'Arrival', description: 'Welcome' }],
      inclusions: ['Guide'],
      exclusions: ['Flights'],
    },
  })
  if (createRes.status !== 201) {
    throw new Error(
      `Tour create failed: ${createRes.status} ${createRes.data?.message || ''}`
    )
  }
  const tour = createRes.data?.data?.data
  const tourId = tour?._id
  if (!tourId) throw new Error('Tour id missing')

  const pub = await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operatorToken,
    orgContext: org._id,
  })
  if (pub.status !== 200 && pub.status !== 201) {
    throw new Error(`Publish failed: ${pub.status} ${pub.data?.message || ''}`)
  }

  const depCreate = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      departureDate: new Date(Date.now() + 86400000 * 45).toISOString(),
      capacity,
      availableSpots: capacity,
      packages: [{ key: 'normal', priceMinor, currency: 'ETB', active: true }],
    },
  })
  if (depCreate.status !== 201) {
    throw new Error(
      `Departure create failed: ${depCreate.status} ${depCreate.data?.message || ''}`
    )
  }
  const departure = depCreate.data?.data?.data
  const departureId = departure?._id
  if (!departureId) throw new Error('Departure id missing')

  return { org, tourId, departureId, departure }
}

async function createCustomerBooking(customerToken, departureId, key) {
  return req('POST', '/bookings/tours', {
    token: customerToken,
    idempotencyKey: key,
    body: {
      departureId,
      packageKey: 'normal',
      quantity: 1,
      contactInfo: {
        fullName: 'Phase4H Customer',
        email: `p4h-${RUN_ID}@example.com`,
        phone: '+251911111111',
      },
    },
  })
}

function hasSensitivePaymentLeak(payload) {
  const raw = JSON.stringify(payload || {})
  return /cvv|cardNumber|pan\b|bankAccount|password|rawProviderResponse/i.test(raw)
}

async function run() {
  console.log(`\n=== Phase 4H provider bookings @ ${BASE} ===\n`)

  const uri = resolveTestDatabaseUri()
  if (uri) {
    await mongoose.connect(uri)
  }

  const adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
  const operatorA = await login('operator@visitethiopia.test', 'OperatorPass123!')
  const operatorB = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
  const customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
  pass('Provider authentication — seed users login')

  let ctxA
  let ctxB
  try {
    ctxA = await setupBookableDeparture({
      operatorToken: operatorA,
      adminToken,
      capacity: 8,
      priceMinor: 40000,
    })
    ctxB = await setupBookableDeparture({
      operatorToken: operatorB,
      adminToken,
      capacity: 8,
      priceMinor: 55000,
    })
    pass('Setup two independent organizations with departures')
  } catch (e) {
    fail('Setup two independent organizations with departures', e.message)
    return done()
  }

  const bookA = await createCustomerBooking(
    customerToken,
    ctxA.departureId,
    `p4h-a-${RUN_ID}`
  )
  const bookB = await createCustomerBooking(
    customerToken,
    ctxB.departureId,
    `p4h-b-${RUN_ID}`
  )
  const bookingAId = bookA.data?.data?._id
  const bookingBId = bookB.data?.data?._id
  if (bookA.status === 201 && bookB.status === 201 && bookingAId && bookingBId) {
    pass('Customer V2 bookings created for both orgs')
  } else {
    fail(
      'Customer V2 bookings created for both orgs',
      `${bookA.status}/${bookB.status} ${bookA.data?.message || ''} ${bookB.data?.message || ''}`
    )
    return done()
  }

  // Confirm one for richer status coverage
  const payA = bookA.data?.data?.payment?._id
  if (payA) {
    await req('POST', `/payments/${payA}/confirm`, {
      token: customerToken,
      idempotencyKey: `p4h-pay-${RUN_ID}`,
    })
  }

  // --- Auth / denial ---
  const unauth = await req('GET', '/provider/bookings')
  if (unauth.status === 401) pass('Unauthenticated provider list rejected')
  else fail('Unauthenticated provider list rejected', `${unauth.status}`)

  const noCtx = await req('GET', '/provider/bookings', { token: operatorA })
  if (noCtx.status === 400) pass('Missing organization context rejected')
  else fail('Missing organization context rejected', `${noCtx.status}`)

  const customerList = await req('GET', '/provider/bookings', {
    token: customerToken,
    orgContext: ctxA.org._id,
  })
  if (customerList.status === 403) pass('Customer denied provider booking list')
  else fail('Customer denied provider booking list', `${customerList.status}`)

  // --- Provider A list own org ---
  const listA = await req('GET', '/provider/bookings', {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (listA.status === 200 && Array.isArray(listA.data?.data)) {
    const ids = listA.data.data.map((b) => String(b._id))
    if (ids.includes(String(bookingAId)) && !ids.includes(String(bookingBId))) {
      pass('Provider A lists own organization booking')
      pass('Provider A list does not include Provider B booking')
    } else {
      fail('Provider A lists own organization booking', JSON.stringify(ids))
      fail('Provider A list does not include Provider B booking')
    }
  } else {
    fail('Provider A lists own organization booking', `${listA.status}`)
    fail('Provider A list does not include Provider B booking')
  }

  // Forge organizationId query — must still scope to context A
  const forgedList = await req(
    'GET',
    `/provider/bookings?organizationId=${ctxB.org._id}`,
    { token: operatorA, orgContext: ctxA.org._id }
  )
  if (
    forgedList.status === 200 &&
    !(forgedList.data?.data || []).some((b) => String(b._id) === String(bookingBId))
  ) {
    pass('Client organizationId query cannot forge list scope')
  } else {
    fail('Client organizationId query cannot forge list scope', `${forgedList.status}`)
  }

  // Cross-org context: A using B's org context
  const crossCtx = await req('GET', '/provider/bookings', {
    token: operatorA,
    orgContext: ctxB.org._id,
  })
  if (crossCtx.status === 403) pass('Provider A cannot use Provider B org context')
  else fail('Provider A cannot use Provider B org context', `${crossCtx.status}`)

  // Detail own
  const detailA = await req('GET', `/provider/bookings/${bookingAId}`, {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (detailA.status === 200 && detailA.data?.data?._id === bookingAId) {
    pass('Provider A can view own booking detail')
  } else {
    fail('Provider A can view own booking detail', `${detailA.status}`)
  }

  // Cross-org detail — 404 (no leak)
  const crossDetail = await req('GET', `/provider/bookings/${bookingBId}`, {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (crossDetail.status === 404) pass('Cross-org booking detail returns 404')
  else fail('Cross-org booking detail returns 404', `${crossDetail.status}`)

  // Sensitive fields
  if (!hasSensitivePaymentLeak(detailA.data)) {
    pass('Provider detail excludes sensitive payment fields')
  } else {
    fail('Provider detail excludes sensitive payment fields')
  }
  if (detailA.data?.data?.customer?.fullName && detailA.data?.data?.priceSnapshot?.totalMinor != null) {
    pass('Provider detail includes customer + price snapshot')
  } else {
    fail('Provider detail includes customer + price snapshot')
  }
  if (detailA.data?.data?.payment && !detailA.data.data.payment.rawProviderResponse) {
    pass('Provider payment payload is sanitized')
  } else {
    fail('Provider payment payload is sanitized')
  }

  // Filters / pagination
  const filtered = await req('GET', '/provider/bookings?status=confirmed&limit=5&page=1', {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (filtered.status === 200) pass('Status filter + pagination accepted')
  else fail('Status filter + pagination accepted', `${filtered.status}`)

  const badPage = await req('GET', '/provider/bookings?limit=9999', {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (badPage.status === 200 && badPage.data?.limit <= 100) {
    pass('Pagination limit capped safely')
  } else {
    fail('Pagination limit capped safely', `${badPage.data?.limit}`)
  }

  const badDep = await req('GET', '/provider/bookings?departureId=not-an-id', {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (badDep.status === 400) pass('Invalid departureId filter rejected')
  else fail('Invalid departureId filter rejected', `${badDep.status}`)

  const badId = await req('GET', '/provider/bookings/not-an-id', {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (badId.status === 404) pass('Malformed booking id returns 404')
  else fail('Malformed booking id returns 404', `${badId.status}`)

  // Mutations deferred — require bookings:manage then 405
  const patchAttempt = await req('PATCH', `/provider/bookings/${bookingAId}`, {
    token: operatorA,
    orgContext: ctxA.org._id,
    body: {
      status: 'confirmed',
      priceSnapshot: { totalMinor: 1 },
      organizationId: ctxB.org._id,
    },
  })
  if (patchAttempt.status === 405) {
    pass('Provider booking mutation endpoint not exposed')
  } else {
    fail('Provider booking mutation endpoint not exposed', `${patchAttempt.status}`)
  }

  // Permission enforcement via staff member without bookings:read
  if (uri) {
    const OrganizationMember = (await import('../models/OrganizationMember.js')).default
    const User = (await import('../models/User.js')).default

    const staffEmail = `p4h-staff-${RUN_ID}@example.com`
    const staffUser = await User.create({
      FirstName: 'Staff',
      LastName: 'Reader',
      email: staffEmail,
      password: 'StaffPass123!',
      passwordConfirm: 'StaffPass123!',
      role: 'user',
    })
    // Bypass email verify if needed
    staffUser.isVerified = true
    await staffUser.save({ validateBeforeSave: false })

    await OrganizationMember.create({
      organizationId: ctxA.org._id,
      userId: staffUser._id,
      orgRole: 'viewer',
      status: 'active',
      permissions: ['tours:read'], // no bookings:read
      membershipRoles: ['tour_operator'],
    })

    const staffLogin = await req('POST', '/users/login', {
      body: { email: staffEmail, password: 'StaffPass123!' },
    })
    const staffToken = staffLogin.data?.token
    const denied = await req('GET', '/provider/bookings', {
      token: staffToken,
      orgContext: ctxA.org._id,
    })
    if (denied.status === 403) pass('Member without bookings:read is denied')
    else fail('Member without bookings:read is denied', `${denied.status}`)

    // Grant read only — still no manage mutations (none exist); verify read works
    await OrganizationMember.findOneAndUpdate(
      { organizationId: ctxA.org._id, userId: staffUser._id },
      { permissions: ['bookings:read'] }
    )
    const allowed = await req('GET', '/provider/bookings', {
      token: staffToken,
      orgContext: ctxA.org._id,
    })
    if (allowed.status === 200) pass('Member with bookings:read can list')
    else fail('Member with bookings:read can list', `${allowed.status}`)

    const manageAttempt = await req('POST', `/provider/bookings/${bookingAId}/cancel`, {
      token: staffToken,
      orgContext: ctxA.org._id,
      body: { status: 'cancelled' },
    })
    if (manageAttempt.status === 403) {
      pass('bookings:manage mutations remain unavailable (deferred)')
    } else {
      fail(
        'bookings:manage mutations remain unavailable (deferred)',
        `${manageAttempt.status}`
      )
    }
  } else {
    fail('Member without bookings:read is denied', 'no db uri')
    fail('Member with bookings:read can list', 'no db uri')
    fail('bookings:manage mutations remain unavailable (deferred)', 'no db uri')
  }

  // Admin access
  const adminList = await req('GET', `/admin/bookings?organizationId=${ctxA.org._id}`, {
    token: adminToken,
  })
  if (
    adminList.status === 200 &&
    (adminList.data?.data || []).some((b) => String(b._id) === String(bookingAId))
  ) {
    pass('Admin can list bookings filtered by organization')
  } else {
    fail('Admin can list bookings filtered by organization', `${adminList.status}`)
  }

  const adminDetail = await req('GET', `/admin/bookings/${bookingBId}`, {
    token: adminToken,
  })
  if (adminDetail.status === 200 && adminDetail.data?.data?._id === bookingBId) {
    pass('Admin can view any organization booking detail')
  } else {
    fail('Admin can view any organization booking detail', `${adminDetail.status}`)
  }

  const providerAdmin = await req('GET', '/admin/bookings', {
    token: operatorA,
  })
  if (providerAdmin.status === 403) pass('Provider denied admin booking list')
  else fail('Provider denied admin booking list', `${providerAdmin.status}`)

  const customerAdmin = await req('GET', `/admin/bookings/${bookingAId}`, {
    token: customerToken,
  })
  if (customerAdmin.status === 403) pass('Customer denied admin booking detail')
  else fail('Customer denied admin booking detail', `${customerAdmin.status}`)

  // Admin bypass on provider route
  const adminBypass = await req('GET', '/provider/bookings', {
    token: adminToken,
    orgContext: ctxB.org._id,
    adminBypass: true,
  })
  if (
    adminBypass.status === 200 &&
    (adminBypass.data?.data || []).some((b) => String(b._id) === String(bookingBId))
  ) {
    pass('Admin org-bypass can list provider bookings for any org')
  } else {
    fail('Admin org-bypass can list provider bookings for any org', `${adminBypass.status}`)
  }

  // Legacy isolation
  if (uri) {
    const Booking = (await import('../models/Booking.js')).default
    const User = (await import('../models/User.js')).default
    const customer = await User.findOne({ email: 'customer@visitethiopia.test' })
    const legacy = await Booking.create({
      user: customer._id,
      bookingType: 'hotel',
      bookingItem: new mongoose.Types.ObjectId(),
      bookingFlowVersion: 'legacy',
      status: 'pending',
      contactInfo: {
        fullName: 'Legacy Guest',
        email: 'legacy@example.com',
        phone: '+251900000000',
      },
      payment: { amount: 100, currency: 'ETB', paymentMethod: 'cash', paymentStatus: 'pending' },
    })
    // Force organizationId onto legacy shouldn't happen; ensure provider doesn't see it
    const legacyPeek = await req('GET', `/provider/bookings/${legacy._id}`, {
      token: operatorA,
      orgContext: ctxA.org._id,
    })
    if (legacyPeek.status === 404) pass('Legacy booking inaccessible via provider V2 endpoint')
    else fail('Legacy booking inaccessible via provider V2 endpoint', `${legacyPeek.status}`)

    const listHasLegacy = (listA.data?.data || []).some(
      (b) => String(b._id) === String(legacy._id) || b.bookingFlowVersion === 'legacy'
    )
    if (!listHasLegacy) pass('Provider list excludes legacy bookings')
    else fail('Provider list excludes legacy bookings')
  } else {
    fail('Legacy booking inaccessible via provider V2 endpoint', 'no db uri')
    fail('Provider list excludes legacy bookings', 'no db uri')
  }

  // Lifecycle integrity — confirmed booking still confirmed; provider cannot alter
  const after = await req('GET', `/provider/bookings/${bookingAId}`, {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (after.data?.data?.status === 'confirmed') {
    pass('Lifecycle intact after provider reads')
  } else {
    fail('Lifecycle intact after provider reads', after.data?.data?.status)
  }

  // Customer flow regression smoke
  const customerMe = await req('GET', '/bookings/me', { token: customerToken })
  if (customerMe.status === 200) pass('Customer /bookings/me still works')
  else fail('Customer /bookings/me still works', `${customerMe.status}`)

  const customerGet = await req('GET', `/bookings/${bookingAId}`, { token: customerToken })
  if (customerGet.status === 200) pass('Customer booking detail still works')
  else fail('Customer booking detail still works', `${customerGet.status}`)

  // Provider must not confirm payments (ownership or forged fields)
  const forgeConfirm = await req('POST', `/payments/${payA}/confirm`, {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if ([403, 404].includes(forgeConfirm.status)) {
    pass('Provider cannot confirm customer payment')
  } else if (
    forgeConfirm.status === 200 &&
    (forgeConfirm.data?.idempotent || forgeConfirm.data?.data?.payment?.status === 'completed')
  ) {
    // Should not happen for non-owner; treat as failure
    fail('Provider cannot confirm customer payment', 'non-owner succeeded')
  } else if (forgeConfirm.status === 400 || forgeConfirm.status === 409) {
    pass('Provider cannot confirm customer payment', `${forgeConfirm.status}`)
  } else {
    fail('Provider cannot confirm customer payment', `${forgeConfirm.status}`)
  }

  // Inventory fields rejected / immutable from provider surface
  if (
    detailA.data?.data?.inventory &&
    typeof detailA.data.data.inventory.reserved === 'boolean'
  ) {
    pass('Inventory status visible read-only to provider')
  } else {
    fail('Inventory status visible read-only to provider')
  }

  // Search filter
  const search = await req('GET', '/provider/bookings?customerSearch=Phase4H', {
    token: operatorA,
    orgContext: ctxA.org._id,
  })
  if (search.status === 200) pass('Customer search filter accepted')
  else fail('Customer search filter accepted', `${search.status}`)

  // Provider B isolation positive
  const listB = await req('GET', '/provider/bookings', {
    token: operatorB,
    orgContext: ctxB.org._id,
  })
  if (
    listB.status === 200 &&
    (listB.data?.data || []).some((b) => String(b._id) === String(bookingBId)) &&
    !(listB.data?.data || []).some((b) => String(b._id) === String(bookingAId))
  ) {
    pass('Provider B sees only own organization bookings')
  } else {
    fail('Provider B sees only own organization bookings', `${listB.status}`)
  }

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n=== Phase 4H provider bookings: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
  )
  mongoose.disconnect().catch(() => {})
  process.exit(failed ? 1 : 0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
