/**
 * Demo marketplace seed for a PRISMA / PostgreSQL deployment (production-safe).
 *
 * - Additive and idempotent: fixed IDs, upserts that never overwrite existing
 *   rows, inventory created with skipDuplicates. Never deletes anything.
 * - No hardcoded passwords. Accounts are created only when the matching env
 *   vars are present:
 *     ADMIN_EMAIL + ADMIN_PASSWORD     → platform admin (your private login)
 *     DEMO_PASSWORD                    → demo traveler + demo provider accounts
 *       (demo.traveler@example.com, demo.provider@example.com — example.com is
 *        an IANA-reserved domain, so these can never receive real mail)
 * - Images: Wikimedia Commons (see docs/IMAGE_CREDITS.md) and Unsplash.
 *
 * Usage (point DATABASE_URL/DIRECT_URL at the target DB explicitly):
 *   node scripts/seedDemoMarketplace.js --dry-run
 *   node scripts/seedDemoMarketplace.js
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '..', 'config.env'), quiet: true })
}
const dryRun = process.argv.includes('--dry-run')

const { default: prisma } = await import('../config/prisma.js')
const { hashPassword } = await import('../services/passwordService.js')
const { permissionsForProviderTypes } = await import('../utils/organizationPermissions.js')

// Deterministic 24-hex IDs (ObjectId-compatible) for idempotency.
const id = (n) => `de30${String(n).padStart(20, '0')}`

const WM = 'https://upload.wikimedia.org/wikipedia/commons'
const IMG = {
  lalibela: `${WM}/thumb/a/a4/Bete_Giyorgis_01.jpg/1280px-Bete_Giyorgis_01.jpg`,
  lalibela2: `${WM}/1/17/Bete_Giyorgis_Lalibela_Ethiopia.jpg`,
  simien: `${WM}/f/f3/Gelada_Baboons_in_the_Simien_Mountains.jpg`,
  simien2: `${WM}/f/fe/Troop_of_Geladas_in_the_Simien_Mountains.jpg`,
  gondar: `${WM}/thumb/5/5b/Fasilides_Palace_02.jpg/1280px-Fasilides_Palace_02.jpg`,
  tana: `${WM}/thumb/5/58/ET_Amhara_asv2018-02_img088_Lake_Tana_at_Bahir_Dar.jpg/1280px-ET_Amhara_asv2018-02_img088_Lake_Tana_at_Bahir_Dar.jpg`,
  tanaMonastery: `${WM}/thumb/b/b1/Debre_Mariam_Monastery_on_Lake_Tana_Ethiopia_%281%29.jpg/1280px-Debre_Mariam_Monastery_on_Lake_Tana_Ethiopia_%281%29.jpg`,
  blueNile: `${WM}/thumb/2/27/Blue_Nile_Falls-03%2C_by_CT_Snow.jpg/1280px-Blue_Nile_Falls-03%2C_by_CT_Snow.jpg`,
  harar: `${WM}/thumb/d/d6/Town_of_Harar_with_Citywall.jpg/1280px-Town_of_Harar_with_Citywall.jpg`,
  hotel1: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
  hotel2: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200',
  hotel3: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
  bus: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=1200',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200',
}

const log = (...a) => console.log('[demo-seed]', ...a)
const DAY = 86400000
const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')

function assertTarget() {
  const url = process.env.DATABASE_URL || ''
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('DATABASE_URL must be a PostgreSQL URL')
  const host = url.replace(/^[^@]*@/, '').split(/[/:?]/)[0]
  log(`target host: ${host}${dryRun ? ' (dry run — no writes)' : ''}`)
}

async function upsertUser(userId, { email, firstName, lastName, role, password }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    log(`SKIP user ${email} (exists)`)
    return existing.id
  }
  if (dryRun) {
    log(`WOULD CREATE user ${email} (${role})`)
    return userId
  }
  await prisma.user.create({
    data: {
      id: userId,
      email,
      firstName,
      lastName,
      role,
      isVerified: true,
      active: true,
      password: await hashPassword(password),
    },
  })
  log(`CREATE user ${email} (${role})`)
  return userId
}

async function upsert(model, where, create, label, naturalKey = null) {
  const existing =
    (await prisma[model].findUnique({ where })) ||
    (naturalKey ? await prisma[model].findFirst({ where: naturalKey }) : null)
  if (existing) return existing
  if (dryRun) {
    log(`WOULD CREATE ${model} ${label}`)
    return create
  }
  const row = await prisma[model].create({ data: create })
  log(`CREATE ${model} ${label}`)
  return row
}

async function approvedOrganization({ orgId, versionId, requestId, ownerId, adminId, slug, name, providerTypes, membershipRoles, description, shortDescription, coverImage, city, services, usps, years }) {
  const verification = {
    legalName: `${name} PLC`,
    registrationNumber: `DEMO-${slug.toUpperCase()}`,
    responsiblePerson: { name: 'Demo Provider', phone: '+251900000000', email: 'demo.provider@example.com' },
    businessDocuments: [],
    note: 'Demo organization for the Visit Ethiopia portfolio deployment.',
  }
  const snapshot = {
    name,
    legalName: `${name} PLC`,
    providerTypes,
    logo: null,
    coverImage,
    gallery: [],
    portfolioPhotos: [],
    description,
    shortDescription,
    uniqueSellingPoints: usps,
    services,
    yearsInBusiness: years,
    location: { city, country: 'Ethiopia' },
    contact: { email: 'demo.provider@example.com', phone: '+251900000000' },
    proposedSlug: slug,
  }
  await upsert('organization', { id: orgId }, {
    id: orgId,
    slug,
    name,
    legalName: `${name} PLC`,
    providerTypes,
    description,
    shortDescription,
    coverImage,
    uniqueSellingPoints: usps,
    services,
    yearsInBusiness: years,
    location: { city, country: 'Ethiopia' },
    contact: { email: 'demo.provider@example.com', phone: '+251900000000' },
    verification,
    ownerUserId: ownerId,
    visibility: 'private',
    approvalStatus: 'draft',
  }, name, { slug })
  await upsert('organizationMember', { organizationId_userId: { organizationId: orgId, userId: ownerId } }, {
    id: id(9000 + Number(orgId.slice(-3))),
    organizationId: orgId,
    userId: ownerId,
    orgRole: 'owner',
    permissions: permissionsForProviderTypes(providerTypes),
    membershipRoles,
    status: 'active',
  }, `owner membership ${slug}`)
  await upsert('providerVersion', { id: versionId }, {
    id: versionId,
    organizationId: orgId,
    versionNumber: 1,
    status: 'approved',
    snapshot,
    verificationSnapshot: verification,
    changedFields: [],
    requiresReapproval: false,
    approvedAt: new Date(),
    approvedById: adminId,
  }, `approved version ${slug}`)
  await upsert('approvalRequest', { id: requestId }, {
    id: requestId,
    organizationId: orgId,
    providerVersionId: versionId,
    requestType: 'initial_approval',
    status: 'approved',
    submittedById: ownerId,
    submittedAt: new Date(),
    reviewedById: adminId,
    reviewedAt: new Date(),
    verificationChecklist: [],
    providerTypes,
    changedFields: [],
    requiresReapproval: false,
  }, `approval request ${slug}`)
  if (!dryRun) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (org && !org.approvedVersionId) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { approvalStatus: 'approved', visibility: 'public', approvedVersionId: versionId, latestVersionId: versionId },
      })
      log(`APPROVE organization ${slug}`)
    }
  }
}

async function main() {
  assertTarget()
  const demoPassword = process.env.DEMO_PASSWORD
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!demoPassword || demoPassword.length < 10) throw new Error('DEMO_PASSWORD (min 10 chars) is required')
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (min 12 chars) are required')
  }

  const adminId = await upsertUser(id(1), { email: adminEmail.toLowerCase(), firstName: 'Platform', lastName: 'Admin', role: 'admin', password: adminPassword })
  if (!dryRun) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    if (admin && admin.role !== 'admin') throw new Error(`${adminEmail} exists but is not an admin — refusing to continue`)
  }
  const providerId = await upsertUser(id(2), { email: 'demo.provider@example.com', firstName: 'Demo', lastName: 'Provider', role: 'tour_operator', password: demoPassword })
  const travelerId = await upsertUser(id(3), { email: 'demo.traveler@example.com', firstName: 'Demo', lastName: 'Traveler', role: 'user', password: demoPassword })

  // --- Destinations ------------------------------------------------------
  const destinations = [
    [101, 'Lalibela', 'Amhara', 12.0317, 39.0476, 'Eleven medieval monolithic churches carved from living rock — a UNESCO World Heritage site and one of the holiest places in Ethiopian Orthodox Christianity.', 'Rock-hewn churches of the 12th century', ['Bete Giyorgis', 'Bete Medhane Alem', 'Asheton Maryam Monastery'], [IMG.lalibela, IMG.lalibela2]],
    [102, 'Simien Mountains', 'Amhara', 13.1833, 38.0667, 'Dramatic escarpments, deep valleys and the endemic gelada monkey and Walia ibex. Trek to Ras Dashen, the highest peak in Ethiopia.', 'Trekking among geladas and jagged peaks', ['Ras Dashen', 'Chennek', 'Imet Gogo viewpoint'], [IMG.simien, IMG.simien2]],
    [103, 'Gondar', 'Amhara', 12.6075, 37.4592, 'The "Camelot of Africa": 17th-century castles of Fasil Ghebbi, Debre Birhan Selassie church and Fasilides\' Bath.', 'Royal castles of Fasil Ghebbi', ['Fasil Ghebbi', 'Debre Birhan Selassie', "Fasilides' Bath"], [IMG.gondar]],
    [104, 'Bahir Dar & Lake Tana', 'Amhara', 11.5936, 37.3908, 'Island monasteries on Ethiopia\'s largest lake and the thundering Blue Nile Falls (Tis Issat) nearby.', 'Lake monasteries and the Blue Nile Falls', ['Ura Kidane Mehret', 'Blue Nile Falls', 'Zege Peninsula'], [IMG.tana, IMG.tanaMonastery, IMG.blueNile]],
    [105, 'Harar', 'Harari', 9.3126, 42.1227, 'The walled city of Harar Jugol with 82 mosques, colourful alleys and the famous hyena feeding at dusk.', 'Historic walled city of the east', ['Harar Jugol', 'Hyena men', 'Rimbaud House'], [IMG.harar]],
  ]
  const destIdByName = {}
  for (const [n, name, region, lat, lng, description, shortDescription, attractions, images] of destinations) {
    const row = await upsert('destination', { id: id(n) }, {
      id: id(n), name, region, description, shortDescription, attractions,
      location: { coordinates: { lat, lng }, address: `${name}, Ethiopia` },
      coverImage: images[0], images, isFeatured: true, status: 'active',
    }, name, { name })
    destIdByName[name] = row.id
  }

  // --- Organizations -----------------------------------------------------
  const ORG_TRAVEL = id(201)
  const ORG_HOTEL = id(202)
  const ORG_BUS = id(203)
  await approvedOrganization({
    orgId: ORG_TRAVEL, versionId: id(211), requestId: id(221), ownerId: providerId, adminId,
    slug: 'abyssinia-trails', name: 'Abyssinia Trails', providerTypes: ['travel_company'], membershipRoles: ['tour_operator'],
    description: 'Small-group cultural and trekking tours across northern Ethiopia, led by licensed local guides.',
    shortDescription: 'Historic north & Simien trekking specialists', coverImage: IMG.lalibela, city: 'Addis Ababa',
    services: ['Guided tours', 'Trekking', 'Airport transfers'], usps: ['Licensed local guides', 'Small groups (max 12)'], years: 9,
  })
  await approvedOrganization({
    orgId: ORG_HOTEL, versionId: id(212), requestId: id(222), ownerId: providerId, adminId,
    slug: 'tana-lakeside-hotels', name: 'Tana Lakeside Hotels', providerTypes: ['hotel'], membershipRoles: ['hotel_manager'],
    description: 'Boutique hotels on the historic northern route — Bahir Dar, Gondar and Lalibela.',
    shortDescription: 'Boutique stays on the northern circuit', coverImage: IMG.hotel1, city: 'Bahir Dar',
    services: ['Accommodation', 'Restaurant', 'Boat trips'], usps: ['Lake-view rooms', 'Free airport shuttle'], years: 6,
  })
  await approvedOrganization({
    orgId: ORG_BUS, versionId: id(213), requestId: id(223), ownerId: providerId, adminId,
    slug: 'selam-coach-lines', name: 'Selam Coach Lines', providerTypes: ['tour_bus_provider'], membershipRoles: ['tour_bus_provider'],
    description: 'Comfortable intercity coaches between Addis Ababa and the main tourist hubs.',
    shortDescription: 'Intercity coaches from Addis Ababa', coverImage: IMG.bus, city: 'Addis Ababa',
    services: ['Intercity coach', 'Group charters'], usps: ['Reclining seats', 'Daily departures'], years: 12,
  })
  if (!dryRun) {
    await prisma.userOrganizationPreference.upsert({
      where: { userId: providerId },
      update: {},
      create: { id: id(301), userId: providerId, activeOrganizationId: ORG_TRAVEL },
    })
  }

  // --- Tours + departures ------------------------------------------------
  const tours = [
    [401, 'Historic Northern Circuit', 'historic-northern-circuit-8-days', 8, ['Lalibela', 'Gondar', 'Bahir Dar & Lake Tana'], ['historical', 'cultural', 'religious'], 'moderate', 3200000, IMG.lalibela, 'Eight days through Ethiopia\'s historic route: Lake Tana monasteries, the Blue Nile Falls, the castles of Gondar and the rock churches of Lalibela.', [
      ['Addis Ababa → Bahir Dar', 'Morning flight, afternoon boat trip to the Zege Peninsula monasteries.'],
      ['Blue Nile Falls', 'Hike to Tis Issat and the 17th-century Portuguese bridge.'],
      ['Gondar', 'Drive to Gondar; Fasil Ghebbi and Debre Birhan Selassie.'],
      ['Lalibela', 'Fly to Lalibela; northern group of churches.'],
    ], [[IMG.lalibela, IMG.gondar, IMG.tana]]],
    [402, 'Simien Mountains Trek', 'simien-mountains-trek-5-days', 5, ['Simien Mountains', 'Gondar'], ['adventure', 'nature'], 'challenging', 2100000, IMG.simien, 'Five-day camping trek from Sankaber to Chennek with scouts, cooks and mules — geladas, ibex and the escarpment views of a lifetime.', [
      ['Gondar → Sankaber', 'Drive to Debark, park registration, first camp.'],
      ['Sankaber → Geech', 'Jinbar waterfall viewpoint.'],
      ['Imet Gogo', 'Sunrise over the escarpment.'],
      ['Chennek', 'Walia ibex territory.'],
    ], [[IMG.simien, IMG.simien2]]],
    [403, 'Lalibela Weekend Pilgrimage', 'lalibela-weekend-3-days', 3, ['Lalibela'], ['religious', 'historical'], 'easy', 950000, IMG.lalibela2, 'A short, unhurried visit to all eleven rock-hewn churches with a priest-guide, plus Asheton Maryam monastery.', [
      ['Arrival', 'Northern church group at golden hour.'],
      ['Bete Giyorgis', 'Southern group and Bete Giyorgis.'],
      ['Asheton Maryam', 'Mule ride to the mountain monastery.'],
    ], [[IMG.lalibela2, IMG.lalibela]]],
    [404, 'Harar Cultural Discovery', 'harar-cultural-discovery-4-days', 4, ['Harar'], ['cultural', 'historical'], 'easy', 1250000, IMG.harar, 'Explore the walled city of Harar Jugol, its markets, traditional Harari houses and the nightly hyena feeding.', [
      ['Dire Dawa → Harar', 'Transfer and evening hyena feeding.'],
      ['Harar Jugol', 'Old city walking tour and Rimbaud House.'],
      ['Markets', 'Spice and camel markets.'],
    ], [[IMG.harar]]],
  ]
  let dep = 0
  for (const [n, title, slug, days, dests, categories, difficulty, priceMinor, cover, description, itinerary, [images]] of tours) {
    const tourId = id(n)
    await upsert('tour', { id: tourId }, {
      id: tourId, title, slug, description, shortDescription: description.split('.')[0],
      highlights: itinerary.map(([t]) => t), uniqueSellingPoints: ['Licensed local guide', 'Small group'],
      durationDays: days, durationNights: days - 1, destinations: dests, categories, difficulty,
      price: priceMinor / 100, priceMinor, currency: 'ETB', coverImage: cover, images, gallery: [], portfolioPhotos: [],
      maxGroupSize: 12, inclusions: ['Licensed guide', 'Accommodation', 'Ground transport', 'Entrance fees'],
      exclusions: ['International flights', 'Tips', 'Personal expenses'],
      policies: { cancellation: 'Free cancellation up to 48 hours before departure.' },
      packages: [
        { key: 'standard', name: 'Standard', priceMinor, currency: 'ETB', active: true },
        { key: 'comfort', name: 'Comfort (upgraded lodges)', priceMinor: Math.round(priceMinor * 1.35), currency: 'ETB', active: true },
      ],
      itinerary: itinerary.map(([t, d], i) => ({ day: i + 1, title: t, description: d })),
      createdById: providerId, organizationId: ORG_TRAVEL, secretTour: false,
      isFeatured: n <= 402, status: 'published', publishedAt: new Date(),
    }, title, { slug })
    if (!dryRun) {
      await prisma.destinationTour.createMany({
        data: dests.filter((d) => destIdByName[d]).map((d) => ({ destinationId: destIdByName[d], tourId })),
        skipDuplicates: true,
      })
    }
    // Departures every 14 days for ~4 months
    for (let k = 1; k <= 8; k++) {
      dep += 1
      const depId = id(5000 + dep)
      const start = new Date(today.getTime() + (7 + (n % 4) * 3 + (k - 1) * 14) * DAY)
      await upsert('tourDeparture', { id: depId }, {
        id: depId, tourId, organizationId: ORG_TRAVEL, departureDate: start,
        returnDate: new Date(start.getTime() + (days - 1) * DAY), capacity: 12, availableSpots: 12, status: 'open',
        packages: [
          { key: 'standard', priceMinor, currency: 'ETB', active: true },
          { key: 'comfort', priceMinor: Math.round(priceMinor * 1.35), currency: 'ETB', active: true },
        ],
        notes: '',
      }, `departure ${slug} #${k}`)
    }
  }

  // --- Hotels + daily inventory -----------------------------------------
  const hotels = [
    [601, 'Tana Lakeside Resort', 'Bahir Dar', 'Amhara', 11.5936, 37.3908, 4, IMG.hotel1, 104, [['standard', 'Standard Double', 2, 380000, 10], ['lakeview', 'Lake View Suite', 3, 620000, 4]]],
    [602, 'Fasil Heritage Hotel', 'Gondar', 'Amhara', 12.6075, 37.4592, 3, IMG.hotel2, 103, [['standard', 'Standard Twin', 2, 290000, 12], ['family', 'Family Room', 4, 480000, 3]]],
    [603, 'Roha Rock View Lodge', 'Lalibela', 'Amhara', 12.0317, 39.0476, 4, IMG.hotel3, 101, [['standard', 'Standard Double', 2, 420000, 8], ['deluxe', 'Deluxe Valley View', 2, 590000, 4]]],
  ]
  for (const [n, name, city, region, lat, lng, stars, cover, destN, rooms] of hotels) {
    const hotelId = id(n)
    await upsert('hotel', { id: hotelId }, {
      id: hotelId, name,
      description: `${name} offers comfortable rooms, a restaurant serving Ethiopian and international dishes, and easy access to ${city}'s main sights.`,
      shortDescription: `${stars}-star stay in ${city}`,
      location: { address: `${city} centre`, city, region, coordinates: { lat, lng } },
      stars, amenities: ['WiFi', 'Restaurant', 'Airport shuttle', 'Hot water', 'Parking'],
      roomTypes: rooms.map(([key, type, capacity, pm, count]) => ({
        key, type, name: type, description: `${type} for up to ${capacity} guests`, capacity,
        price: pm / 100, priceMinor: pm, currency: 'ETB', amenities: ['WiFi', 'Breakfast'], images: [], availableRooms: count, active: true,
      })),
      coverImage: cover, images: [cover], contact: { phone: '+251900000000', email: 'demo.provider@example.com' },
      policies: { checkIn: '14:00', checkOut: '11:00', cancellation: 'Free cancellation up to 48 hours before arrival.' },
      createdById: providerId, organizationId: ORG_HOTEL, isFeatured: true, status: 'active',
    }, name)
    if (!dryRun) {
      const destName = destinations.find((x) => x[0] === destN)?.[1]
      if (destIdByName[destName]) {
        await prisma.destinationHotel.createMany({ data: [{ destinationId: destIdByName[destName], hotelId }], skipDuplicates: true })
      }
      const inv = []
      for (let d = 0; d < 120; d++) {
        for (const [ri, [key, , , , count]] of rooms.entries()) {
          inv.push({ id: `de32${String(n).padStart(4, '0')}${String(ri).padStart(2, '0')}${String(d).padStart(14, '0')}`, hotelId, organizationId: ORG_HOTEL, roomTypeKey: key, date: new Date(today.getTime() + d * DAY), totalRooms: count, reservedRooms: 0, availableRooms: count, currency: 'ETB' })
        }
      }
      const r = await prisma.hotelDailyInventory.createMany({ data: inv, skipDuplicates: true })
      log(`inventory ${name}: +${r.count} room-days`)
    }
  }

  // --- Transport + route inventory --------------------------------------
  const routes = [
    ['addis-bahir-dar-0600', 'Addis Ababa', 'Bahir Dar', '06:00', '15:30', '9h 30m', 95000],
    ['addis-gondar-0530', 'Addis Ababa', 'Gondar', '05:30', '17:00', '11h 30m', 110000],
    ['bahir-dar-gondar-0800', 'Bahir Dar', 'Gondar', '08:00', '11:00', '3h', 35000],
  ]
  const transportId = id(701)
  await upsert('transport', { id: transportId }, {
    id: transportId, name: 'Selam Coach — Northern Routes', type: 'bus',
    description: 'Daily air-conditioned coaches with reclining seats, onboard water and luggage hold, connecting Addis Ababa with Bahir Dar and Gondar.',
    routes: routes.map(([key, from, to, departureTime, arrivalTime, duration, pm]) => ({ key, from, to, departureTime, arrivalTime, duration, price: pm / 100, priceMinor: pm, currency: 'ETB', availableSeats: 45, active: true })),
    vehicleDetails: { model: 'Higer KLQ6129 coach', capacity: 45, images: [IMG.bus] },
    contact: { phone: '+251900000000', email: 'demo.provider@example.com' },
    createdById: providerId, organizationId: ORG_BUS, status: 'active',
  }, 'Selam Coach — Northern Routes')
  if (!dryRun) {
    const inv = []
    for (let d = 1; d <= 90; d++) {
      routes.forEach(([key], ri) => {
        inv.push({ id: `de31${String(ri).padStart(4, '0')}${String(d).padStart(16, '0')}`, transportId, organizationId: ORG_BUS, routeKey: key, date: new Date(today.getTime() + d * DAY), totalSeats: 45, availableSeats: 45, reservedSeats: 0, currency: 'ETB' })
      })
    }
    const r = await prisma.transportRouteInventory.createMany({ data: inv, skipDuplicates: true })
    log(`transport inventory: +${r.count} route-days`)
  }

  // --- Restaurant, news, reviews ----------------------------------------
  await upsert('restaurant', { id: id(801) }, {
    id: id(801), name: 'Yod Abyssinia Cultural Restaurant (demo listing)',
    description: 'Traditional Ethiopian dishes served with live music and cultural dance in the evenings.',
    shortDescription: 'Injera, tibs and traditional music', cuisineType: ['Ethiopian'],
    location: { address: 'Bole', city: 'Addis Ababa', region: 'Addis Ababa' }, priceRange: '$$',
    coverImage: IMG.food, images: [IMG.food], contact: { phone: '+251900000000', email: 'demo.provider@example.com' },
    menu: [{ category: 'Mains', items: [{ name: 'Doro Wat', description: 'Spiced chicken stew', price: 650 }, { name: 'Special Kitfo', description: 'Minced beef with mitmita', price: 720 }] }],
    openingHours: {}, createdById: providerId, isFeatured: true, status: 'active',
  }, 'restaurant')
  await upsert('news', { id: id(901) }, {
    id: id(901), title: 'Timkat and Meskel: planning a festival trip to Ethiopia',
    summary: 'When to travel, where to stay and how to book departures around Ethiopia\'s most colourful celebrations.',
    content: 'Timkat (Epiphany, January 19) and Meskel (Finding of the True Cross, September 27) are the most spectacular festivals in the Ethiopian calendar. Gondar and Lalibela fill up early, so book accommodation and tour departures well ahead. This demo article is part of the Visit Ethiopia portfolio deployment.',
    coverImage: IMG.gondar, category: 'event', tags: ['festivals', 'timkat', 'meskel'],
    authorId: adminId, isFeatured: true, status: 'published', views: 0,
  }, 'news article')
  await upsert('review', { id: id(951) }, {
    id: id(951), userId: travelerId, itemType: 'tour', itemId: id(401), rating: 5,
    title: 'Well organised and great guides', comment: 'Demo review: the itinerary was well paced and the guide in Lalibela was excellent.',
    status: 'approved', images: [],
  }, 'review')

  log(dryRun ? 'dry run complete' : 'done')
}

main()
  .catch((err) => {
    console.error('[demo-seed] FAILED:', err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
