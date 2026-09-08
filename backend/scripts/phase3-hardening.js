/**
 * Phase 3 hardening — lifecycle, visibility, concurrency, Phase 2 isolation, validation.
 * Usage: node scripts/phase3-hardening.js [baseUrl]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Tour from '../models/Tour.js'
import TourDeparture from '../models/TourDeparture.js'
import {
  reserveDepartureSpots,
  releaseDepartureSpots,
} from '../services/tourDepartureService.js'
import { assertTourTransition } from '../config/tourLifecycle.js'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://localhost:4002/api/v1').replace(/\/$/, '')
const results = []

function pass(section, name, detail = '') {
  results.push({ section, ok: true, name, detail })
  console.log(`✅ [${section}] ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(section, name, detail = '') {
  results.push({ section, ok: false, name, detail })
  console.log(`❌ [${section}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function req(method, path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.orgContext ? { 'X-Org-Context': opts.orgContext } : {}),
    ...(opts.adminBypass ? { 'X-Admin-Org-Bypass': 'true' } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, text: JSON.stringify(data || {}) }
}

async function login(email, password) {
  const r = await req('POST', '/users/login', { body: { email, password } })
  if (!r.data?.token) throw new Error(`Login failed ${email}`)
  return r.data.token
}

function verification() {
  return {
    legalName: 'P3 Hardening PLC',
    registrationNumber: 'P3H-001',
    responsiblePerson: {
      name: 'Hard Operator',
      phone: '+251911000099',
      email: 'operator@visitethiopia.test',
    },
    businessDocuments: [
      { type: 'business_license', url: 'https://example.com/license.pdf' },
    ],
  }
}

function tourPayload(title) {
  return {
    title,
    description: 'Detailed tour description for hardening tests.',
    shortDescription: 'Hardening tour',
    duration: { days: 4, nights: 3 },
    destinations: ['Gondar'],
    difficulty: 'moderate',
    price: 900,
    coverImage: 'https://images.unsplash.com/photo-1518341223789-51e3a61f5dc6',
    maxGroupSize: 10,
  }
}

async function registerApprove(token, adminToken, name) {
  const reg = await req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes: ['travel_company'],
      shortDescription: 'Hardening org',
      verification: verification(),
    },
  })
  const org = reg.data?.data?.organization
  const versionId = reg.data?.data?.draftVersion?._id
  await req('PATCH', `/organizations/${org._id}/draft`, {
    token,
    orgContext: org._id,
    body: { shortDescription: 'V1 PUBLIC', verification: verification() },
  })
  const sub = await req('POST', `/organizations/${org._id}/versions/${versionId}/submit`, {
    token,
    orgContext: org._id,
  })
  const approvalId = sub.data?.data?.approvalRequest?._id
  await req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: adminToken,
    body: {},
  })
  return org
}

function resolveDbUri() {
  const f = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim()
  return process.env.DATABASE
}

async function runConcurrency(capacity, attempts, quantity = 1) {
  const dep = await TourDeparture.create({
    tourId: new mongoose.Types.ObjectId(),
    organizationId: new mongoose.Types.ObjectId(),
    departureDate: new Date(Date.now() + 86400000 * 20),
    capacity,
    availableSpots: capacity,
    status: 'open',
  })
  const outcomes = await Promise.all(
    Array.from({ length: attempts }, () =>
      reserveDepartureSpots(dep._id, quantity).then(
        () => ({ ok: true }),
        () => ({ ok: false })
      )
    )
  )
  const succeeded = outcomes.filter((o) => o.ok).length
  const refreshed = await TourDeparture.findById(dep._id)
  await TourDeparture.deleteOne({ _id: dep._id })
  return { succeeded, failed: attempts - succeeded, spots: refreshed?.availableSpots }
}

function done() {
  const sections = {}
  for (const r of results) {
    sections[r.section] = sections[r.section] || { pass: 0, fail: 0 }
    if (r.ok) sections[r.section].pass++
    else sections[r.section].fail++
  }
  console.log('\n=== PHASE 3 HARDENING SUMMARY ===')
  for (const [section, counts] of Object.entries(sections)) {
    console.log(`${section}: ${counts.pass}/${counts.pass + counts.fail}`)
  }
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\nTOTAL: ${passed} passed, ${failed} failed (${results.length} checks)\n`)
  process.exit(failed ? 1 : 0)
}

async function run() {
  console.log(`\n=== Phase 3 Hardening @ ${BASE} ===\n`)

  let operator, operatorB, admin, customer
  try {
    operator = await login('operator@visitethiopia.test', 'OperatorPass123!')
    operatorB = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
    admin = await login('admin@visitethiopia.test', 'AdminPass123!')
    customer = await login('customer@visitethiopia.test', 'CustomerPass123!')
    pass('SETUP', 'Seed logins')
  } catch (e) {
    fail('SETUP', 'Seed logins', e.message)
    return done()
  }

  const LC = 'LIFECYCLE'
  const invalidTransitions = [
    ['draft', 'unpublished'],
    ['published', 'draft'],
    ['archived', 'published'],
    ['archived', 'draft'],
    ['unpublished', 'draft'],
  ]
  for (const [from, to] of invalidTransitions) {
    try {
      assertTourTransition(from, to)
      fail(LC, `Reject ${from}→${to}`)
    } catch {
      pass(LC, `Reject ${from}→${to}`)
    }
  }
  const validTransitions = [
    ['draft', 'published'],
    ['published', 'unpublished'],
    ['unpublished', 'published'],
    ['published', 'archived'],
    ['draft', 'archived'],
  ]
  for (const [from, to] of validTransitions) {
    try {
      assertTourTransition(from, to)
      pass(LC, `Allow ${from}→${to}`)
    } catch (e) {
      fail(LC, `Allow ${from}→${to}`, e.message)
    }
  }

  const org = await registerApprove(operator, admin, `P3H Org ${Date.now()}`)
  const create = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Lifecycle Tour ${Date.now()}`),
  })
  const tourId = create.data?.data?.data?._id
  if (!tourId) {
    fail(LC, 'Create tour for lifecycle')
    return done()
  }

  const patchStatus = await req('PATCH', `/organizations/${org._id}/tours/${tourId}`, {
    token: operator,
    orgContext: org._id,
    body: { status: 'published' },
  })
  if (patchStatus.status === 200 && patchStatus.data?.data?.data?.status === 'draft') {
    pass(LC, 'PATCH cannot bypass lifecycle via status field')
  } else fail(LC, 'PATCH cannot bypass lifecycle via status field', `${patchStatus.status}`)

  const patchOrg = await req('PATCH', `/organizations/${org._id}/tours/${tourId}`, {
    token: operator,
    orgContext: org._id,
    body: { organizationId: '507f1f77bcf86cd799439011' },
  })
  if (patchOrg.data?.data?.data?.organizationId === org._id) {
    pass(LC, 'organizationId tampering ignored')
  } else fail(LC, 'organizationId tampering ignored')

  await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operator,
    orgContext: org._id,
  })
  const republish = await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operator,
    orgContext: org._id,
  })
  if (republish.status === 409) pass(LC, 'Repeated publish rejected')
  else fail(LC, 'Repeated publish rejected', `${republish.status}`)

  const VIS = 'VISIBILITY'
  const slug = create.data.data.data.slug
  const pub = await req('GET', `/tours/${slug}`)
  if (pub.status === 200) pass(VIS, 'Published tour public by slug')
  else fail(VIS, 'Published tour public by slug', `${pub.status}`)

  if (!pub.text.includes('verification') && !pub.text.includes('adminNotes')) {
    pass(VIS, 'Public tour has no verification/admin leaks')
  } else fail(VIS, 'Public tour has no verification/admin leaks')

  if (!pub.data?.data?.data?.status) pass(VIS, 'Public tour omits internal status field')
  else fail(VIS, 'Public tour omits internal status field')

  const iso = 'PHASE2-ISO'
  const draftV2 = await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operator,
    orgContext: org._id,
    body: { shortDescription: 'V2 SECRET DRAFT', verification: verification() },
  })
  const v2Id = draftV2.data?.data?.version?._id
  const pubDuringDraft = await req('GET', `/organizations/${org.slug}`)
  if (pubDuringDraft.data?.data?.data?.shortDescription === 'V1 PUBLIC') {
    pass(iso, 'Approved V1 remains public during V2 draft')
  } else fail(iso, 'Approved V1 remains public during V2 draft')

  await req('POST', `/organizations/${org._id}/versions/${v2Id}/submit`, {
    token: operator,
    orgContext: org._id,
  })
  const pubDuringSubmit = await req('GET', `/organizations/${org.slug}`)
  if (pubDuringSubmit.data?.data?.data?.shortDescription === 'V1 PUBLIC') {
    pass(iso, 'Approved V1 remains public while V2 pending')
  } else fail(iso, 'Approved V1 remains public while V2 pending')

  const tourDuringV2 = await req('GET', `/tours/${slug}`)
  if (
    tourDuringV2.status === 200 &&
    tourDuringV2.data?.data?.data?.organization?.shortDescription === 'V1 PUBLIC'
  ) {
    pass(iso, 'Tour organization snapshot uses approved V1 during V2 pending')
  } else {
    fail(iso, 'Tour organization snapshot uses approved V1 during V2 pending')
  }

  const INV = 'INVENTORY'
  const uri = resolveDbUri()
  if (uri && mongoose.connection.readyState === 0) await mongoose.connect(uri)

  const c10 = await runConcurrency(10, 50, 1)
  if (c10.succeeded === 10 && c10.failed === 40 && c10.spots === 0) {
    pass(INV, '50 parallel x1 on capacity 10')
  } else {
    fail(INV, '50 parallel x1 on capacity 10', JSON.stringify(c10))
  }

  const c100 = await runConcurrency(10, 100, 1)
  if (c100.succeeded === 10 && c100.spots === 0) {
    pass(INV, '100 parallel x1 on capacity 10')
  } else fail(INV, '100 parallel x1 on capacity 10', JSON.stringify(c100))

  const dep = await TourDeparture.create({
    tourId: new mongoose.Types.ObjectId(),
    organizationId: new mongoose.Types.ObjectId(),
    departureDate: new Date(Date.now() + 86400000 * 10),
    capacity: 10,
    availableSpots: 10,
    status: 'open',
  })
  try {
    await reserveDepartureSpots(dep._id, 0)
    fail(INV, 'Reject zero quantity')
  } catch {
    pass(INV, 'Reject zero quantity')
  }
  try {
    await reserveDepartureSpots(dep._id, -1)
    fail(INV, 'Reject negative quantity')
  } catch {
    pass(INV, 'Reject negative quantity')
  }
  await TourDeparture.deleteOne({ _id: dep._id })

  const VAL = 'VALIDATION'
  const badPrice = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: {
      ...tourPayload(`Bad Price ${Date.now()}`),
      packages: [{ key: 'normal', name: 'N', priceMinor: 10.5 }],
    },
  })
  if (badPrice.status === 400) pass(VAL, 'Reject fractional package priceMinor')
  else fail(VAL, 'Reject fractional package priceMinor', `${badPrice.status}`)

  const badDep = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operator,
    orgContext: org._id,
    body: { departureDate: 'not-a-date', capacity: 5 },
  })
  if (badDep.status === 400) pass(VAL, 'Reject invalid departure date')
  else fail(VAL, 'Reject invalid departure date', `${badDep.status}`)

  const AUTH = 'AUTH'
  const crossDep = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operatorB,
    orgContext: org._id,
    body: {
      departureDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      capacity: 5,
    },
  })
  if (crossDep.status === 403) pass(AUTH, 'Cross-org departure create blocked')
  else fail(AUTH, 'Cross-org departure create blocked', `${crossDep.status}`)

  const custPub = await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: customer,
    orgContext: org._id,
  })
  if (custPub.status === 403 || custPub.status === 401) {
    pass(AUTH, 'Customer cannot publish tour')
  } else fail(AUTH, 'Customer cannot publish tour', `${custPub.status}`)

  const draftTour = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Draft Only ${Date.now()}`),
  })
  const draftId = draftTour.data?.data?.data?._id
  const draftSlug = draftTour.data?.data?.data?.slug
  if (draftSlug) {
    const hidden = await req('GET', `/tours/${draftSlug}`)
    if (hidden.status === 404) pass(VIS, 'Draft tour hidden by slug')
    else fail(VIS, 'Draft tour hidden by slug', `${hidden.status}`)
  }

  await req('POST', `/organizations/${org._id}/tours/${tourId}/archive`, {
    token: operator,
    orgContext: org._id,
  })
  const archivedPub = await req('GET', `/tours/${slug}`)
  if (archivedPub.status === 404) pass(VIS, 'Archived tour hidden publicly')
  else fail(VIS, 'Archived tour hidden publicly', `${archivedPub.status}`)

  const archivedDep = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operator,
    orgContext: org._id,
    body: {
      departureDate: new Date(Date.now() + 86400000 * 40).toISOString(),
      capacity: 5,
    },
  })
  if (archivedDep.status === 409) pass(LC, 'Cannot add departure to archived tour')
  else fail(LC, 'Cannot add departure to archived tour', `${archivedDep.status}`)

  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  done()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
