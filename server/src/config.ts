/**
 * Server runtime configuration
 *
 * Single source of truth for env-driven server settings. Loaded once at
 * import time, validated, and frozen. Every other module imports from here
 * rather than reading process.env directly — this makes the full config
 * surface grep-able and keeps validation centralized.
 *
 * Why defaults differ by mode:
 *   - dev  binds 0.0.0.0 so LAN devices (e.g. WeChat devtools on another
 *          machine) can reach the API during mini-program debugging.
 *   - prod binds 127.0.0.1 on the assumption nginx terminates TLS and
 *          reverse-proxies /api to this process. Override HOST=0.0.0.0
 *          only when Node is intentionally exposed directly.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const IS_PROD = NODE_ENV === 'production'
const IS_TEST = NODE_ENV === 'test'

function parsePort(raw: string | undefined, fallback: number): number {
  const n = raw === undefined ? fallback : Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`[config] Invalid PORT: ${raw}`)
  }
  return n
}

function parseCorsOrigins(raw: string | undefined): string[] | '*' {
  if (raw === undefined || raw.trim() === '') {
    // Empty in prod = same-origin only (no CORS). In dev = permissive.
    return IS_PROD ? [] : '*'
  }
  if (raw.trim() === '*') return '*'
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

export const config = Object.freeze({
  nodeEnv: NODE_ENV,
  isProd: IS_PROD,

  host: process.env.HOST ?? (IS_PROD ? '127.0.0.1' : '0.0.0.0'),
  port: parsePort(process.env.PORT, 3000),

  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),

  logLevel: process.env.LOG_LEVEL ?? (IS_TEST ? 'silent' : IS_PROD ? 'info' : 'debug'),

  // Body size limit for POST /api/v1/readings — a full 10-card spread is
  // well under 4 KB; 64 KB leaves ample headroom without inviting abuse.
  jsonBodyLimit: '64kb',

  // Rate limit only applies to /api/* in prod; disabled in dev to avoid
  // surprising contributors running integration tests in tight loops.
  rateLimit: {
    windowMs: 60_000,
    max: IS_PROD ? 120 : 0, // 0 disables the limiter
  },
})
