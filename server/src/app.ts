/**
 * Express application setup
 *
 * Separated from server.ts so tests can import the app without triggering
 * app.listen(). All env-driven behavior is sourced from ./config, not
 * process.env — this keeps the config surface discoverable and testable.
 *
 * Route order (top to bottom):
 *   1. trust proxy + security + compression + body parser  (all requests)
 *   2. CORS (allow-listed per env)                         (all requests)
 *   3. Request logger                                      (all requests)
 *   4. /static/*            static tarot assets (immutable, 30d)
 *   5. /api/*               rate-limited + routed to handlers
 *      5a. /api/healthz     liveness probe
 *      5b. /api/readyz      readiness (assets loadable)
 *      5c. /api/v1/*        business endpoints
 *      5d. any /api/* miss → JSON 404 (never the SPA)
 *   6. /*                   SPA: serve hashed assets long-cached,
 *                           index.html no-cache, unknown paths → index.html
 *   7. Error handler (terminal)
 */

import express, { type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'

import { config } from './config'
import { logger } from './logger'
import cardsRouter from './routes/cards'
import divinationsRouter from './routes/divinations'
import themesRouter from './routes/themes'
import { getAllCards } from './services/card_loader'

const app = express()

// Behind nginx: trust the first hop so req.ip / X-Forwarded-For work correctly.
app.set('trust proxy', 1)
app.disable('x-powered-by')

// ---------------------------------------------------------------------------
// 1. Security + compression + body parsing
// ---------------------------------------------------------------------------

// helmet defaults; CSP is configured with a baseline policy that allows
// the SPA's inline scripts/styles and GSAP. Nginx can layer a stricter
// policy per-deployment if needed.
//
// Two helmet defaults we explicitly opt out of:
//   - `upgrade-insecure-requests` (CSP directive): helmet adds this to
//     every directives map by default. It tells the browser to rewrite
//     all sub-resource URLs from http:// to https://. We don't want the
//     app layer to enforce that — production traffic terminates TLS at
//     nginx and reverse-proxies plain HTTP to this process; the directive
//     would either double-upgrade or, on local HTTP runs (Playwright,
//     dev), break the SPA outright.
//   - `Strict-Transport-Security` in non-prod: HSTS is sticky in browsers
//     and pollutes localhost HTTP debugging across all of `localhost:*`.
//     Production keeps the default HSTS so the reverse proxy + app are
//     defense-in-depth.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  ...(config.isProd ? {} : {
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
  }),
}))
app.use(compression())
app.use(express.json({ limit: config.jsonBodyLimit }))

// ---------------------------------------------------------------------------
// 2. CORS (allow-list; no wildcard in prod unless explicitly configured)
// ---------------------------------------------------------------------------

app.use((req, res, next) => {
  const origin = req.headers.origin
  const allowed = config.corsOrigins

  if (allowed === '*') {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Vary', 'Origin')
  } else if (typeof origin === 'string' && allowed.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Vary', 'Origin')
  }
  // else: no ACAO header — browser blocks cross-origin, same-origin still works.

  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

// ---------------------------------------------------------------------------
// 3. Request logger
// ---------------------------------------------------------------------------

app.use(
  pinoHttp({
    logger,
    // quiet health probes — they fire every few seconds from systemd/k8s/nginx
    autoLogging: {
      ignore: req => req.url === '/api/healthz' || req.url === '/api/readyz',
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    },
  }),
)

// ---------------------------------------------------------------------------
// 4. Static tarot assets
// Images/fonts are hashed-name-free but content-addressable per theme; we
// still mark them immutable with a 30-day window — changing a theme bumps
// the theme id (directory), which invalidates the URL.
// ---------------------------------------------------------------------------

app.use(
  '/static',
  express.static(path.join(__dirname, '../public/static'), {
    maxAge: '30d',
    immutable: true,
    etag: true,
  }),
)

// ---------------------------------------------------------------------------
// 5. API
// ---------------------------------------------------------------------------

// Rate limit /api/* when enabled (prod only per config). In dev/test the
// limiter is skipped entirely so integration tests don't trip it.
if (config.rateLimit.max > 0) {
  app.use(
    '/api',
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many requests' },
    }),
  )
}

// Liveness: process is up and the event loop is responsive.
app.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Readiness: card library loads without throwing. Cheap because cards are
// cached after first call, so repeated probes are O(1).
app.get('/api/readyz', (_req, res) => {
  try {
    const count = getAllCards().length
    if (count !== 78) {
      res.status(503).json({ status: 'not_ready', reason: `expected 78 cards, got ${count}` })
      return
    }
    res.json({ status: 'ready', cards: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    res.status(503).json({ status: 'not_ready', reason: message })
  }
})

// Backwards-compat: the previous spec + tests hit /api/health. Keep it as a
// synonym for /api/healthz so existing probes don't break.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/v1/cards', cardsRouter)
app.use('/api/v1/divinations', divinationsRouter)
app.use('/api/v1/themes', themesRouter)

// Any unmatched /api/* path must return JSON 404 — never fall through to the
// SPA, which would confusingly return index.html with HTTP 200 for a typo'd
// API URL.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ---------------------------------------------------------------------------
// 6. H5 SPA
// In production nginx is expected to serve this directory directly; the
// Express fallback below is a safety net so `npm run start:prod` still works
// without nginx during smoke tests.
// ---------------------------------------------------------------------------

const devH5Dist = path.join(__dirname, '../../dist/dev/h5')
const buildH5Dist = path.join(__dirname, '../../dist/build/h5')
const h5Dist = config.isProd
  ? buildH5Dist
  : (fs.existsSync(devH5Dist) ? devH5Dist : buildH5Dist)

// Hashed asset files ship with a year-long immutable Cache-Control; the
// vite build emits everything under /assets/ with a content hash so this
// is safe. index.html is served below with no-cache.
app.use(
  express.static(h5Dist, {
    maxAge: '1y',
    immutable: true,
    etag: true,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  }),
)

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(h5Dist, 'index.html'))
})

// ---------------------------------------------------------------------------
// 7. Terminal error handler
// ---------------------------------------------------------------------------

app.use((err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, _next: express.NextFunction) => {
  // pino-http attaches a logger to req; fall back to module logger if absent.
  const log = (req as { log?: typeof logger }).log ?? logger
  // Middleware like body-parser throws HttpError with .status (e.g. 413 for
  // payload-too-large). Preserve 4xx so clients see the right reason;
  // anything else is treated as an internal fault.
  const status = err.status ?? err.statusCode
  if (typeof status === 'number' && status >= 400 && status < 500) {
    log.warn({ err, status }, 'client error')
    if (res.headersSent) return
    res.status(status).json({ error: 'Bad request' })
    return
  }
  log.error({ err }, 'unhandled error')
  if (res.headersSent) return
  res.status(500).json({ error: 'Internal server error' })
})

export default app
