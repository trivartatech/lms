import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { env } from './config/env'
import routes from './routes'
import { errorHandler } from './middleware/error.middleware'

const app = express()

// Behind nginx reverse proxy — trust the first hop for X-Forwarded-* headers.
app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // Allow WebAssembly for client-side PDF generation (pdf-lib/@react-pdf).
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
    },
  },
}))
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin (no Origin header), native mobile, and the configured frontend.
    if (!origin) return cb(null, true)
    if (origin === env.FRONTEND_URL) return cb(null, true)
    return cb(null, false)
  },
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// ── Rate limiting ────────────────────────────────────────────────────────────
// Aggressive on auth, moderate on the rest of the API.
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 min
  max:             10,             // 10 attempts/IP/window
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { message: 'Too many auth attempts, try again later.' },
})

const apiLimiter = rateLimit({
  windowMs:        1 * 60 * 1000,  // 1 min
  max:             200,            // 200 req/IP/min
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { message: 'Too many requests, slow down.' },
})

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Auth limiter scoped to login/refresh (avoid locking already-authenticated users out)
app.use('/api/auth/login',   authLimiter)
app.use('/api/auth/refresh', authLimiter)
app.use('/api', apiLimiter)

app.use('/api', routes)

// ── Serve web build (production) ─────────────────────────────────────────────
// In production the bundled web app (packages/web/dist) is copied next to the
// backend's dist folder as `public/`. Serve it with SPA fallback so deep links
// like /leads/5 resolve to index.html.
const webRoot = path.resolve(__dirname, '../public')
if (fs.existsSync(webRoot)) {
  app.use(express.static(webRoot))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webRoot, 'index.html'))
  })
}

app.use(errorHandler)

export default app
