/**
 * Ownership / authorization security checks.
 * Usage: node scripts/ownership-security.js [baseUrl]
 */
const BASE = (process.argv[2] || 'http://localhost:4002/api/v1').replace(/\/$/, '')
const results = []

function ok(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5200',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function login(email, password) {
  const res = await req('POST', '/users/login', { body: { email, password } })
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed for ${email}: ${res.status}`)
  }
  return res.data.token
}

function pickId(list, titleContains) {
  const item = (list || []).find((x) =>
    (x.title || x.name || '').toLowerCase().includes(titleContains.toLowerCase())
  )
  return item?._id
}

async function run() {
  console.log(`\n=== Ownership security @ ${BASE} ===\n`)

  let opA, opB, hotelA, hotelB, trA, trB, customer, admin
  try {
    opA = await login('operator@visitethiopia.test', 'OperatorPass123!')
    opB = await login('operatorb@visitethiopia.test', 'OperatorBPass123!')
    hotelA = await login('hotelmgr@visitethiopia.test', 'HotelMgrPass123!')
    hotelB = await login('hotelmgrb@visitethiopia.test', 'HotelMgrBPass123!')
    trA = await login('transportmgr@visitethiopia.test', 'TransportMgrPass123!')
    trB = await login('transportmgrb@visitethiopia.test', 'TransportMgrBPass123!')
    customer = await login('customer@visitethiopia.test', 'CustomerPass123!')
    admin = await login('admin@visitethiopia.test', 'AdminPass123!')
    ok('All role logins')
  } catch (e) {
    fail('Role logins', e.message)
    return done()
  }

  const tours = await req('GET', '/tours?limit=50')
  const hotels = await req('GET', '/hotels?limit=50')
  const transports = await req('GET', '/transports?limit=50')
  const tourList = tours.data?.data?.data || tours.data?.data || []
  const hotelList = hotels.data?.data?.data || hotels.data?.data || []
  const transportList = transports.data?.data?.data || transports.data?.data || []

  const tourAId =
    pickId(tourList, 'Northern') ||
    pickId(tourList, 'Historic') ||
    tourList[0]?._id
  const tourBId =
    pickId(tourList, 'Operator B') ||
    pickId(tourList, 'Private Trek') ||
    tourList.find((t) => t._id !== tourAId)?._id
  const hotelAId =
    pickId(hotelList, 'Mountain') || hotelList[0]?._id
  const hotelBId =
    pickId(hotelList, 'Operator B') ||
    hotelList.find((h) => h._id !== hotelAId)?._id
  const transportAId =
    pickId(transportList, 'Addis Express') || transportList[0]?._id
  const transportBId =
    pickId(transportList, 'Manager B') ||
    transportList.find((t) => t._id !== transportAId)?._id

  if (!tourAId || !tourBId) {
    fail('Seed tours for ownership', `A=${tourAId} B=${tourBId}`)
  } else {
    ok('Found owned tours', `${tourAId} / ${tourBId}`)
  }

  // Operator A cannot patch Operator B tour
  if (tourBId) {
    const cross = await req('PATCH', `/tours/${tourBId}`, {
      token: opA,
      body: { title: 'Hacked by A' },
    })
    if (cross.status === 403) ok('Operator A cannot update Operator B tour')
    else fail('Operator A cannot update Operator B tour', `${cross.status}`)

    const del = await req('DELETE', `/tours/${tourBId}`, { token: opA })
    if (del.status === 403) ok('Operator A cannot delete Operator B tour')
    else fail('Operator A cannot delete Operator B tour', `${del.status}`)
  }

  // Operator A can update own tour
  if (tourAId) {
    const own = await req('PATCH', `/tours/${tourAId}`, {
      token: opA,
      body: { shortDescription: 'Updated by owner A' },
    })
    if (own.status === 200) ok('Operator A can update own tour')
    else fail('Operator A can update own tour', `${own.status} ${own.data?.message}`)
  }

  // Hotel manager cross-ownership
  if (hotelBId) {
    const cross = await req('PATCH', `/hotels/${hotelBId}`, {
      token: hotelA,
      body: { name: 'Hacked Hotel' },
    })
    if (cross.status === 403) ok('Hotel manager A cannot update Hotel B')
    else fail('Hotel manager A cannot update Hotel B', `${cross.status}`)
  }
  if (hotelAId) {
    const own = await req('PATCH', `/hotels/${hotelAId}`, {
      token: hotelA,
      body: { shortDescription: 'Updated by hotel mgr A' },
    })
    if (own.status === 200) ok('Hotel manager A can update own hotel')
    else fail('Hotel manager A can update own hotel', `${own.status}`)
  }

  // Transport cross-ownership
  if (transportBId) {
    const cross = await req('PATCH', `/transports/${transportBId}`, {
      token: trA,
      body: { name: 'Hacked Transport' },
    })
    if (cross.status === 403) ok('Transport manager A cannot update Transport B')
    else fail('Transport manager A cannot update Transport B', `${cross.status}`)
  }
  if (transportAId) {
    const own = await req('PATCH', `/transports/${transportAId}`, {
      token: trA,
      body: { description: 'Updated by transport mgr A' },
    })
    if (own.status === 200) ok('Transport manager A can update own transport')
    else fail('Transport manager A can update own transport', `${own.status}`)
  }

  // Customer blocked from management APIs
  const custTour = await req('POST', '/tours', {
    token: customer,
    body: {
      title: 'Customer Tour',
      description: 'x',
      shortDescription: 'x',
      duration: { days: 1, nights: 0 },
      destinations: ['x'],
      categories: ['cultural'],
      difficulty: 'easy',
      price: 1,
      coverImage: 'https://example.com/x.jpg',
      maxGroupSize: 1,
      itinerary: [{ day: 1, title: 'd', description: 'd' }],
    },
  })
  if (custTour.status === 403) ok('Customer cannot create tours')
  else fail('Customer cannot create tours', `${custTour.status}`)

  const custStats = await req('GET', '/stats', { token: customer })
  if (custStats.status === 403) ok('Customer cannot access stats')
  else fail('Customer cannot access stats', `${custStats.status}`)

  const custUsers = await req('GET', '/users', { token: customer })
  if (custUsers.status === 403) ok('Customer cannot list users')
  else fail('Customer cannot list users', `${custUsers.status}`)

  // Non-admin cannot create destination/news
  const dest = await req('POST', '/destinations', {
    token: opA,
    body: {
      name: `Hack Dest ${Date.now()}`,
      description: 'x',
      shortDescription: 'x',
      region: 'Amhara',
      location: { coordinates: { lat: 1, lng: 1 } },
      coverImage: 'https://example.com/x.jpg',
    },
  })
  if (dest.status === 403) ok('Tour operator cannot create destinations')
  else fail('Tour operator cannot create destinations', `${dest.status}`)

  // Admin can update any tour
  if (tourBId) {
    const adm = await req('PATCH', `/tours/${tourBId}`, {
      token: admin,
      body: { shortDescription: 'Admin override ok' },
    })
    if (adm.status === 200) ok('Admin can update any tour')
    else fail('Admin can update any tour', `${adm.status}`)
  }

  // Hotel manager cannot create transport
  const badTr = await req('POST', '/transports', {
    token: hotelA,
    body: {
      name: 'Nope',
      description: 'x',
      type: 'bus',
      contact: { phone: '+251900000000' },
      routes: [
        {
          from: 'A',
          to: 'B',
          departureTime: '08:00',
          arrivalTime: '10:00',
          price: 1,
          availableSeats: 1,
        },
      ],
    },
  })
  if (badTr.status === 403) ok('Hotel manager cannot create transport')
  else fail('Hotel manager cannot create transport', `${badTr.status}`)

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Ownership results: ${passed} passed, ${failed} failed (${results.length} total) ===\n`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
