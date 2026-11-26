/**
 * Idempotent LOCAL PostgreSQL catalog seed (Phase 2).
 *
 * Targets DATABASE_URL / DIRECT_URL only — NEVER MongoDB `DATABASE`.
 *
 * Usage:
 *   cd backend
 *   # ensure Docker Postgres is up and CATALOG env URLs set
 *   npm run prisma:seed
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import prisma from '../config/prisma.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env') })
}

const IDS = {
  owner: 'a10000000000000000000001',
  visitor: 'a10000000000000000000002',
  // Phase 3 identity seed
  admin: 'a10000000000000000000003',
  member: 'a10000000000000000000004',
  organization: 'a30000000000000000000001',
  ownerMembership: 'a30000000000000000000002',
  memberMembership: 'a30000000000000000000003',
  preference: 'a30000000000000000000004',
  providerVersion: 'a30000000000000000000005',
  approvalRequest: 'a30000000000000000000006',
  destination: 'a20000000000000000000001',
  tour: 'a20000000000000000000002',
  hotel: 'a20000000000000000000003',
  transport: 'a20000000000000000000004',
  restaurant: 'a20000000000000000000005',
  news: 'a20000000000000000000006',
  review: 'a20000000000000000000007',
}

/** Local-only seed password — never use in production. Override via SEED_LOCAL_PASSWORD. */
const SEED_PASSWORD =
  process.env.SEED_LOCAL_PASSWORD || 'Phase3LocalSeedOnly!x'

const IMG = {
  // Verified reachable HTTPS Unsplash URLs (local seed only)
  lalibela:
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  bus: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  news: 'https://images.unsplash.com/photo-1504512485720-7d83a16ee930?w=800',
}

function assertPostgresUrl(url, name) {
  if (!url) throw new Error(`${name} is required for prisma seed`)
  if (/^mongodb(\+srv)?:\/\//i.test(url)) {
    throw new Error(`${name} looks like MongoDB — refuse to seed`)
  }
}

async function upsertUser(id, data) {
  const existing = await prisma.user.findUnique({ where: { id } })
  const password = await bcrypt.hash(SEED_PASSWORD, 12)
  if (existing) {
    // Keep seed logins deterministic on re-run (local only).
    await prisma.user.update({
      where: { id },
      data: {
        password,
        active: true,
        isVerified: true,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      },
    })
    console.log(`[prisma:seed] REFRESH user ${data.email}`)
    return existing
  }
  const created = await prisma.user.create({
    data: {
      id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password,
      role: data.role,
      isVerified: data.isVerified !== false,
      active: data.active !== false,
    },
  })
  console.log(`[prisma:seed] CREATE user ${data.email}`)
  return created
}

async function main() {
  assertPostgresUrl(process.env.DATABASE_URL, 'DATABASE_URL')
  assertPostgresUrl(process.env.DIRECT_URL || process.env.DATABASE_URL, 'DIRECT_URL')

  console.log('[prisma:seed] LOCAL PostgreSQL catalog seed (idempotent)')

  await upsertUser(IDS.owner, {
    email: 'prisma.catalog.owner@visitethiopia.test',
    firstName: 'Prisma',
    lastName: 'Owner',
    role: 'tour_operator',
  })
  await upsertUser(IDS.visitor, {
    email: 'prisma.catalog.visitor@visitethiopia.test',
    firstName: 'Prisma',
    lastName: 'Visitor',
    role: 'user',
  })

  await prisma.destination.upsert({
    where: { id: IDS.destination },
    update: {
      coverImage: IMG.lalibela,
      images: [IMG.lalibela],
    },
    create: {
      id: IDS.destination,
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
      coverImage: IMG.lalibela,
      images: [IMG.lalibela],
      isFeatured: true,
      status: 'active',
    },
  })
  console.log('[prisma:seed] UPSERT destination Lalibela')

  await prisma.tour.upsert({
    where: { id: IDS.tour },
    update: {
      coverImage: IMG.lalibela,
      images: [IMG.lalibela],
    },
    create: {
      id: IDS.tour,
      title: 'Historic Northern Circuit',
      slug: 'historic-northern-circuit',
      description:
        'Explore Lalibela, Axum, and Gondar on a guided cultural tour.',
      shortDescription: 'Culture and history across northern Ethiopia',
      durationDays: 8,
      durationNights: 7,
      destinations: ['Lalibela', 'Axum', 'Gondar'],
      categories: ['cultural', 'historical'],
      difficulty: 'moderate',
      price: 25000,
      priceMinor: 2500000,
      currency: 'ETB',
      coverImage: IMG.lalibela,
      images: [IMG.lalibela],
      gallery: [],
      portfolioPhotos: [],
      maxGroupSize: 12,
      inclusions: ['Guide', 'Breakfast'],
      exclusions: ['Flights'],
      policies: {},
      packages: [
        {
          key: 'normal',
          name: 'Standard',
          priceMinor: 2500000,
          currency: 'ETB',
          active: true,
        },
      ],
      itinerary: [
        { day: 1, title: 'Arrive Addis', description: 'Briefing' },
        { day: 2, title: 'Fly to Lalibela', description: 'Rock churches' },
      ],
      createdById: IDS.owner,
      organizationId: null,
      secretTour: false,
      averageRating: 4.5,
      reviewCount: 1,
      isFeatured: true,
      status: 'active',
    },
  })
  console.log('[prisma:seed] UPSERT tour Historic Northern Circuit')

  await prisma.destinationTour.upsert({
    where: {
      destinationId_tourId: {
        destinationId: IDS.destination,
        tourId: IDS.tour,
      },
    },
    update: {},
    create: { destinationId: IDS.destination, tourId: IDS.tour },
  })

  await prisma.hotel.upsert({
    where: { id: IDS.hotel },
    update: {
      coverImage: IMG.hotel,
      images: [IMG.hotel],
    },
    create: {
      id: IDS.hotel,
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
      coverImage: IMG.hotel,
      images: [IMG.hotel],
      contact: { phone: '+251911000000', email: 'lodge@example.com' },
      policies: {},
      createdById: IDS.owner,
      organizationId: null,
      averageRating: 4.2,
      isFeatured: true,
      status: 'active',
    },
  })
  console.log('[prisma:seed] UPSERT hotel Mountain View Lodge')

  await prisma.destinationHotel.upsert({
    where: {
      destinationId_hotelId: {
        destinationId: IDS.destination,
        hotelId: IDS.hotel,
      },
    },
    update: {},
    create: { destinationId: IDS.destination, hotelId: IDS.hotel },
  })

  await prisma.transport.upsert({
    where: { id: IDS.transport },
    update: {
      vehicleDetails: {
        model: 'Coach X1',
        capacity: 40,
        images: [IMG.bus],
      },
    },
    create: {
      id: IDS.transport,
      name: 'Addis Express Shuttle',
      description: 'Comfortable coach service between major cities.',
      type: 'bus',
      routes: [
        {
          key: 'addis-ababa-bahir-dar-07-00',
          from: 'Addis Ababa',
          to: 'Bahir Dar',
          departureTime: '07:00',
          arrivalTime: '15:00',
          duration: '8h',
          price: 800,
          priceMinor: 80000,
          currency: 'ETB',
          availableSeats: 40,
          active: true,
        },
      ],
      vehicleDetails: {
        model: 'Coach X1',
        capacity: 40,
        images: [IMG.bus],
      },
      contact: { phone: '+251911111111', email: 'transport@example.com' },
      createdById: IDS.owner,
      organizationId: null,
      averageRating: 4.0,
      status: 'active',
    },
  })
  console.log('[prisma:seed] UPSERT transport Addis Express Shuttle')

  await prisma.restaurant.upsert({
    where: { id: IDS.restaurant },
    update: {
      coverImage: IMG.food,
      images: [IMG.food],
    },
    create: {
      id: IDS.restaurant,
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
      coverImage: IMG.food,
      images: [IMG.food],
      contact: { phone: '+251922222222', email: 'injera@example.com' },
      menu: [
        {
          category: 'Mains',
          items: [
            { name: 'Doro Wat', description: 'Chicken stew', price: 450 },
          ],
        },
      ],
      openingHours: {},
      createdById: IDS.owner,
      averageRating: 4.3,
      isFeatured: true,
      status: 'active',
    },
  })
  console.log('[prisma:seed] UPSERT restaurant Injera House')

  await prisma.news.upsert({
    where: { id: IDS.news },
    update: {
      coverImage: IMG.news,
    },
    create: {
      id: IDS.news,
      title: 'New Northern Circuit Dates Announced',
      summary: 'Book early for the dry season.',
      content:
        'Full article content about upcoming tour dates and tips for travelers.',
      coverImage: IMG.news,
      category: 'tourism',
      tags: ['tours', 'north'],
      authorId: IDS.owner,
      isFeatured: true,
      status: 'published',
      views: 0,
    },
  })
  console.log('[prisma:seed] UPSERT news')

  await prisma.review.upsert({
    where: { id: IDS.review },
    update: {},
    create: {
      id: IDS.review,
      userId: IDS.visitor,
      itemType: 'tour',
      itemId: IDS.tour,
      rating: 5,
      title: 'Amazing experience',
      comment: 'Loved every day of the tour.',
      status: 'approved',
      images: [],
    },
  })
  console.log('[prisma:seed] UPSERT review')

  // --- Phase 3 identity / marketplace seed ---
  await upsertUser(IDS.admin, {
    email: 'prisma.admin@visitethiopia.test',
    firstName: 'Prisma',
    lastName: 'Admin',
    role: 'admin',
  })
  await upsertUser(IDS.member, {
    email: 'prisma.member@visitethiopia.test',
    firstName: 'Prisma',
    lastName: 'Member',
    role: 'user',
  })

  const verification = {
    legalName: 'Prisma Seed Travel PLC',
    registrationNumber: 'SEED-REG-001',
    responsiblePerson: {
      name: 'Seed Owner',
      phone: '+251911000000',
      email: 'prisma.catalog.owner@visitethiopia.test',
    },
    businessDocuments: [
      {
        type: 'business_license',
        url: 'https://example.com/seed-license.pdf',
        status: 'uploaded',
      },
    ],
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { id: IDS.organization },
  })
  if (!existingOrg) {
    await prisma.organization.create({
      data: {
        id: IDS.organization,
        slug: 'prisma-seed-travel',
        name: 'Prisma Seed Travel',
        legalName: 'Prisma Seed Travel PLC',
        providerTypes: ['travel_company'],
        description: 'Local Prisma seed organization (not production).',
        shortDescription: 'Seed travel company',
        verification,
        ownerUserId: IDS.owner,
        visibility: 'private',
        approvalStatus: 'draft',
        latestVersionId: IDS.providerVersion,
      },
    })
    console.log('[prisma:seed] CREATE organization')
  } else {
    console.log('[prisma:seed] SKIP organization')
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: IDS.organization,
        userId: IDS.owner,
      },
    },
    update: {},
    create: {
      id: IDS.ownerMembership,
      organizationId: IDS.organization,
      userId: IDS.owner,
      orgRole: 'owner',
      permissions: ['org:manage', 'tours:manage', 'bookings:manage'],
      membershipRoles: ['tour_operator'],
      status: 'active',
    },
  })
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: IDS.organization,
        userId: IDS.member,
      },
    },
    update: {},
    create: {
      id: IDS.memberMembership,
      organizationId: IDS.organization,
      userId: IDS.member,
      orgRole: 'staff',
      permissions: ['tours:read'],
      membershipRoles: ['tour_operator'],
      status: 'active',
    },
  })
  console.log('[prisma:seed] UPSERT organization members')

  await prisma.userOrganizationPreference.upsert({
    where: { userId: IDS.owner },
    update: { activeOrganizationId: IDS.organization },
    create: {
      id: IDS.preference,
      userId: IDS.owner,
      activeOrganizationId: IDS.organization,
    },
  })
  console.log('[prisma:seed] UPSERT org preference')

  const snapshot = {
    name: 'Prisma Seed Travel',
    legalName: 'Prisma Seed Travel PLC',
    providerTypes: ['travel_company'],
    logo: null,
    coverImage: null,
    gallery: [],
    portfolioPhotos: [],
    description: 'Local Prisma seed organization (not production).',
    shortDescription: 'Seed travel company',
    uniqueSellingPoints: [],
    services: [],
    yearsInBusiness: 1,
    location: { city: 'Addis Ababa', country: 'Ethiopia' },
    contact: { email: 'prisma.catalog.owner@visitethiopia.test' },
    proposedSlug: 'prisma-seed-travel',
  }

  await prisma.providerVersion.upsert({
    where: { id: IDS.providerVersion },
    update: {
      status: 'approved',
      snapshot,
      verificationSnapshot: verification,
      approvedAt: new Date(),
      approvedById: IDS.admin,
    },
    create: {
      id: IDS.providerVersion,
      organizationId: IDS.organization,
      versionNumber: 1,
      status: 'approved',
      snapshot,
      verificationSnapshot: verification,
      approvedAt: new Date(),
      approvedById: IDS.admin,
    },
  })
  console.log('[prisma:seed] UPSERT provider version (approved)')

  // Promote organization to public marketplace (local seed only)
  await prisma.organization.update({
    where: { id: IDS.organization },
    data: {
      approvalStatus: 'approved',
      visibility: 'public',
      approvedVersionId: IDS.providerVersion,
      latestVersionId: IDS.providerVersion,
      name: 'Prisma Seed Travel',
    },
  })
  console.log('[prisma:seed] PROMOTE organization to approved/public')

  await prisma.approvalRequest.upsert({
    where: { id: IDS.approvalRequest },
    update: {
      status: 'approved',
      reviewedById: IDS.admin,
      reviewedAt: new Date(),
    },
    create: {
      id: IDS.approvalRequest,
      organizationId: IDS.organization,
      providerVersionId: IDS.providerVersion,
      requestType: 'initial_approval',
      status: 'approved',
      submittedById: IDS.owner,
      submittedAt: new Date(),
      reviewedById: IDS.admin,
      reviewedAt: new Date(),
      verificationChecklist: [],
      providerTypes: ['travel_company'],
      changedFields: [],
      requiresReapproval: false,
    },
  })
  console.log('[prisma:seed] UPSERT approval request (approved)')

  // Org-owned published tour + open departure for booking flows
  const orgTourId = 'a20000000000000000000008'
  const departureId = 'a20000000000000000000009'
  await prisma.tour.upsert({
    where: { id: orgTourId },
    update: {
      coverImage: IMG.lalibela,
      images: [IMG.lalibela],
    },
    create: {
      id: orgTourId,
      title: 'Prisma Seed Org Northern Circuit',
      slug: 'prisma-seed-org-northern-circuit',
      description:
        'Organization-owned seed tour for local Prisma booking development.',
      shortDescription: 'Org seed tour',
      durationDays: 5,
      durationNights: 4,
      destinations: ['Lalibela'],
      difficulty: 'moderate',
      price: 1500,
      priceMinor: 150000,
      currency: 'ETB',
      coverImage: IMG.lalibela,
      images: [IMG.lalibela],
      maxGroupSize: 12,
      packages: [
        {
          key: 'standard',
          name: 'Standard',
          priceMinor: 150000,
          currency: 'ETB',
          active: true,
        },
      ],
      createdById: IDS.owner,
      organizationId: IDS.organization,
      status: 'published',
      publishedAt: new Date(),
      secretTour: false,
      isFeatured: true,
    },
  })
  console.log('[prisma:seed] UPSERT org published tour')

  await prisma.tourDeparture.upsert({
    where: { id: departureId },
    update: {
      status: 'open',
      availableSpots: 10,
      capacity: 10,
      departureDate: new Date(Date.now() + 14 * 86400000),
      notes: 'Phase 5 seed departure',
    },
    create: {
      id: departureId,
      tourId: orgTourId,
      organizationId: IDS.organization,
      departureDate: new Date(Date.now() + 14 * 86400000),
      capacity: 10,
      availableSpots: 10,
      status: 'open',
      packages: [
        {
          key: 'standard',
          priceMinor: 150000,
          currency: 'ETB',
          active: true,
        },
      ],
      notes: 'Phase 5 seed departure',
    },
  })
  console.log('[prisma:seed] UPSERT open departure')

  console.log('[prisma:seed] done')
  console.log(
    `[prisma:seed] Local password for seed users: set SEED_LOCAL_PASSWORD or default Phase3LocalSeedOnly!x`
  )
  console.log(
    '[prisma:seed] Dev logins (local only): prisma.admin@visitethiopia.test / prisma.catalog.owner@visitethiopia.test / prisma.catalog.visitor@visitethiopia.test'
  )
}

main()
  .catch((err) => {
    console.error('[prisma:seed] FAILED:', err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
