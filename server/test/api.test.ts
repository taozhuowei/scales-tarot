/**
 * Frontend-backend API contract tests
 *
 * Uses supertest to send real HTTP requests to the Express app in-process.
 * Each assertion verifies that the server response matches the TypeScript
 * interface the frontend expects (TarotCardInfo, ReadingResult, DrawnInput).
 *
 * This file is the source of truth for the API contract between:
 *   - app/src/api/cards.ts       ←→  GET  /api/v1/cards
 *   - app/src/api/divinations.ts ←→  POST /api/v1/divinations
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app'

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

describe('GET /api/health (legacy synonym)', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.timestamp).toBe('string')
  })
})

describe('GET /api/healthz (liveness)', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/healthz')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /api/readyz (readiness)', () => {
  it('returns 200 with card count when assets load', async () => {
    const res = await request(app).get('/api/readyz')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ready')
    expect(res.body.cards).toBe(78)
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/cards
// Frontend contract: fetchAllCards() → Promise<TarotCardInfo[]>
// Expected shape: { cards: TarotCardInfo[] }
// ---------------------------------------------------------------------------

describe('GET /api/v1/cards', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/v1/cards')
    expect(res.status).toBe(200)
  })

  it('returns exactly 78 cards', async () => {
    const res = await request(app).get('/api/v1/cards')
    expect(Array.isArray(res.body.cards)).toBe(true)
    expect(res.body.cards).toHaveLength(78)
  })

  it('each card satisfies TarotCardInfo shape', async () => {
    const res = await request(app).get('/api/v1/cards')
    for (const card of res.body.cards) {
      expect(typeof card.id).toBe('string')
      expect(typeof card.name).toBe('string')
      expect(typeof card.nameEn).toBe('string')
      expect(typeof card.number).toBe('number')
      expect(['major', 'minor']).toContain(card.type)
      expect(typeof card.image).toBe('string')
      // upright meaning
      expect(Array.isArray(card.upright.keywords)).toBe(true)
      expect(typeof card.upright.meaning).toBe('string')
      expect(['positive', 'negative', 'neutral']).toContain(card.upright.sentiment)
      // reversed meaning
      expect(Array.isArray(card.reversed.keywords)).toBe(true)
      expect(typeof card.reversed.meaning).toBe('string')
      expect(['positive', 'negative', 'neutral']).toContain(card.reversed.sentiment)
    }
  })

  it('major arcana cards have no suit field', async () => {
    const res = await request(app).get('/api/v1/cards')
    const majorCards = res.body.cards.filter((c: { type: string }) => c.type === 'major')
    expect(majorCards.length).toBeGreaterThan(0)
    for (const card of majorCards) {
      expect(card.suit).toBeUndefined()
    }
  })

  it('minor arcana cards have a valid suit field', async () => {
    const res = await request(app).get('/api/v1/cards')
    const minorCards = res.body.cards.filter((c: { type: string }) => c.type === 'minor')
    expect(minorCards.length).toBeGreaterThan(0)
    for (const card of minorCards) {
      expect(['wands', 'cups', 'swords', 'pentacles']).toContain(card.suit)
    }
  })

  it('image paths are origin-relative under /static/themes/', async () => {
    const res = await request(app).get('/api/v1/cards')
    for (const card of res.body.cards) {
      expect(card.image).toMatch(/^\/static\/themes\/golden_dawn\/tarot\//)
    }
  })

  it('the_fool has correct major arcana image path', async () => {
    const res = await request(app).get('/api/v1/cards')
    const fool = res.body.cards.find((c: { id: string }) => c.id === 'the_fool')
    expect(fool.image).toBe(
      '/static/themes/golden_dawn/tarot/major/major_arcana_00_the_fool.jpeg'
    )
  })
})

// ---------------------------------------------------------------------------
// POST /api/v1/divinations
// Frontend contract: requestDivination(spreadKind?) → Promise<DivinationOutput>
// Request body: { spreadKind?: 'single_card' }   (defaults to single_card)
// Expected response shape:
//   { drawn:   [{ cardId: string, position: 'upright' | 'reversed' }],
//     reading: { result: 'positive'|'negative', score: number, cardDetails: CardDetail[] } }
// ---------------------------------------------------------------------------

describe('POST /api/v1/divinations', () => {
  it('returns 200 with default body (no spreadKind)', async () => {
    const res = await request(app).post('/api/v1/divinations').send({})
    expect(res.status).toBe(200)
    // Server echoes the resolved spread kind so callers don't have to keep
    // request-side state to know what they got. Today the only value is
    // `single_card`; this assertion guards against silently dropping the
    // field again the way the original C2 wiring did.
    expect(res.body.spreadKind).toBe('single_card')
  })

  it('returns 200 when spreadKind is omitted (no body at all)', async () => {
    const res = await request(app).post('/api/v1/divinations')
    expect(res.status).toBe(200)
  })

  it('returns 200 for explicit spreadKind: single_card', async () => {
    const res = await request(app)
      .post('/api/v1/divinations')
      .send({ spreadKind: 'single_card' })
    expect(res.status).toBe(200)
  })

  it('drawn contains exactly one card for single_card spread', async () => {
    const res = await request(app)
      .post('/api/v1/divinations')
      .send({ spreadKind: 'single_card' })
    expect(Array.isArray(res.body.drawn)).toBe(true)
    expect(res.body.drawn).toHaveLength(1)
    expect(typeof res.body.drawn[0].cardId).toBe('string')
    expect(['upright', 'reversed']).toContain(res.body.drawn[0].position)
  })

  it('reading satisfies ReadingResult shape', async () => {
    const res = await request(app).post('/api/v1/divinations').send({})
    expect(['positive', 'negative']).toContain(res.body.reading.result)
    expect(typeof res.body.reading.score).toBe('number')
    expect(Array.isArray(res.body.reading.cardDetails)).toBe(true)
    expect(res.body.reading.cardDetails).toHaveLength(1)
  })

  it('cardDetails entries satisfy CardDetail shape', async () => {
    const res = await request(app).post('/api/v1/divinations').send({})
    for (const detail of res.body.reading.cardDetails) {
      expect(['upright', 'reversed']).toContain(detail.position)
      expect(typeof detail.meaning).toBe('string')
      expect(detail.meaning.length).toBeGreaterThan(0)
      expect(typeof detail.card.id).toBe('string')
      expect(typeof detail.card.image).toBe('string')
      expect(['major', 'minor']).toContain(detail.card.type)
    }
  })

  it('drawn[0].cardId matches reading.cardDetails[0].card.id', async () => {
    const res = await request(app).post('/api/v1/divinations').send({})
    expect(res.body.drawn[0].cardId).toBe(res.body.reading.cardDetails[0].card.id)
    expect(res.body.drawn[0].position).toBe(res.body.reading.cardDetails[0].position)
  })

  it('returns 400 with code "spreadKind" for unknown spread', async () => {
    const res = await request(app)
      .post('/api/v1/divinations')
      .send({ spreadKind: 'unknown_spread' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Unknown spreadKind')
    expect(res.body.code).toBe('spreadKind')
  })

  it('drawn cards are random across many calls (set size > 1 over 50 trials)', async () => {
    // Probability of drawing the same card 50 times in a row from 78 cards:
    // (1/78)^49 ≈ 10^-93. Effectively impossible — a constant value here
    // means the random source is broken or the deck shrunk.
    const drawn_ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const res = await request(app).post('/api/v1/divinations').send({})
      drawn_ids.add(res.body.drawn[0].cardId)
    }
    expect(drawn_ids.size).toBeGreaterThan(1)
  })

  it('CORS header is present', async () => {
    const res = await request(app).get('/api/v1/cards')
    expect(res.headers['access-control-allow-origin']).toBe('*')
  })
})
