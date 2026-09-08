/**
 * E2E checks for newly implemented customer/admin flows.
 * Usage: node scripts/e2e-new-features.js [baseUrl]
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

async function run() {
  console.log(`\n=== E2E new features @ ${BASE} ===\n`)

  // Login customer
  const login = await req('POST', '/users/login', {
    body: { email: 'customer@visitethiopia.test', password: 'CustomerPass123!' },
  })
  if (login.status !== 200 || !login.data?.token) {
    fail('Customer login', `${login.status}`)
    return done()
  }
  ok('Customer login')
  const customerToken = login.data.token

  // Forgot → reset → login
  const forgot = await req('POST', '/users/forgotPassword', {
    body: { email: 'customer@visitethiopia.test' },
  })
  if (forgot.status === 200 && forgot.data?.resetToken) {
    ok('Forgot password returns resetToken (dev)')
    const reset = await req('PATCH', `/users/resetPassword/${forgot.data.resetToken}`, {
      body: { password: 'CustomerPass999!', passwordConfirm: 'CustomerPass999!' },
    })
    if (reset.status === 200 && reset.data?.token) ok('Reset password')
    else fail('Reset password', `${reset.status} ${reset.data?.message}`)

    const loginNew = await req('POST', '/users/login', {
      body: { email: 'customer@visitethiopia.test', password: 'CustomerPass999!' },
    })
    if (loginNew.status === 200) {
      ok('Login with reset password')
      // restore password for later tests
      const back = await req('PATCH', '/users/updatePassword', {
        token: loginNew.data.token,
        body: {
          passwordCurrent: 'CustomerPass999!',
          password: 'CustomerPass123!',
          passwordConfirm: 'CustomerPass123!',
        },
      })
      if (back.status === 200) ok('Restored customer password')
      else fail('Restored customer password', `${back.status}`)
    } else fail('Login with reset password', `${loginNew.status}`)
  } else {
    fail('Forgot password returns resetToken (dev)', `${forgot.status}`)
  }

  // Relogin customer
  const login2 = await req('POST', '/users/login', {
    body: { email: 'customer@visitethiopia.test', password: 'CustomerPass123!' },
  })
  const cToken = login2.data?.token || customerToken

  // Get a tour id
  const tours = await req('GET', '/tours?limit=1')
  const tourId = tours.data?.data?.data?.[0]?._id
  if (!tourId) {
    fail('Need tour for booking/review')
    return done()
  }
  ok('List tours for booking', tourId)

  // Booking
  const booking = await req('POST', '/bookings', {
    token: cToken,
    body: {
      bookingType: 'tour',
      bookingItem: tourId,
      bookingDetails: { startDate: new Date(Date.now() + 86400000 * 7).toISOString(), quantity: 1 },
      contactInfo: {
        fullName: 'Customer One',
        email: 'customer@visitethiopia.test',
        phone: '+251900000001',
      },
      payment: { amount: 25000, currency: 'ETB', paymentMethod: 'credit_card' },
    },
  })
  if (booking.status === 201) ok('Create booking')
  else fail('Create booking', `${booking.status} ${booking.data?.message}`)

  // Review
  const review = await req('POST', '/reviews', {
    token: cToken,
    body: {
      itemType: 'tour',
      itemId: tourId,
      rating: 5,
      title: 'E2E review',
      comment: 'Great trip',
    },
  })
  if (review.status === 201) ok('Create review')
  else fail('Create review', `${review.status} ${review.data?.message}`)

  // Search
  const search = await req('GET', '/tours?search=Northern')
  if (search.status === 200 && (search.data?.results ?? 0) >= 1) ok('Global search (tours)')
  else fail('Global search (tours)', `${search.status} results=${search.data?.results}`)

  // Contact
  const contact = await req('POST', '/contacts', {
    body: {
      name: 'E2E',
      email: 'e2e@example.com',
      subject: 'Hello',
      message: 'Testing contact',
    },
  })
  if (contact.status === 201) ok('Contact form')
  else fail('Contact form', `${contact.status}`)

  // Favorites
  const fav = await req('PATCH', '/users/profile', {
    token: cToken,
    body: { favorites: [tourId] },
  })
  if (fav.status === 200) ok('Update favorites')
  else fail('Update favorites', `${fav.status}`)

  // Admin
  const adminLogin = await req('POST', '/users/login', {
    body: { email: 'admin@visitethiopia.test', password: 'AdminPass123!' },
  })
  if (adminLogin.status !== 200) {
    fail('Admin login', `${adminLogin.status}`)
    return done()
  }
  ok('Admin login')
  const aToken = adminLogin.data.token

  const stats = await req('GET', '/stats', { token: aToken })
  if (stats.status === 200) ok('Admin stats')
  else fail('Admin stats', `${stats.status}`)

  const denied = await req('GET', '/stats', { token: cToken })
  if (denied.status === 403) ok('Customer denied admin stats')
  else fail('Customer denied admin stats', `${denied.status}`)

  // Manager role logins
  for (const [email, pass, label] of [
    ['operator@visitethiopia.test', 'OperatorPass123!', 'tour_operator'],
    ['hotelmgr@visitethiopia.test', 'HotelMgrPass123!', 'hotel_manager'],
    ['transportmgr@visitethiopia.test', 'TransportMgrPass123!', 'transport_manager'],
  ]) {
    const r = await req('POST', '/users/login', { body: { email, password: pass } })
    if (r.status === 200 && r.data?.data?.user?.role === label) ok(`Login ${label}`)
    else fail(`Login ${label}`, `${r.status} role=${r.data?.data?.user?.role}`)
  }

  // Tour operator can create tour
  const opLogin = await req('POST', '/users/login', {
    body: { email: 'operator@visitethiopia.test', password: 'OperatorPass123!' },
  })
  const opToken = opLogin.data?.token
  const createTour = await req('POST', '/tours', {
    token: opToken,
    body: {
      title: 'Operator Tour',
      description: 'Created by tour operator',
      shortDescription: 'Op tour',
      duration: { days: 2, nights: 1 },
      destinations: ['Addis'],
      categories: ['cultural'],
      difficulty: 'easy',
      price: 1000,
      coverImage: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400',
      maxGroupSize: 5,
      itinerary: [{ day: 1, title: 'Day 1', description: 'Explore' }],
    },
  })
  if (createTour.status === 201) ok('Tour operator create tour')
  else fail('Tour operator create tour', `${createTour.status} ${JSON.stringify(createTour.data).slice(0, 120)}`)

  // Customer cannot create tour
  const deniedTour = await req('POST', '/tours', {
    token: cToken,
    body: { title: 'Nope' },
  })
  if (deniedTour.status === 403) ok('Customer denied create tour')
  else fail('Customer denied create tour', `${deniedTour.status}`)

  // Hotels / restaurants / news / destinations
  for (const [label, path] of [
    ['hotels', '/hotels?limit=1'],
    ['restaurants', '/restaurants?limit=1'],
    ['destinations', '/destinations?limit=1'],
    ['news', '/news?limit=1'],
    ['transports', '/transports?limit=1'],
  ]) {
    const r = await req('GET', path)
    if (r.status === 200 && (r.data?.results ?? 0) >= 1) ok(`Browse ${label}`)
    else fail(`Browse ${label}`, `${r.status}`)
  }

  done()
}

function done() {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
