import AppError from '../utils/appError.js'
import { getPublicPaymentConfig } from '../config/payments.js'

/**
 * Refuse to create payable (v2) bookings when no payment provider is usable,
 * so inventory is never reserved for a booking that cannot be paid.
 */
export default function requirePaymentsAvailable(req, res, next) {
  const cfg = getPublicPaymentConfig()
  if (!cfg.configured) {
    return next(new AppError('Online booking is temporarily unavailable (payments not configured)', 503))
  }
  return next()
}
