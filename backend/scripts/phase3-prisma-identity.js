/**
 * Phase 3 — Prisma identity layer tests (LOCAL Docker PostgreSQL only).
 *
 * Does NOT touch Mongo Atlas / Supabase / Render.
 *
 * Usage:
 *   cd backend
 *   # Docker Postgres up; DATABASE_URL + DIRECT_URL set
 *   node scripts/phase3-prisma-identity.js
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env') })
}

process.env.DATABASE_MODE = 'prisma'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase3-local-test-secret'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

function assertPg(url, name) {
  if (!url) throw new Error(`${name} required`)
  if (/^mongodb/i.test(url)) throw new Error(`${name} must be PostgreSQL`)
}

assertPg(process.env.DATABASE_URL, 'DATABASE_URL')
assertPg(process.env.DIRECT_URL || process.env.DATABASE_URL, 'DIRECT_URL')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const {
  hashPassword,
  comparePassword,
  createPasswordResetTokenPair,
  hashResetToken,
} = await import('../services/passwordService.js')
const users = await import('../repositories/users/prismaUserRepository.js')
const orgs = await import(
  '../repositories/organizations/prismaOrganizationRepository.js'
)
const {
  submitVersionForApprovalPrisma,
  approveRequestPrisma,
  rejectRequestPrisma,
  loadPublicOrganizationBySlugPrisma,
} = await import('../services/prismaIdentityApprovalService.js')
const prisma = (await import('../config/prisma.js')).default
const { generateObjectId } = await import('../utils/objectId.js')

const RUN = generateObjectId().slice(0, 8)
const email = `phase3.${RUN}@visitethiopia.test`

const verification = {
  legalName: `Phase3 Org ${RUN} PLC`,
  registrationNumber: `P3-${RUN}`,
  responsiblePerson: {
    name: 'Phase3 Owner',
    phone: '+251911111111',
    email,
  },
  businessDocuments: [
    {
      type: 'business_license',
      url: 'https://example.com/phase3-license.pdf',
      status: 'uploaded',
    },
  ],
}

async function cleanup(ids) {
  for (const id of ids.approvalIds || []) {
    await prisma.approvalRequest.deleteMany({ where: { id } }).catch(() => {})
  }
  for (const id of ids.versionIds || []) {
    await prisma.providerVersion.deleteMany({ where: { id } }).catch(() => {})
  }
  if (ids.orgId) {
    await prisma.organizationMember.deleteMany({
      where: { organizationId: ids.orgId },
    })
    await prisma.userOrganizationPreference.deleteMany({
      where: { activeOrganizationId: ids.orgId },
    })
    await prisma.organizationPreviousSlug.deleteMany({
      where: { organizationId: ids.orgId },
    })
    await prisma.organization.deleteMany({ where: { id: ids.orgId } })
  }
  for (const id of ids.userIds || []) {
    await prisma.userFavorite.deleteMany({ where: { userId: id } })
    await prisma.userOrganizationPreference.deleteMany({ where: { userId: id } })
    await prisma.organizationMember.deleteMany({ where: { userId: id } })
    await prisma.user.deleteMany({ where: { id } })
  }
}

const track = { userIds: [], orgId: null, versionIds: [], approvalIds: [] }

try {
  // Password service
  const hashed = await hashPassword('ValidPass123!')
  check('password hash + compare', await comparePassword('ValidPass123!', hashed))
  check(
    'password reject wrong',
    !(await comparePassword('wrong', hashed))
  )

  // Signup
  const created = await users.createUser({
    FirstName: 'Phase',
    LastName: 'Three',
    email,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(created._id)
  check('signup create user', Boolean(created?._id && created.email === email))
  check('signup forces role user', created.role === 'user')
  check('signup unverified by default', created.isVerified === false)
  check('api shape _id', typeof created._id === 'string' && created._id.length === 24)

  let dupOk = false
  try {
    await users.createUser({
      FirstName: 'Dup',
      LastName: 'User',
      email,
      password: 'ValidPass123!',
      passwordConfirm: 'ValidPass123!',
    })
  } catch {
    dupOk = true
  }
  check('duplicate email rejected', dupOk)

  // Unverified login semantics
  const unverified = await users.findByEmailForLogin(email)
  check(
    'unverified user loadable for login check',
    unverified && unverified.isVerified === false
  )

  await users.setVerified(created._id, true)
  const loginUser = await users.findByEmailForLogin(email)
  check(
    'login success password',
    await loginUser.correctPassword('ValidPass123!', loginUser.password)
  )
  check(
    'login wrong password',
    !(await loginUser.correctPassword('nope', loginUser.password))
  )

  // Soft delete / inactive
  await users.softDelete(created._id)
  const inactive = await users.findByEmailForLogin(email)
  check('inactive user excluded from login finder', inactive === null)
  const byId = await users.findById(created._id)
  check('inactive user excluded from findById (protect)', byId === null)

  // Fresh verified user for org flow
  const email2 = `phase3.org.${RUN}@visitethiopia.test`
  const owner = await users.createUser({
    FirstName: 'Org',
    LastName: 'Owner',
    email: email2,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(owner._id)
  await users.setVerified(owner._id, true)

  const adminEmail = `phase3.admin.${RUN}@visitethiopia.test`
  const admin = await users.createUser({
    FirstName: 'Org',
    LastName: 'Admin',
    email: adminEmail,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(admin._id)
  await users.setVerified(admin._id, true)
  await users.updateRole(admin._id, 'admin')

  // Password reset
  const pair = createPasswordResetTokenPair()
  await users.setPasswordResetToken(
    owner._id,
    pair.passwordResetToken,
    pair.passwordResetExpires
  )
  const byToken = await users.findByResetToken(hashResetToken(pair.resetToken))
  check('password reset token lookup', byToken?._id === owner._id)
  await users.updatePassword(owner._id, 'NewPass1234!', 'NewPass1234!')
  const afterReset = await users.findByEmailForLogin(email2)
  check(
    'password update works',
    await afterReset.correctPassword('NewPass1234!', afterReset.password)
  )

  // JWT payload shape
  const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  })
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  check('jwt payload { id }', decoded.id === owner._id)

  // Organization register (transaction)
  const registered = await orgs.registerOrganization({
    name: `Phase3 Travel ${RUN}`,
    legalName: verification.legalName,
    providerTypes: ['travel_company'],
    description: 'Phase 3 test org',
    shortDescription: 'test',
    verification,
    ownerUserId: owner._id,
  })
  track.orgId = registered.organization._id
  track.versionIds.push(registered.draftVersion._id)
  check('org create', Boolean(registered.organization._id))
  check('org owner membership', registered.membership.orgRole === 'owner')
  check('org draft version', registered.draftVersion.status === 'draft')
  check(
    'org private unapproved',
    registered.organization.visibility === 'private' &&
      registered.organization.approvalStatus === 'draft'
  )

  await orgs.upsertActiveOrganization(owner._id, registered.organization._id)
  const pref = await orgs.findPreference(owner._id)
  check(
    'org preference / context',
    String(pref.activeOrganizationId) === String(registered.organization._id)
  )

  const member = await orgs.findMember(registered.organization._id, owner._id)
  check('member lookup', member?.status === 'active')

  // Public must not see draft
  const publicBefore = await loadPublicOrganizationBySlugPrisma(
    registered.organization.slug
  )
  check('public cannot see draft org', publicBefore === null)

  // Submit → approve
  const submitted = await submitVersionForApprovalPrisma({
    organization: registered.organization,
    versionId: registered.draftVersion._id,
    submittedBy: owner._id,
  })
  track.approvalIds.push(submitted.approvalRequest._id)
  check('approval request pending', submitted.approvalRequest.status === 'pending')
  check('version submitted', submitted.version.status === 'submitted')

  const stillHidden = await loadPublicOrganizationBySlugPrisma(
    registered.organization.slug
  )
  check('public cannot see pending org', stillHidden === null)

  const approved = await approveRequestPrisma({
    approvalRequestId: submitted.approvalRequest._id,
    adminUserId: admin._id,
    adminNotes: 'ok',
  })
  check('approval approved', approved.approvalRequest.status === 'approved')
  check(
    'org public after approve',
    approved.organization.visibility === 'public' &&
      approved.organization.approvalStatus === 'approved'
  )

  const publicAfter = await loadPublicOrganizationBySlugPrisma(
    approved.organization.slug
  )
  check('public can see approved org', Boolean(publicAfter?.organization))

  // Reject path on a second org
  const email3 = `phase3.reject.${RUN}@visitethiopia.test`
  const owner2 = await users.createUser({
    FirstName: 'Reject',
    LastName: 'Owner',
    email: email3,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(owner2._id)
  await users.setVerified(owner2._id, true)

  const reg2 = await orgs.registerOrganization({
    name: `Phase3 Reject ${RUN}`,
    legalName: `Reject ${RUN} PLC`,
    providerTypes: ['travel_company'],
    verification: {
      ...verification,
      legalName: `Reject ${RUN} PLC`,
      registrationNumber: `P3R-${RUN}`,
    },
    ownerUserId: owner2._id,
  })
  const ids2 = {
    orgId: reg2.organization._id,
    versionIds: [reg2.draftVersion._id],
    approvalIds: [],
    userIds: [],
  }
  const sub2 = await submitVersionForApprovalPrisma({
    organization: reg2.organization,
    versionId: reg2.draftVersion._id,
    submittedBy: owner2._id,
  })
  ids2.approvalIds.push(sub2.approvalRequest._id)
  const rejected = await rejectRequestPrisma({
    approvalRequestId: sub2.approvalRequest._id,
    adminUserId: admin._id,
    rejectionReason: 'Incomplete documents',
  })
  check('reject status', rejected.approvalRequest.status === 'rejected')
  check(
    'rejected stays private',
    rejected.organization.visibility === 'private' &&
      rejected.organization.approvalStatus === 'rejected'
  )
  const publicRejected = await loadPublicOrganizationBySlugPrisma(
    reg2.organization.slug
  )
  check('public cannot see rejected org', publicRejected === null)

  await cleanup(ids2)
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  await cleanup(track)
  await prisma.$disconnect()
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Phase 3 Prisma identity: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
