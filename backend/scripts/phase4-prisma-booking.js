/**
 * Phase 4 — Prisma booking/departure/inventory/payment focused tests
 * (LOCAL Docker PostgreSQL only).
 *
 * Usage: cd backend && node scripts/phase4-prisma-booking.js
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env') })
}

process.env.DATABASE_MODE = 'prisma'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase4-local-test-secret'
process.env.NODE_ENV = process.env.NODE_ENV || 'development'
process.env.MOCK_WEBHOOK_SECRET =
  process.env.MOCK_WEBHOOK_SECRET || 'mock-webhook-dev-secret'

function assertPg(url, name) {
  if (!url) throw new Error(`${name} required`)
  if (/^mongodb/i.test(url)) throw new Error(`${name} must be PostgreSQL`)
}
assertPg(process.env.DATABASE_URL, 'DATABASE_URL')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const { generateObjectId } = await import('../utils/objectId.js')
const prisma = (await import('../config/prisma.js')).default
const users = await import('../repositories/users/prismaUserRepository.js')
const orgs = await import(
  '../repositories/organizations/prismaOrganizationRepository.js'
)
const depInv = await import(
  '../repositories/booking/prismaDepartureInventoryRepository.js'
)
const {
  createTourBookingPrisma,
  finalizeSuccessfulPaymentPrisma,
  handlePaymentFailurePrisma,
  releaseForBookingPrisma,
  restoreConsumedForBookingPrisma,
} = await import('../services/prismaBookingDomainService.js')
const {
  submitVersionForApprovalPrisma,
  approveRequestPrisma,
} = await import('../services/prismaIdentityApprovalService.js')
const { createDeparture } = await import('../services/tourDepartureService.js')
const bookRepo = await import('../repositories/booking/prismaBookingRepository.js')

const RUN = generateObjectId().slice(0, 8)
const track = {
  userIds: [],
  orgId: null,
  tourId: null,
  departureIds: [],
  bookingIds: [],
  paymentIds: [],
}

const verification = {
  legalName: `P4 Org ${RUN} PLC`,
  registrationNumber: `P4-${RUN}`,
  responsiblePerson: {
    name: 'P4 Owner',
    phone: '+251911222333',
    email: `p4.owner.${RUN}@visitethiopia.test`,
  },
  businessDocuments: [
    {
      type: 'business_license',
      url: 'https://example.com/p4-license.pdf',
      status: 'uploaded',
    },
  ],
}

async function cleanup() {
  for (const id of track.paymentIds) {
    await prisma.paymentAttempt.deleteMany({ where: { paymentId: id } }).catch(() => {})
    await prisma.refund.deleteMany({ where: { paymentId: id } }).catch(() => {})
  }
  for (const id of track.bookingIds) {
    await prisma.inventoryHold.deleteMany({ where: { bookingId: id } }).catch(() => {})
    await prisma.bookingOperationAudit.deleteMany({ where: { bookingId: id } }).catch(() => {})
    await prisma.bookingProviderNote.deleteMany({ where: { bookingId: id } }).catch(() => {})
    await prisma.payment.deleteMany({ where: { bookingId: id } }).catch(() => {})
    await prisma.refund.deleteMany({ where: { bookingId: id } }).catch(() => {})
    await prisma.booking.deleteMany({ where: { id } }).catch(() => {})
  }
  for (const id of track.departureIds) {
    await prisma.inventoryHold.deleteMany({ where: { departureId: id } }).catch(() => {})
    await prisma.tourDeparture.deleteMany({ where: { id } }).catch(() => {})
  }
  if (track.tourId) {
    await prisma.tour.deleteMany({ where: { id: track.tourId } }).catch(() => {})
  }
  if (track.orgId) {
    await prisma.approvalRequest.deleteMany({ where: { organizationId: track.orgId } }).catch(() => {})
    await prisma.providerVersion.deleteMany({ where: { organizationId: track.orgId } }).catch(() => {})
    await prisma.organizationMember.deleteMany({ where: { organizationId: track.orgId } }).catch(() => {})
    await prisma.userOrganizationPreference.deleteMany({
      where: { activeOrganizationId: track.orgId },
    }).catch(() => {})
    await prisma.organizationPreviousSlug.deleteMany({
      where: { organizationId: track.orgId },
    }).catch(() => {})
    // clear approvedVersionId FK first
    await prisma.organization.updateMany({
      where: { id: track.orgId },
      data: { approvedVersionId: null, latestVersionId: null },
    }).catch(() => {})
    await prisma.organization.deleteMany({ where: { id: track.orgId } }).catch(() => {})
  }
  for (const id of track.userIds) {
    await prisma.userFavorite.deleteMany({ where: { userId: id } }).catch(() => {})
    await prisma.organizationMember.deleteMany({ where: { userId: id } }).catch(() => {})
    await prisma.userOrganizationPreference.deleteMany({ where: { userId: id } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id } }).catch(() => {})
  }
}

try {
  // --- Setup identity ---
  const owner = await users.createUser({
    FirstName: 'P4',
    LastName: 'Owner',
    email: `p4.owner.${RUN}@visitethiopia.test`,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(owner._id)
  await users.setVerified(owner._id, true)

  const customer = await users.createUser({
    FirstName: 'P4',
    LastName: 'Customer',
    email: `p4.customer.${RUN}@visitethiopia.test`,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(customer._id)
  await users.setVerified(customer._id, true)

  const admin = await users.createUser({
    FirstName: 'P4',
    LastName: 'Admin',
    email: `p4.admin.${RUN}@visitethiopia.test`,
    password: 'ValidPass123!',
    passwordConfirm: 'ValidPass123!',
  })
  track.userIds.push(admin._id)
  await users.setVerified(admin._id, true)
  await users.updateRole(admin._id, 'admin')

  const registered = await orgs.registerOrganization({
    name: `P4 Travel ${RUN}`,
    legalName: verification.legalName,
    providerTypes: ['travel_company'],
    verification,
    ownerUserId: owner._id,
  })
  track.orgId = registered.organization._id

  // Enrich draft snapshot with name for submit
  await orgs.updateProviderVersion(registered.draftVersion._id, {
    snapshot: {
      ...registered.draftVersion.snapshot,
      name: `P4 Travel ${RUN}`,
      providerTypes: ['travel_company'],
    },
    verificationSnapshot: verification,
  })

  const submitted = await submitVersionForApprovalPrisma({
    organization: await orgs.findOrganizationById(track.orgId),
    versionId: registered.draftVersion._id,
    submittedBy: owner._id,
  })
  const approved = await approveRequestPrisma({
    approvalRequestId: submitted.approvalRequest._id,
    adminUserId: admin._id,
  })
  check(
    '4A setup: org approved public',
    approved.organization.visibility === 'public' &&
      approved.organization.approvalStatus === 'approved'
  )

  // Create published org tour
  track.tourId = generateObjectId()
  await prisma.tour.create({
    data: {
      id: track.tourId,
      title: `P4 Tour ${RUN}`,
      slug: `p4-tour-${RUN}`,
      description: 'Phase 4 prisma booking tour description long enough.',
      shortDescription: 'P4 tour',
      durationDays: 3,
      durationNights: 2,
      destinations: ['Lalibela'],
      difficulty: 'moderate',
      price: 1000,
      priceMinor: 100000,
      currency: 'ETB',
      coverImage: 'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
      images: ['https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800'],
      maxGroupSize: 20,
      packages: [
        {
          key: 'standard',
          name: 'Standard',
          priceMinor: 100000,
          currency: 'ETB',
          active: true,
        },
      ],
      createdById: owner._id,
      organizationId: track.orgId,
      status: 'published',
      publishedAt: new Date(),
      secretTour: false,
    },
  })

  // --- 4A Departure CRUD ---
  const departure = await createDeparture({
    tour: { _id: track.tourId },
    organizationId: track.orgId,
    payload: {
      departureDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      capacity: 10,
      availableSpots: 10,
      status: 'open',
      packages: [
        {
          key: 'standard',
          priceMinor: 100000,
          currency: 'ETB',
          active: true,
        },
      ],
      notes: 'p4 dep',
    },
  })
  track.departureIds.push(departure._id)
  check('4A departure create', Boolean(departure._id && departure.availableSpots === 10))
  check('4A departure _id shape', String(departure._id).length === 24)

  const listed = await depInv.findDepartures({
    tourId: track.tourId,
    organizationId: track.orgId,
  })
  check('4A departure list', listed.some((d) => d._id === departure._id))

  // --- 4B CAS concurrency ---
  const casDep = await createDeparture({
    tour: { _id: track.tourId },
    organizationId: track.orgId,
    payload: {
      departureDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      capacity: 10,
      availableSpots: 10,
      status: 'open',
      packages: [{ key: 'standard', priceMinor: 100000, currency: 'ETB', active: true }],
    },
  })
  track.departureIds.push(casDep._id)

  const attempts = await Promise.allSettled(
    Array.from({ length: 20 }, () => depInv.reserveSpotsAtomic(casDep._id, 1))
  )
  const succeeded = attempts.filter((a) => a.status === 'fulfilled').length
  const failed = attempts.filter((a) => a.status === 'rejected').length
  const after = await depInv.findDepartureById(casDep._id)
  check('4B concurrent reserve: exactly 10 succeed', succeeded === 10, `ok=${succeeded}`)
  check('4B concurrent reserve: 10 fail', failed === 10)
  check('4B spots never negative', after.availableSpots === 0 && after.status === 'full')

  // release back
  for (let i = 0; i < 10; i++) {
    await depInv.releaseSpotsAtomic(casDep._id, 1)
  }
  const released = await depInv.findDepartureById(casDep._id)
  check('4B release restores spots', released.availableSpots === 10 && released.status === 'open')

  // --- 4C/4G Booking create ---
  const contactInfo = {
    fullName: 'P4 Customer',
    email: `p4.customer.${RUN}@visitethiopia.test`,
    phone: '+251900000001',
  }
  const idem = `p4-book-${RUN}-001`
  const created = await createTourBookingPrisma({
    userId: customer._id,
    body: {
      departureId: departure._id,
      packageKey: 'standard',
      quantity: 2,
      contactInfo,
    },
    idempotencyKey: idem,
  })
  track.bookingIds.push(created.booking._id)
  if (created.payment) track.paymentIds.push(created.payment._id)

  check('4C booking created payment_pending', created.booking.status === 'payment_pending')
  check('4C inventory reserved', created.booking.inventoryReserved === true)
  check('4C price snapshot immutable shape', Boolean(created.booking.priceSnapshot?.totalMinor))
  check('4C payment created', Boolean(created.payment?._id))
  check('4C booking _id', String(created.booking._id).length === 24)

  const depAfterBook = await depInv.findDepartureById(departure._id)
  check('4C spots decremented by 2', depAfterBook.availableSpots === 8)

  const again = await createTourBookingPrisma({
    userId: customer._id,
    body: {
      departureId: departure._id,
      packageKey: 'standard',
      quantity: 2,
      contactInfo,
    },
    idempotencyKey: idem,
  })
  check('4C idempotent same key', again.idempotent === true)
  check(
    '4C idempotent same booking id',
    String(again.booking._id) === String(created.booking._id)
  )

  let conflictOk = false
  try {
    await createTourBookingPrisma({
      userId: customer._id,
      body: {
        departureId: departure._id,
        packageKey: 'standard',
        quantity: 1,
        contactInfo,
      },
      idempotencyKey: idem,
    })
  } catch (e) {
    conflictOk = e.statusCode === 409 || e.status === 409
  }
  check('4C idempotent different payload rejected', conflictOk)

  // --- 4D/4H payment success ---
  const paySuccess = await finalizeSuccessfulPaymentPrisma({
    payment: created.payment,
    booking: created.booking,
  })
  check('4H payment success → booking confirmed', paySuccess.booking.status === 'confirmed')
  check('4H payment completed', paySuccess.payment.status === 'completed')

  const holdConsumed = await depInv.findHoldByBooking(created.booking._id)
  check('4H hold consumed', holdConsumed?.status === 'consumed')

  // --- 4E restore after refund-like cancel ---
  const restored = await restoreConsumedForBookingPrisma({
    bookingId: created.booking._id,
    reason: 'test_restore',
  })
  check('4E restore consumed hold', restored.restored === true)
  const depRestored = await depInv.findDepartureById(departure._id)
  check('4E spots restored (+2)', depRestored.availableSpots === 10)

  // --- payment failure path on new booking ---
  const dep2 = await createDeparture({
    tour: { _id: track.tourId },
    organizationId: track.orgId,
    payload: {
      departureDate: new Date(Date.now() + 21 * 86400000).toISOString(),
      capacity: 5,
      availableSpots: 5,
      status: 'open',
      packages: [{ key: 'standard', priceMinor: 100000, currency: 'ETB', active: true }],
    },
  })
  track.departureIds.push(dep2._id)

  const failBook = await createTourBookingPrisma({
    userId: customer._id,
    body: {
      departureId: dep2._id,
      packageKey: 'standard',
      quantity: 1,
      contactInfo,
    },
    idempotencyKey: `p4-book-${RUN}-fail`,
  })
  track.bookingIds.push(failBook.booking._id)
  track.paymentIds.push(failBook.payment._id)

  const failResult = await handlePaymentFailurePrisma({
    payment: failBook.payment,
    booking: failBook.booking,
    providerResult: { failureCode: 'mock_fail', failureMessage: 'fail', raw: {} },
    attemptNumber: 2,
  })
  check('4H payment failure → booking failed', failResult.booking.status === 'failed')
  const dep2After = await depInv.findDepartureById(dep2._id)
  check('4H failure releases inventory', dep2After.availableSpots === 5)

  // audit append-only
  const audit = await bookRepo.createAudit({
    bookingId: created.booking._id,
    organizationId: track.orgId,
    actorUserId: owner._id,
    action: 'check_in',
    previousFulfillmentStatus: 'confirmed',
    newFulfillmentStatus: 'checked_in',
    metadata: { test: true },
  })
  check('4F audit append-only create', Boolean(audit._id))
  const audits = await bookRepo.listAuditsForBooking(created.booking._id)
  check('4F audit list', audits.length >= 1)
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  await cleanup()
  await prisma.$disconnect()
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Phase 4 Prisma booking: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
