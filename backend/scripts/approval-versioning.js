/**
 * Phase 2 — Provider versioning & approval tests.
 * Usage: node scripts/approval-versioning.js [baseUrl]
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
    legalName: 'Test Travel PLC',
    registrationNumber: 'REG-12345',
    responsiblePerson: {
      name: 'Jane Operator',
      phone: '+251911000000',
      email: 'operator@visitethiopia.test',
    },
    businessDocuments: [
      {
        type: 'business_license',
        url: 'https://example.com/license.pdf',
        status: 'pending',
      },
    ],
  }
}

async function registerProvider(token, name, providerTypes = ['travel_company']) {
  return req('POST', '/organizations/register', {
    token,
    body: {
      name,
      providerTypes,
      shortDescription: 'Test provider',
      verification: validVerification(),
    },
  })
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n=== Phase 2 approval/versioning: ${passed} passed, ${failed} failed (${results.length} total) ===\n`
  )
  process.exit(failed ? 1 : 0)
}

async function run() {
  console.log(`\n=== Phase 2 approval/versioning @ ${BASE} ===\n`)

  let operatorToken, operatorBToken, adminToken, customerToken
  try {
    operatorToken = await login('operator@visitethiopia.test', 'OperatorPass123!')
    operatorBToken = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
    adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
    customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
    ok('Seed user logins')
  } catch (e) {
    fail('Seed user logins', e.message)
    return done()
  }

  const reg = await registerProvider(operatorToken, `Phase2 Org ${Date.now()}`)
  if (reg.status !== 201) {
    fail('Provider registration creates organization', `${reg.status} ${reg.data?.message}`)
    return done()
  }
  ok('Provider registration creates organization')

  const org = reg.data.data.organization
  const draftVersion = reg.data.data.draftVersion

  if (org.approvalStatus === 'draft' && org.visibility === 'private') {
    ok('Organization starts private/unapproved')
  } else fail('Organization starts private/unapproved', `${org.approvalStatus}/${org.visibility}`)

  if (draftVersion?.status === 'draft' && draftVersion.versionNumber === 1) {
    ok('Initial draft version created')
  } else fail('Initial draft version created', JSON.stringify(draftVersion))

  const badType = await req('POST', '/organizations/register', {
    token: operatorToken,
    body: { name: 'Bad Type', providerTypes: ['invalid_type'] },
  })
  if (badType.status === 400) ok('Provider type validation')
  else fail('Provider type validation', `${badType.status}`)

  const crossEdit = await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operatorBToken,
    orgContext: org._id,
    body: { shortDescription: 'Hacked' },
  })
  if (crossEdit.status === 403) ok('Only organization members can edit')
  else fail('Only organization members can edit', `${crossEdit.status}`)

  const draftUpdate = await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operatorToken,
    orgContext: org._id,
    body: {
      shortDescription: 'Draft description v1',
      verification: validVerification(),
    },
  })
  if (draftUpdate.status === 200) ok('Provider can update draft')
  else fail('Provider can update draft', `${draftUpdate.status} ${draftUpdate.data?.message}`)

  const versionId = draftUpdate.data?.data?.version?._id || draftVersion._id

  const submit = await req(
    'POST',
    `/organizations/${org._id}/versions/${versionId}/submit`,
    { token: operatorToken, orgContext: org._id }
  )
  if (submit.status === 200) ok('Submit creates approval flow')
  else fail('Submit creates approval flow', `${submit.status} ${submit.data?.message}`)

  const approvalId = submit.data?.data?.approvalRequest?._id

  const duplicateSubmit = await req(
    'POST',
    `/organizations/${org._id}/versions/${versionId}/submit`,
    { token: operatorToken, orgContext: org._id }
  )
  if (duplicateSubmit.status === 400) ok('Duplicate active requests prevented')
  else fail('Duplicate active requests prevented', `${duplicateSubmit.status}`)

  const mutateSubmitted = await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operatorToken,
    orgContext: org._id,
    body: { shortDescription: 'Should not edit submitted' },
  })
  if (mutateSubmitted.status === 400) ok('Submitted snapshot cannot be modified by provider')
  else fail('Submitted snapshot cannot be modified', `${mutateSubmitted.status}`)

  const publicList = await req('GET', '/organizations')
  const listed = (publicList.data?.data?.data || []).find((o) => o._id === org._id)
  if (!listed) ok('Unapproved organization not in public list')
  else fail('Unapproved organization not in public list', 'was listed')

  const publicSlug = await req('GET', `/organizations/${org.slug}`)
  if (publicSlug.status === 404) ok('Unapproved organization not accessible by slug')
  else fail('Unapproved organization not accessible by slug', `${publicSlug.status}`)

  const providerApprove = await req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: operatorToken,
    body: {},
  })
  if (providerApprove.status === 403) ok('Provider cannot approve itself')
  else fail('Provider cannot approve itself', `${providerApprove.status}`)

  const adminList = await req('GET', '/organizations/admin/approvals?status=pending', {
    token: adminToken,
  })
  const pendingIds = (adminList.data?.data?.data || []).map((r) => r._id)
  if (adminList.status === 200 && pendingIds.includes(approvalId)) {
    ok('Admin can list pending requests')
  } else fail('Admin can list pending requests', `${adminList.status}`)

  const detail = await req('GET', `/organizations/admin/approvals/${approvalId}`, {
    token: adminToken,
  })
  if (
    detail.status === 200 &&
    detail.data?.data?.submittedVersion?.snapshot?.shortDescription === 'Draft description v1'
  ) {
    ok('Admin can inspect exact submitted snapshot')
  } else {
    fail('Admin can inspect exact submitted snapshot', `${detail.status}`)
  }

  if (detail.data?.data?.currentApprovedVersion == null) {
    ok('Initial approval has no previous approved version')
  } else fail('Initial approval has no previous approved version')

  const approve = await req('PATCH', `/organizations/admin/approvals/${approvalId}/approve`, {
    token: adminToken,
    body: { adminNotes: 'Looks good' },
  })
  if (approve.status === 200) ok('Admin approval promotes exact version')
  else fail('Admin approval promotes exact version', `${approve.status} ${approve.data?.message}`)

  const publicAfter = await req('GET', `/organizations/${org.slug}`)
  if (
    publicAfter.status === 200 &&
    publicAfter.data?.data?.data?.shortDescription === 'Draft description v1'
  ) {
    ok('Public API exposes approved version only')
  } else {
    fail('Public API exposes approved version only', `${publicAfter.status}`)
  }

  const workspace = await req('GET', `/organizations/${org._id}/workspace`, {
    token: operatorToken,
    orgContext: org._id,
  })
  const approvedSnap = workspace.data?.data?.approvedVersion?.snapshot?.shortDescription
  if (workspace.status === 200 && approvedSnap === 'Draft description v1') {
    ok('Approved version snapshot retained after approval')
  } else fail('Approved version snapshot retained', `${workspace.status}`)

  const editApproved = await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operatorToken,
    orgContext: org._id,
    body: { shortDescription: 'Draft v2 secret change' },
  })
  if (editApproved.status === 200) ok('Editing approved provider creates new draft')
  else fail('Editing approved provider creates new draft', `${editApproved.status}`)

  const v2Id = editApproved.data?.data?.version?._id

  const publicDuringDraft = await req('GET', `/organizations/${org.slug}`)
  if (publicDuringDraft.data?.data?.data?.shortDescription === 'Draft description v1') {
    ok('Approved version remains public while draft exists')
  } else fail('Approved version remains public while draft exists')

  if (publicDuringDraft.data?.data?.data?.shortDescription !== 'Draft v2 secret change') {
    ok('Draft fields never leak publicly')
  } else fail('Draft fields never leak publicly')

  await req('PATCH', `/organizations/${org._id}/draft`, {
    token: operatorToken,
    orgContext: org._id,
    body: { verification: validVerification() },
  })

  const submitV2 = await req(
    'POST',
    `/organizations/${org._id}/versions/${v2Id}/submit`,
    { token: operatorToken, orgContext: org._id }
  )
  const approvalV2 = submitV2.data?.data?.approvalRequest?._id

  const publicWhileV2Pending = await req('GET', `/organizations/${org.slug}`)
  if (
    publicWhileV2Pending.status === 200 &&
    publicWhileV2Pending.data?.data?.data?.shortDescription === 'Draft description v1'
  ) {
    ok('Approved version remains public while V2 pending review')
  } else {
    fail(
      'Approved version remains public while V2 pending review',
      `${publicWhileV2Pending.status} ${publicWhileV2Pending.data?.data?.data?.shortDescription}`
    )
  }

  const detailV2 = await req('GET', `/organizations/admin/approvals/${approvalV2}`, {
    token: adminToken,
  })
  if (
    detailV2.status === 200 &&
    detailV2.data?.data?.currentApprovedVersion?.snapshot?.shortDescription ===
      'Draft description v1' &&
    detailV2.data?.data?.submittedVersion?.snapshot?.shortDescription ===
      'Draft v2 secret change'
  ) {
    ok('Admin can compare approved vs submitted')
  } else fail('Admin can compare approved vs submitted')

  if (detailV2.data?.data?.diff?.changedFields?.includes('shortDescription')) {
    ok('Changed fields/diff available to admin')
  } else fail('Changed fields/diff available to admin')

  const rejectV2 = await req('PATCH', `/organizations/admin/approvals/${approvalV2}/reject`, {
    token: adminToken,
    body: {},
  })
  if (rejectV2.status === 400) ok('Rejection requires reason')
  else fail('Rejection requires reason', `${rejectV2.status}`)

  const rejectV2Ok = await req('PATCH', `/organizations/admin/approvals/${approvalV2}/reject`, {
    token: adminToken,
    body: { rejectionReason: 'Needs more detail' },
  })
  if (rejectV2Ok.status === 200) ok('Admin rejection records reason')
  else fail('Admin rejection records reason', `${rejectV2Ok.status}`)

  const publicAfterReject = await req('GET', `/organizations/${org.slug}`)
  if (publicAfterReject.data?.data?.data?.shortDescription === 'Draft description v1') {
    ok('Rejection does not destroy approved version')
  } else fail('Rejection does not destroy approved version')

  const doubleApprove = await req('PATCH', `/organizations/admin/approvals/${approvalV2}/approve`, {
    token: adminToken,
    body: {},
  })
  if (doubleApprove.status === 409) ok('Stale/double approval rejected')
  else fail('Stale/double approval rejected', `${doubleApprove.status}`)

  const versions = await req('GET', `/organizations/${org._id}/versions`, {
    token: operatorToken,
    orgContext: org._id,
  })
  const versionStatuses = (versions.data?.data?.versions || []).map((v) => v.status)
  if (versionStatuses.includes('approved') && versionStatuses.includes('rejected')) {
    ok('Historical versions remain available to authorized users')
  } else fail('Historical versions remain', JSON.stringify(versionStatuses))

  const missingVerification = await req('POST', '/organizations/register', {
    token: operatorBToken,
    body: {
      name: `NoVerify ${Date.now()}`,
      providerTypes: ['travel_company'],
      shortDescription: 'No verification',
    },
  })
  const orgB = missingVerification.data?.data?.organization
  const vB = missingVerification.data?.data?.draftVersion?._id
  const submitNoVerify = await req(
    'POST',
    `/organizations/${orgB._id}/versions/${vB}/submit`,
    { token: operatorBToken, orgContext: orgB._id }
  )
  if (submitNoVerify.status === 400) ok('Required verification fields enforced on submit')
  else fail('Required verification fields enforced', `${submitNoVerify.status}`)

  const hotelReg = await registerProvider(operatorBToken, `Hotel ${Date.now()}`, ['hotel'])
  const hotelOrg = hotelReg.data?.data?.organization
  const hotelV = hotelReg.data?.data?.draftVersion?._id
  await req('PATCH', `/organizations/${hotelOrg._id}/draft`, {
    token: operatorBToken,
    orgContext: hotelOrg._id,
    body: {
      verification: {
        ...validVerification(),
        licenseNumber: 'HOTEL-99',
        businessDocuments: [
          { type: 'hotel_registration', url: 'https://example.com/hotel.pdf' },
        ],
      },
    },
  })
  const hotelSubmit = await req(
    'POST',
    `/organizations/${hotelOrg._id}/versions/${hotelV}/submit`,
    { token: operatorBToken, orgContext: hotelOrg._id }
  )
  if (hotelSubmit.status === 200) ok('Provider-type-specific requirements enforced when satisfied')
  else fail('Provider-type-specific requirements', `${hotelSubmit.status} ${hotelSubmit.data?.message}`)

  const publicHotel = await req('GET', `/organizations/${hotelOrg.slug}`)
  if (publicHotel.status === 404) ok('Submitted-only org not public before approval')
  else fail('Submitted-only org not public before approval', `${publicHotel.status}`)

  if (!JSON.stringify(publicAfter.data || {}).includes('businessDocuments')) {
    ok('Verification documents not publicly exposed')
  } else fail('Verification documents not publicly exposed')

  const suspend = await req('PATCH', `/organizations/admin/organizations/${org._id}/suspend`, {
    token: adminToken,
    body: { reason: 'Policy review' },
  })
  if (suspend.status === 200) ok('Admin can suspend organization')
  else fail('Admin can suspend organization', `${suspend.status}`)

  const publicSuspended = await req('GET', `/organizations/${org.slug}`)
  if (publicSuspended.status === 404) ok('Suspended organizations do not appear publicly')
  else fail('Suspended organizations do not appear publicly', `${publicSuspended.status}`)

  const reactivate = await req(
    'PATCH',
    `/organizations/admin/organizations/${org._id}/reactivate`,
    { token: adminToken }
  )
  if (reactivate.status === 200) ok('Admin can reactivate organization')
  else fail('Admin can reactivate organization', `${reactivate.status}`)

  const normalUserApprove = await req('GET', '/organizations/admin/approvals', {
    token: customerToken,
  })
  if (normalUserApprove.status === 403) ok('Normal users cannot access admin approval queue')
  else fail('Normal users cannot access admin approval queue', `${normalUserApprove.status}`)

  done()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
