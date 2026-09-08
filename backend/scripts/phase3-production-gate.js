/**
 * Phase 3 production gate — adversarial checks for architectural decisions
 * and cross-phase security boundaries.
 * Usage: node scripts/phase3-production-gate.js [baseUrl]
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

async function req(method, path, { token, body, orgContext, headers: extraHeaders } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5200',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgContext ? { 'X-Org-Context': orgContext } : {}),
    ...extraHeaders,
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
    legalName: 'Gate Audit PLC',
    registrationNumber: 'GA-001',
    responsiblePerson: {
      name: 'Gate Auditor',
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
    description: 'Production gate tour description.',
    shortDescription: 'Gate tour',
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
      shortDescription: 'Gate org',
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
  console.log(
    `\n=== Phase 3 production gate: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
  )
  process.exit(failed ? 1 : 0)
}

async function run() {
  console.log(`\n=== Phase 3 Production Gate @ ${BASE} ===\n`)

  const operator = await login('operator@visitethiopia.test', 'OperatorPass123!')
  const admin = await login('admin@visitethiopia.test', 'AdminPass123!')
  const customer = await login('customer@visitethiopia.test', 'CustomerPass123!')

  const org = await registerApprove(operator, admin, `Gate Org ${Date.now()}`)
  const created = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Gate Tour ${Date.now()}`),
  })
  const tourId = created.data?.data?.data?._id
  const initialSlug = created.data?.data?.data?.slug

  const LEG = 'LEGACY'
  const legacyCreate = await req('POST', '/tours', {
    token: operator,
    body: {
      ...tourPayload('Hijack Org Tour'),
      organizationId: org._id,
      status: 'published',
    },
  })
  const hijackOrgId = legacyCreate.data?.data?.data?.organizationId
  if (!hijackOrgId) pass(LEG, 'Legacy POST strips organizationId')
  else fail(LEG, 'Legacy POST strips organizationId', `orgId=${hijackOrgId}`)

  const adminPatch = await req('PATCH', `/tours/${tourId}`, {
    token: admin,
    body: { title: 'Admin Hijack', status: 'archived' },
  })
  if (adminPatch.status === 403) pass(LEG, 'Admin legacy PATCH blocked for org tours')
  else fail(LEG, 'Admin legacy PATCH blocked for org tours', `${adminPatch.status}`)

  const adminDelete = await req('DELETE', `/tours/${tourId}`, { token: admin })
  if (adminDelete.status === 403) pass(LEG, 'Admin legacy DELETE blocked for org tours')
  else fail(LEG, 'Admin legacy DELETE blocked for org tours', `${adminDelete.status}`)

  const orgDelete = await req('DELETE', `/organizations/${org._id}/tours/${tourId}`, {
    token: operator,
    orgContext: org._id,
  })
  if (orgDelete.status >= 400 && orgDelete.status !== 204) {
    pass(LEG, 'Org-scoped tour DELETE not allowed')
  } else fail(LEG, 'Org-scoped tour DELETE not allowed', `${orgDelete.status}`)

  const tours = await req('GET', '/tours?limit=1')
  const legacyId = tours.data?.data?.data?.[0]?._id
  if (legacyId) {
    const legacyOk = await req('PATCH', `/tours/${legacyId}`, {
      token: operator,
      body: { shortDescription: 'Legacy compat OK' },
    })
    if (legacyOk.status === 200) pass(LEG, 'Legacy non-org PATCH still works')
    else fail(LEG, 'Legacy non-org PATCH still works', `${legacyOk.status}`)
  }

  const ARCH = 'ARCHIVE'
  await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operator,
    orgContext: org._id,
  })
  await req('POST', `/organizations/${org._id}/tours/${tourId}/archive`, {
    token: operator,
    orgContext: org._id,
  })

  const republish = await req('POST', `/organizations/${org._id}/tours/${tourId}/publish`, {
    token: operator,
    orgContext: org._id,
  })
  if (republish.status === 409) pass(ARCH, 'Archived tour cannot be republished')
  else fail(ARCH, 'Archived tour cannot be republished', `${republish.status}`)

  const archivedPublic = await req('GET', `/tours/${tourId}`)
  if (archivedPublic.status === 404) pass(ARCH, 'Archived tour hidden from public API')
  else fail(ARCH, 'Archived tour hidden from public API', `${archivedPublic.status}`)

  const internalGet = await req('GET', `/organizations/${org._id}/tours/${tourId}`, {
    token: operator,
    orgContext: org._id,
  })
  if (internalGet.status === 200 && internalGet.data?.data?.data?.status === 'archived') {
    pass(ARCH, 'Archived tour accessible internally to org member')
  } else fail(ARCH, 'Archived tour accessible internally to org member')

  const archivedDep = await req('POST', `/organizations/${org._id}/tours/${tourId}/departures`, {
    token: operator,
    orgContext: org._id,
    body: {
      departureDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      capacity: 10,
    },
  })
  if (archivedDep.status === 409) pass(ARCH, 'Archived tour cannot receive new departures')
  else fail(ARCH, 'Archived tour cannot receive new departures', `${archivedDep.status}`)

  const tour4 = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Dep Archive ${Date.now()}`),
  })
  const tour4Id = tour4.data?.data?.data?._id
  const depOnLive = await req('POST', `/organizations/${org._id}/tours/${tour4Id}/departures`, {
    token: operator,
    orgContext: org._id,
    body: {
      departureDate: new Date(Date.now() + 86400000 * 45).toISOString(),
      capacity: 5,
    },
  })
  const depId = depOnLive.data?.data?.data?._id
  await req('POST', `/organizations/${org._id}/tours/${tour4Id}/archive`, {
    token: operator,
    orgContext: org._id,
  })
  if (depId) {
    const depUpdate = await req(
      'PATCH',
      `/organizations/${org._id}/tours/${tour4Id}/departures/${depId}`,
      { token: operator, orgContext: org._id, body: { notes: 'blocked' } }
    )
    if (depUpdate.status === 409) pass(ARCH, 'Archived tour departures cannot be updated')
    else fail(ARCH, 'Archived tour departures cannot be updated', `${depUpdate.status}`)
  }

  const SLUG = 'SLUG'
  const tour2 = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Slug Test ${Date.now()}`),
  })
  const tour2Id = tour2.data?.data?.data?._id
  const slug2 = tour2.data?.data?.data?.slug

  const maliciousSlug = await req('PATCH', `/organizations/${org._id}/tours/${tour2Id}`, {
    token: operator,
    orgContext: org._id,
    body: { slug: '../../../etc/passwd', title: tour2.data.data.data.title },
  })
  if (maliciousSlug.status === 200 && maliciousSlug.data?.data?.data?.slug === slug2) {
    pass(SLUG, 'Client slug field ignored on PATCH')
  } else fail(SLUG, 'Client slug field ignored on PATCH')

  const titleChange = await req('PATCH', `/organizations/${org._id}/tours/${tour2Id}`, {
    token: operator,
    orgContext: org._id,
    body: { title: `Renamed Tour ${Date.now()}` },
  })
  const newSlug = titleChange.data?.data?.data?.slug
  if (newSlug && newSlug !== slug2) pass(SLUG, 'Title change regenerates slug')
  else fail(SLUG, 'Title change regenerates slug')

  const oldSlugReq = await req('GET', `/tours/${slug2}`)
  if (oldSlugReq.status === 404) pass(SLUG, 'Old slug returns 404 after title change')
  else fail(SLUG, 'Old slug returns 404 after title change', `${oldSlugReq.status}`)

  const AUTH = 'AUTH'
  const custCreate = await req('POST', `/organizations/${org._id}/tours`, {
    token: customer,
    orgContext: org._id,
    body: tourPayload('Customer Tour'),
  })
  if (custCreate.status === 403) pass(AUTH, 'Customer cannot create org tour')
  else fail(AUTH, 'Customer cannot create org tour', `${custCreate.status}`)

  const crossOrg = await req('GET', `/organizations/${org._id}/tours/${tourId}`, {
    token: operator,
    orgContext: '507f1f77bcf86cd799439011',
  })
  if (crossOrg.status === 403 || crossOrg.status === 400) {
    pass(AUTH, 'Wrong org context rejected')
  } else fail(AUTH, 'Wrong org context rejected', `${crossOrg.status}`)

  const bypassAttempt = await req('GET', `/organizations/${org._id}/tours`, {
    token: customer,
    orgContext: org._id,
    headers: { 'X-Admin-Org-Bypass': 'true' },
  })
  if (bypassAttempt.status === 403) pass(AUTH, 'Non-admin cannot use admin org bypass')
  else fail(AUTH, 'Non-admin cannot use admin org bypass', `${bypassAttempt.status}`)

  const VIS = 'VISIBILITY'
  const tour3 = await req('POST', `/organizations/${org._id}/tours`, {
    token: operator,
    orgContext: org._id,
    body: tourPayload(`Public Gate ${Date.now()}`),
  })
  const tour3Id = tour3.data?.data?.data?._id
  await req('POST', `/organizations/${org._id}/tours/${tour3Id}/publish`, {
    token: operator,
    orgContext: org._id,
  })
  const pubTour = await req('GET', `/tours/${tour3Id}`)
  const body = pubTour.text
  if (
    pubTour.status === 200 &&
    pubTour.data?.data?.data?.organization?.shortDescription === 'V1 PUBLIC' &&
    !body.includes('verificationSnapshot') &&
    !body.includes('adminNotes') &&
    !body.includes('businessDocuments')
  ) {
    pass(VIS, 'Public tour uses approved snapshot only, no private leaks')
  } else fail(VIS, 'Public tour uses approved snapshot only, no private leaks')

  await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operator,
    orgContext: org._id,
    body: { shortDescription: 'V2 LEAK GATE', verification: verification() },
  })
  const afterV2 = await req('GET', `/tours/${tour3Id}`)
  if (afterV2.data?.data?.data?.organization?.shortDescription === 'V1 PUBLIC') {
    pass(VIS, 'V2 draft never leaks through public tour after edit')
  } else fail(VIS, 'V2 draft never leaks through public tour after edit')

  done()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
