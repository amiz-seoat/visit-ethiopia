/**
 * Idempotent production marketplace seed (legacy public content).
 *
 * Usage:
 *   DATABASE=... node scripts/seedProductionMarketplace.js --dry-run
 *   DATABASE=... node scripts/seedProductionMarketplace.js
 *
 * - Never drops or deleteMany's collections
 * - Never overwrites existing documents (skip if stable key exists)
 * - Uses absolute HTTPS Unsplash image URLs
 * - Seeds organizationId: null + status active/published for public API visibility
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes('--dry-run')

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env') })
}

const SEED_OWNER_EMAIL = 'marketplace.seed.owner@visitethiopia.test'
const SEED_VISITOR_EMAIL = 'marketplace.seed.visitor@visitethiopia.test'

function maskDatabaseUri(uri) {
  if (!uri) return '[missing]'
  return String(uri).replace(/(mongodb(?:\+srv)?:\/\/)([^@/]+)@/i, '$1***@')
}

function assertNotMemoryUri(uri) {
  const memoryUriFile = path.join(__dirname, '..', '.memory-db-uri')
  if (fs.existsSync(memoryUriFile)) {
    const memoryUri = fs.readFileSync(memoryUriFile, 'utf8').trim()
    if (memoryUri && uri === memoryUri) {
      throw new Error(
        'Refusing to run against MongoMemoryServer URI from .memory-db-uri'
      )
    }
  }
  if (/memory|mongo-mem/i.test(uri)) {
    throw new Error('Refusing to run against a memory-style MongoDB URI')
  }
}

function assertHttpsImage(url, label) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw new Error(`Image URL for ${label} must be absolute https: ${url}`)
  }
}

const summary = {
  created: [],
  skipped: [],
  linked: [],
}

function noteCreate(kind, key) {
  summary.created.push(`${kind}:${key}`)
  console.log(`[seed] CREATE ${kind} key=${key}`)
}

function noteSkip(kind, key, id) {
  summary.skipped.push(`${kind}:${key}`)
  console.log(`[seed] SKIP ${kind} key=${key} existing=${id}`)
}

async function ensureUser(User, { email, role, firstName, lastName }) {
  const existing = await User.findOne({ email })
  if (existing) {
    noteSkip('user', email, existing._id)
    return existing
  }
  if (dryRun) {
    noteCreate('user', email)
    return { _id: new mongoose.Types.ObjectId(), email, __dryRun: true }
  }
  const password = crypto.randomBytes(24).toString('base64url')
  const user = await User.create({
    FirstName: firstName,
    LastName: lastName,
    email,
    password,
    passwordConfirm: password,
    role,
    isVerified: true,
  })
  noteCreate('user', email)
  return user
}

async function ensureByQuery(Model, kind, key, query, payload) {
  const existing = await Model.findOne(query).select('_id')
  if (existing) {
    noteSkip(kind, key, existing._id)
    return existing
  }
  if (dryRun) {
    noteCreate(kind, key)
    return { _id: new mongoose.Types.ObjectId(), ...payload, __dryRun: true }
  }
  const created = await Model.create(payload)
  noteCreate(kind, key)
  return created
}

async function main() {
  const uri = process.env.DATABASE || process.env.MONGO_URI
  if (process.env.NODE_ENV === 'production' && !uri) {
    throw new Error('NODE_ENV=production requires DATABASE (or MONGO_URI)')
  }
  if (!uri) {
    throw new Error('DATABASE (or MONGO_URI) is required')
  }
  assertNotMemoryUri(uri)

  console.log(`[seedProductionMarketplace] dryRun=${dryRun}`)
  console.log(`[seedProductionMarketplace] target=${maskDatabaseUri(uri)}`)

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })

  const User = (await import('../models/User.js')).default
  const Destination = (await import('../models/Destination.js')).default
  const Tour = (await import('../models/Tour.js')).default
  const Hotel = (await import('../models/Hotel.js')).default
  const Transport = (await import('../models/Transport.js')).default
  const Restaurant = (await import('../models/Restaurants.js')).default
  const News = (await import('../models/News.js')).default
  const Review = (await import('../models/Review.js')).default

  const owner = await ensureUser(User, {
    email: SEED_OWNER_EMAIL,
    role: 'tour_operator',
    firstName: 'Marketplace',
    lastName: 'SeedOwner',
  })
  const visitor = await ensureUser(User, {
    email: SEED_VISITOR_EMAIL,
    role: 'user',
    firstName: 'Demo',
    lastName: 'Visitor',
  })

  const destinationPayload = {
    name: 'Lalibela',
    description:
      'Rock-hewn churches of Lalibela, a UNESCO World Heritage site.',
    shortDescription: 'Ancient rock churches',
    region: 'Amhara',
    location: {
      coordinates: { lat: 12.0317, lng: 39.0476 },
      address: 'Lalibela, Ethiopia',
    },
    attractions: ['Bet Giyorgis', 'Bet Medhane Alem'],
    coverImage:
      'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
    images: [
      'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
    ],
    isFeatured: true,
    status: 'active',
  }
  assertHttpsImage(destinationPayload.coverImage, 'destination')

  const destination = await ensureByQuery(
    Destination,
    'destination',
    destinationPayload.name,
    { name: destinationPayload.name },
    destinationPayload
  )

  const tourPayload = {
    title: 'Historic Northern Circuit',
    description:
      'Explore Lalibela, Axum, and Gondar on a guided cultural tour.',
    shortDescription: 'Culture and history across northern Ethiopia',
    duration: { days: 8, nights: 7 },
    destinations: ['Lalibela', 'Axum', 'Gondar'],
    categories: ['cultural', 'historical'],
    difficulty: 'moderate',
    price: 25000,
    discount: 0,
    coverImage:
      'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
    images: [
      'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
    ],
    availableDates: [
      new Date(Date.now() + 14 * 86400000),
      new Date(Date.now() + 30 * 86400000),
    ],
    maxGroupSize: 12,
    inclusions: ['Guide', 'Breakfast'],
    exclusions: ['Flights'],
    itinerary: [
      {
        day: 1,
        title: 'Arrive Addis',
        description: 'Airport transfer and briefing',
      },
      {
        day: 2,
        title: 'Fly to Lalibela',
        description: 'Visit rock churches',
      },
    ],
    createdBy: owner._id,
    organizationId: null,
    averageRating: 4.5,
    isFeatured: true,
    status: 'active',
    secretTour: false,
  }
  assertHttpsImage(tourPayload.coverImage, 'tour')

  const tour = await ensureByQuery(
    Tour,
    'tour',
    tourPayload.title,
    { title: tourPayload.title, organizationId: null },
    tourPayload
  )

  const hotelPayload = {
    name: 'Mountain View Lodge',
    description: 'Comfortable lodge near the churches.',
    shortDescription: 'Scenic lodge in Lalibela',
    location: {
      address: 'Near Main Street',
      city: 'Lalibela',
      region: 'Amhara',
      coordinates: { lat: 12.03, lng: 39.04 },
    },
    stars: 4,
    amenities: ['WiFi', 'Restaurant'],
    roomTypes: [
      {
        type: 'Standard',
        description: 'Double room',
        price: 3500,
        capacity: 2,
        availableRooms: 8,
      },
    ],
    coverImage:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    contact: { phone: '+251911000000', email: 'lodge@example.com' },
    createdBy: owner._id,
    organizationId: null,
    averageRating: 4.2,
    isFeatured: true,
    status: 'active',
  }
  assertHttpsImage(hotelPayload.coverImage, 'hotel')

  const hotel = await ensureByQuery(
    Hotel,
    'hotel',
    `${hotelPayload.name}|${hotelPayload.location.city}`,
    { name: hotelPayload.name, 'location.city': hotelPayload.location.city },
    hotelPayload
  )

  const transportPayload = {
    name: 'Addis Express Shuttle',
    description: 'Comfortable coach service between major cities.',
    type: 'bus',
    routes: [
      {
        from: 'Addis Ababa',
        to: 'Bahir Dar',
        departureTime: '07:00',
        arrivalTime: '15:00',
        duration: '8h',
        price: 800,
        availableSeats: 40,
      },
    ],
    vehicleDetails: {
      model: 'Coach X1',
      capacity: 40,
      images: [
        'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800',
      ],
    },
    contact: { phone: '+251911111111', email: 'transport@example.com' },
    createdBy: owner._id,
    organizationId: null,
    averageRating: 4.0,
    status: 'active',
  }

  const transport = await ensureByQuery(
    Transport,
    'transport',
    transportPayload.name,
    { name: transportPayload.name, organizationId: null },
    transportPayload
  )

  const restaurantPayload = {
    name: 'Injera House',
    description: 'Traditional Ethiopian cuisine.',
    shortDescription: 'Authentic local food',
    cuisineType: ['Ethiopian'],
    location: {
      address: 'Bole Road',
      city: 'Addis Ababa',
      region: 'Addis Ababa',
    },
    priceRange: '$$',
    coverImage:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    contact: { phone: '+251922222222', email: 'injera@example.com' },
    menu: [
      {
        category: 'Mains',
        items: [
          {
            name: 'Doro Wat',
            description: 'Chicken stew',
            price: 450,
          },
        ],
      },
    ],
    createdBy: owner._id,
    averageRating: 4.3,
    isFeatured: true,
    status: 'active',
  }
  assertHttpsImage(restaurantPayload.coverImage, 'restaurant')

  const restaurant = await ensureByQuery(
    Restaurant,
    'restaurant',
    restaurantPayload.name,
    { name: restaurantPayload.name },
    restaurantPayload
  )

  const newsPayload = {
    title: 'New Northern Circuit Dates Announced',
    summary: 'Book early for the dry season.',
    content:
      'Full article content about upcoming tour dates and tips for travelers.',
    coverImage:
      'https://images.unsplash.com/photo-1504512485720-7d83a16ee930?w=800',
    author: owner._id,
    category: 'tourism',
    tags: ['tours', 'north'],
    isFeatured: true,
    status: 'published',
  }
  assertHttpsImage(newsPayload.coverImage, 'news')

  const news = await ensureByQuery(
    News,
    'news',
    newsPayload.title,
    { title: newsPayload.title },
    newsPayload
  )

  // Link destination ↔ tour without wiping existing arrays
  if (destination.__dryRun || tour.__dryRun) {
    summary.linked.push('destination.tours')
    console.log('[seed] DRY-RUN would $addToSet destination.tours ← tour')
  } else {
    const destDoc = await Destination.findById(destination._id).select('tours')
    if (depDocHasTour(destDoc, tour._id)) {
      console.log('[seed] SKIP destination.tours link (already present)')
    } else if (dryRun) {
      summary.linked.push('destination.tours')
      console.log('[seed] DRY-RUN would $addToSet destination.tours')
    } else {
      await Destination.updateOne(
        { _id: destination._id },
        { $addToSet: { tours: tour._id } }
      )
      summary.linked.push('destination.tours')
      console.log('[seed] LINK destination.tours ← tour')
    }
  }

  // Review only when both sides are real (or dry-run with planned ids)
  const reviewQuery = {
    user: visitor._id,
    itemType: 'tour',
    itemId: tour._id,
  }
  const existingReview = visitor.__dryRun
    ? null
    : await Review.findOne(reviewQuery)
  if (existingReview) {
    noteSkip('review', 'visitor→tour', existingReview._id)
  } else if (dryRun) {
    noteCreate('review', 'visitor→tour')
  } else if (!visitor.__dryRun && !tour.__dryRun) {
    await Review.create({
      user: visitor._id,
      itemType: 'tour',
      itemId: tour._id,
      rating: 5,
      title: 'Amazing experience',
      comment: 'Loved every day of the tour.',
      status: 'approved',
    })
    noteCreate('review', 'visitor→tour')
  }

  void hotel
  void transport
  void restaurant
  void news

  console.log('\n=== SEED SUMMARY ===')
  console.log(`created=${summary.created.length}`)
  summary.created.forEach((x) => console.log(`  + ${x}`))
  console.log(`skipped=${summary.skipped.length}`)
  summary.skipped.forEach((x) => console.log(`  = ${x}`))
  console.log(`linked=${summary.linked.length}`)
  summary.linked.forEach((x) => console.log(`  ~ ${x}`))
  console.log(
    dryRun
      ? '\nDry-run complete — no writes were performed.'
      : '\nSeed complete — existing documents were not overwritten.'
  )

  await mongoose.disconnect()
}

function depDocHasTour(destDoc, tourId) {
  if (!destDoc?.tours?.length) return false
  return destDoc.tours.some((t) => String(t._id || t) === String(tourId))
}

main().catch(async (err) => {
  console.error('[seedProductionMarketplace] FAILED:', err.message || err)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
