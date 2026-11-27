/**
 * Admin dashboard service (PostgreSQL / Prisma only).
 *
 * Read models for the admin console (overview KPIs, bookings, payments, users,
 * audit log) and the few privileged writes an admin may perform. Writes never
 * move money: payment reviews only record a decision; refunds still go through
 * the booking cancellation/refund flow and the payment provider.
 */
import prisma from '../config/prisma.js'
import AppError from '../utils/appError.js'
import { generateObjectId } from '../utils/objectId.js'
import { isPrismaApp } from '../utils/databaseMode.js'

export const USER_ROLES = [
  'user',
  'customer',
  'admin',
  'guide',
  'tour_operator',
  'hotel_manager',
  'transport_manager',
]

const BOOKING_STATUSES = [
  'pending', 'confirmed', 'cancelled', 'completed',
  'payment_pending', 'failed', 'expired', 'partially_refunded',
]
const BOOKING_TYPES = ['tour', 'hotel', 'transport', 'restaurant']
const PAYMENT_STATUSES = [
  'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded',
]
const PAID_STATUSES = ['completed', 'partially_refunded', 'refunded']

export function assertPrismaAdmin() {
  if (!isPrismaApp()) {
    throw new AppError('Admin console requires DATABASE_MODE=prisma', 501)
  }
}

function pageArgs(query = {}, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit))
  return { page, limit, skip: (page - 1) * limit }
}

function parseDate(value, name) {
  if (!value) return null
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) throw new AppError(`Invalid ${name}`, 400)
  return d
}

const dayKey = (d) => new Date(d).toISOString().slice(0, 10)

function emptySeries(days) {
  const out = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86400000)
    out.push(dayKey(d))
  }
  return out
}

export async function logAdminAction(actorId, action, targetType, targetId, details = {}) {
  await prisma.adminAuditLog.create({
    data: {
      id: generateObjectId(),
      actorId: String(actorId),
      action,
      targetType,
      targetId: String(targetId),
      details,
    },
  })
}

// ---------------------------------------------------------------------------
// Catalog title lookup (bookings reference tours/hotels/transports by id)
// ---------------------------------------------------------------------------
async function itemTitles(bookings) {
  const ids = { tour: new Set(), hotel: new Set(), transport: new Set() }
  for (const b of bookings) if (ids[b.bookingType]) ids[b.bookingType].add(b.bookingItemId)
  const [tours, hotels, transports] = await Promise.all([
    ids.tour.size
      ? prisma.tour.findMany({ where: { id: { in: [...ids.tour] } }, select: { id: true, title: true } })
      : [],
    ids.hotel.size
      ? prisma.hotel.findMany({ where: { id: { in: [...ids.hotel] } }, select: { id: true, name: true } })
      : [],
    ids.transport.size
      ? prisma.transport.findMany({ where: { id: { in: [...ids.transport] } }, select: { id: true, name: true } })
      : [],
  ])
  const map = new Map()
  tours.forEach((t) => map.set(t.id, t.title))
  hotels.forEach((h) => map.set(h.id, h.name))
  transports.forEach((t) => map.set(t.id, t.name))
  return map
}

const isFlagged = (metadata) =>
  Boolean(metadata && typeof metadata === 'object' && metadata.needsRefundReview === true)

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export async function getOverview({ days = 30 } = {}) {
  assertPrismaAdmin()
  const span = Math.min(180, Math.max(7, Number(days) || 30))
  const since = new Date(Date.now() - span * 86400000)
  since.setUTCHours(0, 0, 0, 0)

  const [
    usersTotal,
    usersActive,
    usersNew,
    usersByRole,
    bookingsByStatus,
    bookingsByType,
    periodBookings,
    paidPayments,
    periodPayments,
    refundsCompleted,
    refundsFailed,
    pendingApprovals,
    pendingReviews,
    newContacts,
    stalePending,
    pendingPaymentsWithMeta,
    orgs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['bookingType'], _count: { _all: true } }),
    prisma.booking.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, bookingType: true, bookingItemId: true },
    }),
    prisma.payment.findMany({
      where: { status: { in: PAID_STATUSES } },
      select: { amountMinor: true, amountRefundedMinor: true, currency: true, provider: true },
    }),
    prisma.payment.findMany({
      where: { status: { in: PAID_STATUSES }, completedAt: { gte: since } },
      select: { amountMinor: true, amountRefundedMinor: true, currency: true, completedAt: true },
    }),
    prisma.refund.aggregate({
      where: { status: 'completed', completedAt: { gte: since } },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    prisma.refund.count({ where: { status: 'failed' } }),
    prisma.approvalRequest.count({ where: { status: { in: ['pending', 'processing'] } } }),
    prisma.review.count({ where: { status: 'pending' } }),
    prisma.contact.count({ where: { status: 'new' } }),
    prisma.booking.count({ where: { status: 'payment_pending', expiresAt: { lt: new Date() } } }),
    prisma.payment.findMany({
      where: { status: { in: ['pending', 'completed', 'cancelled', 'failed'] } },
      select: { metadata: true },
    }),
    prisma.organization.groupBy({ by: ['approvalStatus'], _count: { _all: true } }),
  ])

  // Revenue (net of refunds), per currency
  const revenueAllTime = {}
  const paymentsByProvider = {}
  for (const p of paidPayments) {
    revenueAllTime[p.currency] = (revenueAllTime[p.currency] || 0) + p.amountMinor - p.amountRefundedMinor
    paymentsByProvider[p.provider] = (paymentsByProvider[p.provider] || 0) + 1
  }
  const revenuePeriod = {}
  const series = emptySeries(span)
  const revenueByDay = Object.fromEntries(series.map((d) => [d, 0]))
  for (const p of periodPayments) {
    const net = p.amountMinor - p.amountRefundedMinor
    revenuePeriod[p.currency] = (revenuePeriod[p.currency] || 0) + net
    if (p.currency === 'ETB') {
      const k = dayKey(p.completedAt)
      if (k in revenueByDay) revenueByDay[k] += net
    }
  }

  const bookingsByDay = Object.fromEntries(series.map((d) => [d, 0]))
  const itemCounts = new Map()
  for (const b of periodBookings) {
    const k = dayKey(b.createdAt)
    if (k in bookingsByDay) bookingsByDay[k] += 1
    if (['confirmed', 'completed', 'partially_refunded'].includes(b.status)) {
      const key = `${b.bookingType}:${b.bookingItemId}`
      itemCounts.set(key, (itemCounts.get(key) || 0) + 1)
    }
  }
  const topKeys = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const titles = await itemTitles(
    topKeys.map(([k]) => {
      const [bookingType, bookingItemId] = k.split(':')
      return { bookingType, bookingItemId }
    })
  )

  const countBy = (rows, key) =>
    Object.fromEntries(rows.map((r) => [r[key], r._count._all]))

  return {
    periodDays: span,
    since: since.toISOString(),
    users: {
      total: usersTotal,
      active: usersActive,
      suspended: usersTotal - usersActive,
      newInPeriod: usersNew,
      byRole: countBy(usersByRole, 'role'),
    },
    bookings: {
      total: bookingsByStatus.reduce((a, r) => a + r._count._all, 0),
      inPeriod: periodBookings.length,
      byStatus: countBy(bookingsByStatus, 'status'),
      byType: countBy(bookingsByType, 'bookingType'),
    },
    revenue: {
      allTimeMinor: revenueAllTime,
      periodMinor: revenuePeriod,
      paymentsByProvider,
      refundsInPeriod: {
        count: refundsCompleted._count._all,
        amountMinor: refundsCompleted._sum.amountMinor || 0,
      },
    },
    series: series.map((d) => ({ date: d, bookings: bookingsByDay[d], revenueMinorEtb: revenueByDay[d] })),
    topListings: topKeys.map(([k, count]) => {
      const [type, id] = k.split(':')
      return { type, id, title: titles.get(id) || '(deleted listing)', bookings: count }
    }),
    providers: { byApprovalStatus: countBy(orgs, 'approvalStatus') },
    queues: {
      pendingApprovals,
      pendingReviews,
      newContacts,
      flaggedPayments: pendingPaymentsWithMeta.filter((p) => isFlagged(p.metadata)).length,
      failedRefunds: refundsFailed,
      expiredHoldsAwaitingCleanup: stalePending,
    },
  }
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export async function listBookings(query = {}) {
  assertPrismaAdmin()
  const { page, limit, skip } = pageArgs(query)
  const where = {}
  if (query.status) {
    if (!BOOKING_STATUSES.includes(query.status)) throw new AppError('Invalid status filter', 400)
    where.status = query.status
  }
  if (query.type) {
    if (!BOOKING_TYPES.includes(query.type)) throw new AppError('Invalid type filter', 400)
    where.bookingType = query.type
  }
  const from = parseDate(query.from, 'from date')
  const to = parseDate(query.to, 'to date')
  if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) }
  if (query.search) {
    const q = String(query.search).trim().slice(0, 100)
    if (q) {
      where.OR = [
        ...(/^[a-f0-9]{6,24}$/i.test(q) ? [{ id: { endsWith: q.toLowerCase() } }] : []),
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
      ]
    }
  }

  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        payments: {
          select: { id: true, status: true, provider: true, amountMinor: true, amountRefundedMinor: true, currency: true, metadata: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ])
  const titles = await itemTitles(rows)
  return {
    total,
    page,
    limit,
    data: rows.map((b) => {
      const pay = b.payments[0]
      const snap = b.priceSnapshot || {}
      return {
        _id: b.id,
        reference: b.id.slice(-8).toUpperCase(),
        bookingType: b.bookingType,
        status: b.status,
        fulfillmentStatus: b.fulfillmentStatus,
        itemTitle: titles.get(b.bookingItemId) || '(deleted listing)',
        bookingItemId: b.bookingItemId,
        organizationId: b.organizationId,
        customer: b.user
          ? { _id: b.user.id, name: `${b.user.firstName} ${b.user.lastName}`.trim(), email: b.user.email }
          : null,
        totalMinor: snap.totalMinor ?? pay?.amountMinor ?? null,
        currency: snap.currency || pay?.currency || 'ETB',
        payment: pay
          ? {
              _id: pay.id,
              status: pay.status,
              provider: pay.provider,
              amountMinor: pay.amountMinor,
              amountRefundedMinor: pay.amountRefundedMinor,
              flagged: isFlagged(pay.metadata),
            }
          : null,
        createdAt: b.createdAt,
        expiresAt: b.expiresAt,
      }
    }),
  }
}

export async function getBookingDetail(id) {
  assertPrismaAdmin()
  const b = await prisma.booking.findUnique({
    where: { id: String(id) },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      payments: { include: { attempts: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } },
      refunds: { orderBy: { createdAt: 'desc' } },
      audits: { orderBy: { createdAt: 'asc' } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  })
  if (!b) throw new AppError('Booking not found', 404)
  const titles = await itemTitles([b])
  return { ...b, _id: b.id, itemTitle: titles.get(b.bookingItemId) || '(deleted listing)' }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export async function listPayments(query = {}) {
  assertPrismaAdmin()
  const { page, limit, skip } = pageArgs(query)
  const where = {}
  if (query.status) {
    if (!PAYMENT_STATUSES.includes(query.status)) throw new AppError('Invalid status filter', 400)
    where.status = query.status
  }
  if (query.provider) {
    if (!['mock', 'chapa'].includes(query.provider)) throw new AppError('Invalid provider filter', 400)
    where.provider = query.provider
  }
  if (query.flagged === 'true') {
    where.metadata = { path: ['needsRefundReview'], equals: true }
  }
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        attempts: { select: { id: true, status: true, failureCode: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 3 },
      },
    }),
  ])
  const bookings = await prisma.booking.findMany({
    where: { id: { in: rows.map((p) => p.bookingId) } },
    select: { id: true, status: true, bookingType: true, bookingItemId: true, user: { select: { email: true } } },
  })
  const byId = new Map(bookings.map((b) => [b.id, b]))
  const titles = await itemTitles(bookings)
  return {
    total,
    page,
    limit,
    data: rows.map((p) => {
      const b = byId.get(p.bookingId)
      const meta = p.metadata || {}
      return {
        _id: p.id,
        bookingId: p.bookingId,
        bookingReference: p.bookingId.slice(-8).toUpperCase(),
        bookingStatus: b?.status,
        itemTitle: b ? titles.get(b.bookingItemId) || '(deleted listing)' : null,
        customerEmail: b?.user?.email || null,
        status: p.status,
        provider: p.provider,
        amountMinor: p.amountMinor,
        amountRefundedMinor: p.amountRefundedMinor,
        currency: p.currency,
        providerPaymentId: p.providerPaymentId,
        flagged: isFlagged(meta),
        flagReason: meta.flagged || null,
        refundReview: meta.refundReview || null,
        recentAttempts: p.attempts,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      }
    }),
  }
}

const REVIEW_RESOLUTIONS = ['refunded_externally', 'customer_rebooked', 'no_refund_due']

/**
 * Close a payment flagged for refund review (e.g. paid after the booking hold expired).
 * Records the admin decision only — it never moves money.
 */
export async function resolveFlaggedPayment(actor, paymentId, { resolution, note } = {}) {
  assertPrismaAdmin()
  if (!REVIEW_RESOLUTIONS.includes(resolution)) {
    throw new AppError(`resolution must be one of: ${REVIEW_RESOLUTIONS.join(', ')}`, 400)
  }
  const cleanNote = String(note || '').trim().slice(0, 500)
  if (!cleanNote) throw new AppError('A note explaining the decision is required', 400)

  const payment = await prisma.payment.findUnique({ where: { id: String(paymentId) } })
  if (!payment) throw new AppError('Payment not found', 404)
  const meta = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}
  if (!isFlagged(meta)) throw new AppError('Payment is not awaiting refund review', 409)

  const refundReview = {
    resolution,
    note: cleanNote,
    resolvedBy: String(actor._id || actor.id),
    resolvedAt: new Date().toISOString(),
  }
  // Compare-and-set on the flag so two admins can't resolve the same payment twice.
  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, metadata: { path: ['needsRefundReview'], equals: true } },
    data: { metadata: { ...meta, needsRefundReview: false, refundReview } },
  })
  if (updated.count !== 1) throw new AppError('Payment was already resolved', 409)

  await logAdminAction(refundReview.resolvedBy, 'payment.refund_review_resolved', 'payment', payment.id, {
    resolution,
    note: cleanNote,
    bookingId: payment.bookingId,
  })
  return { _id: payment.id, refundReview }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const publicUser = (u) => ({
  _id: u.id,
  FirstName: u.firstName,
  LastName: u.lastName,
  email: u.email,
  role: u.role,
  active: u.active,
  isVerified: u.isVerified,
  createdAt: u.createdAt,
  bookingsCount: u._count?.bookings ?? undefined,
})

export async function listUsers(query = {}) {
  assertPrismaAdmin()
  const { page, limit, skip } = pageArgs(query)
  const where = {}
  if (query.role) {
    if (!USER_ROLES.includes(query.role)) throw new AppError('Invalid role filter', 400)
    where.role = query.role
  }
  if (query.status === 'active') where.active = true
  if (query.status === 'suspended') where.active = false
  if (query.search) {
    const q = String(query.search).trim().slice(0, 100)
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ]
    }
  }
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        active: true, isVerified: true, createdAt: true,
        _count: { select: { bookings: true } },
      },
    }),
  ])
  return { total, page, limit, data: rows.map(publicUser) }
}

/**
 * Change a user's role and/or active flag. Guards:
 *  - admins cannot change their own role or suspend themselves;
 *  - the last active admin can never be demoted or suspended.
 */
export async function updateUserByAdmin(actor, userId, body = {}) {
  assertPrismaAdmin()
  const actorId = String(actor._id || actor.id)
  const id = String(userId)
  const changes = {}
  if (body.role !== undefined) {
    if (!USER_ROLES.includes(body.role)) throw new AppError('Invalid role', 400)
    changes.role = body.role
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new AppError('active must be true or false', 400)
    changes.active = body.active
  }
  if (!Object.keys(changes).length) throw new AppError('Nothing to update (role or active)', 400)

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new AppError('User not found', 404)
  if (id === actorId) throw new AppError('You cannot change your own role or status', 403)

  const losesAdmin =
    target.role === 'admin' &&
    target.active &&
    ((changes.role && changes.role !== 'admin') || changes.active === false)
  if (losesAdmin) {
    const otherAdmins = await prisma.user.count({
      where: { role: 'admin', active: true, id: { not: id } },
    })
    if (otherAdmins === 0) throw new AppError('Cannot remove the last active admin', 409)
  }

  const updated = await prisma.user.update({
    where: { id },
    data: changes,
    select: {
      id: true, firstName: true, lastName: true, email: true, role: true,
      active: true, isVerified: true, createdAt: true,
    },
  })
  const before = { role: target.role, active: target.active }
  await logAdminAction(actorId, 'user.updated', 'user', id, { before, after: changes })
  return publicUser(updated)
}

// ---------------------------------------------------------------------------
// Audit log & assistant insights
// ---------------------------------------------------------------------------
export async function listAuditLog(query = {}) {
  assertPrismaAdmin()
  const { page, limit, skip } = pageArgs(query, { defaultLimit: 30 })
  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
  ])
  const actorIds = [...new Set(rows.map((r) => r.actorId))]
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  })
  const emailById = new Map(actors.map((a) => [a.id, a.email]))
  return {
    total,
    page,
    limit,
    data: rows.map((r) => ({ ...r, _id: r.id, actorEmail: emailById.get(r.actorId) || null })),
  }
}

export async function getAssistantInsights({ days = 30 } = {}) {
  assertPrismaAdmin()
  const since = new Date(Date.now() - Math.min(180, Math.max(1, Number(days) || 30)) * 86400000)
  const [total, unanswered, recent, unansweredRecent] = await Promise.all([
    prisma.assistantQuery.count({ where: { createdAt: { gte: since } } }),
    prisma.assistantQuery.count({ where: { createdAt: { gte: since }, answered: false } }),
    prisma.assistantQuery.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { sourceIds: true, mode: true, latencyMs: true },
    }),
    prisma.assistantQuery.findMany({
      where: { createdAt: { gte: since }, answered: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, question: true, createdAt: true },
    }),
  ])
  const sourceCounts = new Map()
  let latencySum = 0
  let latencyN = 0
  const byMode = {}
  for (const q of recent) {
    for (const s of q.sourceIds) sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1)
    if (q.latencyMs != null) {
      latencySum += q.latencyMs
      latencyN += 1
    }
    byMode[q.mode] = (byMode[q.mode] || 0) + 1
  }
  return {
    total,
    unanswered,
    byMode,
    avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : null,
    topSources: [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count })),
    recentUnanswered: unansweredRecent,
  }
}
