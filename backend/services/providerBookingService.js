import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'
import { isV2BookingFlow } from '../config/booking.js'
import { escapeRegex } from '../utils/escapeRegex.js'

const MAX_PAGE_LIMIT = 100
const DEFAULT_LIMIT = 20

/**
 * Safe payment payload for provider/admin fulfillment views.
 * Never includes card/PAN/CVV/bank credentials or raw provider dumps.
 */
export function serializeProviderPayment(payment) {
  if (!payment) return null
  const doc = payment.toObject ? payment.toObject() : { ...payment }
  return {
    _id: doc._id,
    status: doc.status,
    currency: doc.currency,
    amountMinor: doc.amountMinor,
    amountRefundedMinor: doc.amountRefundedMinor || 0,
    provider: doc.provider,
    providerPaymentId: doc.providerPaymentId || null,
    expiresAt: doc.expiresAt || null,
    completedAt: doc.completedAt || null,
  }
}

function snapshotSubset(snapshot) {
  if (!snapshot) return null
  return {
    currency: snapshot.currency,
    quantity: snapshot.quantity,
    unitPriceMinor: snapshot.unitPriceMinor,
    subtotalMinor: snapshot.subtotalMinor,
    discountMinor: snapshot.discountMinor || 0,
    feesMinor: snapshot.feesMinor || 0,
    taxMinor: snapshot.taxMinor || 0,
    totalMinor: snapshot.totalMinor,
    tourId: snapshot.tourId,
    tourTitle: snapshot.tourTitle,
    tourSlug: snapshot.tourSlug,
    departureId: snapshot.departureId,
    departureDate: snapshot.departureDate,
    returnDate: snapshot.returnDate ?? null,
    packageKey: snapshot.packageKey,
    packageName: snapshot.packageName,
    organizationId: snapshot.organizationId,
    organizationName: snapshot.organizationName,
    pricedAt: snapshot.pricedAt,
  }
}

/**
 * Provider-facing booking serializer (V2 only).
 * Distinct from customer serializeV2Booking — fulfillment-oriented fields only.
 */
export function serializeProviderBooking(booking, { payment = null, customerUser = null } = {}) {
  const doc = booking.toObject ? booking.toObject({ virtuals: true }) : { ...booking }
  const contact = doc.contactInfo || {}
  const snap = doc.priceSnapshot || {}

  return {
    _id: doc._id,
    reference: String(doc._id).slice(-8).toUpperCase(),
    bookingFlowVersion: doc.bookingFlowVersion,
    bookingType: doc.bookingType,
    status: doc.status,
    organizationId: doc.organizationId,
    customer: {
      fullName: contact.fullName || null,
      email: contact.email || null,
      phone: contact.phone || null,
      ...(customerUser
        ? {
            userId: customerUser._id,
            accountName: `${customerUser.FirstName || ''} ${customerUser.LastName || ''}`.trim() || null,
          }
        : {}),
    },
    tour: {
      id: snap.tourId || doc.bookingItem || null,
      title: snap.tourTitle || null,
      slug: snap.tourSlug || null,
    },
    departure: {
      id: doc.departureId || snap.departureId || null,
      departureDate: snap.departureDate || null,
      returnDate: snap.returnDate ?? null,
    },
    package: {
      key: doc.packageKey || snap.packageKey || null,
      name: snap.packageName || null,
    },
    quantity: doc.inventoryQuantity ?? snap.quantity ?? null,
    priceSnapshot: snapshotSubset(snap),
    payment: serializeProviderPayment(payment),
    inventory: {
      quantity: doc.inventoryQuantity ?? null,
      reserved: Boolean(doc.inventoryReserved),
      releasedAt: doc.inventoryReleasedAt || null,
    },
    fulfillmentStatus: doc.fulfillmentStatus || 'pending',
    fulfillmentConfirmedAt: doc.fulfillmentConfirmedAt || null,
    checkedInAt: doc.checkedInAt || null,
    fulfillmentCompletedAt: doc.fulfillmentCompletedAt || null,
    noShowAt: doc.noShowAt || null,
    providerNotes: Array.isArray(doc.providerNotes)
      ? doc.providerNotes.map((n) => ({
          _id: n._id,
          note: n.note,
          createdBy: n.createdBy,
          createdAt: n.createdAt,
        }))
      : [],
    expiresAt: doc.expiresAt || null,
    confirmedAt: doc.confirmedAt || null,
    cancelledAt: doc.cancelledAt || null,
    cancellationReason: doc.cancellationReason || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function parseObjectId(value, fieldName) {
  if (value == null || value === '') return null
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new AppError(`Invalid ${fieldName}`, 400)
  }
  return new mongoose.Types.ObjectId(String(value))
}

function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1)
  let limit = parseInt(String(query.limit || String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT
  if (limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_PAGE_LIMIT) limit = MAX_PAGE_LIMIT
  return { page, limit, skip: (page - 1) * limit }
}

/**
 * Build a scoped V2 tour booking filter for one organization.
 * Client-supplied organizationId is ignored — scope comes from auth context only.
 */
export function buildProviderBookingFilter(organizationId, query = {}) {
  const filter = {
    bookingFlowVersion: 'v2',
    bookingType: 'tour',
    organizationId,
  }

  if (query.status) {
    filter.status = String(query.status).trim()
  }

  const departureId = parseObjectId(query.departureId, 'departureId')
  if (departureId) filter.departureId = departureId

  const tourId = parseObjectId(query.tourId, 'tourId')
  if (tourId) {
    filter['priceSnapshot.tourId'] = tourId
  }

  if (query.createdFrom || query.createdTo) {
    filter.createdAt = {}
    if (query.createdFrom) {
      const from = new Date(query.createdFrom)
      if (Number.isNaN(from.getTime())) throw new AppError('Invalid createdFrom', 400)
      filter.createdAt.$gte = from
    }
    if (query.createdTo) {
      const to = new Date(query.createdTo)
      if (Number.isNaN(to.getTime())) throw new AppError('Invalid createdTo', 400)
      filter.createdAt.$lte = to
    }
  }

  if (query.customerSearch) {
    const term = escapeRegex(String(query.customerSearch).trim())
    if (term) {
      const regex = { $regex: term, $options: 'i' }
      filter.$or = [
        { 'contactInfo.fullName': regex },
        { 'contactInfo.email': regex },
        { 'contactInfo.phone': regex },
      ]
    }
  }

  return filter
}

async function attachPayments(bookings) {
  const paymentIds = bookings
    .map((b) => b.paymentId)
    .filter(Boolean)
  if (!paymentIds.length) return new Map()

  const payments = await Payment.find({ _id: { $in: paymentIds } }).setOptions({})
  const map = new Map()
  for (const p of payments) {
    map.set(String(p._id), p)
  }
  return map
}

async function attachCustomerUsers(bookings) {
  const userIds = [...new Set(bookings.map((b) => String(b.user)).filter(Boolean))]
  if (!userIds.length) return new Map()
  const users = await User.find({ _id: { $in: userIds } }).select('FirstName LastName email')
  const map = new Map()
  for (const u of users) map.set(String(u._id), u)
  return map
}

/**
 * List V2 tour bookings for an organization (provider or admin-bypass context).
 */
export async function listOrganizationV2Bookings(organizationId, query = {}) {
  const { page, limit, skip } = parsePagination(query)
  const filter = buildProviderBookingFilter(organizationId, query)

  if (query.paymentStatus) {
    const status = String(query.paymentStatus).trim()
    const payments = await Payment.find({
      organizationId,
      status,
    }).select('_id')
    const paymentIds = payments.map((p) => p._id)
    if (!paymentIds.length) {
      return { results: 0, total: 0, page, limit, data: [] }
    }
    filter.paymentId = { $in: paymentIds }
  }

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .setOptions({ skipUserPopulate: true, skipBookingItemPopulate: true }),
  ])

  const paymentMap = await attachPayments(bookings)
  const userMap = await attachCustomerUsers(bookings)

  const data = bookings.map((b) =>
    serializeProviderBooking(b, {
      payment: b.paymentId ? paymentMap.get(String(b.paymentId)) : null,
      customerUser: userMap.get(String(b.user)) || null,
    })
  )

  return {
    results: data.length,
    total,
    page,
    limit,
    data,
  }
}

/**
 * Load one org-scoped V2 tour booking. Cross-org / legacy → 404 (no existence leak).
 */
export async function getOrganizationV2Booking(organizationId, bookingId) {
  if (!mongoose.Types.ObjectId.isValid(String(bookingId))) {
    throw new AppError('Booking not found', 404)
  }

  const booking = await Booking.findById(bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  if (
    !booking ||
    !isV2BookingFlow(booking) ||
    booking.bookingType !== 'tour' ||
    String(booking.organizationId) !== String(organizationId)
  ) {
    throw new AppError('Booking not found', 404)
  }

  let payment = null
  if (booking.paymentId) {
    payment = await Payment.findById(booking.paymentId)
  }

  const customerUser = booking.user
    ? await User.findById(booking.user).select('FirstName LastName email')
    : null

  return serializeProviderBooking(booking, { payment, customerUser })
}

/**
 * Admin list — may filter by organizationId explicitly (platform admin only).
 */
export async function listAdminV2Bookings(query = {}) {
  const { page, limit, skip } = parsePagination(query)
  const filter = {
    bookingFlowVersion: 'v2',
    bookingType: 'tour',
  }

  const organizationId = parseObjectId(query.organizationId, 'organizationId')
  if (organizationId) filter.organizationId = organizationId

  if (query.status) filter.status = String(query.status).trim()

  const departureId = parseObjectId(query.departureId, 'departureId')
  if (departureId) filter.departureId = departureId

  const tourId = parseObjectId(query.tourId, 'tourId')
  if (tourId) filter['priceSnapshot.tourId'] = tourId

  if (query.paymentStatus) {
    const status = String(query.paymentStatus).trim()
    const payFilter = { status }
    if (organizationId) payFilter.organizationId = organizationId
    const payments = await Payment.find(payFilter).select('_id')
    const paymentIds = payments.map((p) => p._id)
    if (!paymentIds.length) {
      return { results: 0, total: 0, page, limit, data: [] }
    }
    filter.paymentId = { $in: paymentIds }
  }

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .setOptions({ skipUserPopulate: true, skipBookingItemPopulate: true }),
  ])

  const paymentMap = await attachPayments(bookings)
  const userMap = await attachCustomerUsers(bookings)

  const data = bookings.map((b) =>
    serializeProviderBooking(b, {
      payment: b.paymentId ? paymentMap.get(String(b.paymentId)) : null,
      customerUser: userMap.get(String(b.user)) || null,
    })
  )

  return { results: data.length, total, page, limit, data }
}

export async function getAdminV2Booking(bookingId) {
  if (!mongoose.Types.ObjectId.isValid(String(bookingId))) {
    throw new AppError('Booking not found', 404)
  }

  const booking = await Booking.findById(bookingId).setOptions({
    skipUserPopulate: true,
    skipBookingItemPopulate: true,
  })

  if (!booking || !isV2BookingFlow(booking) || booking.bookingType !== 'tour') {
    throw new AppError('Booking not found', 404)
  }

  let payment = null
  if (booking.paymentId) {
    payment = await Payment.findById(booking.paymentId)
  }
  const customerUser = booking.user
    ? await User.findById(booking.user).select('FirstName LastName email')
    : null

  return serializeProviderBooking(booking, { payment, customerUser })
}

export default {
  serializeProviderBooking,
  serializeProviderPayment,
  buildProviderBookingFilter,
  listOrganizationV2Bookings,
  getOrganizationV2Booking,
  listAdminV2Bookings,
  getAdminV2Booking,
}
