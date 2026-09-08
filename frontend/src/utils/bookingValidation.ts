import {
  formatMinorAmount,
  createIdempotencyKey,
} from './bookingHelpers'

export interface BookingContactInfo {
  fullName: string
  email: string
  phone: string
  address?: string
}

export interface TourBookingFormValues {
  departureId: string
  packageKey: string
  quantity: number
  contactInfo: BookingContactInfo
}

export function validateTourBookingForm(
  values: TourBookingFormValues,
  opts: { availableSpots: number; isAuthenticated: boolean }
): string | null {
  if (!opts.isAuthenticated) {
    return 'Please sign in to book this tour.'
  }
  if (!values.departureId) {
    return 'Please select a departure.'
  }
  if (!values.packageKey) {
    return 'Please select a package.'
  }
  if (!Number.isInteger(values.quantity) || values.quantity < 1) {
    return 'Quantity must be at least 1.'
  }
  if (opts.availableSpots <= 0) {
    return 'This departure is sold out.'
  }
  if (values.quantity > opts.availableSpots) {
    return `Only ${opts.availableSpots} spot${opts.availableSpots === 1 ? '' : 's'} available.`
  }
  const { fullName, email, phone } = values.contactInfo
  if (!fullName?.trim()) return 'Full name is required.'
  if (!email?.trim()) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Please enter a valid email address.'
  }
  if (!phone?.trim()) return 'Phone number is required.'
  return null
}

export function availabilityLabel(availableSpots: number): string {
  if (availableSpots <= 0) return 'Sold out'
  if (availableSpots <= 3) return `Only ${availableSpots} spot${availableSpots === 1 ? '' : 's'} left`
  return `${availableSpots} spots available`
}

export function previewPackageTotalMinor(
  unitPriceMinor: number,
  quantity: number
): number {
  return Math.max(0, (Number(unitPriceMinor) || 0) * Math.max(0, Number(quantity) || 0))
}

export { formatMinorAmount, createIdempotencyKey }
