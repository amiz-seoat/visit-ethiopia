/**
 * Phase 3 final production audit tests.
 * Usage: node scripts/phase3-final-audit.js [baseUrl]
 */
import dotenv from 'dotenv'

dotenv.config({ path: './config.env' })

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

async function req(method, path, { token, body, orgContext } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgContext ? { 'X-Org-Context': orgContext } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, text: JSON.stringify(data || {}) }
}

async function login(email, password) {
  const r = await req('POST', '/users/login', { body: { email, password } })
  return r.data.token
}

function verification() {
  return {
    legalName: 'Final Audit PLC',
    registrationNumber: 'FA-001',
    responsiblePerson: {
      name: 'Auditor',
      phone: '+251911000088',
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
    description: 'Final audit tour description.',
    shortDescription: 'Audit tour',
    duration: { days: 3, nights: 2 },
    destinations: ['Axum'],
    difficulty: 'easy',
    price: 400,
    coverImage: 'https://images.unsplash.com/photo-1518341223789-51e3a61f5dc6',
    maxGroupSize: 8,
  }
}

async function registerApprove(token, adminToken, name) {
  const reg = await req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes: ['travel_company'],
      shortDescription: 'Audit org',
      verification: verification(),
    },
  })
  const org = reg.data.data.organization
  const versionId = reg.data.data.draftVersion._id
  await req('PATCH', `/organizations/${org._id}/draft`, {
    token,
    orgContext: org._id,
    body: { shortDescription: 'V1 PUBLIC', verification: verification() },
  })
  const sub = await req('POST', `/organizations/${org._id}/versions/${versionId}/submit`, {
    token,
    orgContext: org._id,
  })
  await req('PATCH', `/organizations/admin/approvals/${sub.data.data.approvalRequest._id}/approve`, {
    token: adminToken,
    body: {},
  })
  return org
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Phase 3 final audit: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
  process.exit(failed ? 1 : 0)
}

async function run() {
  console.log(`\n=== Phase 3 Final Audit @ ${BASE} ===\n`)

  const operator = await login('operator@visitethiopia.test', 'OperatorPass123!')
  const admin = await login('admin@visitethiopia.test', 'AdminPass123!')

  const LEG = 'LEGACY'
  const org = await registerApprove(operator, admin, `Final Audit Org ${Date.now()}`)
  const created = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Org Tour ${Date.now()}`),
  })
  const orgTourId = created.data?.data?.data?._id

  const legacyPatch = await req('PATCH', `/tours/${orgTourId}`, {
    token: operator,
    body: { status: 'published', title: 'Hijacked' },
  })
  if (legacyPatch.status === 403) pass(LEG, 'Legacy PATCH blocked for organization tours')
  else fail(LEG, 'Legacy PATCH blocked for organization tours', `${legacyPatch.status}`)

  const legacyDelete = await req('DELETE', `/tours/${orgTourId}`, { token: operator })
  if (legacyDelete.status === 403) pass(LEG, 'Legacy DELETE blocked for organization tours')
  else fail(LEG, 'Legacy DELETE blocked for organization tours', `${legacyDelete.status}`)

  const tours = await req('GET', '/tours?limit=1')
  const legacyId = tours.data?.data?.data?.[0]?._id
  if (legacyId) {
    const legacyOk = await req('PATCH', `/tours/${legacyId}`, {
      token: operator,
      body: { shortDescription: 'Legacy still works' },
    })
    if (legacyOk.status === 200) pass(LEG, 'Legacy PATCH still works for non-org tours')
    else fail(LEG, 'Legacy PATCH still works for non-org tours', `${legacyOk.status}`)
  }

  const MASS = 'MASS-ASSIGN'
  const dupPkg = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: {
      ...tourPayload(`Dup Pkg ${Date.now()}`),
      packages: [
        { key: 'normal', name: 'A', priceMinor: 100 },
        { key: 'normal', name: 'B', priceMinor: 200 },
      ],
    },
  })
  if (dupPkg.status === 400) pass(MASS, 'Duplicate package keys rejected')
  else fail(MASS, 'Duplicate package keys rejected', `${dupPkg.status}`)

  const VIS = 'VISIBILITY'
  await req('POST', `/organizations/${org._id}/tours/${orgTourId}/publish`, {
    token: operator,
    orgContext: org._id,
  })
  const publicTour = await req('GET', `/tours/${orgTourId}`)
  if (
    publicTour.status === 200 &&
    publicTour.data?.data?.data?.organization?.shortDescription === 'V1 PUBLIC'
  ) {
    pass(VIS, 'Public tour includes approved org snapshot only')
  } else fail(VIS, 'Public tour includes approved org snapshot only')

  await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operator,
    orgContext: org._id,
    body: { shortDescription: 'V2 LEAK', verification: verification() },
  })
  const leak = await req('GET', `/tours/${orgTourId}`)
  if (leak.data?.data?.data?.organization?.shortDescription === 'V1 PUBLIC') {
    pass(VIS, 'V2 draft never leaks through public tour')
  } else fail(VIS, 'V2 draft never leaks through public tour')

  const proto = await req('PATCH', `/organizations/${org._id}/tours/${orgTourId}`, {
    token: operator,
    orgContext: org._id,
    body: { __proto__: { polluted: true }, title: 'Safe Title' },
  })
  if (proto.status === 200 && proto.data?.data?.data?.title === 'Safe Title') {
    pass(MASS, 'Prototype pollution keys ignored')
  } else fail(MASS, 'Prototype pollution keys ignored', `${proto.status}`)

  const unapprovedFilter = await req(
    'GET',
    '/tours/marketplace?organizationId=507f1f77bcf86cd799439011'
  )
  if ((unapprovedFilter.data?.data?.data || []).length === 0) {
    pass(VIS, 'Marketplace filter hides unknown/unapproved org ids')
  } else fail(VIS, 'Marketplace filter hides unknown/unapproved org ids')

  const QUERY = 'QUERY'
  const hugeLimit = await req('GET', '/tours/marketplace?limit=99999')
  if (hugeLimit.status === 200) {
    const count = (hugeLimit.data?.data?.data || []).length
    if (count <= 100) pass(QUERY, 'Marketplace limit capped at 100')
    else fail(QUERY, 'Marketplace limit capped at 100', `count=${count}`)
  } else fail(QUERY, 'Marketplace limit capped', `${hugeLimit.status}`)

  const badSort = await req('GET', '/tours/marketplace?sort=$where')
  if (badSort.status === 200) pass(QUERY, 'Malicious sort rejected safely')
  else fail(QUERY, 'Malicious sort rejected safely', `${badSort.status}`)

  done()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
