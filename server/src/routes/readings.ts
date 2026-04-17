/**
 * Readings Router
 * POST /api/v1/readings — Accepts drawn card IDs + positions + spreadKind, returns interpretation.
 * Body: { cards: [{ cardId: string, position: 'upright' | 'reversed' }], spreadKind: string }
 */

import { Router, type Request, type Response } from 'express'
import { generateReading, type DrawnInput } from '../services/tarot_reading'

const router = Router()

const VALID_POSITIONS = new Set(['upright', 'reversed'])

const SPREAD_CARD_COUNTS: Record<string, number> = {
  single_card: 1,
  three_card: 3,
  cross_spread: 5,
}

interface ValidationError {
  error: string
  code?: string
}

function validateReadingBody(body: unknown): { valid: false; error: ValidationError } | { valid: true; data: { cards: DrawnInput[]; spreadKind: string } } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: { error: 'Request body must be an object', code: 'INVALID_BODY' } }
  }

  const b = body as Record<string, unknown>

  if (!Array.isArray(b.cards) || b.cards.length === 0) {
    return { valid: false, error: { error: 'cards array is required and must not be empty', code: 'MISSING_CARDS' } }
  }

  if (typeof b.spreadKind !== 'string' || b.spreadKind.length === 0) {
    return { valid: false, error: { error: 'spreadKind is required and must be a non-empty string', code: 'MISSING_SPREAD_KIND' } }
  }

  const expectedCount = SPREAD_CARD_COUNTS[b.spreadKind]
  if (expectedCount === undefined) {
    return { valid: false, error: { error: `Unknown spreadKind: ${b.spreadKind}`, code: 'UNKNOWN_SPREAD_KIND' } }
  }

  if (b.cards.length !== expectedCount) {
    return { valid: false, error: { error: `spreadKind '${b.spreadKind}' requires exactly ${expectedCount} cards, but received ${b.cards.length}`, code: 'CARD_COUNT_MISMATCH' } }
  }

  const cards: DrawnInput[] = []
  for (let i = 0; i < b.cards.length; i++) {
    const item = b.cards[i]
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: { error: `cards[${i}] must be an object`, code: 'INVALID_CARD_SHAPE' } }
    }
    const c = item as Record<string, unknown>
    if (typeof c.cardId !== 'string' || c.cardId.length === 0) {
      return { valid: false, error: { error: `cards[${i}].cardId must be a non-empty string`, code: 'INVALID_CARD_ID' } }
    }
    if (typeof c.position !== 'string' || !VALID_POSITIONS.has(c.position)) {
      return { valid: false, error: { error: `cards[${i}].position must be 'upright' or 'reversed'`, code: 'INVALID_CARD_POSITION' } }
    }
    cards.push({ cardId: c.cardId, position: c.position as 'upright' | 'reversed' })
  }

  return { valid: true, data: { cards, spreadKind: b.spreadKind } }
}

router.post('/', (req: Request, res: Response) => {
  const validation = validateReadingBody(req.body)

  if (!validation.valid) {
    res.status(400).json(validation.error)
    return
  }

  try {
    res.json(generateReading(validation.data.cards))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reading failed'
    res.status(422).json({ error: message, code: 'READING_GENERATION_FAILED' })
  }
})

export default router
