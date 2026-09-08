/** Generate a unique Idempotency-Key for booking/payment/refund requests. */
export function createIdempotencyKey(prefix = 've'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}-${rand}`.slice(0, 128)
}

export function formatMinorAmount(amountMinor: number, currency = 'ETB'): string {
  const major = (Number(amountMinor) || 0) / 100
  return `${major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

export function bookingStatusLabel(status?: string): string {
  if (!status) return 'Unknown'
  return status.replace(/_/g, ' ')
}

export function bookingStatusClass(status?: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'payment_pending':
      return 'bg-amber-100 text-amber-800'
    case 'cancelled':
    case 'failed':
    case 'expired':
      return 'bg-red-100 text-red-800'
    case 'partially_refunded':
      return 'bg-purple-100 text-purple-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function canCustomerCancelBooking(status?: string): boolean {
  return status === 'payment_pending' || status === 'confirmed' || status === 'partially_refunded'
}

export function isV2Booking(booking: { bookingFlowVersion?: string } | null | undefined): boolean {
  return booking?.bookingFlowVersion === 'v2'
}
