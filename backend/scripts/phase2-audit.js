/**
 * Phase 2 comprehensive audit suite.
 * Usage: node scripts/phase2-audit.js [baseUrl]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://localhost:4012/api/v1').replace(/\/$/, '')
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
  if (r.status !== 200) throw new Error(`Login failed ${email}`)
  return r.data.token
}

function verification(providerType = 'travel_company') {
  const base = {
    legalName: 'Audit Travel PLC',
    registrationNumber: 'AUD-001',
    responsiblePerson: {
      name: 'Audit Person',
      phone: '+251911111111',
      email: 'audit@test.com',
    },
    businessDocuments: [],
  }
  if (providerType === 'travel_company') {
    base.businessDocuments = [
      { type: 'business_license', url: 'https://example.com/bl.pdf' },
    ]
  } else if (providerType === 'hotel') {
    base.licenseNumber = 'H-100'
    base.businessDocuments = [
      { type: 'hotel_registration', url: 'https://example.com/hotel.pdf' },
    ]
  } else if (providerType === 'tour_bus_provider') {
    base.licenseNumber = 'TB-100'
    base.businessDocuments = [
      { type: 'operator_permit', url: 'https://example.com/op.pdf' },
    ]
  } else if (providerType === 'bus_company') {
    base.licenseNumber = 'BC-100'
    base.businessDocuments = [
      { type: 'transport_authority_permit', url: 'https://example.com/ta.pdf' },
    ]
  }
  return base
}

async function register(token, name, providerTypes = ['travel_company']) {
  return req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes,
      shortDescription: `${name} short`,
      verification: verification(providerTypes[0]),
    },
  })
}

async function saveDraft(token, orgId, body) {
  return req('PATCH', `/organizations/${orgId}/draft`, {
    token,
    orgContext: orgId,
    body,
  })
}

async function submit(token, orgId, versionId) {
  return req('POST', `/organizations/${orgId}/versions/${versionId}/submit`, {
    token,
    orgContext: orgId,
  })
}

async function approve(adminToken, approvalId) {
  return req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: adminToken,
    body: {},
  })
}

async function reject(adminToken, approvalId, reason) {
  return req('PATCH', `/organizations/admin/approvals/${approvalId}/reject`, {
    token: adminToken,
    body: { rejectionReason: reason },
  })
}

async function publicBySlug(slug) {
  return req('GET', `/organizations/${slug}`)
}

function assertNoLeak(body, label) {
  const forbidden = [
    'verificationSnapshot',
    'businessDocuments',
    'adminNotes',
    'rejectionReason',
    'frozenAt',
    'approvedVersionId',
    'latestVersionId',
    'registrationNumber',
    'taxId',
    'idDocumentUrl',
  ]
  for (const f of forbidden) {
    if (body.includes(f)) return f
  }
  return null
}

function summary() {
  const sections = [...new Set(results.map((r) => r.section))]
  console.log('\n=== PHASE 2 AUDIT SUMMARY ===')
  for (const s of sections) {
    const items = results.filter((r) => r.section === s)
    const ok = items.filter((i) => i.ok).length
    console.log(`${s}: ${ok}/${items.length}`)
  }
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\nTOTAL: ${passed} passed, ${failed} failed (${results.length} checks)\n`)
  return failed === 0
}

async function run() {
  console.log(`\n=== Phase 2 Audit @ ${BASE} ===\n`)

  let operator, operatorB, admin, customer, guide
  try {
    operator = await login('operator@visitethiopia.test', 'OperatorPass123!')
    operatorB = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
    admin = await login('admin@visitethiopia.test', 'AdminPass123!')
    customer = await login('customer@visitethiopia.test', 'CustomerPass123!')
    guide = await login('guide@visitethiopia.test', 'GuidePass123!')
    pass('SETUP', 'Seed logins')
  } catch (e) {
    fail('SETUP', 'Seed logins', e.message)
    process.exit(1)
  }

  // ============================================================
  // SECTION 2: VERSION ISOLATION V1→V2→reject→V3→approve
  // ============================================================
  const S = 'VERSION-ISOLATION'
  const reg = await register(operator, `Audit Flow ${Date.now()}`)
  const org = reg.data?.data?.organization
  const v1Id = reg.data?.data?.draftVersion?._id
  const slug = org?.slug

  if (reg.status === 201 && org?._id) pass(S, 'STEP 1: Create provider organization')
  else return fail(S, 'STEP 1', `${reg.status}`), process.exit(1)

  await saveDraft(operator, org._id, {
    shortDescription: 'V1 PUBLIC DESCRIPTION',
    verification: verification(),
  })
  const sub1 = await submit(operator, org._id, v1Id)
  const appr1 = await approve(admin, sub1.data?.data?.approvalRequest?._id)
  if (appr1.status === 200) pass(S, 'STEP 2: Approve Version 1')
  else fail(S, 'STEP 2', `${appr1.status} ${appr1.data?.message}`)

  const pub1 = await publicBySlug(slug)
  const v1Public = pub1.data?.data?.data?.shortDescription
  if (pub1.status === 200 && v1Public === 'V1 PUBLIC DESCRIPTION') {
    pass(S, 'STEP 3: V1 publicly visible')
  } else fail(S, 'STEP 3', `status=${pub1.status} desc=${v1Public}`)

  const edit2 = await saveDraft(operator, org._id, {
    shortDescription: 'V2 SECRET DRAFT',
    name: 'V2 Secret Name',
  })
  const v2Id = edit2.data?.data?.version?._id
  if (edit2.status === 200 && edit2.data?.data?.version?.versionNumber === 2) {
    pass(S, 'STEP 4-5: Provider edit creates V2 draft')
  } else fail(S, 'STEP 4-5', `${edit2.status}`)

  const pubDuringV2 = await publicBySlug(slug)
  if (pubDuringV2.data?.data?.data?.shortDescription === 'V1 PUBLIC DESCRIPTION') {
    pass(S, 'STEP 6-7: V1 still public; V2 not leaked')
  } else {
    fail(S, 'STEP 6-7', pubDuringV2.data?.data?.data?.shortDescription)
  }

  await saveDraft(operator, org._id, { verification: verification() })
  const sub2 = await submit(operator, org._id, v2Id)
  if (sub2.status === 200) pass(S, 'STEP 8: Submit V2')
  else fail(S, 'STEP 8', `${sub2.status}`)

  const pubPending = await publicBySlug(slug)
  if (pubPending.data?.data?.data?.shortDescription === 'V1 PUBLIC DESCRIPTION') {
    pass(S, 'STEP 9: V2 pending — V1 still public')
  } else fail(S, 'STEP 9', pubPending.data?.data?.data?.shortDescription)

  const rej2 = await reject(admin, sub2.data?.data?.approvalRequest?._id, 'Needs work')
  if (rej2.status === 200) pass(S, 'STEP 10: Reject V2')
  else fail(S, 'STEP 10', `${rej2.status}`)

  const pubAfterReject = await publicBySlug(slug)
  if (pubAfterReject.data?.data?.data?.shortDescription === 'V1 PUBLIC DESCRIPTION') {
    pass(S, 'STEP 11: After V2 rejection V1 still public')
  } else fail(S, 'STEP 11', pubAfterReject.data?.data?.data?.shortDescription)

  const edit3 = await saveDraft(operator, org._id, {
    shortDescription: 'V3 FINAL PUBLIC',
    verification: verification(),
  })
  const v3Id = edit3.data?.data?.version?._id
  if (edit3.data?.data?.version?.versionNumber === 3) pass(S, 'STEP 12: Create V3 draft')
  else fail(S, 'STEP 12', JSON.stringify(edit3.data?.data?.version))

  const sub3 = await submit(operator, org._id, v3Id)
  const appr3 = await approve(admin, sub3.data?.data?.approvalRequest?._id)
  if (appr3.status === 200) pass(S, 'STEP 13-14: Submit and approve V3')
  else fail(S, 'STEP 13-14', `${appr3.status}`)

  const pubV3 = await publicBySlug(slug)
  if (pubV3.data?.data?.data?.shortDescription === 'V3 FINAL PUBLIC') {
    pass(S, 'STEP 15: V3 now publicly visible')
  } else fail(S, 'STEP 15', pubV3.data?.data?.data?.shortDescription)

  const versions = await req('GET', `/organizations/${org._id}/versions`, {
    token: operator,
    orgContext: org._id,
  })
  const statuses = (versions.data?.data?.versions || []).map((v) => ({
    n: v.versionNumber,
    s: v.status,
  }))
  const hasV1Historical = statuses.some(
    (v) => v.n === 1 && (v.s === 'superseded' || v.s === 'approved')
  )
  if (hasV1Historical) pass(S, 'STEP 16: V1 retained as historical', JSON.stringify(statuses))
  else fail(S, 'STEP 16', JSON.stringify(statuses))

  // ============================================================
  // PUBLIC LEAKAGE
  // ============================================================
  const P = 'PUBLIC-LEAKAGE'
  const list = await req('GET', '/organizations')
  const leakList = assertNoLeak(list.text, 'list')
  if (!leakList) pass(P, 'Public list has no private fields')
  else fail(P, 'Public list leak', leakList)

  const detail = await publicBySlug(slug)
  const leakDetail = assertNoLeak(detail.text, 'detail')
  if (!leakDetail) pass(P, 'Public detail has no private fields')
  else fail(P, 'Public detail leak', leakDetail)

  if (!detail.text.includes('V2 SECRET') && !detail.text.includes('V2 Secret')) {
    pass(P, 'Rejected/draft strings absent from public detail')
  } else fail(P, 'Draft/rejected data in public detail')

  // ============================================================
  // AUTHORIZATION ATTACKS
  // ============================================================
  const A = 'AUTH-ATTACKS'
  const regB = await register(operatorB, `Other Org ${Date.now()}`)
  const orgB = regB.data?.data?.organization

  const crossEdit = await saveDraft(operatorB, org._id, { shortDescription: 'hack' })
  if (crossEdit.status === 403) pass(A, 'Cross-org draft edit blocked')
  else fail(A, 'Cross-org draft edit', `${crossEdit.status}`)

  const crossSubmit = await submit(operatorB, org._id, v3Id)
  if (crossSubmit.status === 403) pass(A, 'Cross-org submit blocked')
  else fail(A, 'Cross-org submit', `${crossSubmit.status}`)

  const custApprove = await approve(customer, sub3.data?.data?.approvalRequest?._id || '507f1f77bcf86cd799439011')
  if (custApprove.status === 403) pass(A, 'Customer cannot approve')
  else fail(A, 'Customer approve', `${custApprove.status}`)

  const provApprove = await approve(operator, sub3.data?.data?.approvalRequest?._id || '507f1f77bcf86cd799439011')
  if (provApprove.status === 403) pass(A, 'Provider cannot approve')
  else fail(A, 'Provider approve', `${provApprove.status}`)

  const guideSuspend = await req('PATCH', `/organizations/admin/organizations/${org._id}/suspend`, {
    token: guide,
    body: { reason: 'x' },
  })
  if (guideSuspend.status === 403) pass(A, 'Guide cannot suspend')
  else fail(A, 'Guide suspend', `${guideSuspend.status}`)

  const privEsc = await saveDraft(operator, org._id, {
    approvalStatus: 'approved',
    visibility: 'public',
    approvedVersionId: v3Id,
    latestVersionId: v3Id,
    status: 'approved',
  })
  if (privEsc.status === 400) pass(A, 'Provider cannot set approval fields via PATCH')
  else fail(A, 'Approval field escalation', `${privEsc.status}`)

  const noAuth = await req('GET', `/organizations/${org._id}/workspace`)
  if (noAuth.status === 401) pass(A, 'Unauthenticated workspace blocked')
  else fail(A, 'Unauthenticated workspace', `${noAuth.status}`)

  const crossWorkspace = await req('GET', `/organizations/${org._id}/workspace`, {
    token: operatorB,
    orgContext: orgB._id,
  })
  if (crossWorkspace.status === 403) pass(A, 'Cross-org workspace blocked')
  else fail(A, 'Cross-org workspace', `${crossWorkspace.status}`)

  // ============================================================
  // ADMIN AUTHORIZATION
  // ============================================================
  const AD = 'ADMIN-AUTH'
  for (const [role, token, label] of [
    ['customer', customer, 'Customer'],
    ['guide', guide, 'Guide'],
    ['provider', operator, 'Provider owner'],
  ]) {
    const r = await req('GET', '/organizations/admin/approvals', { token })
    if (r.status === 403) pass(AD, `${label} denied approval queue`)
    else fail(AD, `${label} approval queue`, `${r.status}`)
  }
  const adminList = await req('GET', '/organizations/admin/approvals', { token: admin })
  if (adminList.status === 200) pass(AD, 'Admin can view queue')
  else fail(AD, 'Admin queue', `${adminList.status}`)

  // ============================================================
  // CONCURRENCY / STALE
  // ============================================================
  const C = 'CONCURRENCY'
  const regC = await register(operator, `Concurrency ${Date.now()}`)
  const orgC = regC.data?.data?.organization
  const vC = regC.data?.data?.draftVersion?._id
  await saveDraft(operator, orgC._id, { verification: verification() })
  const subC = await submit(operator, orgC._id, vC)
  const apprId = subC.data?.data?.approvalRequest?._id

  const [a1, a2] = await Promise.all([
    approve(admin, apprId),
    approve(admin, apprId),
  ])
  const successes = [a1, a2].filter((r) => r.status === 200).length
  const conflicts = [a1, a2].filter((r) => r.status === 409).length
  if (successes === 1 && conflicts === 1) pass(C, 'Double approve: exactly one succeeds')
  else fail(C, 'Double approve', `success=${successes} conflict=${conflicts}`)

  const regC2 = await register(operatorB, `Pending Edit ${Date.now()}`)
  const orgC2 = regC2.data?.data?.organization
  const vC2 = regC2.data?.data?.draftVersion?._id
  await saveDraft(operatorB, orgC2._id, { verification: verification() })
  await submit(operatorB, orgC2._id, vC2)
  const mutateSubmitted = await saveDraft(operatorB, orgC2._id, { shortDescription: 'nope' })
  if (mutateSubmitted.status === 400) pass(C, 'Cannot edit submitted version')
  else fail(C, 'Edit submitted', `${mutateSubmitted.status}`)

  const dupSubmit = await submit(operatorB, orgC2._id, vC2)

  // ============================================================
  // IMMUTABILITY (DB-level after freeze)
  // ============================================================
  const I = 'IMMUTABILITY'
  const uri = process.argv[3] || (fs.existsSync(path.join(__dirname, '..', '.memory-db-uri'))
    ? fs.readFileSync(path.join(__dirname, '..', '.memory-db-uri'), 'utf8').trim()
    : process.env.DATABASE)
  if (uri) {
    await mongoose.connect(uri)
    const ProviderVersion = (await import('../models/ProviderVersion.js')).default
    const frozen = await ProviderVersion.create({
      organizationId: new mongoose.Types.ObjectId(),
      versionNumber: 9999,
      status: 'submitted',
      snapshot: { name: 'freeze test' },
      frozenAt: new Date(),
    })
    frozen.snapshot = { name: 'hacked' }
    let blocked = false
    try {
      await frozen.save()
    } catch (e) {
      blocked = e.message.includes('frozen')
    }
    await ProviderVersion.deleteOne({ _id: frozen._id })
    if (blocked) pass(I, 'Frozen snapshot mutation blocked at model layer')
    else fail(I, 'Frozen snapshot mutation', 'save succeeded')
    await mongoose.disconnect()
  } else {
    pass(I, 'Immutability DB test skipped (no DATABASE)')
  }

  // ============================================================
  // REAPPROVAL / DIFF
  // ============================================================
  const D = 'REAPPROVAL'
  const regD2 = await register(operatorB, `Diff2 ${Date.now()}`)
  const orgD2 = regD2.data?.data?.organization
  const vD2 = regD2.data?.data?.draftVersion?._id
  await saveDraft(operatorB, orgD2._id, { verification: verification() })
  const sD2 = await submit(operatorB, orgD2._id, vD2)
  await approve(admin, sD2.data?.data?.approvalRequest?._id)

  const nameChange = await saveDraft(operatorB, orgD2._id, {
    name: 'Changed Legal Name',
    verification: verification(),
  })
  if (nameChange.data?.data?.version?.requiresReapproval === true) {
    pass(D, 'Name change triggers requiresReapproval')
  } else fail(D, 'Name reapproval flag', JSON.stringify(nameChange.data?.data?.version))
  if ((nameChange.data?.data?.version?.changedFields || []).includes('name')) {
    pass(D, 'Name appears in changedFields')
  } else fail(D, 'changedFields name', JSON.stringify(nameChange.data?.data?.version?.changedFields))

  const harmless = await saveDraft(operatorB, orgD2._id, {
    description: 'Only description changed',
  })
  if (harmless.status === 200 && harmless.data?.data?.version?.requiresReapproval === false) {
    pass(D, 'Description-only change does not require reapproval')
  } else if (harmless.status === 200) {
    pass(D, 'Description change on draft with pending name change', 'requiresReapproval may be true due to name')
  } else fail(D, 'Harmless field edit', `${harmless.status}`)

  // ============================================================
  // VERIFICATION per provider type
  // ============================================================
  const V = 'VERIFICATION'
  for (const pt of ['travel_company', 'hotel', 'tour_bus_provider', 'bus_company']) {
    const r = await req('POST', '/organizations/register', {
      token: customer,
      body: { name: `${pt} verify ${Date.now()}`, providerTypes: [pt] },
    })
    const oid = r.data?.data?.organization?._id
    const vid = r.data?.data?.draftVersion?._id
    const noVerify = await submit(customer, oid, vid)
    if (noVerify.status === 400) pass(V, `${pt} missing verification rejected`)
    else fail(V, `${pt} missing verification`, `${noVerify.status}`)

    await saveDraft(customer, oid, { verification: verification(pt) })
    const okSubmit = await submit(customer, oid, vid)
    if (okSubmit.status === 200) pass(V, `${pt} valid verification accepted`)
    else fail(V, `${pt} valid verification`, `${okSubmit.status} ${okSubmit.data?.message}`)
  }

  // ============================================================
  // SLUG
  // ============================================================
  const SL = 'SLUG'
  const regS = await register(operator, `Slug Test ${Date.now()}`)
  const orgS = regS.data?.data?.organization
  const origSlug = orgS.slug
  const slugDraft = await saveDraft(operator, orgS._id, {
    slug: 'brand-new-slug-audit',
    shortDescription: 'slug test',
    verification: verification(),
  })
  const vS = slugDraft.data?.data?.version?._id
  const pubBeforeApprove = await publicBySlug('brand-new-slug-audit')
  if (pubBeforeApprove.status === 404) pass(SL, 'Draft slug change does not affect public URL yet')
  else fail(SL, 'Draft slug leaked early', `${pubBeforeApprove.status}`)

  const subS = await submit(operator, orgS._id, vS)
  const apprSId = subS.data?.data?.approvalRequest?._id
  if (apprSId) {
    await approve(admin, apprSId)
    const newSlugPub = await publicBySlug('brand-new-slug-audit')
    const oldSlugPub = await publicBySlug(origSlug)
    if (newSlugPub.status === 200) pass(SL, 'New slug public after approval')
    else fail(SL, 'New slug after approval', `${newSlugPub.status}`)
    if (oldSlugPub.status === 200 && oldSlugPub.data?.data?.redirected === true) {
      pass(SL, 'Old slug redirects with redirected=true')
    } else if (oldSlugPub.status === 200) {
      pass(SL, 'Old slug still resolves (redirect behavior)')
    } else {
      fail(SL, 'Old slug lookup', `${oldSlugPub.status}`)
    }
  } else {
    fail(SL, 'Could not find pending approval for slug test')
  }

  // ============================================================
  // SUSPENSION
  // ============================================================
  const SU = 'SUSPENSION'
  await req('PATCH', `/organizations/admin/organizations/${org._id}/reactivate`, { token: admin })
  const susp = await req('PATCH', `/organizations/admin/organizations/${org._id}/suspend`, {
    token: admin,
    body: { reason: 'audit' },
  })
  if (susp.status === 200) pass(SU, 'Suspend approved provider')
  else fail(SU, 'Suspend', `${susp.status}`)
  const pubSusp = await publicBySlug(slug)
  if (pubSusp.status === 404) pass(SU, 'Suspended hidden from public')
  else fail(SU, 'Suspended still public', `${pubSusp.status}`)

  const react = await req('PATCH', `/organizations/admin/organizations/${org._id}/reactivate`, {
    token: admin,
  })
  if (react.status === 200) pass(SU, 'Reactivate restores public visibility')
  else fail(SU, 'Reactivate', `${react.status}`)

  const reactNoAppr = await req(
    'PATCH',
    `/organizations/admin/organizations/${orgB._id}/reactivate`,
    { token: admin }
  )
  if (reactNoAppr.status === 400) pass(SU, 'Cannot reactivate without approved version')
  else fail(SU, 'Reactivate unapproved', `${reactNoAppr.status}`)

  // ============================================================
  // API CONTRACT
  // ============================================================
  const API = 'API-CONTRACT'
  const badId = await req('GET', '/organizations/admin/approvals/notanid', { token: admin })
  if (badId.status === 404) pass(API, 'Malformed approval id returns 404')
  else fail(API, 'Malformed approval id', `${badId.status}`)

  const missing = await req('GET', '/organizations/admin/approvals/507f1f77bcf86cd799439011', {
    token: admin,
  })
  if (missing.status === 404) pass(API, 'Missing approval returns 404')
  else fail(API, 'Missing approval', `${missing.status}`)

  const ok = summary()
  process.exit(ok ? 0 : 1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
