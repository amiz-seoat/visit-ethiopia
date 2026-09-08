/**
 * Phase 3 — Travel company + tour marketplace security & concurrency tests.
 * Usage: node scripts/phase3-tour-marketplace.js [baseUrl] [databaseUri]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Tour from '../models/Tour.js'
import TourDeparture from '../models/TourDeparture.js'
import { reserveDepartureSpots } from '../services/tourDepartureService.js'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveTestDatabaseUri() {
  if (process.argv[3]) return process.argv[3]
  const memoryUriFile = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(memoryUriFile)) {
    return fs.readFileSync(memoryUriFile, 'utf8').trim()
  }
  return process.env.DATABASE
}

const BASE = (process.argv[2] || 'http://localhost:4002/api/v1').replace(/\/$/, '')
const results = []

function ok(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function req(method, path, { token, body, orgContext, adminBypass } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgContext ? { 'X-Org-Context': orgContext } : {}),
    ...(adminBypass ? { 'X-Admin-Org-Bypass': 'true' } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function login(email, password) {
  const res = await req('POST', '/users/login', { body: { email, password } })
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed for ${email}: ${res.status}`)
  }
  return res.data.token
}

function validVerification() {
  return {
    legalName: 'Phase3 Travel PLC',
    registrationNumber: 'P3-REG-001',
    responsiblePerson: {
      name: 'Tour Operator',
      phone: '+251911000001',
      email: 'operator@visitethiopia.test',
    },
    businessDocuments: [
      { type: 'business_license', url: 'https://example.com/license.pdf', status: 'pending' },
    ],
  }
}

function sampleTourPayload(title = 'Phase3 Safari') {
  return {
    title,
    description: 'A comprehensive tour across northern Ethiopia with expert guides.',
    shortDescription: 'Northern Ethiopia highlights',
    duration: { days: 5, nights: 4 },
    destinations: ['Lalibela', 'Gondar'],
    difficulty: 'moderate',
    price: 1200,
    coverImage: 'https://images.unsplash.com/photo-1518341223789-51e3a61f5dc6',
    maxGroupSize: 15,
    highlights: ['Rock-hewn churches', 'Castle visit'],
    inclusions: ['Guide', 'Transport'],
    exclusions: ['International flights'],
    policies: { cancellation: '48h notice', refund: 'Partial', other: '' },
    itinerary: [
      { day: 1, title: 'Arrival', description: 'Welcome and briefing' },
    ],
  }
}

async function registerAndApproveOrg(token, adminToken, name) {
  const reg = await req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes: ['travel_company'],
      shortDescription: 'Approved travel company',
      verification: validVerification(),
    },
  })
  if (reg.status !== 201) throw new Error(`Register failed: ${reg.status}`)
  const org = reg.data.data.organization
  const versionId = reg.data.data.draftVersion._id

  await req('PATCH', `/organizations/${org._id}/draft`, {
    token,
    orgContext: org._id,
    body: { shortDescription: 'Public company profile', verification: validVerification() },
  })

  const submit = await req('POST', `/organizations/${org._id}/versions/${versionId}/submit`, {
    token,
    orgContext: org._id,
  })
  const approvalId = submit.data?.data?.approvalRequest?._id
  await req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: adminToken,
    body: {},
  })
  return org
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n=== Phase 3 tour marketplace: ${passed} passed, ${failed} failed (${results.length} total) ===\n`
  )
  process.exit(failed ? 1 : 0)
}

async function runConcurrencyTest() {
  const uri = resolveTestDatabaseUri()
  if (!uri) {
    fail('Concurrency test DB connection', 'No DATABASE URI')
    return
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri)
  }

  const departure = await TourDeparture.create({
    tourId: new mongoose.Types.ObjectId(),
    organizationId: new mongoose.Types.ObjectId(),
    departureDate: new Date(Date.now() + 86400000 * 30),
    capacity: 10,
    availableSpots: 10,
    status: 'open',
  })

  const attempts = Array.from({ length: 20 }, () =>
    reserveDepartureSpots(departure._id, 1).then(
      () => ({ ok: true }),
      (e) => ({ ok: false, message: e.message })
    )
  )
  const outcomes = await Promise.all(attempts)
  const succeeded = outcomes.filter((o) => o.ok).length
  const failed = outcomes.filter((o) => !o.ok).length

  const refreshed = await TourDeparture.findById(departure._id)
  await TourDeparture.deleteOne({ _id: departure._id })

  if (succeeded === 10 && failed === 10 && refreshed.availableSpots === 0) {
    ok('Concurrent inventory: exactly 10 succeed, 10 fail, spots=0')
  } else {
    fail(
      'Concurrent inventory: exactly 10 succeed, 10 fail, spots=0',
      `success=${succeeded} fail=${failed} spots=${refreshed?.availableSpots}`
    )
  }

  if (refreshed.availableSpots >= 0) ok('availableSpots never negative')
  else fail('availableSpots never negative', String(refreshed.availableSpots))
}

async function run() {
  console.log(`\n=== Phase 3 tour marketplace @ ${BASE} ===\n`)

  let customerToken, operatorToken, operatorBToken, guideToken, adminToken
  try {
    customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
    operatorToken = await login('operator@visitethiopia.test', 'OperatorPass123!')
    operatorBToken = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
    guideToken = await login('guide@visitethiopia.test', 'GuidePass123!')
    adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
    ok('Seed user logins')
  } catch (e) {
    fail('Seed user logins', e.message)
    return done()
  }

  let orgA, orgB
  try {
    orgA = await registerAndApproveOrg(
      operatorToken,
      adminToken,
      `Phase3 Org A ${Date.now()}`
    )
    orgB = await registerAndApproveOrg(
      operatorBToken,
      adminToken,
      `Phase3 Org B ${Date.now()}`
    )
    ok('Setup approved travel companies A and B')
  } catch (e) {
    fail('Setup approved travel companies', e.message)
    return done()
  }

  // A. Customer cannot create tour via org endpoint
  const custCreate = await req('POST', `/organizations/${orgA._id}/tours`, {
    token: customerToken,
    orgContext: orgA._id,
    body: sampleTourPayload(),
  })
  if (custCreate.status === 403 || custCreate.status === 401) {
    ok('A. Customer cannot create org tour')
  } else fail('A. Customer cannot create org tour', `${custCreate.status}`)

  // Create draft tour as operator
  const createRes = await req('POST', `/organizations/${orgA._id}/tours`, {
    token: operatorToken,
    orgContext: orgA._id,
    body: sampleTourPayload(`Lalibela Explorer ${Date.now()}`),
  })
  if (createRes.status !== 201) {
    fail('Provider creates draft tour', `${createRes.status} ${createRes.data?.message}`)
    return done()
  }
  ok('Provider creates draft tour')
  const tour = createRes.data.data.data
  const tourId = tour._id
  const tourSlug = tour.slug

  // G. Draft invisible publicly
  const draftPublic = await req('GET', `/tours/${tourSlug}`)
  if (draftPublic.status === 404) ok('G. Draft tour invisible publicly')
  else fail('G. Draft tour invisible publicly', `${draftPublic.status}`)

  // B. Customer cannot edit
  const custEdit = await req('PATCH', `/organizations/${orgA._id}/tours/${tourId}`, {
    token: customerToken,
    orgContext: orgA._id,
    body: { title: 'Hacked' },
  })
  if (custEdit.status === 403 || custEdit.status === 401) ok('B. Customer cannot edit tour')
  else fail('B. Customer cannot edit tour', `${custEdit.status}`)

  // D/E. Cross-org access
  const crossRead = await req('GET', `/organizations/${orgA._id}/tours/${tourId}`, {
    token: operatorBToken,
    orgContext: orgB._id,
  })
  if (crossRead.status === 403) ok('D. Org B cannot read Org A tour management')
  else fail('D. Org B cannot read Org A tour management', `${crossRead.status}`)

  const crossEdit = await req('PATCH', `/organizations/${orgA._id}/tours/${tourId}`, {
    token: operatorBToken,
    orgContext: orgB._id,
    body: { title: 'Stolen' },
  })
  if (crossEdit.status === 403) ok('E. Org B cannot modify Org A tour')
  else fail('E. Org B cannot modify Org A tour', `${crossEdit.status}`)

  // F. Unauthenticated workspace
  const noAuth = await req('GET', `/organizations/${orgA._id}/tours`)
  if (noAuth.status === 401) ok('F. Unauthenticated cannot access provider tours')
  else fail('F. Unauthenticated cannot access provider tours', `${noAuth.status}`)

  // Publish tour
  const publishRes = await req('POST', `/organizations/${orgA._id}/tours/${tourId}/publish`, {
    token: operatorToken,
    orgContext: orgA._id,
  })
  if (publishRes.status === 200) ok('Provider publishes tour')
  else fail('Provider publishes tour', `${publishRes.status} ${publishRes.data?.message}`)

  // K. Approved provider + published tour visible
  const publicTour = await req('GET', `/tours/${tourSlug}`)
  if (publicTour.status === 200 && publicTour.data?.data?.data?.title) {
    ok('K. Approved provider + published tour publicly visible')
  } else {
    fail('K. Approved provider + published tour publicly visible', `${publicTour.status}`)
  }

  // L. Private fields not leaked
  const pubData = publicTour.data?.data?.data || {}
  if (!pubData.secretTour && !pubData.verification && !pubData.createdBy) {
    ok('L. Private fields not leaked on public tour')
  } else fail('L. Private fields not leaked', JSON.stringify(Object.keys(pubData)))

  // Company tours listing
  const orgTours = await req('GET', `/organizations/${orgA.slug}/tours`)
  if (orgTours.status === 200 && (orgTours.data?.data?.data || []).length >= 1) {
    ok('Public company tours listing')
  } else fail('Public company tours listing', `${orgTours.status}`)

  // Create departure
  const depDate = new Date(Date.now() + 86400000 * 45).toISOString()
  const depCreate = await req('POST', `/organizations/${orgA._id}/tours/${tourId}/departures`, {
    token: operatorToken,
    orgContext: orgA._id,
    body: { departureDate: depDate, capacity: 10, availableSpots: 10 },
  })
  if (depCreate.status === 201) ok('Provider creates departure')
  else fail('Provider creates departure', `${depCreate.status} ${depCreate.data?.message}`)

  const publicDeps = await req('GET', `/tours/${tourSlug}/departures`)
  if (publicDeps.status === 200 && (publicDeps.data?.data?.data || []).length >= 1) {
    ok('Public departure listing')
  } else fail('Public departure listing', `${publicDeps.status}`)

  // Unpublish
  await req('POST', `/organizations/${orgA._id}/tours/${tourId}/unpublish`, {
    token: operatorToken,
    orgContext: orgA._id,
  })
  const unpublishedPublic = await req('GET', `/tours/${tourSlug}`)
  if (unpublishedPublic.status === 404) ok('H. Unpublished tour invisible publicly')
  else fail('H. Unpublished tour invisible publicly', `${unpublishedPublic.status}`)

  // Re-publish for lifecycle tests
  await req('POST', `/organizations/${orgA._id}/tours/${tourId}/publish`, {
    token: operatorToken,
    orgContext: orgA._id,
  })

  // Archive
  await req('POST', `/organizations/${orgA._id}/tours/${tourId}/archive`, {
    token: operatorToken,
    orgContext: orgA._id,
  })
  const archivePublish = await req('POST', `/organizations/${orgA._id}/tours/${tourId}/publish`, {
    token: operatorToken,
    orgContext: orgA._id,
  })
  if (archivePublish.status === 409) ok('O/P. Archived tour cannot publish without valid transition')
  else fail('O/P. Archived tour cannot publish', `${archivePublish.status}`)

  // Unapproved org tour visibility — register but don't approve
  const unapprovedReg = await req('POST', '/organizations/register', {
    token: operatorToken,
    body: {
      name: `Unapproved ${Date.now()}`,
      providerTypes: ['travel_company'],
      shortDescription: 'Not approved',
      verification: validVerification(),
    },
  })
  const unapprovedOrg = unapprovedReg.data?.data?.organization
  if (unapprovedOrg) {
    const unapTour = await req('POST', `/organizations/${unapprovedOrg._id}/tours`, {
      token: operatorToken,
      orgContext: unapprovedOrg._id,
      body: sampleTourPayload('Hidden Tour'),
    })
    const hiddenId = unapTour.data?.data?.data?._id
    if (hiddenId) {
      await req('POST', `/organizations/${unapprovedOrg._id}/tours/${hiddenId}/publish`, {
        token: operatorToken,
        orgContext: unapprovedOrg._id,
      })
      const hiddenSlug = unapTour.data.data.data.slug
      const hiddenPublic = await req('GET', `/tours/${hiddenSlug}`)
      if (hiddenPublic.status === 404) ok('I. Published tour of unapproved provider invisible')
      else fail('I. Published tour of unapproved provider invisible', `${hiddenPublic.status}`)
    }
  }

  // J. Suspended provider
  const suspendRes = await req(
    'PATCH',
    `/organizations/admin/organizations/${orgA._id}/suspend`,
    { token: adminToken, body: { reason: 'Test suspend' } }
  )
  if (suspendRes.status === 200) {
    const suspendedPublic = await req('GET', `/tours/${tourSlug}`)
    if (suspendedPublic.status === 404) ok('J. Published tour of suspended provider invisible')
    else fail('J. Suspended provider tour invisible', `${suspendedPublic.status}`)
    await req('PATCH', `/organizations/admin/organizations/${orgA._id}/reactivate`, {
      token: adminToken,
      body: {},
    })
  } else fail('J. Suspend org for visibility test', `${suspendRes.status}`)

  // Marketplace endpoint
  const marketplace = await req('GET', '/tours/marketplace?limit=5')
  if (marketplace.status === 200) ok('Marketplace listing endpoint')
  else fail('Marketplace listing endpoint', `${marketplace.status}`)

  // M/N concurrency
  await runConcurrencyTest()

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }

  done()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
