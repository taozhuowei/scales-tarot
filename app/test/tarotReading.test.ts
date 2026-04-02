import { describe, expect, it } from 'vitest'
import { generateReading, loadAllCards, drawThreeCards, type DrawnResult } from '../src/utils/tarotReading'

describe('tarotReading', () => {
  it('loads all 78 tarot cards correctly', () => {
    const cards = loadAllCards()
    expect(cards.length).toBe(78)
    const fool = cards.find(c => c.id === 'the_fool')
    expect(fool).toBeDefined()
    expect(fool?.image).toContain('major_arcana_00_the_fool.jpeg')
  })

  it('draws 3 random cards with positions', () => {
    const cards = loadAllCards()
    const drawn = drawThreeCards(cards)
    expect(drawn.length).toBe(3)
    drawn.forEach(d => {
      expect(d.card).toBeDefined()
      expect(['upright', 'reversed']).toContain(d.position)
    })
  })

  it('generates a positive reading result when score > 0', () => {
    const mockPositiveCard = loadAllCards().find(c => c.id === 'the_sun')!
    const drawn: DrawnResult[] = [
      { card: mockPositiveCard, position: 'upright' }, // positive
      { card: mockPositiveCard, position: 'upright' }, // positive
      { card: mockPositiveCard, position: 'upright' }  // positive
    ]
    const reading = generateReading(drawn)
    expect(reading.result).toBe('yes')
    expect(reading.cardDetails.length).toBe(3)
    expect(reading.cardDetails[0].meaning).toBe(mockPositiveCard.upright.meaning)
  })

  it('generates a negative reading result when score < 0', () => {
    const mockNegativeCard = loadAllCards().find(c => c.id === 'the_tower')!
    const drawn: DrawnResult[] = [
      { card: mockNegativeCard, position: 'upright' }, // negative
      { card: mockNegativeCard, position: 'upright' }, // negative
      { card: mockNegativeCard, position: 'upright' }  // negative
    ]
    const reading = generateReading(drawn)
    expect(reading.result).toBe('no')
  })

  it('generates an uncertain reading result when score == 0', () => {
    const mockNeutralCard = loadAllCards().find(c => c.id === 'the_fool')!
    const drawn: DrawnResult[] = [
      { card: mockNeutralCard, position: 'upright' }, // positive (+1)
      { card: mockNeutralCard, position: 'reversed' } // negative (-1)
    ]
    const reading = generateReading(drawn)
    expect(reading.result).toBe('uncertain')
  })
})
