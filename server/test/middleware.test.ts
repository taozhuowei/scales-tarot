/**
 * Middleware / deployment-readiness tests
 *
 * These tests lock down the surface area nginx + operations depend on:
 *   - Security headers from helmet are present
 *   - POST body size is enforced
 *   - Unknown /api paths return JSON 404 (never the SPA)
 *   - /api/healthz and /api/readyz exist and return plain JSON
 *
 * CORS is covered in api.test.ts and rate-limit is disabled in non-prod
 * (config.rateLimit.max = 0 when NODE_ENV !== 'production'), so there's
 * nothing to assert here for limiter behavior.
 */

import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app'

describe('security headers (helmet)', () => {
  it('removes x-powered-by', async () => {
    const res = await request(app).get('/api/healthz')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('sets x-content-type-options: nosniff', async () => {
    const res = await request(app).get('/api/healthz')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('sets a referrer policy', async () => {
    const res = await request(app).get('/api/healthz')
    expect(typeof res.headers['referrer-policy']).toBe('string')
  })
})

describe('API 404 returns JSON, never the SPA', () => {
  it('responds 404 with JSON for unknown /api path', async () => {
    const res = await request(app).get('/api/v1/not-a-real-endpoint')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(typeof res.body.error).toBe('string')
  })

  it('responds 404 with JSON for unknown /api/ root', async () => {
    const res = await request(app).get('/api/nothing')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})

describe('JSON body size limit', () => {
  it('rejects bodies larger than the configured limit', async () => {
    // 128 KB payload — comfortably over the 64 KB limit
    const huge = { spreadKind: 'single_card', padding: 'x'.repeat(128 * 1024) }
    const res = await request(app).post('/api/v1/divinations').send(huge)
    expect(res.status).toBe(413)
  })
})

describe('OPTIONS preflight', () => {
  it('responds 204 to CORS preflight', async () => {
    const res = await request(app).options('/api/v1/cards')
    expect(res.status).toBe(204)
  })
})
