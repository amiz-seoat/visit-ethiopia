export interface LatLng {
  lat: number;
  lng: number;
}

const inEthiopiaRegion = (p: LatLng) =>
  p.lat >= -5 && p.lat <= 20 && p.lng >= 30 && p.lng <= 50;

function valid(lat: unknown, lng: unknown): LatLng | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

/**
 * Extract coordinates from the location shapes used across the API:
 *  - { coordinates: { lat, lng } }            (PostgreSQL catalog)
 *  - { coordinates: [lng, lat] }              (GeoJSON, legacy Mongo)
 *  - { lat, lng } / { latitude, longitude }
 */
export function extractLatLng(location: unknown): LatLng | null {
  if (!location || typeof location !== 'object') return null;
  const loc = location as Record<string, unknown>;

  const direct = valid(loc.lat ?? loc.latitude, loc.lng ?? loc.lon ?? loc.longitude);
  if (direct) return direct;

  const c = loc.coordinates;
  if (Array.isArray(c) && c.length >= 2) {
    // GeoJSON is [lng, lat]; fall back to swapped order if that is clearly wrong.
    const geo = valid(c[1], c[0]);
    if (geo && inEthiopiaRegion(geo)) return geo;
    const swapped = valid(c[0], c[1]);
    if (swapped && inEthiopiaRegion(swapped)) return swapped;
    return geo;
  }
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    return valid(o.lat ?? o.latitude, o.lng ?? o.lon ?? o.longitude);
  }
  return null;
}

/** Official Google Maps URLs (no API key): https://developers.google.com/maps/documentation/urls */
export function googleMapsSearchUrl(p: LatLng | null, label?: string): string {
  const query = p ? `${p.lat},${p.lng}` : label || 'Ethiopia';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleMapsDirectionsUrl(p: LatLng | null, label?: string): string {
  const destination = p ? `${p.lat},${p.lng}` : label || 'Ethiopia';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Ethiopia's rough centre, used when nothing else is known. */
export const ETHIOPIA_CENTER: LatLng = { lat: 9.145, lng: 40.4897 };
