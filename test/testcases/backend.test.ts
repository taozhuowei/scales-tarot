/**
 * Backend unit tests
 * Tests card_loader and generateReading service logic using real JSON card data.
 * No mocking — all assertions are against deterministic real-data values.
 *
 * Score rules (from tarot_reading.ts):
 *   minor non-neutral: base ±3 + alignment ±2 = ±5
 *   major non-neutral: Math.round(±5 × 1.3) = +7 / -6  (JS round-half-up asymmetry)
 *   major neutral upright:   Math.round(1 × 1.3) = 1
 *   major neutral reversed:  Math.round(-1 × 1.3) = -1
 */

import { describe, it, expect } from 'vitest'
import { getAllCards, getCardById } from '../../server/src/services/card_loader'
import { generateReading } from '../../server/src/services/tarot_reading'

// ---------------------------------------------------------------------------
// card_loader
// ---------------------------------------------------------------------------

describe('card_loader', () => {
  it('loads exactly 78 cards', () => {
    expect(getAllCards()).toHaveLength(78)
  })

  it('returns the same reference on repeated calls (singleton)', () => {
    expect(getAllCards()).toBe(getAllCards())
  })

  it('finds a card by id', () => {
    const card = getCardById('the_fool')
    expect(card).toBeDefined()
    expect(card!.id).toBe('the_fool')
    expect(card!.name).toBe('愚者')
  })

  it('returns undefined for an unknown id', () => {
    expect(getCardById('nonexistent_card')).toBeUndefined()
  })

  it('builds the correct image path for a major arcana card', () => {
    const card = getCardById('the_fool')!
    expect(card.image).toBe(
      '/static/themes/golden_dawn/tarot/major/major_arcana_00_the_fool.jpeg'
    )
  })

  it('builds the correct image path for a minor arcana card', () => {
    const card = getCardById('cups_ace')!
    expect(card.image).toBe(
      '/static/themes/golden_dawn/tarot/minor/cups/minor_arcana_cups_01_ace_of_cups.jpeg'
    )
  })

  it('minor arcana cards carry a suit field', () => {
    expect(getCardById('cups_ace')!.suit).toBe('cups')
  })

  it('major arcana cards have no suit field', () => {
    expect(getCardById('the_fool')!.suit).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// generateReading — per-card scoring paths
//
// Reference cards used here:
//   cups_ace  minor positive   upright.sentiment=positive, reversed.sentiment=negative
//   swords_2  minor negative   upright.sentiment=negative, reversed.sentiment=positive
//   the_fool  major positive   upright.sentiment=positive, reversed.sentiment=negative
//   the_devil major negative   upright.sentiment=negative, reversed.sentiment=positive
//   the_hierophant major neutral  both sentiments=neutral
// ---------------------------------------------------------------------------

describe('generateReading — scoring', () => {
  it('minor positive upright scores +5', () => {
    const r = generateReading([{ cardId: 'cups_ace', position: 'upright' }])
    expect(r.score).toBe(5)
    expect(r.result).toBe('positive')
  })

  it('minor negative upright scores -5', () => {
    const r = generateReading([{ cardId: 'swords_2', position: 'upright' }])
    expect(r.score).toBe(-5)
    expect(r.result).toBe('negative')
  })

  it('minor positive reversed scores -5 (reversed.sentiment=negative)', () => {
    const r = generateReading([{ cardId: 'cups_ace', position: 'reversed' }])
    expect(r.score).toBe(-5)
    expect(r.result).toBe('negative')
  })

  it('minor negative reversed scores +5 (reversed.sentiment=positive)', () => {
    // swords_2 has reversed.sentiment=positive — a redemptive reversal
    const r = generateReading([{ cardId: 'swords_2', position: 'reversed' }])
    expect(r.score).toBe(5)
    expect(r.result).toBe('positive')
  })

  it('major positive upright scores +7 (×1.3 multiplier)', () => {
    const r = generateReading([{ cardId: 'the_fool', position: 'upright' }])
    expect(r.score).toBe(7) // Math.round(5 × 1.3) = Math.round(6.5) = 7
  })

  it('major negative upright scores -6 (Math.round(-6.5) rounds toward +∞)', () => {
    const r = generateReading([{ cardId: 'the_devil', position: 'upright' }])
    expect(r.score).toBe(-6) // Math.round(-5 × 1.3) = Math.round(-6.5) = -6 (not -7)
  })

  it('major neutral upright scores +1', () => {
    const r = generateReading([{ cardId: 'the_hierophant', position: 'upright' }])
    expect(r.score).toBe(1)
  })

  it('major neutral reversed scores -1', () => {
    const r = generateReading([{ cardId: 'the_hierophant', position: 'reversed' }])
    expect(r.score).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// generateReading — multi-card results and cardDetails
// ---------------------------------------------------------------------------

describe('generateReading — result and details', () => {
  it('returns yes for a net positive score (3 positive minor upright)', () => {
    const r = generateReading([
      { cardId: 'cups_ace', position: 'upright' },
      { cardId: 'cups_ace', position: 'upright' },
      { cardId: 'cups_ace', position: 'upright' },
    ])
    expect(r.score).toBe(15)
    expect(r.result).toBe('positive')
  })

  it('returns no for a net negative score (3 negative minor upright)', () => {
    const r = generateReading([
      { cardId: 'swords_2', position: 'upright' },
      { cardId: 'swords_2', position: 'upright' },
      { cardId: 'swords_2', position: 'upright' },
    ])
    expect(r.score).toBe(-15)
    expect(r.result).toBe('negative')
  })

  it('returns correct total for a mixed three-card spread', () => {
    // +5 (cups_ace up) + (-5) (swords_2 up) + (+5) (swords_2 reversed) = +5
    const r = generateReading([
      { cardId: 'cups_ace', position: 'upright' },
      { cardId: 'swords_2', position: 'upright' },
      { cardId: 'swords_2', position: 'reversed' },
    ])
    expect(r.score).toBe(5)
    expect(r.result).toBe('positive')
  })

  it('populates cardDetails with the drawn position and meaning', () => {
    const r = generateReading([{ cardId: 'cups_ace', position: 'upright' }])
    expect(r.cardDetails).toHaveLength(1)
    const detail = r.cardDetails[0]
    expect(detail.position).toBe('upright')
    expect(detail.card.id).toBe('cups_ace')
    expect(detail.meaning).toBe(getCardById('cups_ace')!.upright.meaning)
  })

  it('uses reversed meaning when position is reversed', () => {
    const r = generateReading([{ cardId: 'cups_ace', position: 'reversed' }])
    expect(r.cardDetails[0].meaning).toBe(getCardById('cups_ace')!.reversed.meaning)
  })

  it('throws when a card id does not exist', () => {
    expect(() =>
      generateReading([{ cardId: 'not_a_real_card', position: 'upright' }])
    ).toThrow('Card not found: not_a_real_card')
  })
})

// ---------------------------------------------------------------------------
// generateReading — tie-break (total score = 0)
//
// Tie-break logic: upright_count >= reversed_count → score=+1 (yes)
//                  upright_count <  reversed_count → score=-1 (no)
//
// Score-zero constructions using real cards (no mocking needed):
//   2 upright:   cups_ace up (+5) + swords_2 up (-5) = 0, 2 up / 0 rv
//   2 reversed:  swords_2 rv (+5) + cups_ace rv (-5) = 0, 0 up / 2 rv
//   1+1 equal:   cups_ace up (+5) + cups_ace rv (-5) = 0, 1 up / 1 rv
// ---------------------------------------------------------------------------

describe('generateReading — tie-break', () => {
  it('more upright than reversed → upright wins → yes', () => {
    const r = generateReading([
      { cardId: 'cups_ace', position: 'upright' },  // +5
      { cardId: 'swords_2', position: 'upright' },  // -5  → total=0, 2 up / 0 rv
    ])
    expect(r.score).toBe(1)
    expect(r.result).toBe('positive')
  })

  it('more reversed than upright → reversed wins → no', () => {
    const r = generateReading([
      { cardId: 'swords_2', position: 'reversed' }, // +5 (reversed.sentiment=positive)
      { cardId: 'cups_ace', position: 'reversed' }, // -5 (reversed.sentiment=negative)
    ])                                               // total=0, 0 up / 2 rv
    expect(r.score).toBe(-1)
    expect(r.result).toBe('negative')
  })

  it('equal upright and reversed count → upright wins (>=) → yes', () => {
    const r = generateReading([
      { cardId: 'cups_ace', position: 'upright' },  // +5
      { cardId: 'cups_ace', position: 'reversed' }, // -5  → total=0, 1 up / 1 rv
    ])
    expect(r.score).toBe(1)
    expect(r.result).toBe('positive')
  })
})
