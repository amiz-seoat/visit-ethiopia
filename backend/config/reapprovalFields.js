/**
 * Fields that require admin re-approval when changed between approved and submitted snapshots.
 * Dot-notation paths for nested fields.
 */
export const REAPPROVAL_FIELDS = {
  organization: [
    'name',
    'legalName',
    'providerTypes',
    'location.coordinates',
    'location.address',
    'location.city',
    'location.region',
    'location.country',
    'contact.phone',
    'contact.email',
    'proposedSlug',
  ],
}

/** Harmless fields editable without triggering re-approval notice (still versioned). */
export const HARMLESS_PROFILE_FIELDS = [
  'description',
  'shortDescription',
  'uniqueSellingPoints',
  'services',
  'yearsInBusiness',
  'logo',
  'coverImage',
  'gallery',
  'portfolioPhotos',
  'contact.website',
  'contact.socialLinks',
]

export default REAPPROVAL_FIELDS
