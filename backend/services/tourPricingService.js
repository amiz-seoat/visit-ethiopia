import AppError from '../utils/appError.js'
import { serializePublicOrganization } from './publicOrganizationService.js'

/**
 * Resolve authoritative package pricing from departure packages, with tour package fallback.
 */
export function resolvePackagePricing({ departure, tour, packageKey }) {
  const key = String(packageKey || '')
    .trim()
    .toLowerCase()
  if (!key) {
    throw new AppError('packageKey is required', 400)
  }

  const departurePackage = (departure.packages || []).find(
    (pkg) => pkg.key === key && pkg.active !== false
  )
  if (departurePackage) {
    const unitPriceMinor = Number(departurePackage.priceMinor)
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
      throw new AppError('Departure package price is invalid', 409)
    }
    const tourPackage = (tour.packages || []).find((pkg) => pkg.key === key)
    return {
      unitPriceMinor,
      currency: (departurePackage.currency || tour.currency || 'ETB').toUpperCase(),
      pricedFrom: 'departure_package',
      packageKey: key,
      packageName: tourPackage?.name || key,
    }
  }

  const tourPackage = (tour.packages || []).find(
    (pkg) => pkg.key === key && pkg.active !== false
  )
  if (tourPackage) {
    const unitPriceMinor = Number(tourPackage.priceMinor)
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
      throw new AppError('Tour package price is invalid', 409)
    }
    return {
      unitPriceMinor,
      currency: (tourPackage.currency || tour.currency || 'ETB').toUpperCase(),
      pricedFrom: 'tour_package',
      packageKey: key,
      packageName: tourPackage.name || key,
    }
  }

  throw new AppError('Package not found or not available', 400)
}

/**
 * Build immutable price snapshot from server-side sources only.
 */
export function buildPriceSnapshot({
  departure,
  tour,
  organization,
  approvedVersion,
  packageKey,
  quantity,
}) {
  const pricing = resolvePackagePricing({ departure, tour, packageKey })
  const publicOrg = serializePublicOrganization(organization, approvedVersion)
  if (!publicOrg) {
    throw new AppError('Organization is not available for booking', 409)
  }

  const discountMinor = 0
  const feesMinor = 0
  const taxMinor = 0
  const subtotalMinor = pricing.unitPriceMinor * quantity
  const totalMinor = subtotalMinor - discountMinor + feesMinor + taxMinor

  return {
    currency: pricing.currency,
    quantity,
    unitPriceMinor: pricing.unitPriceMinor,
    subtotalMinor,
    discountMinor,
    feesMinor,
    taxMinor,
    totalMinor,
    tourId: tour._id,
    tourTitle: tour.title,
    tourSlug: tour.slug,
    departureId: departure._id,
    departureDate: departure.departureDate,
    returnDate: departure.returnDate || null,
    packageKey: pricing.packageKey,
    packageName: pricing.packageName,
    organizationId: organization._id,
    organizationName: publicOrg.name,
    organizationSlug: publicOrg.slug,
    pricedFrom: pricing.pricedFrom,
    pricedAt: new Date(),
    tourPriceMinorAtBooking: pricing.unitPriceMinor,
  }
}

export default {
  resolvePackagePricing,
  buildPriceSnapshot,
}
