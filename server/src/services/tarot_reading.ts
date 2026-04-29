/**
 * Tarot Reading Service
 *
 * Purpose:
 *   Owns the full divination pipeline on the backend — from random card
 *   selection through scoring/interpretation — so the frontend never holds
 *   any draw randomness or scoring logic.
 *
 * Why:
 *   Previously the frontend shuffled and drew cards locally, then POSTed the
 *   chosen cards to /api/v1/readings for scoring. Splitting the random source
 *   between client and server made the contract awkward and harder to audit
 *   (replay, fairness, future server-side personalization). This module
 *   centralizes both steps behind `performDivination()`.
 *
 * Data flow:
 *   getAllCards() ──▶ Fisher-Yates shuffle ──▶ pick N (N depends on spread)
 *                                              │
 *                                              ▼
 *                                        DrawnInput[]
 *                                              │
 *                                              ▼
 *                                      generateReading()
 *                                              │
 *                                              ▼
 *                                  { drawn, reading: ReadingResult }
 *
 * Random source:
 *   Uses node:crypto via utils/secure_random. The shuffle and orientation
 *   steps therefore draw from the platform CSPRNG. This is overkill for a
 *   tarot demo but keeps the project-wide ban on Math.random consistent
 *   and removes any predictability concerns from v8's PRNG state.
 */

import { getAllCards, getCardById, type TarotCard } from './card_loader'
import { randomBelow, randomBool } from '../utils/secure_random'

export interface DrawnInput {
  cardId: string
  position: 'upright' | 'reversed'
}

export interface CardDetail {
  card: TarotCard
  position: 'upright' | 'reversed'
  meaning: string
}

export interface ReadingResult {
  result: 'positive' | 'negative'
  score: number
  cardDetails: CardDetail[]
}

export interface DivinationOutput {
  /** Echo of the request so callers can branch on spread without keeping
   *  request-side state. Today only `single_card` is supported; this field
   *  is the protocol's extension point for future multi-card spreads. */
  spreadKind: 'single_card'
  drawn: DrawnInput[]
  reading: ReadingResult
}

// Spread → number of cards drawn. Currently single-card only; extending to
// multi-card spreads later means adding entries here AND extending the route
// validator. Keep this list and the route's zod enum in lock-step.
const SPREAD_DRAW_COUNT: Record<string, number> = {
  single_card: 1,
}

// Base sentiment weights: positive = +3, negative = -3, neutral = 0
const SENTIMENT_BASE_WEIGHT: Record<string, number> = {
  positive: 3,
  negative: -3,
  neutral: 0
}

/**
 * Score a single drawn card.
 * Rules:
 *  - Base score from sentiment (+3/-3/0)
 *  - Position/sentiment alignment: matching → +2 or -2, mismatching → +1 or -1
 *  - Neutral cards: upright = +1, reversed = -1
 *  - Major Arcana: score × 1.3 (rounded)
 */
function getCardScore(card: TarotCard, position: 'upright' | 'reversed'): number {
  const meaning = position === 'upright' ? card.upright : card.reversed
  const sentiment = meaning.sentiment

  let score = SENTIMENT_BASE_WEIGHT[sentiment] ?? 0

  if (sentiment === 'neutral') {
    score = position === 'upright' ? 1 : -1
  } else {
    const position_sentiment = position === 'upright' ? card.upright.sentiment : card.reversed.sentiment
    if (position_sentiment === sentiment) {
      score += sentiment === 'positive' ? 2 : -2
    } else {
      score += sentiment === 'positive' ? -1 : 1
    }
  }

  if (card.type === 'major') {
    score = Math.round(score * 1.3)
  }

  return score
}

/**
 * Generate a reading from drawn card IDs + positions.
 * Total score > 0 → positive (yes), < 0 → negative (no). Ties resolve by
 * upright count (more upright wins; reversed wins only on a strict majority).
 *
 * Kept exported because integration tests and the divination service both
 * depend on it; do not collapse into performDivination.
 */
export function generateReading(inputs: DrawnInput[]): ReadingResult {
  // Guard against the empty-array edge case. Without this, the function
  // walks through fine and the tie-break branch produces a misleading
  // `{ result: 'positive', score: 1 }` from zero cards. The route layer
  // currently never calls us with `[]` (every spread maps to ≥ 1 cards),
  // but exporting this function makes that an enforceable contract.
  if (inputs.length === 0) {
    throw new Error('generateReading requires at least one drawn card')
  }

  const resolved = inputs.map(({ cardId, position }) => {
    const card = getCardById(cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)
    return { card, position }
  })

  const scores = resolved.map(({ card, position }) => getCardScore(card, position))
  let total_score = scores.reduce((sum, s) => sum + s, 0)

  if (total_score === 0) {
    const upright_count = resolved.filter(r => r.position === 'upright').length
    const reversed_count = resolved.filter(r => r.position === 'reversed').length
    total_score = upright_count >= reversed_count ? 1 : -1
  }

  return {
    result: total_score > 0 ? 'positive' : 'negative',
    score: total_score,
    cardDetails: resolved.map(({ card, position }) => ({
      card,
      position,
      meaning: position === 'upright' ? card.upright.meaning : card.reversed.meaning
    }))
  }
}

/**
 * Fisher-Yates in-place shuffle. Operates on a fresh copy so callers can pass
 * the cached card list without mutating it. Uses the CSPRNG-backed
 * `randomBelow` helper — see file header note on random source.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Run a complete divination: shuffle the deck, pick N cards (N is fixed per
 * spread), randomly orient each card upright/reversed, and produce the
 * scored interpretation.
 *
 * Throws on unknown spreadKind — the route layer validates first, so this is
 * a defensive backstop, not the primary error surface.
 */
export function performDivination(spreadKind: 'single_card'): DivinationOutput {
  const draw_count = SPREAD_DRAW_COUNT[spreadKind]
  if (draw_count === undefined) {
    throw new Error(`Unknown spreadKind: ${spreadKind}`)
  }

  const shuffled = shuffle(getAllCards())
  const picked = shuffled.slice(0, draw_count)

  const drawn: DrawnInput[] = picked.map(card => ({
    cardId: card.id,
    position: randomBool() ? 'upright' : 'reversed',
  }))

  const reading = generateReading(drawn)
  return { spreadKind, drawn, reading }
}
