/**
 * Email transport: Brevo HTTPS API (stubbed — no network, fake key), transport
 * selection, error reporting without credential leaks, and the signup →
 * verification-email → verify-link flow end to end.
 *
 * Usage: node scripts/email-transport-prisma.js   (LOCAL database only)
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
process.env.JWT_SECRET = process.env.JWT_SECRET || 'email-test-secret-0123456789abcdef0123'
for (const k of ['BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_HOST']) delete process.env[k]

if (!process.env.DATABASE_URL || !/@(127\.0\.0\.1|localhost):\d+\//.test(process.env.DATABASE_URL)) {
  console.error('A LOCAL DATABASE_URL is required')
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
const { default: sendEmail, emailTransport, setEmailHttpTransport } = await import('../utils/Email.js')

const PORT = 4115
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const RUN = generateObjectId().slice(-8)
const FAKE_KEY = `xkeysib-test-${RUN}`
const signupEmail = `email.flow.${RUN}@visitethiopia.test`

const errors = []
const origError = console.error
console.error = (...a) => {
  errors.push(a.join(' '))
  origError(...a)
}

const server = app.listen(PORT)
try {
  // --- transport selection -----------------------------------------------------
  // (cleared again here: importing the app re-reads config.env)
  for (const k of ['BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_HOST']) delete process.env[k]
  check('no config → no transport', emailTransport() === null)
  process.env.EMAIL_USER = 'sender@example.com'
  process.env.EMAIL_PASS = 'app-password'
  check('EMAIL_USER/PASS → smtp', emailTransport() === 'smtp')
  process.env.BREVO_API_KEY = FAKE_KEY
  check('BREVO_API_KEY takes precedence (works on Render free)', emailTransport() === 'brevo')
  delete process.env.EMAIL_USER
  delete process.env.EMAIL_PASS
  check('Brevo without a sender address is not configured', emailTransport() === null)
  process.env.EMAIL_FROM = 'noreply@example.com'
  check('Brevo + EMAIL_FROM → brevo', emailTransport() === 'brevo')

  // --- Brevo request shape ---------------------------------------------------------
  const calls = []
  setEmailHttpTransport(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({ messageId: '<abc@brevo>' }), { status: 201 })
  })
  await sendEmail({ email: 'traveler@example.com', subject: 'Hello', message: 'plain', html: '<b>hi</b>' })
  const c = calls[0]
  check('posts to Brevo transactional endpoint', c?.url === 'https://api.brevo.com/v3/smtp/email' && c.init.method === 'POST')
  check('API key sent only in the api-key header', c?.init.headers['api-key'] === FAKE_KEY && !c.init.body.includes(FAKE_KEY))
  check('payload has sender, recipient, subject, html and text',
    c?.body.sender.email === 'noreply@example.com' && c.body.sender.name === 'Visit Ethiopia'
    && c.body.to[0].email === 'traveler@example.com' && c.body.subject === 'Hello'
    && c.body.htmlContent === '<b>hi</b>' && c.body.textContent === 'plain')

  // --- Brevo errors --------------------------------------------------------------------
  setEmailHttpTransport(async () => new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 }))
  let msg = ''
  try {
    await sendEmail({ email: 'traveler@example.com', subject: 'Bad key', message: 'x' })
  } catch (e) {
    msg = e.message
  }
  check('Brevo error surfaces status and reason', /401/.test(msg) && /unauthorized/.test(msg), msg)
  check('logs never contain the API key', !errors.some((l) => l.includes(FAKE_KEY)))
  setEmailHttpTransport(async () => {
    throw Object.assign(new Error('x'), { name: 'TimeoutError' })
  })
  msg = ''
  try {
    await sendEmail({ email: 'traveler@example.com', subject: 'Timeout', message: 'x' })
  } catch (e) {
    msg = e.message
  }
  check('network timeout reported clearly', msg === 'Brevo request timed out', msg)

  // --- signup → verification email → verify link ----------------------------------
  calls.length = 0
  setEmailHttpTransport(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({ messageId: '<verify@brevo>' }), { status: 201 })
  })
  const signup = await fetch(`${BASE}/users/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      FirstName: 'Email', LastName: 'Flow', email: signupEmail,
      password: `Flow-${RUN}-Pass!1`, passwordConfirm: `Flow-${RUN}-Pass!1`,
    }),
  })
  const sb = await signup.json().catch(() => ({}))
  check('signup succeeds and asks to check email', signup.status === 201 && /check your email/i.test(sb.message || ''), `${signup.status} ${sb.message}`)
  const mail = calls[0]?.body
  check('verification email sent via Brevo to the new user', mail?.to?.[0]?.email === signupEmail && mail.subject === 'Verify your email')
  const link = (mail?.htmlContent || '').match(/https?:\/\/[^"'<\s]+\/api\/v1\/users\/verify\/[^"'<\s]+/)?.[0]
  check('email contains a verification link', Boolean(link), link ? link.replace(/verify\/.*/, 'verify/…') : 'none')
  const before = await prisma.user.findUnique({ where: { email: signupEmail } })
  check('account starts unverified', before && before.isVerified === false)
  if (link) {
    const token = link.split('/verify/')[1]
    const v = await fetch(`${BASE}/users/verify/${token}`, { headers: { Accept: 'application/json' } })
    const after = await prisma.user.findUnique({ where: { email: signupEmail } })
    check('verification link verifies the account', v.status === 200 && after?.isVerified === true, String(v.status))
  }
} catch (err) {
  check('suite crashed', false, err.stack || String(err))
} finally {
  setEmailHttpTransport(null)
  console.error = origError
  server.close()
  try {
    await prisma.user.deleteMany({ where: { email: signupEmail } })
  } catch (e) {
    console.error('cleanup failed', e.message)
  }
  await prisma.$disconnect().catch(() => {})
}

const failed = results.filter((r) => !r.ok).length
const passed = results.filter((r) => r.ok).length
console.log(`\n=== Email transport Prisma: ${passed} passed, ${failed} failed (${results.length} checks) ===\n`)
process.exitCode = failed ? 1 : 0
