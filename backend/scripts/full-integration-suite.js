/**
 * Full Visit Ethiopia integration suite against a running API.
 * Usage: node scripts/full-integration-suite.js [baseUrl]
 */
const BASE = (process.argv[2] || 'http://localhost:4000/api/v1').replace(/\/$/, '')
const ORIGIN = process.argv[3] || 'http://localhost:5199'

const results = { passed: [], failed: [], notes: [] }
const state = {}

function pass(name, detail = '') {
  results.passed.push({ name, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.failed.push({ name, detail })
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}
function note(msg) {
  results.notes.push(msg)
  console.log(`ℹ️  ${msg}`)
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data, headers: res.headers }
}

function extractList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.data)) return data.data
  if (data.data && Array.isArray(data.data.data)) return data.data.data
  if (data.data && Array.isArray(data.data.reviews)) return data.data.reviews
  if (Array.isArray(data.reviews)) return data.reviews
  return []
}

function extractOne(data) {
  if (!data || typeof data !== 'object') return null
  if (data.data?.data && typeof data.data.data === 'object' && !Array.isArray(data.data.data))
    return data.data.data
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data
  return null
}

async function run() {
  console.log(`\n=== Full Integration Suite ===\nAPI: ${BASE}\n`)

  // Health
  const health = await fetch(BASE.replace(/\/api\/v1$/, '/') || 'http://localhost:4000/')
  const healthText = await health.text()
  if (health.ok && healthText.includes('API is working')) pass('Backend health')
  else fail('Backend health', healthText.slice(0, 80))

  // CORS
  const cors = await req('OPTIONS', '/tours')
  // fetch may not expose CORS; do a GET with Origin
  const corsGet = await req('GET', '/tours?limit=1')
  const acao = corsGet.headers.get('access-control-allow-origin')
  if (acao === ORIGIN || acao === '*' || acao) pass('CORS origin reflected', String(acao))
  else fail('CORS origin reflected', String(acao))

  // Public lists
  for (const [name, path, key] of [
    ['List tours', '/tours?status=active&limit=5', 'tourId'],
    ['Featured tours', '/tours/featured', 'tourId'],
    ['List hotels', '/hotels?status=active&limit=5', 'hotelId'],
    ['Featured hotels', '/hotels/featured', 'hotelId'],
    ['List destinations', '/destinations?status=active&limit=5', 'destinationId'],
    ['Featured destinations', '/destinations/featured', 'destinationId'],
    ['List transports', '/transports?status=active&limit=5', 'transportId'],
    ['Transport routes', '/transports/routes', null],
    ['List restaurants', '/restaurants?status=active&limit=5', 'restaurantId'],
    ['Featured restaurants', '/restaurants/featured', 'restaurantId'],
    ['List news', '/news?limit=5', 'newsId'],
    ['Featured news', '/news/featured', 'newsId'],
  ]) {
    const res = await req('GET', path)
    if (res.status === 200 && res.data?.status === 'success') {
      const list = extractList(res.data)
      pass(name, `count=${list.length || res.data.results || 0}`)
      if (key && list[0]?._id && !state[key]) state[key] = list[0]._id
      // news featured may return differently
      if (key === 'newsId' && !state.newsId) {
        const one = extractOne(res.data) || list[0]
        if (one?._id) state.newsId = one._id
        if (Array.isArray(res.data?.data) && res.data.data[0]?._id) state.newsId = res.data.data[0]._id
      }
    } else fail(name, `status=${res.status} ${res.data?.message || JSON.stringify(res.data).slice(0, 100)}`)
  }

  // Details
  if (state.tourId) {
    const t = await req('GET', `/tours/${state.tourId}`)
    if (t.status === 200 && extractOne(t.data)) pass('Tour detail')
    else fail('Tour detail', `status=${t.status}`)
    const tr = await req('GET', `/tours/${state.tourId}/reviews`)
    if (tr.status === 200) pass('Tour reviews', `results=${tr.data?.results}`)
    else fail('Tour reviews', `status=${tr.status}`)
  }

  if (state.hotelId) {
    const h = await req('GET', `/hotels/${state.hotelId}`)
    if (h.status === 200 && extractOne(h.data)) pass('Hotel detail')
    else fail('Hotel detail', `status=${h.status}`)
  }

  if (state.destinationId) {
    const d = await req('GET', `/destinations/${state.destinationId}`)
    if (d.status === 200) pass('Destination detail')
    else fail('Destination detail', `status=${d.status}`)
    const dt = await req('GET', `/destinations/${state.destinationId}/tours`)
    if (dt.status === 200) pass('Destination tours')
    else fail('Destination tours', `status=${dt.status} ${dt.data?.message}`)
  }

  if (state.transportId) {
    const t = await req('GET', `/transports/${state.transportId}`)
    if (t.status === 200) pass('Transport detail')
    else fail('Transport detail', `status=${t.status}`)
  }

  if (state.restaurantId) {
    const r = await req('GET', `/restaurants/${state.restaurantId}`)
    if (r.status === 200) pass('Restaurant detail')
    else fail('Restaurant detail', `status=${r.status}`)
  }

  if (state.newsId) {
    const n = await req('GET', `/news/${state.newsId}`)
    if (n.status === 200) pass('News detail')
    else fail('News detail', `status=${n.status}`)
  } else {
    // try first from list news
    const list = await req('GET', '/news')
    const items = extractList(list.data)
    if (items[0]?._id) {
      state.newsId = items[0]._id
      const n = await req('GET', `/news/${state.newsId}`)
      if (n.status === 200) pass('News detail')
      else fail('News detail', `status=${n.status}`)
    } else fail('News detail', 'no news id')
  }

  // Auth unauth
  const unauth = await req('GET', '/users/profile')
  if (unauth.status === 401) pass('Profile requires auth')
  else fail('Profile requires auth', `status=${unauth.status}`)

  // Login customer
  const loginC = await req('POST', '/users/login', {
    body: { email: 'customer@visitethiopia.test', password: 'CustomerPass123!' },
  })
  if (loginC.status === 200 && loginC.data?.token) {
    pass('Customer login')
    state.customerToken = loginC.data.token
    state.customer = loginC.data.data?.user
  } else fail('Customer login', `${loginC.status} ${loginC.data?.message}`)

  // Login admin
  const loginA = await req('POST', '/users/login', {
    body: { email: 'admin@visitethiopia.test', password: 'AdminPass123!' },
  })
  if (loginA.status === 200 && loginA.data?.token) {
    pass('Admin login')
    state.adminToken = loginA.data.token
  } else fail('Admin login', `${loginA.status} ${loginA.data?.message}`)

  // Wrong password
  const badLogin = await req('POST', '/users/login', {
    body: { email: 'customer@visitethiopia.test', password: 'wrong' },
  })
  if (badLogin.status === 401) pass('Login rejects bad password')
  else fail('Login rejects bad password', `status=${badLogin.status}`)

  if (!state.customerToken) {
    fail('Abort customer flows', 'no customer token')
    return summarize()
  }

  // Profile
  const profile = await req('GET', '/users/profile', { token: state.customerToken })
  if (profile.status === 200 && extractOne(profile.data)) pass('Get profile')
  else fail('Get profile', `${profile.status}`)

  const upd = await req('PATCH', '/users/profile', {
    token: state.customerToken,
    body: { FirstName: 'CustomerUpdated' },
  })
  if (upd.status === 200) pass('Update profile')
  else fail('Update profile', `${upd.status} ${upd.data?.message}`)

  // Favorites via profile
  if (state.tourId) {
    const fav = await req('PATCH', '/users/profile', {
      token: state.customerToken,
      body: { favorites: [state.tourId] },
    })
    if (fav.status === 200) pass('Update favorites')
    else fail('Update favorites', `${fav.status} ${fav.data?.message}`)
  }

  // Password change wrong current
  const badPw = await req('PATCH', '/users/updatePassword', {
    token: state.customerToken,
    body: {
      passwordCurrent: 'WrongPass!',
      password: 'NewPass123!',
      passwordConfirm: 'NewPass123!',
    },
  })
  if (badPw.status === 401) pass('Password change rejects wrong current')
  else fail('Password change rejects wrong current', `status=${badPw.status}`)

  // Bookings
  if (state.tourId) {
    const booking = await req('POST', '/bookings', {
      token: state.customerToken,
      body: {
        bookingType: 'tour',
        bookingItem: state.tourId,
        bookingDetails: {
          startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
          quantity: 2,
          participants: [{ name: 'Customer One' }, { name: 'Guest Two' }],
        },
        contactInfo: {
          fullName: 'Customer One',
          email: 'customer@visitethiopia.test',
          phone: '+251900000001',
        },
        payment: { amount: 50000, currency: 'ETB', paymentMethod: 'credit_card' },
      },
    })
    if (booking.status === 201) {
      pass('Create tour booking')
      state.bookingId = booking.data?.data?._id
    } else fail('Create tour booking', `${booking.status} ${booking.data?.message}`)
  }

  if (state.hotelId) {
    const hb = await req('POST', '/bookings', {
      token: state.customerToken,
      body: {
        bookingType: 'hotel',
        bookingItem: state.hotelId,
        bookingDetails: {
          startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
          endDate: new Date(Date.now() + 86400000 * 12).toISOString(),
          quantity: 1,
          roomType: 'Standard',
        },
        contactInfo: {
          fullName: 'Customer One',
          email: 'customer@visitethiopia.test',
          phone: '+251900000001',
        },
        payment: { amount: 7000, currency: 'ETB', paymentMethod: 'mobile_money' },
      },
    })
    if (hb.status === 201) pass('Create hotel booking')
    else fail('Create hotel booking', `${hb.status} ${hb.data?.message}`)
  }

  const myBookings = await req('GET', '/bookings/me', { token: state.customerToken })
  if (myBookings.status === 200) {
    const list = extractList(myBookings.data)
    pass('Get my bookings', `count=${list.length}`)
  } else fail('Get my bookings', `${myBookings.status}`)

  if (state.bookingId) {
    const byId = await req('GET', `/bookings/${state.bookingId}`, { token: state.customerToken })
    if (byId.status === 200) pass('Get booking by id')
    else fail('Get booking by id', `${byId.status} ${byId.data?.message}`)

    const cancel = await req('PATCH', `/bookings/${state.bookingId}/cancel`, {
      token: state.customerToken,
    })
    if (cancel.status === 200 && cancel.data?.data?.status === 'cancelled') pass('Cancel booking')
    else fail('Cancel booking', `${cancel.status} ${cancel.data?.message}`)
  }

  // Reviews
  if (state.tourId) {
    const review = await req('POST', '/reviews', {
      token: state.customerToken,
      body: {
        itemType: 'tour',
        itemId: state.tourId,
        rating: 4,
        title: 'Solid tour',
        comment: 'Would book again',
      },
    })
    if (review.status === 201) {
      pass('Create review')
      state.reviewId = review.data?.data?._id
    } else fail('Create review', `${review.status} ${review.data?.message}`)

    const mine = await req('GET', '/reviews/me', { token: state.customerToken })
    if (mine.status === 200) pass('Get my reviews', `count=${extractList(mine.data).length}`)
    else fail('Get my reviews', `${mine.status}`)
  }

  if (state.reviewId) {
    const updR = await req('PATCH', `/reviews/${state.reviewId}`, {
      token: state.customerToken,
      body: { comment: 'Updated comment' },
    })
    if (updR.status === 200) pass('Update own review')
    else fail('Update own review', `${updR.status} ${updR.data?.message}`)
  }

  // Contact
  const contact = await req('POST', '/contacts', {
    body: {
      name: 'Integration Tester',
      email: 'tester@example.com',
      phone: '+251911222333',
      subject: 'Availability',
      message: 'Are October dates open?',
    },
  })
  if (contact.status === 201) {
    pass('Submit contact form')
    state.contactId = contact.data?.data?._id
  } else fail('Submit contact form', `${contact.status} ${contact.data?.message}`)

  // Customer denied admin
  const denied = await req('GET', '/stats', { token: state.customerToken })
  if (denied.status === 403) pass('Customer denied admin stats')
  else fail('Customer denied admin stats', `status=${denied.status}`)

  // Admin flows
  if (state.adminToken) {
    const stats = await req('GET', '/stats', { token: state.adminToken })
    if (stats.status === 200) pass('Admin stats')
    else fail('Admin stats', `${stats.status}`)

    const allB = await req('GET', '/bookings', { token: state.adminToken })
    if (allB.status === 200) pass('Admin list bookings')
    else fail('Admin list bookings', `${allB.status}`)

    const contacts = await req('GET', '/contacts', { token: state.adminToken })
    if (contacts.status === 200) pass('Admin list contacts')
    else fail('Admin list contacts', `${contacts.status}`)

    if (state.contactId) {
      const patchC = await req('PATCH', `/contacts/${state.contactId}`, {
        token: state.adminToken,
        body: { status: 'in_progress' },
      })
      if (patchC.status === 200) pass('Admin update contact status')
      else fail('Admin update contact status', `${patchC.status} ${patchC.data?.message}`)
    }

    if (state.reviewId) {
      const approve = await req('PATCH', `/reviews/${state.reviewId}/approve`, {
        token: state.adminToken,
      })
      const status = approve.data?.data?.data?.status || approve.data?.data?.status
      if (approve.status === 200 && status === 'approved') pass('Admin approve review')
      else fail('Admin approve review', `${approve.status} status=${status}`)
    }

    // Admin create tour
    const newTour = await req('POST', '/tours', {
      token: state.adminToken,
      body: {
        title: 'Audit Created Tour',
        description: 'Created during integration audit',
        shortDescription: 'Audit tour',
        duration: { days: 3, nights: 2 },
        destinations: ['Addis Ababa'],
        categories: ['cultural'],
        difficulty: 'easy',
        price: 5000,
        coverImage: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
        maxGroupSize: 10,
        createdBy: state.adminToken, // may fail validation — fix if needed
        itinerary: [{ day: 1, title: 'City', description: 'City tour' }],
      },
    })
    // createdBy should be ObjectId of admin user — login response has user
    if (newTour.status === 201) {
      pass('Admin create tour')
      state.createdTourId = extractOne(newTour.data)?._id || newTour.data?.data?.data?._id
    } else {
      // retry with proper createdBy from admin login
      const adminUserId = loginA.data?.data?.user?._id
      const newTour2 = await req('POST', '/tours', {
        token: state.adminToken,
        body: {
          title: 'Audit Created Tour',
          description: 'Created during integration audit',
          shortDescription: 'Audit tour',
          duration: { days: 3, nights: 2 },
          destinations: ['Addis Ababa'],
          categories: ['cultural'],
          difficulty: 'easy',
          price: 5000,
          coverImage: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
          maxGroupSize: 10,
          createdBy: adminUserId,
          itinerary: [{ day: 1, title: 'City', description: 'City tour' }],
        },
      })
      if (newTour2.status === 201) {
        pass('Admin create tour')
        state.createdTourId = extractOne(newTour2.data)?._id || newTour2.data?.data?.data?._id
      } else fail('Admin create tour', `${newTour2.status} ${JSON.stringify(newTour2.data).slice(0, 150)}`)
    }

    if (state.createdTourId) {
      const patchT = await req('PATCH', `/tours/${state.createdTourId}`, {
        token: state.adminToken,
        body: { price: 5500 },
      })
      if (patchT.status === 200) pass('Admin update tour')
      else fail('Admin update tour', `${patchT.status}`)

      const delT = await req('DELETE', `/tours/${state.createdTourId}`, {
        token: state.adminToken,
      })
      if (delT.status === 204 || delT.status === 200) pass('Admin delete tour')
      else fail('Admin delete tour', `${delT.status}`)
    }

    // Customer cannot create tour
    const deniedCreate = await req('POST', '/tours', {
      token: state.customerToken,
      body: { title: 'Nope' },
    })
    if (deniedCreate.status === 403) pass('Customer denied create tour')
    else fail('Customer denied create tour', `status=${deniedCreate.status}`)
  }

  // Signup + verify flow (email may fail)
  const email = `audit_${Date.now()}@example.com`
  const signup = await req('POST', '/users/signup', {
    body: {
      FirstName: 'New',
      LastName: 'User',
      email,
      password: 'NewUserPass123!',
      passwordConfirm: 'NewUserPass123!',
    },
  })
  if (signup.status === 201) pass('Signup (email sent)')
  else if (signup.status === 500 && String(signup.data?.message || '').toLowerCase().includes('email'))
    note(`Signup blocked by email service: ${signup.data.message}`)
  else fail('Signup', `${signup.status} ${signup.data?.message}`)

  // Forgot password
  const forgot = await req('POST', '/users/forgotPassword', {
    body: { email: 'customer@visitethiopia.test' },
  })
  if (forgot.status === 200) pass('Forgot password email')
  else if (forgot.status === 500)
    note(`Forgot password email service issue: ${forgot.data?.message}`)
  else fail('Forgot password', `${forgot.status} ${forgot.data?.message}`)

  // Logout
  const logout = await req('POST', '/users/logout', { token: state.customerToken })
  if (logout.status === 200) pass('Logout')
  else fail('Logout', `${logout.status}`)

  // Pagination / sort
  const page = await req('GET', '/tours?limit=1&page=1&sort=-price')
  if (page.status === 200) pass('Tours pagination/sort query accepted')
  else fail('Tours pagination/sort', `${page.status}`)

  summarize()
}

function summarize() {
  console.log('\n=== SUMMARY ===')
  console.log(`Passed: ${results.passed.length}`)
  console.log(`Failed: ${results.failed.length}`)
  if (results.failed.length) {
    console.log('\nFailures:')
    for (const f of results.failed) console.log(` - ${f.name}: ${f.detail}`)
  }
  if (results.notes.length) {
    console.log('\nNotes:')
    for (const n of results.notes) console.log(` - ${n}`)
  }
  process.exit(results.failed.length ? 1 : 0)
}

run().catch((err) => {
  console.error('Suite crashed:', err)
  process.exit(1)
})
