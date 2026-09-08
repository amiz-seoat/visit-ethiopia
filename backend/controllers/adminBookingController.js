import catchAsync from '../utils/catchAsync.js'
import { runPaymentReconciliation } from '../services/paymentReconciliationService.js'
import {
  listAdminV2Bookings,
  getAdminV2Booking,
} from '../services/providerBookingService.js'

export const reconcileBookings = catchAsync(async (req, res) => {
  const dryRun =
    req.body?.dryRun === true ||
    req.query?.dryRun === 'true' ||
    req.query?.dryRun === '1'
  const limit = Number(req.body?.limit ?? req.query?.limit ?? 100)

  const summary = await runPaymentReconciliation({ dryRun, limit })

  res.status(200).json({
    status: 'success',
    data: {
      scanned: summary.scanned,
      repaired: summary.repaired,
      expired: summary.expired,
      inventoryReleased: summary.inventoryReleased,
      bookingsConfirmed: summary.bookingsConfirmed,
      flagged: summary.flagged,
      errors: summary.errors,
      dryRun: summary.dryRun,
    },
  })
})

/** Platform admin — list V2 tour bookings (optional organizationId filter). */
export const listAdminBookings = catchAsync(async (req, res) => {
  const result = await listAdminV2Bookings(req.query)

  res.status(200).json({
    status: 'success',
    results: result.results,
    total: result.total,
    page: result.page,
    limit: result.limit,
    data: result.data,
  })
})

export const getAdminBooking = catchAsync(async (req, res) => {
  const booking = await getAdminV2Booking(req.params.id)

  res.status(200).json({
    status: 'success',
    data: booking,
  })
})

export default {
  reconcileBookings,
  listAdminBookings,
  getAdminBooking,
}
