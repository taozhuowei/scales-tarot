/**
 * Frontend-backend API contract tests
 * Uses supertest to send real HTTP requests to the Express app in-process.
 * Each assertion verifies that the server response matches the TypeScript
 * interface the frontend expects (TarotCardInfo, ReadingResult from tarotReading.ts).
 *
 * This file is the source of truth for the API contract between:
 *   - app/src/api/cards.ts   ←→  GET  /api/v1/cards
 *   - app/src/api/readings.ts ←→  POST /api/v1/readings
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../server/src/app'

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
// POST /api/v1/readings
// Frontend contract: fetchReading(drawn) → Promise<ReadingResult>
// Request body: { cards: [{ cardId: string, position: 'upright' | 'reversed' }] }
// Expected shape: { result: 'positive'|'negative', score: number, cardDetails: CardDetail[] }
// ---------------------------------------------------------------------------

describe('POST /api/v1/readings', () => {
  const VALID_BODY = {
    spreadKind: 'three_card',
    cards: [
      { cardId: 'the_fool', position: 'upright' },
      { cardId: 'cups_ace', position: 'upright' },
      { cardId: 'swords_2', position: 'reversed' },
    ],
  }

  it('returns 200 for a valid three-card request', async () => {
    const res = await request(app).post('/api/v1/readings').send(VALID_BODY)
    expect(res.status).toBe(200)
  })

  it('response satisfies ReadingResult shape', async () => {
    const res = await request(app).post('/api/v1/readings').send(VALID_BODY)
    expect(['positive', 'negative']).toContain(res.body.result)
    expect(typeof res.body.score).toBe('number')
    expect(Array.isArray(res.body.cardDetails)).toBe(true)
  })

  it('cardDetails length matches submitted card count', async () => {
    const res = await request(app).post('/api/v1/readings').send(VALID_BODY)
    expect(res.body.cardDetails).toHaveLength(3)
  })

  it('each cardDetail satisfies CardDetail shape', async () => {
    const res = await request(app).post('/api/v1/readings').send(VALID_BODY)
    for (const detail of res.body.cardDetails) {
      expect(['upright', 'reversed']).toContain(detail.position)
      expect(typeof detail.meaning).toBe('string')
      expect(detail.meaning.length).toBeGreaterThan(0)
      // nested card object satisfies TarotCardInfo shape
      expect(typeof detail.card.id).toBe('string')
      expect(typeof detail.card.image).toBe('string')
      expect(['major', 'minor']).toContain(detail.card.type)
    }
  })

  it('returns the_fool score of 7 (major ×1.3 multiplier verified end-to-end)', async () => {
    const res = await request(app)
      .post('/api/v1/readings')
      .send({ spreadKind: 'single_card', cards: [{ cardId: 'the_fool', position: 'upright' }] })
    expect(res.body.score).toBe(7)
    expect(res.body.result).toBe('positive')
  })

  it('returns 400 when cards array is empty', async () => {
    const res = await request(app).post('/api/v1/readings').send({ spreadKind: 'three_card', cards: [] })
    expect(res.status).toBe(400)
    expect(typeof res.body.error).toBe('string')
  })

  it('returns 400 when cards field is missing', async () => {
    const res = await request(app).post('/api/v1/readings').send({ spreadKind: 'three_card' })
    expect(res.status).toBe(400)
    expect(typeof res.body.error).toBe('string')
  })

  it('returns 400 when spreadKind is missing', async () => {
    const res = await request(app)
      .post('/api/v1/readings')
      .send({ cards: [{ cardId: 'the_fool', position: 'upright' }] })
    expect(res.status).toBe(400)
    expect(typeof res.body.error).toBe('string')
  })

  it('returns 400 when spreadKind card count mismatches', async () => {
    const res = await request(app)
      .post('/api/v1/readings')
      .send({ spreadKind: 'three_card', cards: [{ cardId: 'the_fool', position: 'upright' }] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/requires exactly 3 cards/)
  })

  it('returns 422 when a card id does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/readings')
      .send({ spreadKind: 'single_card', cards: [{ cardId: 'not_a_real_card', position: 'upright' }] })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch('not_a_real_card')
  })

  it('CORS header is present', async () => {
    const res = await request(app).get('/api/v1/cards')
    expect(res.headers['access-control-allow-origin']).toBe('*')
  })
})
