/**
 * Public site details. Contact fields come from build-time env vars so no placeholder
 * numbers or addresses ship. Anything left unset is simply not shown.
 * These are public values (shown on the page): never put secrets in VITE_* variables.
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const SITE = {
  name: 'Visit Ethiopia',
  tagline: 'Book verified tours, hotels, transport and restaurants across Ethiopia.',
  contactEmail: clean(import.meta.env.VITE_CONTACT_EMAIL),
  contactPhone: clean(import.meta.env.VITE_CONTACT_PHONE),
  contactAddress: clean(import.meta.env.VITE_CONTACT_ADDRESS),
  social: {
    facebook: clean(import.meta.env.VITE_SOCIAL_FACEBOOK),
    instagram: clean(import.meta.env.VITE_SOCIAL_INSTAGRAM),
    x: clean(import.meta.env.VITE_SOCIAL_X),
  },
  /** Date the Terms and Privacy pages were last revised. */
  policiesUpdated: 'November 27, 2026',
} as const;
