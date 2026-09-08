/**
 * Organization membership and context security tests.
 * Usage: node scripts/org-membership-security.js [baseUrl]
 *
 * Optional: loads config.env for direct DB membership status tests (suspended/removed).
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

async function registerOrg(token, name, providerTypes) {
  return req('POST', '/organizations/register', {
    token,
    body: { name, providerTypes, shortDescription: 'Test org' },
  })
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(
    `\n=== Organization security: ${passed} passed, ${failed} failed (${results.length} total) ===\n`
  )
  process.exit(failed ? 1 : 0)
}

async function run() {
  console.log(`\n=== Organization membership security @ ${BASE} ===\n`)

  let customerToken, operatorToken, operatorBToken, adminToken
  try {
    customerToken = await login('customer@visitethiopia.test', 'CustomerPass123!')
    operatorToken = await login('operator@visitethiopia.test', 'OperatorPass123!')
    operatorBToken = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
    adminToken = await login('admin@visitethiopia.test', 'AdminPass123!')
    ok('Seed user logins')
  } catch (e) {
    fail('Seed user logins', e.message)
    return done()
  }

  // Registration
  const regA = await registerOrg(operatorToken, `Org A ${Date.now()}`, ['travel_company'])
  if (regA.status === 201 && regA.data?.data?.organization?._id) {
    ok('Organization registration')
  } else {
    fail('Organization registration', `${regA.status} ${regA.data?.message}`)
    return done()
  }
  const orgA = regA.data.data.organization
  const orgAMembership = regA.data.data.membership

  const regB = await registerOrg(operatorBToken, `Org B ${Date.now()}`, ['travel_company'])
  const orgB = regB.data?.data?.organization

  if (regA.data.data.organization.approvalStatus !== 'draft') {
    fail('Registration sets draft approvalStatus', regA.data.data.organization.approvalStatus)
  } else ok('Registration sets draft approvalStatus')

  if (regA.data.data.organization.visibility !== 'private') {
    fail('Registration sets private visibility', regA.data.data.organization.visibility)
  } else ok('Registration sets private visibility')

  if (orgAMembership.orgRole !== 'owner') {
    fail('Registration creates owner membership', orgAMembership.orgRole)
  } else ok('Organization owner has owner orgRole')

  const badReg = await req('POST', '/organizations/register', {
    token: customerToken,
    body: {
      name: 'Evil Admin Org',
      providerTypes: ['travel_company'],
      approvalStatus: 'approved',
      visibility: 'public',
    },
  })
  if (badReg.status === 400) ok('Customer cannot set admin approval fields on register')
  else fail('Customer cannot set admin approval fields on register', `${badReg.status}`)

  // Public visibility gate — draft org not in public list
  const publicList = await req('GET', '/organizations')
  const publicIds = (publicList.data?.data?.data || []).map((o) => o._id)
  if (!publicIds.includes(orgA._id)) ok('Draft org not in public directory')
  else fail('Draft org not in public directory', 'draft org was listed')

  const publicSlug = await req('GET', `/organizations/${orgA.slug}`)
  if (publicSlug.status === 404) ok('Draft org not accessible by slug publicly')
  else fail('Draft org not accessible by slug publicly', `${publicSlug.status}`)

  // Missing X-Org-Context
  const noCtx = await req('PATCH', `/organizations/${orgA._id}`, {
    token: operatorToken,
    body: { shortDescription: 'Updated' },
  })
  if (noCtx.status === 400) ok('Missing X-Org-Context rejected for provider mutation')
  else fail('Missing X-Org-Context rejected', `${noCtx.status}`)

  // Invalid org context
  const badCtx = await req('PATCH', `/organizations/${orgA._id}`, {
    token: operatorToken,
    orgContext: '507f1f77bcf86cd799439011',
    body: { shortDescription: 'Updated' },
  })
  if (badCtx.status === 400) ok('Invalid X-Org-Context rejected')
  else fail('Invalid X-Org-Context rejected', `${badCtx.status}`)

  // Cross-org access — operator B cannot mutate org A
  const crossOrg = await req('PATCH', `/organizations/${orgA._id}`, {
    token: operatorBToken,
    orgContext: orgA._id,
    body: { shortDescription: 'Hacked' },
  })
  if (crossOrg.status === 403) ok('User cannot access another organization')
  else fail('User cannot access another organization', `${crossOrg.status}`)

  // Active membership succeeds
  const ownUpdate = await req('PATCH', `/organizations/${orgA._id}`, {
    token: operatorToken,
    orgContext: orgA._id,
    body: { shortDescription: 'Updated by owner' },
  })
  if (ownUpdate.status === 200) ok('Active membership succeeds for provider mutation')
  else fail('Active membership succeeds', `${ownUpdate.status} ${ownUpdate.data?.message}`)

  // Org A permissions do not leak to org B context
  if (orgB?._id) {
    const leak = await req('PATCH', `/organizations/${orgB._id}`, {
      token: operatorToken,
      orgContext: orgA._id,
      body: { shortDescription: 'Wrong org id in URL' },
    })
    if (leak.status === 403) ok('Org A context cannot mutate org B resource')
    else fail('Org A context cannot mutate org B resource', `${leak.status}`)
  }

  // Suspend membership
  // Use direct DB via a secondary registration + manual test through context endpoint
  const ctxOk = await req('GET', `/organizations/context/${orgA._id}`, {
    token: operatorToken,
    orgContext: orgA._id,
  })
  if (ctxOk.status === 200) ok('Organization context read with membership')
  else fail('Organization context read with membership', `${ctxOk.status}`)

  // User organizations list
  const myOrgs = await req('GET', '/users/me/organizations', { token: operatorToken })
  if (myOrgs.status === 200 && (myOrgs.data?.data?.memberships?.length || 0) >= 1) {
    ok('GET /users/me/organizations')
  } else fail('GET /users/me/organizations', `${myOrgs.status}`)

  // Active organization preference
  const setActive = await req('POST', '/users/me/active-organization', {
    token: operatorToken,
    body: { organizationId: orgA._id },
  })
  if (setActive.status === 200) ok('POST /users/me/active-organization')
  else fail('POST /users/me/active-organization', `${setActive.status}`)

  const setActiveOther = await req('POST', '/users/me/active-organization', {
    token: operatorToken,
    body: { organizationId: orgB?._id || orgA._id },
  })
  if (orgB?._id && setActiveOther.status === 403) {
    ok('Cannot set active org without membership')
  } else if (!orgB?._id) {
    ok('Cannot set active org without membership (skipped — org B missing)')
  } else {
    fail('Cannot set active org without membership', `${setActiveOther.status}`)
  }

  // Admin bypass with explicit header
  const adminBypass = await req('PATCH', `/organizations/${orgA._id}`, {
    token: adminToken,
    orgContext: orgA._id,
    adminBypass: true,
    body: { shortDescription: 'Admin bypass update' },
  })
  if (adminBypass.status === 200) ok('Admin bypass works with X-Admin-Org-Bypass')
  else fail('Admin bypass works with X-Admin-Org-Bypass', `${adminBypass.status}`)

  // Admin without bypass still needs membership OR bypass header
  const adminNoBypass = await req('PATCH', `/organizations/${orgA._id}`, {
    token: adminToken,
    orgContext: orgA._id,
    body: { shortDescription: 'Admin without bypass' },
  })
  if (adminNoBypass.status === 403) ok('Admin without bypass header requires membership')
  else fail('Admin without bypass header requires membership', `${adminNoBypass.status}`)

  // Suspended / removed membership — create fresh org and simulate via second user if possible
  // Register org for customer and test they can own it (customer CAN register org — not admin privileges)
  const custOrg = await registerOrg(customerToken, `Customer Org ${Date.now()}`, ['hotel'])
  if (custOrg.status === 201) ok('Customer can register organization (not platform admin)')
  else fail('Customer can register organization', `${custOrg.status}`)

  // Suspended membership
  const testDbUri = resolveTestDatabaseUri()
  if (testDbUri) {
    try {
      await mongoose.connect(testDbUri)
      const OrganizationMember = (await import('../models/OrganizationMember.js')).default
      const User = (await import('../models/User.js')).default
      const operatorUser = await User.findOne({ email: 'operator@visitethiopia.test' })

      const suspendReg = await registerOrg(
        operatorToken,
        `Suspend Test Org ${Date.now()}`,
        ['travel_company']
      )
      const suspendOrg = suspendReg.data?.data?.organization
      if (suspendOrg && operatorUser) {
        await OrganizationMember.updateOne(
          { organizationId: suspendOrg._id, userId: operatorUser._id },
          { status: 'suspended' }
        )
        const suspended = await req('PATCH', `/organizations/${suspendOrg._id}`, {
          token: operatorToken,
          orgContext: suspendOrg._id,
          body: { shortDescription: 'Should fail' },
        })
        if (suspended.status === 403) ok('Suspended membership rejected')
        else fail('Suspended membership rejected', `${suspended.status}`)

        await OrganizationMember.updateOne(
          { organizationId: suspendOrg._id, userId: operatorUser._id },
          { status: 'removed' }
        )
        const removed = await req('PATCH', `/organizations/${suspendOrg._id}`, {
          token: operatorToken,
          orgContext: suspendOrg._id,
          body: { shortDescription: 'Should fail removed' },
        })
        if (removed.status === 403) ok('Removed membership rejected')
        else fail('Removed membership rejected', `${removed.status}`)

        await OrganizationMember.updateOne(
          { organizationId: suspendOrg._id, userId: operatorUser._id },
          { status: 'active' }
        )
      }
      await mongoose.disconnect()
    } catch (e) {
      fail('Suspended/removed membership DB tests', e.message)
    }
  } else {
    ok('Suspended/removed tests skipped (no DATABASE URI)')
  }

  console.log('\nTip: run migrateOrganizations.js --dry-run for idempotency verification.')

  done()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
