import catchAsync from '../utils/catchAsync.js'
import {
  listOrganizationV2Bookings,
  getOrganizationV2Booking,
} from '../services/providerBookingService.js'
import {
  checkInProviderBooking,
  completeProviderBooking,
  markNoShowProviderBooking,
  addProviderBookingNote,
  listBookingOperationAudits,
} from '../services/providerFulfillmentService.js'

/** Reject client attempts to forge organization scope via query/body. */
function stripClientOrgForge(req) {
  if (req.query) {
    delete req.query.organizationId
    delete req.query.orgId
  }
  if (req.body && typeof req.body === 'object') {
    delete req.body.organizationId
    delete req.body.orgId
    delete req.body.userId
    delete req.body.user
    delete req.body.status
    delete req.body.fulfillmentStatus
    delete req.body.paymentStatus
    delete req.body.amountMinor
    delete req.body.priceSnapshot
    delete req.body.inventoryReserved
  }
}

export const listProviderBookings = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const result = await listOrganizationV2Bookings(req.organizationId, req.query)

  res.status(200).json({
    status: 'success',
    results: result.results,
    total: result.total,
    page: result.page,
    limit: result.limit,
    data: result.data,
  })
})

export const getProviderBooking = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const booking = await getOrganizationV2Booking(
    req.organizationId,
    req.params.id
  )

  res.status(200).json({
    status: 'success',
    data: booking,
  })
})

export const checkInBooking = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const result = await checkInProviderBooking({
    organizationId: req.organizationId,
    bookingId: req.params.id,
    actorUserId: req.user.id,
    body: req.body || {},
  })

  res.status(200).json({
    status: 'success',
    idempotent: result.idempotent,
    data: result.booking,
  })
})

export const completeBooking = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const result = await completeProviderBooking({
    organizationId: req.organizationId,
    bookingId: req.params.id,
    actorUserId: req.user.id,
    body: req.body || {},
  })

  res.status(200).json({
    status: 'success',
    idempotent: result.idempotent,
    data: result.booking,
  })
})

export const noShowBooking = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const result = await markNoShowProviderBooking({
    organizationId: req.organizationId,
    bookingId: req.params.id,
    actorUserId: req.user.id,
    body: req.body || {},
  })

  res.status(200).json({
    status: 'success',
    idempotent: result.idempotent,
    data: result.booking,
  })
})

export const addBookingNote = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const result = await addProviderBookingNote({
    organizationId: req.organizationId,
    bookingId: req.params.id,
    actorUserId: req.user.id,
    body: req.body || {},
  })

  res.status(200).json({
    status: 'success',
    data: result.booking,
  })
})

export const listBookingAudits = catchAsync(async (req, res) => {
  stripClientOrgForge(req)
  const audits = await listBookingOperationAudits(
    req.organizationId,
    req.params.id
  )

  res.status(200).json({
    status: 'success',
    results: audits.length,
    data: audits,
  })
})

export default {
  listProviderBookings,
  getProviderBooking,
  checkInBooking,
  completeBooking,
  noShowBooking,
  addBookingNote,
  listBookingAudits,
}
