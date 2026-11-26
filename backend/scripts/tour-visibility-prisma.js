/**
 * Public tour visibility (Prisma) — org-owned tours appear only when the org is
 * approved + public with an approved version; drafts, secret tours and private
 * orgs never leak, and query-string filters cannot override visibility.
 *
 * Usage: node scripts/tour-visibility-prisma.js   (LOCAL database only)
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'config.env') })

process.env.NODE_ENV = 'development'
process.env.DATABASE_MODE = 'prisma'
process.env.CATALOG_DB = 'prisma'
process.env.SKIP_MONGO = 'true'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'tour-visibility-test-secret'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const { generateObjectId } = await import('../utils/objectId.js')
const prisma = (await import('../config/prisma.js')).default
const app = (await import('../app.js')).default

const PORT = 4112
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const RUN = generateObjectId().slice(0, 8)

const ownerId = generateObjectId()
const publicOrg = generateObjectId()
const privateOrg = generateObjectId()
const versionId = generateObjectId()
const T = {
  publicPublished: generateObjectId(),
  publicDraft: generateObjectId(),
  publicSecret: generateObjectId(),
  privatePublished: generateObjectId(),
}

function tourData(id, title, organizationId, extra = {}) {
  return {
    id, title, slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${RUN}`,
    description: 'Visibility test tour', shortDescription: `vis-${RUN}`,
    durationDays: 2, durationNights: 1, difficulty: 'easy', price: 100,
    coverImage: 'https://example.test/x.jpg', maxGroupSize: 10,
    createdById: ownerId, organizationId, status: 'published', secretTour: false,
    ...extra,
  }
}

async function get(p) {
  const res = await fetch(`${BASE}${p}`)
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
const titles = (r) => (r.body?.data?.data || []).map((t) => t.title)

const server = app.listen(PORT)
try {
  await prisma.user.create({
    data: { id: ownerId, firstName: 'Vis', lastName: 'Owner', email: `vis.owner.${RUN}@visitethiopia.test`, password: 'x', role: 'tour_operator', isVerified: true, active: true },
  })
  const orgBase = { providerTypes: ['travel_company'], description: '', shortDescription: '', uniqueSellingPoints: [], services: [], gallery: [], portfolioPhotos: [], ownerUserId: ownerId, verification: {} }
  await prisma.organization.create({ data: { ...orgBase, id: publicOrg, name: `Vis Public ${RUN}`, slug: `vis-public-${RUN}`, approvalStatus: 'draft', visibility: 'private' } })
  await prisma.organization.create({ data: { ...orgBase, id: privateOrg, name: `Vis Private ${RUN}`, slug: `vis-private-${RUN}`, approvalStatus: 'under_review', visibility: 'private' } })
  await prisma.providerVersion.create({
    data: { id: versionId, organizationId: publicOrg, versionNumber: 1, status: 'approved', snapshot: { name: `Vis Public ${RUN}`, providerTypes: ['travel_company'] }, changedFields: [], requiresReapproval: false, approvedAt: new Date() },
  })
  await prisma.organization.update({ where: { id: publicOrg }, data: { approvalStatus: 'approved', visibility: 'public', approvedVersionId: versionId, latestVersionId: versionId } })

  await prisma.tour.createMany({
    data: [
      tourData(T.publicPublished, `Vis Public Published ${RUN}`, publicOrg),
      tourData(T.publicDraft, `Vis Public Draft ${RUN}`, publicOrg, { status: 'draft' }),
      tourData(T.publicSecret, `Vis Public Secret ${RUN}`, publicOrg, { secretTour: true }),
      tourData(T.privatePublished, `Vis Private Published ${RUN}`, privateOrg),
    ],
  })

  const search = `search=vis-${RUN}`
  for (const route of ['/tours/marketplace', '/tours']) {
    const r = await get(`${route}?${search}&limit=100`)
    const t = titles(r)
    check(`${route}: published tour of public org listed`, t.includes(`Vis Public Published ${RUN}`), t.join(', '))
    check(`${route}: draft tour hidden`, !t.includes(`Vis Public Draft ${RUN}`))
    check(`${route}: secret tour hidden`, !t.includes(`Vis Public Secret ${RUN}`))
    check(`${route}: tour of non-approved org hidden`, !t.includes(`Vis Private Published ${RUN}`))

    const forced = await get(`${route}?${search}&status=draft&secretTour=true&limit=100`)
    const ft = titles(forced)
    check(`${route}: status/secretTour query cannot override visibility`,
      !ft.includes(`Vis Public Draft ${RUN}`) && !ft.includes(`Vis Public Secret ${RUN}`) && !ft.includes(`Vis Private Published ${RUN}`), ft.join(', '))
  }

  const mk = await get(`/tours/marketplace?${search}`)
  const listed = (mk.body?.data?.data || []).find((t) => t._id === T.publicPublished)
  check('marketplace attaches approved organization snapshot', listed?.organization?.name === `Vis Public ${RUN}`)
  check('organization snapshot omits private fields', listed?.organization && !('verification' in listed.organization) && !('ownerUserId' in listed.organization))

  const byPrivateOrg = await get(`/tours/marketplace?organizationId=${privateOrg}`)
  check('organizationId filter for non-public org returns nothing', (byPrivateOrg.body?.data?.data || []).length === 0)
  const byPublicOrg = await get(`/tours/marketplace?organizationId=${publicOrg}`)
  check('organizationId filter for public org returns only its public tours',
    titles(byPublicOrg).length === 1 && titles(byPublicOrg)[0] === `Vis Public Published ${RUN}`, titles(byPublicOrg).join(', '))

  check('detail: public org tour returns 200', (await get(`/tours/${T.publicPublished}`)).status === 200)
  check('detail: draft tour returns 404', (await get(`/tours/${T.publicDraft}`)).status === 404)
  check('detail: secret tour returns 404', (await get(`/tours/${T.publicSecret}`)).status === 404)
  check('detail: non-approved org tour returns 404', (await get(`/tours/${T.privatePublished}`)).status === 404)
  check('departures: non-approved org tour returns 404', (await get(`/tours/${T.privatePublished}/departures`)).status === 404)

  // Suspending/hiding the org removes its tours immediately.
  await prisma.organization.update({ where: { id: publicOrg }, data: { visibility: 'private' } })
  check('org made private → tour disappears from marketplace', !titles(await get(`/tours/marketplace?${search}`)).includes(`Vis Public Published ${RUN}`))
  check('org made private → detail returns 404', (await get(`/tours/${T.publicPublished}`)).status === 404)
} catch (err) {
  check('suite crashed', false, err.stack || String(err))
} finally {
  server.close()
  try {
    await prisma.tour.deleteMany({ where: { id: { in: Object.values(T) } } })
    await prisma.organization.updateMany({ where: { id: { in: [publicOrg, privateOrg] } }, data: { approvedVersionId: null, latestVersionId: null } })
    await prisma.providerVersion.deleteMany({ where: { organizationId: { in: [publicOrg, privateOrg] } } })
    await prisma.organization.deleteMany({ where: { id: { in: [publicOrg, privateOrg] } } })
    await prisma.user.deleteMany({ where: { id: ownerId } })
  } catch {
    /* best effort */
  }
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(`\n=== Tour visibility Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
process.exitCode = failed ? 1 : 0
