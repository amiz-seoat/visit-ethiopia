import Organization from '../models/Organization.js'
import { getApprovedVersion } from './organizationVersionService.js'
import { serializePublicOrganization } from './publicOrganizationService.js'

export function serializePublicTour(tour, organization = null, approvedVersion = null) {
  const base = {
    _id: tour._id,
    slug: tour.slug,
    title: tour.title,
    shortDescription: tour.shortDescription,
    description: tour.description,
    highlights: tour.highlights,
    uniqueSellingPoints: tour.uniqueSellingPoints,
    duration: tour.duration,
    destinations: tour.destinations,
    startingLocation: tour.startingLocation,
    destinationLocations: tour.destinationLocations,
    categories: tour.categories,
    difficulty: tour.difficulty,
    price: tour.price,
    priceMinor: tour.priceMinor,
    currency: tour.currency,
    discount: tour.discount,
    coverImage: tour.coverImage,
    images: tour.images,
    gallery: tour.gallery,
    portfolioPhotos: tour.portfolioPhotos,
    inclusions: tour.inclusions,
    exclusions: tour.exclusions,
    policies: tour.policies,
    packages: (tour.packages || []).filter((p) => p.active !== false),
    itinerary: tour.itinerary,
    maxGroupSize: tour.maxGroupSize,
    averageRating: tour.averageRating,
    reviewCount: tour.reviewCount,
    isFeatured: tour.isFeatured,
    organizationId: tour.organizationId,
  }

  if (organization && approvedVersion) {
    base.organization = serializePublicOrganization(organization, approvedVersion)
  } else if (organization && organization.name && !approvedVersion) {
    // Already-serialized public organization snapshot
    base.organization = organization
  }

  return base
}

export async function loadPublicOrganizationForTour(tour) {
  if (!tour.organizationId) return null
  const organization = await Organization.findOne({
    _id: tour.organizationId,
    ...Organization.publicMarketplaceFilter(),
  })
  if (!organization) return null
  const approvedVersion = await getApprovedVersion(organization)
  if (!approvedVersion) return null
  return { organization, approvedVersion }
}

export default { serializePublicTour, loadPublicOrganizationForTour }
