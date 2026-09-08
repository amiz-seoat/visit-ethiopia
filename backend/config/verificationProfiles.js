/**
 * Provider-type verification requirements.
 * Extend by adding new provider types without rewriting validation logic.
 */
export const VERIFICATION_PROFILES = {
  travel_company: {
    label: 'Tour & Travel Company',
    requiredVerificationFields: [
      'legalName',
      'registrationNumber',
      'responsiblePerson.name',
      'responsiblePerson.phone',
      'responsiblePerson.email',
    ],
    requiredDocumentTypes: ['business_license'],
    optionalDocumentTypes: ['tourism_license', 'insurance_certificate'],
  },
  hotel: {
    label: 'Hotel',
    requiredVerificationFields: [
      'legalName',
      'registrationNumber',
      'licenseNumber',
      'responsiblePerson.name',
      'responsiblePerson.phone',
    ],
    requiredDocumentTypes: ['hotel_registration'],
    optionalDocumentTypes: ['star_certification'],
  },
  tour_bus_provider: {
    label: 'Tour Bus Provider',
    requiredVerificationFields: [
      'legalName',
      'registrationNumber',
      'licenseNumber',
      'responsiblePerson.name',
      'responsiblePerson.phone',
    ],
    requiredDocumentTypes: ['operator_permit'],
    optionalDocumentTypes: ['fleet_insurance'],
  },
  bus_company: {
    label: 'Public Bus Company',
    requiredVerificationFields: [
      'legalName',
      'registrationNumber',
      'licenseNumber',
      'responsiblePerson.name',
      'responsiblePerson.phone',
    ],
    requiredDocumentTypes: ['transport_authority_permit'],
    optionalDocumentTypes: ['route_license'],
  },
}

export function getVerificationProfile(providerType) {
  return VERIFICATION_PROFILES[providerType] || null
}

export default VERIFICATION_PROFILES
