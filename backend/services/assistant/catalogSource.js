/**
 * Live platform listings (bookable hotels, tours, restaurants, destinations) as
 * retrievable chunks, so the assistant can point visitors to things they can
 * actually book here. Uses the same public-visibility repository functions as
 * the public API, so drafts, secret tours and unapproved providers never leak.
 * Cached briefly to keep chat requests cheap.
 */
import {
  findDestinations,
  findHotels,
  findPublicTours,
  findRestaurants,
} from '../../repositories/prisma/catalogRepository.js'

const TTL_MS = 10 * 60 * 1000
let cache = { at: 0, chunks: [] }

const loc = (l) => {
  if (!l || typeof l !== 'object') return ''
  return [l.address, l.city, l.region].filter((x) => typeof x === 'string' && x).join(', ')
}
const coords = (l) => {
  const c = l?.coordinates
  if (c && typeof c === 'object' && !Array.isArray(c) && Number.isFinite(+c.lat) && Number.isFinite(+c.lng)) {
    return { lat: +c.lat, lng: +c.lng }
  }
  if (Array.isArray(c) && c.length >= 2) return { lat: +c[1], lng: +c[0] }
  return null
}
const clip = (s, n = 600) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export function buildCatalogChunks({ hotels = [], tours = [], restaurants = [], destinations = [] }) {
  const chunks = []
  for (const h of hotels) {
    chunks.push({
      id: `hotel:${h._id}`,
      type: 'hotel',
      title: h.name,
      href: `/hotels/${h._id}`,
      coordinates: coords(h.location),
      boostText: `${h.name} ${loc(h.location)} hotel`,
      text: `Bookable hotel on Visit Ethiopia: ${h.name}${h.stars ? ` (${h.stars}-star)` : ''}. Location: ${loc(h.location) || 'n/a'}. ${clip(h.shortDescription || h.description)}${h.amenities?.length ? ` Amenities: ${h.amenities.slice(0, 8).join(', ')}.` : ''}`,
    })
  }
  for (const t of tours) {
    const price = t.priceMinor != null ? `${(t.priceMinor / 100).toLocaleString('en-US')} ${t.currency || 'ETB'}` : `${t.price} ${t.currency || 'ETB'}`
    chunks.push({
      id: `tour:${t._id}`,
      type: 'tour',
      title: t.title,
      href: `/tours/${t._id}`,
      coordinates: null,
      boostText: `${t.title} ${(t.destinations || []).join(' ')} tour`,
      text: `Bookable tour on Visit Ethiopia: ${t.title}. ${t.durationDays} days. Destinations: ${(t.destinations || []).join(', ') || 'n/a'}. From ${price} per person. ${clip(t.shortDescription || t.description)}`,
    })
  }
  for (const r of restaurants) {
    chunks.push({
      id: `restaurant:${r._id}`,
      type: 'restaurant',
      title: r.name,
      href: `/restaurants/${r._id}`,
      coordinates: coords(r.location),
      boostText: `${r.name} ${loc(r.location)} restaurant`,
      text: `Restaurant listed on Visit Ethiopia: ${r.name}. Location: ${loc(r.location) || 'n/a'}. Cuisine: ${(r.cuisineType || []).join(', ') || 'n/a'}.${r.priceRange ? ` Price range: ${r.priceRange}.` : ''} ${clip(r.shortDescription || r.description)}`,
    })
  }
  for (const d of destinations) {
    chunks.push({
      id: `destination:${d._id}`,
      type: 'destination',
      title: d.name,
      href: `/destinations/${d._id}`,
      coordinates: coords(d.location),
      boostText: `${d.name} ${d.region || ''}`,
      text: `Destination page on Visit Ethiopia: ${d.name} (${d.region || 'Ethiopia'}). ${clip(d.shortDescription || d.description)}${d.attractions?.length ? ` Attractions: ${d.attractions.slice(0, 8).join(', ')}.` : ''}`,
    })
  }
  return chunks
}

export async function loadCatalogChunks({ force = false } = {}) {
  if (!force && Date.now() - cache.at < TTL_MS) return cache.chunks
  try {
    const [hotels, tours, restaurants, destinations] = await Promise.all([
      findHotels({ limit: 100 }),
      findPublicTours({ limit: 100 }),
      findRestaurants({ limit: 100 }),
      findDestinations({ limit: 100 }),
    ])
    const active = (x) => !x.status || x.status === 'active'
    cache = {
      at: Date.now(),
      chunks: buildCatalogChunks({
        hotels,
        tours,
        restaurants: restaurants.filter(active),
        destinations: destinations.filter(active),
      }),
    }
  } catch (err) {
    // Catalogue unavailable: keep serving the curated knowledge base.
    console.warn('[assistant] catalogue load failed:', err.message)
    cache = { at: Date.now() - TTL_MS + 60000, chunks: cache.chunks }
  }
  return cache.chunks
}

export function resetCatalogCache() {
  cache = { at: 0, chunks: [] }
}
