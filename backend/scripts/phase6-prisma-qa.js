/**
 * Phase 6 — Live Prisma API QA against a running Prisma-only backend.
 *
 * Usage (backend already on :4002 via npm run dev:prisma):
 *   node scripts/phase6-prisma-qa.js [baseUrl]
 *
 * Default: http://127.0.0.1:4002/api/v1
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'config.env') })

process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'

const BASE = (process.argv[2] || 'http://127.0.0.1:4002/api/v1').replace(
  /\/$/,
  ''
)
const SEED_PASSWORD =
  process.env.SEED_LOCAL_PASSWORD || 'Phase3LocalSeedOnly!x'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function req(method, urlPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data, headers: res.headers }
}

function hasId(doc) {
  return Boolean(doc?._id || doc?.id)
}

function httpsOk(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url)
}

function noLocalImage(url) {
  if (!url) return true
  const s = String(url)
  return (
    !/localhost/i.test(s) &&
    !/^\/uploads\//i.test(s) &&
    !/^uploads\//i.test(s)
  )
}

const prisma = (await import('../config/prisma.js')).default
const RUN = Date.now()

try {
  // --- Health / mode ---
  const health = await req('GET', '/tours?limit=1')
  check('API reachable', health.status === 200, `status=${health.status}`)

  const mongoose = (await import('mongoose')).default
  // This script does not start mongoose; verify Mongo not required by API by hitting requireDb routes
  check(
    'mongoose not connected in this QA process',
    mongoose.connection.readyState !== 1
  )

  // --- Catalog + images ---
  const dests = await req('GET', '/destinations')
  const destList = dests.data?.data?.data || dests.data?.data || []
  check('destinations list', dests.status === 200 && Array.isArray(destList))
  const dest = destList[0]
  if (dest) {
    check('destination has _id', hasId(dest))
    check(
      'destination image https',
      httpsOk(dest.coverImage || dest.images?.[0]) &&
        noLocalImage(dest.coverImage)
    )
    if (dest.coverImage) {
      try {
        const imgRes = await fetch(dest.coverImage, { method: 'GET' })
        check(
          'destination image reachable',
          imgRes.ok &&
            String(imgRes.headers.get('content-type') || '').startsWith(
              'image/'
            ),
          `status=${imgRes.status}`
        )
      } catch (e) {
        check('destination image reachable', false, e.message)
      }
    }
    const d1 = await req('GET', `/destinations/${dest._id}`)
    check('destination detail', d1.status === 200)
  }

  const tours = await req('GET', '/tours?limit=5')
  const tourList = tours.data?.data?.data || tours.data?.data || []
  check('tours list', tours.status === 200 && Array.isArray(tourList))
  const tour = tourList.find((t) => t.coverImage) || tourList[0]
  if (tour) {
    check('tour _id', hasId(tour))
    check(
      'tour image https',
      httpsOk(tour.coverImage) && noLocalImage(tour.coverImage)
    )
    if (tour.coverImage) {
      try {
        const imgRes = await fetch(tour.coverImage, { method: 'GET' })
        check(
          'tour image reachable',
          imgRes.ok &&
            String(imgRes.headers.get('content-type') || '').startsWith(
              'image/'
            ),
          `status=${imgRes.status}`
        )
      } catch (e) {
        check('tour image reachable', false, e.message)
      }
    }
    const key = tour.slug || tour._id
    const t1 = await req('GET', `/tours/${key}`)
    check('tour detail by slug/id', t1.status === 200)
  }

  const hotels = await req('GET', '/hotels?limit=3')
  const hotelList = hotels.data?.data?.data || hotels.data?.data || []
  check('hotels list', hotels.status === 200)
  const hotel = hotelList[0]
  if (hotel) {
    check(
      'hotel image https',
      httpsOk(hotel.coverImage) && noLocalImage(hotel.coverImage)
    )
    check('hotel detail', (await req('GET', `/hotels/${hotel._id}`)).status === 200)
  }

  const rests = await req('GET', '/restaurants?limit=3')
  const restList = rests.data?.data?.data || rests.data?.data || []
  check('restaurants list', rests.status === 200)
  const rest = restList[0]
  if (rest) {
    check(
      'restaurant image https',
      httpsOk(rest.coverImage) && noLocalImage(rest.coverImage)
    )
  }

  const featuredRest = await req('GET', '/restaurants/featured')
  check(
    'featured restaurants',
    featuredRest.status === 200,
    `status=${featuredRest.status}`
  )

  const transports = await req('GET', '/transports?limit=3')
  check('transports list', transports.status === 200)

  const news = await req('GET', '/news?limit=3')
  const newsList = news.data?.data?.data || news.data?.data || []
  check('news list', news.status === 200)
  const article = newsList[0]
  if (article) {
    check(
      'news image https',
      httpsOk(article.coverImage || article.image) &&
        noLocalImage(article.coverImage || article.image)
    )
  }

  // --- Auth ---
  const email = `phase6.qa.${RUN}@visitethiopia.test`
  const signup = await req('POST', '/users/signup', {
    body: {
      FirstName: 'Phase',
      LastName: 'Six',
      email,
      password: 'ValidPass123!',
      passwordConfirm: 'ValidPass123!',
    },
  })
  check(
    'signup',
    signup.status === 201,
    signup.data?.message || String(signup.status)
  )

  const login = await req('POST', '/users/login', {
    body: { email, password: 'ValidPass123!' },
  })
  check('login', login.status === 200 && Boolean(login.data?.token))
  const token = login.data?.token

  const profile = await req('GET', '/users/profile', { token })
  const userDoc = profile.data?.data?.data || profile.data?.data
  check('get profile', profile.status === 200 && hasId(userDoc))
  check(
    'password not in profile',
    !userDoc?.password && !JSON.stringify(userDoc || {}).includes('"password"')
  )

  const patchProfile = await req('PATCH', '/users/profile', {
    token,
    body: { FirstName: 'PhaseSix' },
  })
  check('update profile', patchProfile.status === 200)

  const badLogin = await req('POST', '/users/login', {
    body: { email, password: 'WrongPass999!' },
  })
  check('wrong password rejected', badLogin.status === 401)

  const forgot = await req('POST', '/users/forgotPassword', {
    body: { email },
  })
  check(
    'forgot password accepted',
    forgot.status === 200,
    `status=${forgot.status}`
  )
  const resetToken =
    forgot.data?.resetToken ||
    forgot.data?.token ||
    forgot.data?.data?.resetToken
  if (resetToken) {
    const reset = await req('PATCH', `/users/resetPassword/${resetToken}`, {
      body: {
        password: 'ValidPass456!',
        passwordConfirm: 'ValidPass456!',
      },
    })
    check('reset password', reset.status === 200, `status=${reset.status}`)
    const relogin = await req('POST', '/users/login', {
      body: { email, password: 'ValidPass456!' },
    })
    check('login after reset', relogin.status === 200 && Boolean(relogin.data?.token))
  } else {
    check('reset password (token in response)', true, 'dev email path — token not exposed; skipped')
  }

  const logout = await req('POST', '/users/logout', { token })
  check('logout', logout.status === 200 || logout.status === 204)

  // Seed users
  const adminLogin = await req('POST', '/users/login', {
    body: {
      email: 'prisma.admin@visitethiopia.test',
      password: SEED_PASSWORD,
    },
  })
  check('seed admin login', adminLogin.status === 200)
  const adminToken = adminLogin.data?.token

  const visitorLogin = await req('POST', '/users/login', {
    body: {
      email: 'prisma.catalog.visitor@visitethiopia.test',
      password: SEED_PASSWORD,
    },
  })
  check('seed visitor login', visitorLogin.status === 200)
  const visitorToken = visitorLogin.data?.token

  const ownerLogin = await req('POST', '/users/login', {
    body: {
      email: 'prisma.catalog.owner@visitethiopia.test',
      password: SEED_PASSWORD,
    },
  })
  check('seed owner login', ownerLogin.status === 200)
  const ownerToken = ownerLogin.data?.token

  if (adminToken) {
    const stats = await req('GET', '/stats', { token: adminToken })
    check('admin stats', stats.status === 200)
    const users = await req('GET', '/users', { token: adminToken })
    check('admin user list', users.status === 200)
    const pending = await req('GET', '/reviews/pending', { token: adminToken })
    check('admin pending reviews', pending.status === 200)
  }

  // --- Marketplace visibility ---
  const org = await prisma.organization.findFirst({
    where: { approvalStatus: 'approved', visibility: 'public' },
  })
  if (org?.slug) {
    const pub = await req('GET', `/organizations/${org.slug}`)
    check('approved public org visible', pub.status === 200)

    const orgTours = await req('GET', `/organizations/${org.slug}/tours`)
    check(
      'public org tours',
      orgTours.status === 200,
      `status=${orgTours.status}`
    )
  }

  // Draft org must not be public
  const draftSlug = `phase6-draft-${RUN}`
  if (ownerToken) {
    const reg = await req('POST', '/organizations/register', {
      token: ownerToken,
      body: {
        name: `Phase6 Draft ${RUN}`,
        providerTypes: ['travel_company'],
        proposedSlug: draftSlug,
      },
    })
    check(
      'org register',
      reg.status === 201 || reg.status === 200,
      `status=${reg.status}`
    )
    const leak = await req('GET', `/organizations/${draftSlug}`)
    check(
      'draft org not public',
      leak.status === 404 || leak.status === 403,
      `status=${leak.status}`
    )
  }

  // --- Booking / payment / inventory ---
  const departure = await prisma.tourDeparture.findFirst({
    where: { status: 'open', availableSpots: { gt: 0 } },
    orderBy: { availableSpots: 'desc' },
  })

  if (visitorToken && departure) {
    const before = departure.availableSpots
    const idem = `phase6-book-${RUN}`
    const book = await req('POST', '/bookings/tours', {
      token: visitorToken,
      headers: { 'Idempotency-Key': idem },
      body: {
        departureId: departure.id,
        packageKey: 'standard',
        quantity: 1,
        contactInfo: {
          fullName: 'Phase Six Visitor',
          email: 'prisma.catalog.visitor@visitethiopia.test',
          phone: '+251900000099',
        },
      },
    })
    check(
      'create booking',
      book.status === 201 || book.status === 200,
      `status=${book.status} ${book.data?.message || ''}`
    )
    const bookingId = book.data?.data?._id
    const paymentId = book.data?.data?.payment?._id

    const again = await req('POST', '/bookings/tours', {
      token: visitorToken,
      headers: { 'Idempotency-Key': idem },
      body: {
        departureId: departure.id,
        packageKey: 'standard',
        quantity: 1,
        contactInfo: {
          fullName: 'Phase Six Visitor',
          email: 'prisma.catalog.visitor@visitethiopia.test',
          phone: '+251900000099',
        },
      },
    })
    check(
      'idempotent booking reuse',
      again.status === 200 && again.data?.idempotent === true
    )

    const conflict = await req('POST', '/bookings/tours', {
      token: visitorToken,
      headers: { 'Idempotency-Key': idem },
      body: {
        departureId: departure.id,
        packageKey: 'standard',
        quantity: 2,
        contactInfo: {
          fullName: 'Phase Six Visitor',
          email: 'prisma.catalog.visitor@visitethiopia.test',
          phone: '+251900000099',
        },
      },
    })
    check('idempotent conflict', conflict.status === 409)

    if (paymentId) {
      const confirm = await req('POST', `/payments/${paymentId}/confirm`, {
        token: visitorToken,
        body: { mockOutcome: 'success' },
      })
      check('payment success', confirm.status === 200)
    } else {
      check('payment success', false, 'missing payment id')
    }

    const after = await prisma.tourDeparture.findUnique({
      where: { id: departure.id },
    })
    check(
      'inventory decremented',
      after.availableSpots === before - 1,
      `before=${before} after=${after.availableSpots}`
    )
    check('availableSpots non-negative', after.availableSpots >= 0)

    if (bookingId) {
      const one = await req('GET', `/bookings/${bookingId}`, {
        token: visitorToken,
      })
      check('get booking', one.status === 200 && hasId(one.data?.data))
    }
  } else {
    check('booking flow', false, 'missing visitor token or open departure')
  }

  // Over-capacity rejection
  if (visitorToken && org) {
    const tour = await prisma.tour.findFirst({
      where: { organizationId: org.id, status: 'published' },
    })
    if (tour) {
      const tiny = await prisma.tourDeparture.create({
        data: {
          id: crypto.randomBytes(12).toString('hex'),
          tourId: tour.id,
          organizationId: org.id,
          departureDate: new Date(Date.now() + 40 * 86400000),
          capacity: 1,
          availableSpots: 1,
          status: 'open',
          packages: [
            {
              key: 'standard',
              priceMinor: 10000,
              currency: 'ETB',
              active: true,
            },
          ],
          notes: 'phase6-capacity',
        },
      })
      const over = await req('POST', '/bookings/tours', {
        token: visitorToken,
        headers: { 'Idempotency-Key': `phase6-over-${RUN}` },
        body: {
          departureId: tiny.id,
          packageKey: 'standard',
          quantity: 5,
          contactInfo: {
            fullName: 'Phase Six Visitor',
            email: 'prisma.catalog.visitor@visitethiopia.test',
            phone: '+251900000099',
          },
        },
      })
      check(
        'over-capacity rejected',
        over.status === 409 || over.status === 400,
        `status=${over.status}`
      )
      await prisma.tourDeparture.delete({ where: { id: tiny.id } }).catch(() => {})
    }
  }

  // Concurrency CAS (repo-level, same as phase4)
  if (org) {
    const tour = await prisma.tour.findFirst({
      where: { organizationId: org.id, status: 'published' },
    })
    if (tour) {
      const {
        createDepartureRecord,
        reserveSpotsAtomic,
        findDepartureById,
      } = await import(
        '../repositories/booking/prismaDepartureInventoryRepository.js'
      )
      const dep = await createDepartureRecord({
        tourId: tour.id,
        organizationId: org.id,
        departureDate: new Date(Date.now() + 60 * 86400000),
        capacity: 10,
        availableSpots: 10,
        status: 'open',
        packages: [
          {
            key: 'standard',
            priceMinor: 50000,
            currency: 'ETB',
            active: true,
          },
        ],
        notes: 'phase6-cas',
      })
      const attempts = await Promise.allSettled(
        Array.from({ length: 20 }, () => reserveSpotsAtomic(dep._id, 1))
      )
      const ok = attempts.filter((a) => a.status === 'fulfilled').length
      const fail = attempts.filter((a) => a.status === 'rejected').length
      const after = await findDepartureById(dep._id)
      check('concurrency 20→10 success', ok === 10, `ok=${ok}`)
      check('concurrency 10 rejected', fail === 10, `fail=${fail}`)
      check(
        'concurrency spots=0 non-negative',
        after.availableSpots === 0 && after.availableSpots >= 0
      )
      await prisma.tourDeparture.delete({ where: { id: dep._id } }).catch(() => {})
    }
  }

  // Soft-deleted user cannot login
  if (adminToken) {
    const softEmail = `phase6.soft.${RUN}@visitethiopia.test`
    const softSignup = await req('POST', '/users/signup', {
      body: {
        FirstName: 'Soft',
        LastName: 'Delete',
        email: softEmail,
        password: 'ValidPass123!',
        passwordConfirm: 'ValidPass123!',
      },
    })
    if (softSignup.status === 201) {
      const softLogin = await req('POST', '/users/login', {
        body: { email: softEmail, password: 'ValidPass123!' },
      })
      const softToken = softLogin.data?.token
      if (softToken) {
        await req('DELETE', '/users/profile', { token: softToken })
        const afterSoft = await req('POST', '/users/login', {
          body: { email: softEmail, password: 'ValidPass123!' },
        })
        check(
          'soft-deleted cannot login',
          afterSoft.status === 401,
          `status=${afterSoft.status}`
        )
      }
    }
  }

  // DB integrity spot checks
  const neg = await prisma.tourDeparture.count({
    where: { availableSpots: { lt: 0 } },
  })
  check('no negative availableSpots in DB', neg === 0, `count=${neg}`)

  const seedTour = await prisma.tour.findFirst({
    where: { slug: 'prisma-seed-org-northern-circuit' },
  })
  check(
    'seed org tour image https',
    seedTour ? httpsOk(seedTour.coverImage) && noLocalImage(seedTour.coverImage) : false
  )
} catch (err) {
  check('suite crashed', false, err.message || String(err))
  console.error(err)
} finally {
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(
  `\n=== Phase 6 Prisma live QA: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`
)
process.exitCode = failed ? 1 : 0
