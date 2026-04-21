/**
 * Readings Router
 * POST /api/v1/readings — Accepts drawn card IDs + positions + spreadKind, returns interpretation.
 * Body: { cards: [{ cardId: string, position: 'upright' | 'reversed' }], spreadKind: string }
 */

import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { generateReading } from '../services/tarot_reading'

const router = Router()

const SPREAD_CARD_COUNTS: Record<string, number> = {
  single_card: 1,
  three_card: 3,
  cross_spread: 5,
}

const cardSchema = z.object({
  cardId: z.string().min(1, 'cardId must be a non-empty string'),
  position: z.enum(['upright', 'reversed'], {
    message: "position must be 'upright' or 'reversed'",
  }),
})

const readingBodySchema = z.object({
  cards: z.array(cardSchema).min(1, 'cards array is required and must not be empty'),
  spreadKind: z.string().min(1, 'spreadKind is required and must be a non-empty string'),
}).superRefine((data, ctx) => {
  const expectedCount = SPREAD_CARD_COUNTS[data.spreadKind]
  if (expectedCount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unknown spreadKind: ${data.spreadKind}`,
      path: ['spreadKind'],
    })
    return
  }
  if (data.cards.length !== expectedCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `spreadKind '${data.spreadKind}' requires exactly ${expectedCount} cards, but received ${data.cards.length}`,
      path: ['cards'],
    })
  }
})

router.post('/', (req: Request, res: Response) => {
  const parseResult = readingBodySchema.safeParse(req.body)

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    const code = firstError.path.join('.') || 'INVALID_BODY'
    res.status(400).json({ error: firstError.message, code })
    return
  }

  try {
    const cards = parseResult.data!.cards
    res.json(generateReading(cards))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reading failed'
    res.status(500).json({ error: message, code: 'READING_GENERATION_FAILED' })
  }
})

export default router
