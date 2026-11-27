import express from 'express'
import path from 'path'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import xss from 'xss-clean'
import globalErrorHandler from './controllers/errorController.js'
import AppError from './utils/appError.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import router from './routes/authRoutes.js'
import bookingRouter from './routes/bookingRoutes.js'
import paymentRouter from './routes/paymentRoutes.js'
import adminBookingRouter from './routes/adminBookingRoutes.js'
import adminRouter from './routes/adminRoutes.js'
import assistantRouter from './routes/assistantRoutes.js'
import providerBookingRouter from './routes/providerBookingRoutes.js'
import contactRouter from './routes/contactRoutes.js'
import destinationRouter from './routes/destinationRoutes.js'
import hotelRouter from './routes/hotelRoutes.js'
import newsRouter from './routes/newsRoutes.js'
import restaurantRouter from './routes/restaurantrRoutes.js'
import reviewRouter from './routes/reviewRoutes.js'
import tourRouter from './routes/tourRoutes.js'
import transportRouter from './routes/transportRoutes.js'
import statsRouter from './routes/statsRoutes.js'
import organizationRouter from './routes/organizationRoutes.js'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './swagger/swagger.js'
import cors from 'cors'
import requireDb from './middlewares/requireDb.js'

// Define __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './config.env' })
}

const app = express()

// Trust proxy headers (Render / reverse proxies)
app.set('trust proxy', 1)

/** Explicit origin allowlist — never Access-Control-Allow-Origin: * with credentials. */
function buildAllowedOrigins() {
  const origins = new Set(
    process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:5176',
          'http://localhost:5188',
          'http://localhost:5199',
          'http://localhost:5200',
        ]
  )

  const normalize = (value) => String(value).trim().replace(/\/$/, '')
  if (process.env.FRONTEND_URL) {
    origins.add(normalize(process.env.FRONTEND_URL))
  }
  if (process.env.CORS_ALLOWED_ORIGINS) {
    for (const part of process.env.CORS_ALLOWED_ORIGINS.split(',')) {
      if (part.trim()) origins.add(normalize(part))
    }
  }
  return origins
}

const allowedOrigins = buildAllowedOrigins()

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (no Origin) and known frontend origins.
      // In development, also allow any localhost Vite port.
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          /^http:\/\/localhost:\d+$/.test(origin))
      ) {
        return callback(null, true)
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Org-Context',
      'X-Admin-Org-Bypass',
      'Idempotency-Key',
      'X-Mock-Payment-Outcome',
      'X-Mock-Refund-Outcome',
      'X-Mock-Webhook-Signature',
      'X-Webhook-Signature',
    ],
  })
)

// Swagger docs route
app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Middleware
app.use(cookieParser())
app.use(helmet())

// Request log (skip health probes); errors are logged by the error handler.
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/health/ready') return next()
  const started = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - started
    if (process.env.NODE_ENV === 'production' || res.statusCode >= 500 || ms > 2000) {
      console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms}ms`)
    }
  })
  next()
})

// Rate limiting (higher ceiling in development for local test suites)
const isProd = process.env.NODE_ENV === 'production'
const limiter = rateLimit({
  max: isProd ? Number(process.env.RATE_LIMIT_MAX || 600) : 5000,
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
})
app.use('/api', limiter)

// Stricter limit for credential endpoints (brute-force protection)
const authLimiter = rateLimit({
  max: isProd ? Number(process.env.AUTH_RATE_LIMIT_MAX || 30) : 1000,
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many attempts, please try again in 15 minutes.' },
})
app.use(
  [
    '/api/v1/users/login',
    '/api/v1/users/signup',
    '/api/v1/users/forgotPassword',
    '/api/v1/users/resetPassword',
  ],
  authLimiter
)

app.use(express.json({
  limit: '10kb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  },
}))
// Mongo operator sanitization — keep for mongo mode; skip when Prisma-only.
if (String(process.env.DATABASE_MODE || 'mongo').toLowerCase() !== 'prisma') {
  app.use(mongoSanitize())
}
app.use(xss())
app.use(express.static(path.join(__dirname, 'public')))

// Health / liveness (no auth, no DB mutation — safe for Render health checks)
app.get('/', (req, res) => {
  res.send('API is working')
})

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
})

// Readiness: verifies the database answers (use for monitoring, not liveness).
app.get('/health/ready', async (req, res) => {
  try {
    if (String(process.env.DATABASE_MODE || '').toLowerCase() === 'prisma') {
      const { default: prisma } = await import('./config/prisma.js')
      await prisma.$queryRaw`SELECT 1`
      return res.status(200).json({ status: 'ok', database: 'postgresql' })
    }
    const { default: mongoose } = await import('mongoose')
    const ok = mongoose.connection.readyState === 1
    return res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable', database: 'mongodb' })
  } catch {
    return res.status(503).json({ status: 'unavailable' })
  }
})

// Main API routes (require an active database connection)
app.use('/api/v1/users', requireDb, router)
app.use('/api/v1/organizations', requireDb, organizationRouter)
app.use('/api/v1/bookings', requireDb, bookingRouter)
app.use('/api/v1/payments', requireDb, paymentRouter)
app.use('/api/v1/admin/bookings', requireDb, adminBookingRouter)
app.use('/api/v1/admin', requireDb, adminRouter)
app.use('/api/v1/provider/bookings', requireDb, providerBookingRouter)
app.use('/api/v1/contacts', requireDb, contactRouter)
app.use('/api/v1/destinations', requireDb, destinationRouter)
app.use('/api/v1/hotels', requireDb, hotelRouter)
app.use('/api/v1/news', requireDb, newsRouter)
app.use('/api/v1/restaurants', requireDb, restaurantRouter)
app.use('/api/v1/reviews', requireDb, reviewRouter)
app.use('/api/v1/tours', requireDb, tourRouter)
app.use('/api/v1/transports', requireDb, transportRouter)
app.use('/api/v1/stats', requireDb, statsRouter)
// Travel assistant works without a DB (knowledge base is bundled); listings are added when available.
app.use('/api/v1/assistant', assistantRouter)

// Catch unmatched routes
app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`))
})

// Global error handler
app.use(globalErrorHandler)

export default app
