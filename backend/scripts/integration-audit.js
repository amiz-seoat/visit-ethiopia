/**
 * Visit Ethiopia integration audit runner.
 * Usage: node scripts/integration-audit.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:5000/api/v1';
const ORIGIN = 'http://localhost:5173';

const results = { passed: [], failed: [], skipped: [], blocked: [] };

function pass(name, detail = '') {
  results.passed.push({ name, detail });
  console.log(`✅ PASS: ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.failed.push({ name, detail });
  console.log(`❌ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
}

function skip(name, detail = '') {
  results.skipped.push({ name, detail });
  console.log(`⏭️  SKIP: ${name}${detail ? ` — ${detail}` : ''}`);
}

function blocked(name, detail = '') {
  results.blocked.push({ name, detail });
  console.log(`🚫 BLOCKED: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(method, path, { token, body, headers = {} } = {}) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...headers,
    },
  };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

function isDbError(res) {
  const msg = typeof res.data === 'object' ? res.data?.message || '' : String(res.data || '');
  return (
    res.status >= 500 ||
    msg.includes('buffering timed out') ||
    msg.includes('Operation') && msg.includes('timed out') ||
    msg.includes('connect')
  );
}

const state = {
  adminToken: null,
  customerToken: null,
  customerId: null,
  adminId: null,
  tourId: null,
  hotelId: null,
  destinationId: null,
  transportId: null,
  restaurantId: null,
  newsId: null,
  bookingId: null,
  reviewId: null,
  contactId: null,
};

const testEmail = `audit_${Date.now()}@example.com`;
const testPassword = 'AuditPass123!';

async function run() {
  console.log(`\n=== Visit Ethiopia Integration Audit ===`);
  console.log(`API base: ${BASE}\n`);

  // Health
  try {
    const health = await fetch(BASE.replace('/api/v1', '/'));
    const text = await health.text();
    if (health.ok && text.includes('API is working')) pass('Backend health check');
    else fail('Backend health check', `status=${health.status} body=${text.slice(0, 80)}`);
  } catch (e) {
    fail('Backend health check', e.message);
    console.log('\nBackend unreachable — aborting API tests.');
    printSummary();
    process.exit(1);
  }

  // CORS
  try {
    const cors = await request('GET', '/tours');
    const acao = cors.headers.get('access-control-allow-origin');
    if (acao === ORIGIN || acao === '*') pass('CORS allows frontend origin', acao);
    else fail('CORS allows frontend origin', `got ${acao}`);
  } catch (e) {
    fail('CORS allows frontend origin', e.message);
  }

  // Public reads
  for (const [name, path] of [
    ['List tours', '/tours?limit=5'],
    ['Featured tours', '/tours/featured?limit=5'],
    ['List hotels', '/hotels?limit=5'],
    ['Featured hotels', '/hotels/featured?limit=5'],
    ['List destinations', '/destinations?limit=5'],
    ['Featured destinations', '/destinations/featured?limit=5'],
    ['List transports', '/transports?limit=5'],
    ['Transport routes', '/transports/routes'],
    ['List restaurants', '/restaurants?limit=5'],
    ['Featured restaurants', '/restaurants/featured?limit=5'],
    ['List news', '/news?limit=5'],
    ['Featured news', '/news/featured?limit=5'],
  ]) {
    try {
      const res = await request('GET', path);
      if (isDbError(res)) {
        blocked(name, 'Database unavailable');
        continue;
      }
      if (res.status === 200 && res.data?.status === 'success') {
        pass(name, `results=${res.data.results ?? 'n/a'}`);
        if (path.includes('/tours?') && !state.tourId) {
          state.tourId = res.data?.data?.data?.[0]?._id;
        }
        if (path.includes('/hotels?') && !state.hotelId) {
          state.hotelId = res.data?.data?.data?.[0]?._id;
        }
        if (path.includes('/destinations?') && !state.destinationId) {
          state.destinationId = res.data?.data?.data?.[0]?._id;
        }
        if (path.includes('/transports?') && !state.transportId) {
          state.transportId = res.data?.data?.data?.[0]?._id;
        }
        if (path.includes('/restaurants?') && !state.restaurantId) {
          state.restaurantId = res.data?.data?.data?.[0]?._id;
        }
        if (path.includes('/news?') && !state.newsId) {
          state.newsId = res.data?.data?.data?.[0]?._id;
        }
      } else fail(name, `status=${res.status} msg=${res.data?.message || JSON.stringify(res.data).slice(0, 120)}`);
    } catch (e) {
      fail(name, e.message);
    }
  }

  // Detail endpoints
  if (state.tourId) {
    const res = await request('GET', `/tours/${state.tourId}`);
    if (res.status === 200) pass('Tour detail by ID');
    else fail('Tour detail by ID', `status=${res.status}`);
    const rev = await request('GET', `/tours/${state.tourId}/reviews`);
    if (rev.status === 200) pass('Tour reviews');
    else fail('Tour reviews', `status=${rev.status}`);
  } else blocked('Tour detail by ID', 'No tour in database');

  if (state.hotelId) {
    const res = await request('GET', `/hotels/${state.hotelId}`);
    if (res.status === 200) pass('Hotel detail by ID');
    else fail('Hotel detail by ID', `status=${res.status}`);
  } else blocked('Hotel detail by ID', 'No hotel in database');

  if (state.destinationId) {
    const res = await request('GET', `/destinations/${state.destinationId}`);
    if (res.status === 200) pass('Destination detail by ID');
    else fail('Destination detail by ID', `status=${res.status}`);
    const tours = await request('GET', `/destinations/${state.destinationId}/tours`);
    if (tours.status === 200) pass('Destination tours');
    else fail('Destination tours', `status=${tours.status}`);
  } else blocked('Destination detail by ID', 'No destination in database');

  // Auth: signup
  let signupRes;
  try {
    signupRes = await request('POST', '/users/signup', {
      body: {
        FirstName: 'Audit',
        LastName: 'User',
        email: testEmail,
        password: testPassword,
        passwordConfirm: testPassword,
      },
    });
    if (isDbError(signupRes)) blocked('User signup', 'Database unavailable');
    else if (signupRes.status === 201) pass('User signup');
    else if (signupRes.status === 500 && signupRes.data?.message?.includes('email'))
      blocked('User signup', 'Email service failure (expected without SMTP in some envs)');
    else fail('User signup', `status=${signupRes.status} ${signupRes.data?.message}`);
  } catch (e) {
    fail('User signup', e.message);
  }

  // Login before verify should fail
  const preLogin = await request('POST', '/users/login', {
    body: { email: testEmail, password: testPassword },
  });
  if (isDbError(preLogin)) blocked('Login blocked before email verify', 'Database unavailable');
  else if (preLogin.status === 401) pass('Login blocked before email verify');
  else fail('Login blocked before email verify', `status=${preLogin.status}`);

  // Try verify via direct DB bypass - can't without DB. Try existing users login
  const loginAttempts = [
    { email: 'admin@visitethiopia.com', password: 'Admin1234!', role: 'admin' },
    { email: 'test@example.com', password: 'password123', role: 'customer' },
  ];

  for (const cred of loginAttempts) {
    const res = await request('POST', '/users/login', {
      body: { email: cred.email, password: cred.password },
    });
    if (isDbError(res)) {
      blocked(`Login as ${cred.role}`, 'Database unavailable');
      continue;
    }
    if (res.status === 200 && res.data?.token) {
      pass(`Login as ${cred.role}`, cred.email);
      if (cred.role === 'admin') {
        state.adminToken = res.data.token;
        state.adminId = res.data.data?.user?._id;
      } else {
        state.customerToken = res.data.token;
        state.customerId = res.data.data?.user?._id;
      }
    }
  }

  // Protected routes without token
  const unauth = await request('GET', '/users/profile');
  if (unauth.status === 401) pass('Profile requires authentication');
  else if (isDbError(unauth)) blocked('Profile requires authentication', 'Database unavailable');
  else fail('Profile requires authentication', `status=${unauth.status}`);

  const token = state.customerToken || state.adminToken;
  if (!token) {
    blocked('Authenticated flow tests', 'No verified user available to login');
    printSummary();
    return;
  }

  // Profile
  const profile = await request('GET', '/users/profile', { token });
  if (profile.status === 200) pass('Get current user profile');
  else fail('Get current user profile', `status=${profile.status}`);

  const profileUpdate = await request('PATCH', '/users/profile', {
    token,
    body: { FirstName: 'AuditUpdated' },
  });
  if (profileUpdate.status === 200) pass('Update profile');
  else fail('Update profile', `status=${profileUpdate.status}`);

  // Password change wrong current
  const badPw = await request('PATCH', '/users/updatePassword', {
    token,
    body: { passwordCurrent: 'wrong', password: 'NewPass123!', passwordConfirm: 'NewPass123!' },
  });
  if (badPw.status === 401) pass('Password change rejects wrong current password');
  else fail('Password change rejects wrong current password', `status=${badPw.status}`);

  // Bookings
  if (state.tourId) {
    const booking = await request('POST', '/bookings', {
      token,
      body: {
        bookingType: 'tour',
        bookingItem: state.tourId,
        bookingDetails: {
          startDate: new Date(Date.now() + 86400000).toISOString(),
          quantity: 1,
          participants: [{ name: 'Audit User' }],
        },
        contactInfo: {
          fullName: 'Audit User',
          email: testEmail,
          phone: '+251900000000',
        },
        payment: {
          amount: 1000,
          currency: 'ETB',
          paymentMethod: 'credit_card',
        },
      },
    });
    if (booking.status === 201) {
      pass('Create tour booking');
      state.bookingId = booking.data?.data?._id;
    } else fail('Create tour booking', `status=${booking.status} ${booking.data?.message}`);

    const myBookings = await request('GET', '/bookings/me', { token });
    if (myBookings.status === 200) pass('Get my bookings');
    else fail('Get my bookings', `status=${myBookings.status}`);

    if (state.bookingId) {
      const cancel = await request('PATCH', `/bookings/${state.bookingId}/cancel`, { token });
      if (cancel.status === 200) pass('Cancel booking');
      else fail('Cancel booking', `status=${cancel.status} ${cancel.data?.message}`);
    }
  } else blocked('Booking flow', 'No tour available');

  // getBookingById - frontend expects route that may not exist
  if (state.bookingId) {
    const byId = await request('GET', `/bookings/${state.bookingId}`, { token });
    if (byId.status === 200) pass('Get booking by ID');
    else if (byId.status === 404) fail('Get booking by ID', 'Route missing on backend (404)');
    else fail('Get booking by ID', `status=${byId.status}`);
  }

  // Reviews
  if (state.tourId) {
    const review = await request('POST', '/reviews', {
      token,
      body: {
        itemType: 'tour',
        itemId: state.tourId,
        rating: 5,
        title: 'Great tour',
        comment: 'Integration audit review',
      },
    });
    if (review.status === 201) {
      pass('Create review');
      state.reviewId = review.data?.data?._id;
    } else fail('Create review', `status=${review.status} ${review.data?.message}`);

    const myReviews = await request('GET', '/reviews/me', { token });
    if (myReviews.status === 200) pass('Get my reviews');
    else fail('Get my reviews', `status=${myReviews.status}`);
  }

  // Contact form
  const contact = await request('POST', '/contacts', {
    body: {
      name: 'Audit Contact',
      email: 'contact@example.com',
      phone: '+251911111111',
      subject: 'Integration test',
      message: 'Testing contact form integration',
    },
  });
  if (contact.status === 201) {
    pass('Submit contact form');
    state.contactId = contact.data?.data?._id;
  } else if (isDbError(contact)) blocked('Submit contact form', 'Database unavailable');
  else fail('Submit contact form', `status=${contact.status}`);

  // Admin-only
  if (state.adminToken) {
    const stats = await request('GET', '/stats', { token: state.adminToken });
    if (stats.status === 200) pass('Admin stats dashboard');
    else fail('Admin stats dashboard', `status=${stats.status}`);

    const allBookings = await request('GET', '/bookings', { token: state.adminToken });
    if (allBookings.status === 200) pass('Admin list all bookings');
    else fail('Admin list all bookings', `status=${allBookings.status}`);

    const contacts = await request('GET', '/contacts', { token: state.adminToken });
    if (contacts.status === 200) pass('Admin list contacts');
    else fail('Admin list contacts', `status=${contacts.status}`);

    if (state.reviewId) {
      const approve = await request('PATCH', `/reviews/${state.reviewId}/approve`, {
        token: state.adminToken,
      });
      if (approve.status === 200 && approve.data?.data?.data?.status === 'approved')
        pass('Admin approve review');
      else fail('Admin approve review', `status=${approve.status} statusField=${approve.data?.data?.data?.status}`);
    }

    // contact status update - frontend expects PATCH
    if (state.contactId) {
      const patchContact = await request('PATCH', `/contacts/${state.contactId}`, {
        token: state.adminToken,
        body: { status: 'in_progress' },
      });
      if (patchContact.status === 200) pass('Admin update contact status');
      else if (patchContact.status === 404) fail('Admin update contact status', 'PATCH route missing on backend');
      else fail('Admin update contact status', `status=${patchContact.status}`);
    }
  } else {
    blocked('Admin-only tests', 'No admin credentials available');
  }

  // Role restriction: customer cannot access admin stats
  if (state.customerToken) {
    const denied = await request('GET', '/stats', { token: state.customerToken });
    if (denied.status === 403) pass('Customer denied admin stats');
    else fail('Customer denied admin stats', `status=${denied.status}`);
  }

  // Logout
  const logout = await request('POST', '/users/logout', { token });
  if (logout.status === 200) pass('Logout');
  else fail('Logout', `status=${logout.status}`);

  printSummary();
}

function printSummary() {
  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Blocked: ${results.blocked.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
}

run().catch((err) => {
  console.error('Audit runner crashed:', err);
  process.exit(1);
});
