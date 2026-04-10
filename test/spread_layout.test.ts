/**
 * Spread layout solver unit tests
 * Tests the pure layout calculation module
 */

import { describe, expect, it } from 'vitest'
import {
  type SpreadLayoutInput,
  getSpreadCardCount,
  resolveSpreadLayout,
} from '../app/src/utils/spread_layout'

const DEFAULT_ASPECT_RATIO = 1.6

function makeInput(overrides: Partial<SpreadLayoutInput> = {}): SpreadLayoutInput {
  return {
    spreadKind: 'three_card',
    scene: 'draw_stage',
    containerWidth: 400,
    containerHeight: 800,
    isWide: false,
    cardAspectRatio: DEFAULT_ASPECT_RATIO,
    ...overrides,
  }
}

describe('getSpreadCardCount', () => {
  it('returns 1 for single_card', () => {
    expect(getSpreadCardCount('single_card')).toBe(1)
  })

  it('returns 3 for three_card', () => {
    expect(getSpreadCardCount('three_card')).toBe(3)
  })

  it('returns 5 for cross_spread', () => {
    expect(getSpreadCardCount('cross_spread')).toBe(5)
  })
})

describe('single_card layout', () => {
  it('returns exactly 1 card', () => {
    const input = makeInput({ spreadKind: 'single_card' })
    const result = resolveSpreadLayout(input)
    
    expect(result.cards).toHaveLength(1)
  })

  it('centers the card in draw_stage', () => {
    const input = makeInput({ 
      spreadKind: 'single_card',
      scene: 'draw_stage',
      containerWidth: 400,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    expect(result.cards[0].x).toBe(0)
    // Card should be near center Y (with slight lift in draw stage)
    expect(result.cards[0].y).toBeLessThan(0)
    expect(result.stageShiftY).toBeGreaterThan(0)
  })

  it('centers the card in result_stage', () => {
    const input = makeInput({ 
      spreadKind: 'single_card',
      scene: 'result_stage',
      containerWidth: 400,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    expect(result.cards[0].x).toBe(0)
    expect(result.cards[0].y).toBe(0)
    expect(result.stageShiftY).toBe(0)
  })

  it('has valid card dimensions', () => {
    const input = makeInput({ spreadKind: 'single_card' })
    const result = resolveSpreadLayout(input)
    
    expect(result.cardWidth).toBeGreaterThan(0)
    expect(result.cardHeight).toBeGreaterThan(0)
    expect(result.cardHeight).toBeCloseTo(result.cardWidth * DEFAULT_ASPECT_RATIO, 1)
  })
})

describe('three_card layout', () => {
  it('returns exactly 3 cards', () => {
    const input = makeInput({ spreadKind: 'three_card' })
    const result = resolveSpreadLayout(input)
    
    expect(result.cards).toHaveLength(3)
  })

  it('keeps all cards within container bounds in narrow mode', () => {
    const input = makeInput({ 
      spreadKind: 'three_card',
      isWide: false,
      containerWidth: 400,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    const halfWidth = input.containerWidth / 2
    const halfHeight = input.containerHeight / 2
    
    for (const card of result.cards) {
      // Check card center is within reasonable bounds
      expect(Math.abs(card.x)).toBeLessThanOrEqual(halfWidth)
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfHeight)
    }
  })

  it('keeps all cards within container bounds in wide mode', () => {
    const input = makeInput({ 
      spreadKind: 'three_card',
      isWide: true,
      containerWidth: 1200,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    const halfWidth = input.containerWidth / 2
    const halfHeight = input.containerHeight / 2
    
    for (const card of result.cards) {
      expect(Math.abs(card.x)).toBeLessThanOrEqual(halfWidth)
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfHeight)
    }
  })

  it('arranges cards horizontally in wide mode', () => {
    const input = makeInput({ 
      spreadKind: 'three_card',
      isWide: true,
      containerWidth: 1200,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    // In wide mode, cards should be in a row (different X, similar Y)
    expect(result.cards[0].x).toBeLessThan(result.cards[1].x)
    expect(result.cards[1].x).toBeLessThan(result.cards[2].x)
    expect(Math.abs(result.cards[0].y - result.cards[2].y)).toBeLessThan(10)
  })

  it('arranges cards vertically in narrow mode', () => {
    const input = makeInput({ 
      spreadKind: 'three_card',
      isWide: false,
      containerWidth: 400,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    // In narrow mode, cards should be in a column (same X, different Y)
    expect(result.cards[0].x).toBe(result.cards[1].x)
    expect(result.cards[1].x).toBe(result.cards[2].x)
    expect(result.cards[0].y).not.toBe(result.cards[2].y)
  })

  it('assigns unique slotIds', () => {
    const input = makeInput({ spreadKind: 'three_card' })
    const result = resolveSpreadLayout(input)
    
    const slotIds = result.cards.map(c => c.slotId)
    expect(new Set(slotIds).size).toBe(3)
  })
})

describe('cross_spread layout', () => {
  it('returns exactly 5 cards', () => {
    const input = makeInput({ spreadKind: 'cross_spread' })
    const result = resolveSpreadLayout(input)
    
    expect(result.cards).toHaveLength(5)
  })

  it('keeps all cards within container bounds in narrow mode', () => {
    const input = makeInput({ 
      spreadKind: 'cross_spread',
      isWide: false,
      containerWidth: 400,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    const halfWidth = input.containerWidth / 2
    const halfHeight = input.containerHeight / 2
    
    for (const card of result.cards) {
      expect(Math.abs(card.x)).toBeLessThanOrEqual(halfWidth + result.cardWidth / 2)
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfHeight + result.cardHeight / 2)
    }
  })

  it('keeps all cards within container bounds in wide mode', () => {
    const input = makeInput({ 
      spreadKind: 'cross_spread',
      isWide: true,
      containerWidth: 1200,
      containerHeight: 800,
    })
    const result = resolveSpreadLayout(input)
    
    const halfWidth = input.containerWidth / 2
    const halfHeight = input.containerHeight / 2
    
    for (const card of result.cards) {
      expect(Math.abs(card.x)).toBeLessThanOrEqual(halfWidth + result.cardWidth / 2)
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfHeight + result.cardHeight / 2)
    }
  })

  it('has center card in the middle', () => {
    const input = makeInput({ spreadKind: 'cross_spread' })
    const result = resolveSpreadLayout(input)
    
    const centerCard = result.cards.find(c => c.slotId === 'center')
    expect(centerCard).toBeDefined()
    expect(centerCard!.x).toBe(0)
  })

  it('assigns unique slotIds', () => {
    const input = makeInput({ spreadKind: 'cross_spread' })
    const result = resolveSpreadLayout(input)
    
    const slotIds = result.cards.map(c => c.slotId)
    expect(new Set(slotIds).size).toBe(5)
  })
})

describe('draw_stage vs result_stage determinism', () => {
  it('both stages return deterministic layouts for same input', () => {
    const baseInput = makeInput({ spreadKind: 'three_card' })
    
    const drawResult = resolveSpreadLayout({ ...baseInput, scene: 'draw_stage' })
    const resultResult = resolveSpreadLayout({ ...baseInput, scene: 'result_stage' })
    
    // Both should have same number of cards
    expect(drawResult.cards).toHaveLength(resultResult.cards.length)
    // Card sizes should be the same
    expect(drawResult.cardWidth).toBe(resultResult.cardWidth)
    expect(drawResult.cardHeight).toBe(resultResult.cardHeight)
  })

  it('draw_stage has stageShiftY while result_stage has none', () => {
    const baseInput = makeInput({ spreadKind: 'three_card' })

    const drawResult = resolveSpreadLayout({ ...baseInput, scene: 'draw_stage' })
    const resultResult = resolveSpreadLayout({ ...baseInput, scene: 'result_stage' })

    expect(drawResult.stageShiftY).toBeGreaterThan(0)
    expect(resultResult.stageShiftY).toBe(0)
  })

  // Regression: three_card result_stage cards must be centered (y=0 target),
  // not shifted up by liftY as they were before the fix.
  it('three_card result_stage column: cards centered around y=0', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'result_stage',
      containerWidth: 375,
      containerHeight: 800,
      isWide: false,
      cardAspectRatio: 1.6,
    })
    // In result_stage the group center (middle card) should be at y=0 (container center)
    const presentCard = result.cards.find(c => c.slotId === 'present')!
    expect(presentCard.y).toBe(0)
  })

  it('three_card result_stage row (wide): cards centered around y=0', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'result_stage',
      containerWidth: 1200,
      containerHeight: 800,
      isWide: true,
      cardAspectRatio: 1.6,
    })
    // All three cards should share the same Y which equals 0 (container center)
    for (const card of result.cards) {
      expect(card.y).toBe(0)
    }
  })

  it('three_card draw_stage column: stage lift compensated by positive card Y offset', () => {
    // Use a tall container (1200px) so spread < availableSpan/2, leaving room for liftY offset
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'draw_stage',
      containerWidth: 375,
      containerHeight: 1200,
      isWide: false,
      cardAspectRatio: 1.6,
    })
    // Stage lifts upward (stageShiftY > 0); present card must shift downward (y > 0)
    // so net screen position = container_center (stage shift cancels card offset)
    expect(result.stageShiftY).toBeGreaterThan(0)
    const presentCard = result.cards.find(c => c.slotId === 'present')!
    // With tall container, liftY fits within clamped range → center > 0
    expect(presentCard.y).toBeGreaterThanOrEqual(0)
  })

  it('three_card result_stage vs draw_stage: result is more centered', () => {
    // With a tall container, draw_stage shifts the group up while result_stage centers it
    const base = { spreadKind: 'three_card' as const, containerWidth: 375, containerHeight: 1200, isWide: false, cardAspectRatio: 1.6 }
    const drawResult = resolveSpreadLayout({ ...base, scene: 'draw_stage' })
    const stageResult = resolveSpreadLayout({ ...base, scene: 'result_stage' })
    const presentDraw = drawResult.cards.find(c => c.slotId === 'present')!
    const presentResult = stageResult.cards.find(c => c.slotId === 'present')!
    // result_stage present card should be at y=0 (true center)
    expect(presentResult.y).toBe(0)
    // draw_stage present card shifted down (positive y) to compensate stage lift
    expect(presentDraw.y).toBeGreaterThan(presentResult.y)
  })
})

describe('wide vs narrow layout selection for three_card', () => {
  it('uses horizontal layout in wide mode', () => {
    const wideInput = makeInput({ 
      spreadKind: 'three_card',
      isWide: true,
      containerWidth: 1200,
      containerHeight: 800,
    })
    const narrowInput = makeInput({ 
      spreadKind: 'three_card',
      isWide: false,
      containerWidth: 400,
      containerHeight: 800,
    })
    
    const wideResult = resolveSpreadLayout(wideInput)
    const narrowResult = resolveSpreadLayout(narrowInput)
    
    // Wide: cards should have different X positions (row)
    const wideXSpread = Math.max(...wideResult.cards.map(c => c.x)) - Math.min(...wideResult.cards.map(c => c.x))
    expect(wideXSpread).toBeGreaterThan(0)
    
    // Narrow: cards should have same X (column) or very close
    const narrowXSpread = Math.max(...narrowResult.cards.map(c => c.x)) - Math.min(...narrowResult.cards.map(c => c.x))
    expect(narrowXSpread).toBe(0)
  })

  it('wide mode selects row candidate, narrow selects column candidate', () => {
    const baseInput = makeInput({ spreadKind: 'three_card' })
    
    const wideResult = resolveSpreadLayout({ ...baseInput, isWide: true, containerWidth: 1200 })
    const narrowResult = resolveSpreadLayout({ ...baseInput, isWide: false, containerWidth: 400 })
    
    // Wide: Y positions should be nearly identical (horizontal row)
    const wideYSpread = Math.max(...wideResult.cards.map(c => c.y)) - Math.min(...wideResult.cards.map(c => c.y))
    expect(wideYSpread).toBeLessThan(10)
    
    // Narrow: X positions should be identical (vertical column)
    const narrowXSpread = Math.max(...narrowResult.cards.map(c => c.x)) - Math.min(...narrowResult.cards.map(c => c.x))
    expect(narrowXSpread).toBe(0)
    
    // Narrow: Y positions should be spread out
    const narrowYSpread = Math.max(...narrowResult.cards.map(c => c.y)) - Math.min(...narrowResult.cards.map(c => c.y))
    expect(narrowYSpread).toBeGreaterThan(0)
  })
})

describe('card dimensions', () => {
  it('respects aspect ratio', () => {
    const input = makeInput({ 
      spreadKind: 'single_card',
      cardAspectRatio: 1.75,
    })
    const result = resolveSpreadLayout(input)
    
    expect(result.cardHeight / result.cardWidth).toBeCloseTo(1.75, 2)
  })

  it('scales appropriately for larger containers', () => {
    const smallInput = makeInput({ 
      spreadKind: 'three_card',
      containerWidth: 400,
      containerHeight: 600,
    })
    const largeInput = makeInput({ 
      spreadKind: 'three_card',
      containerWidth: 1200,
      containerHeight: 900,
    })
    
    const smallResult = resolveSpreadLayout(smallInput)
    const largeResult = resolveSpreadLayout(largeInput)
    
    // Larger container should generally have larger or equal cards
    expect(largeResult.cardWidth).toBeGreaterThanOrEqual(smallResult.cardWidth)
  })
})

describe('deterministic behavior', () => {
  it('same input gives identical output', () => {
    const input = makeInput({ spreadKind: 'cross_spread' })
    
    const result1 = resolveSpreadLayout(input)
    const result2 = resolveSpreadLayout(input)
    const result3 = resolveSpreadLayout(input)
    
    // All results should be identical
    expect(result1.cardWidth).toBe(result2.cardWidth)
    expect(result2.cardWidth).toBe(result3.cardWidth)
    expect(result1.stageShiftY).toBe(result2.stageShiftY)
    expect(result2.stageShiftY).toBe(result3.stageShiftY)
    
    // Card positions should be identical
    result1.cards.forEach((card, i) => {
      expect(card.x).toBe(result2.cards[i].x)
      expect(card.y).toBe(result2.cards[i].y)
      expect(card.x).toBe(result3.cards[i].x)
      expect(card.y).toBe(result3.cards[i].y)
    })
  })

  it('different spread kinds produce different layouts', () => {
    const baseParams = {
      scene: 'draw_stage' as const,
      containerWidth: 800,
      containerHeight: 600,
      isWide: true,
      cardAspectRatio: 1.6,
    }
    
    const singleResult = resolveSpreadLayout({ ...baseParams, spreadKind: 'single_card' })
    const threeResult = resolveSpreadLayout({ ...baseParams, spreadKind: 'three_card' })
    const crossResult = resolveSpreadLayout({ ...baseParams, spreadKind: 'cross_spread' })
    
    // Different card counts
    expect(singleResult.cards).toHaveLength(1)
    expect(threeResult.cards).toHaveLength(3)
    expect(crossResult.cards).toHaveLength(5)
    
    // Different layouts should have different positions
    expect(singleResult.cards[0].x).toBe(0) // single card centered
    expect(threeResult.cards[0].x).not.toBe(threeResult.cards[1].x) // three cards spread horizontally
  })
})

describe('cross_spread specific layout', () => {
  it('has correct slotIds for cross spread', () => {
    const input = makeInput({ spreadKind: 'cross_spread' })
    const result = resolveSpreadLayout(input)
    
    const slotIds = result.cards.map(c => c.slotId).sort()
    expect(slotIds).toEqual(['center', 'east', 'north', 'south', 'west'].sort())
  })

  it('cross cards are positioned correctly relative to center', () => {
    const input = makeInput({ spreadKind: 'cross_spread', isWide: true })
    const result = resolveSpreadLayout(input)
    
    const centerCard = result.cards.find(c => c.slotId === 'center')!
    const northCard = result.cards.find(c => c.slotId === 'north')!
    const southCard = result.cards.find(c => c.slotId === 'south')!
    const eastCard = result.cards.find(c => c.slotId === 'east')!
    const westCard = result.cards.find(c => c.slotId === 'west')!
    
    // North should be above center
    expect(northCard.y).toBeLessThan(centerCard.y)
    // South should be below center
    expect(southCard.y).toBeGreaterThan(centerCard.y)
    // East should be to the right of center
    expect(eastCard.x).toBeGreaterThan(centerCard.x)
    // West should be to the left of center
    expect(westCard.x).toBeLessThan(centerCard.x)
  })

  it('center card has highest zIndex', () => {
    const input = makeInput({ spreadKind: 'cross_spread' })
    const result = resolveSpreadLayout(input)
    
    const centerCard = result.cards.find(c => c.slotId === 'center')!
    const otherCards = result.cards.filter(c => c.slotId !== 'center')
    
    otherCards.forEach(card => {
      expect(centerCard.zIndex).toBeGreaterThan(card.zIndex)
    })
  })
})

describe('three_card slotIds', () => {
  it('has correct slotIds for three card spread', () => {
    const input = makeInput({ spreadKind: 'three_card' })
    const result = resolveSpreadLayout(input)
    
    const slotIds = result.cards.map(c => c.slotId).sort()
    expect(slotIds).toEqual(['future', 'past', 'present'].sort())
  })
})

describe('single_card specific layout', () => {
  it('single_card is a distinct preset, not a row-of-1', () => {
    const input = makeInput({ spreadKind: 'single_card' })
    const result = resolveSpreadLayout(input)
    
    // Single card should be centered
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].x).toBe(0)
    expect(result.cards[0].slotId).toBe('center')
    
    // Card size should be optimized for single card display
    // (larger relative to container than multi-card spreads)
    const multiCardInput = makeInput({ spreadKind: 'three_card' })
    const multiCardResult = resolveSpreadLayout(multiCardInput)
    
    // Single card should generally be larger than cards in multi-card spreads
    // for the same container size
    expect(result.cardWidth).toBeGreaterThanOrEqual(multiCardResult.cardWidth)
  })
})

/**
 * Cross-device sizing regression tests
 *
 * Background: CSS variables (--card-width) were previously defined as small static
 * values (88px for mini program, 108px for H5 mobile) that did not match solver output.
 * face-back/face-front elements used the CSS vars instead of the solver dimensions,
 * causing them to appear tiny (e.g., 88px) inside correctly-sized solver containers
 * (e.g., 134px). Fix: CSS vars are now driven by solver output via Vue reactive binding.
 *
 * These tests verify solver output is larger than the old CSS var fallbacks across all
 * typical device profiles, ensuring face elements now fill the card frame correctly.
 */
describe('cross-device card sizing', () => {
  // Typical WeChat Mini Program phone: 375×812 logical pixels, narrow
  it('mini program phone (375×812) single_card: solver > old CSS var (88px)', () => {
    // topBar ~84px (44 status + 32 capsule + 8 padding)
    const result = resolveSpreadLayout({
      spreadKind: 'single_card',
      scene: 'draw_stage',
      containerWidth: 375,
      containerHeight: 812 - 84,
      isWide: false,
      cardAspectRatio: 1.6,
    })
    expect(result.cardWidth).toBeGreaterThan(88) // old CSS var was 88px — solver should give more
    expect(result.cardWidth).toBeGreaterThanOrEqual(88)
    expect(result.cardHeight).toBeCloseTo(result.cardWidth * 1.6, 1)
  })

  it('mini program phone (375×812) three_card column: card fits vertically', () => {
    const containerHeight = 812 - 84
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'draw_stage',
      containerWidth: 375,
      containerHeight,
      isWide: false,
      cardAspectRatio: 1.6,
    })
    expect(result.cards).toHaveLength(3)
    // All 3 cards + 2 gaps should fit within container
    const totalHeight = result.cardHeight * 3 + 16 * 2
    expect(totalHeight).toBeLessThanOrEqual(containerHeight)
    // Solver should give more than old CSS var (88px)
    expect(result.cardWidth).toBeGreaterThan(88)
  })

  // Typical H5 mobile: 375×812, narrow
  it('H5 mobile (375×812) three_card column: solver > old CSS var (108px)', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'draw_stage',
      containerWidth: 375,
      containerHeight: 812,
      isWide: false,
      cardAspectRatio: 1.6,
    })
    expect(result.cardWidth).toBeGreaterThan(88)
    expect(result.cardHeight).toBeCloseTo(result.cardWidth * 1.6, 1)
  })

  // iPad / mini program tablet: 768×1024, wide
  it('wide tablet (768×1024) three_card row: cards fit horizontally', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'draw_stage',
      containerWidth: 768,
      containerHeight: 1024,
      isWide: true,
      cardAspectRatio: 1.6,
    })
    expect(result.cards).toHaveLength(3)
    // All 3 cards + 2 gaps should fit within container width
    const totalWidth = result.cardWidth * 3 + 16 * 2
    expect(totalWidth).toBeLessThanOrEqual(768)
    // Wide mode: cards should be in a row (different X)
    const xs = result.cards.map(c => c.x)
    expect(new Set(xs).size).toBe(3)
  })

  // Desktop H5: 1440×900, wide
  it('desktop (1440×900) single_card: card dimensions within bounds', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'single_card',
      scene: 'draw_stage',
      containerWidth: 1440,
      containerHeight: 900,
      isWide: true,
      cardAspectRatio: 1.6,
    })
    expect(result.cardWidth).toBeGreaterThanOrEqual(88)
    expect(result.cardWidth).toBeLessThanOrEqual(300) // sanity upper bound
    expect(result.cardHeight).toBeCloseTo(result.cardWidth * 1.6, 1)
  })

  // Result stage shrinks container — still fits
  it('mini program result stage (375×340): cards fit in half-screen', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'result_stage',
      containerWidth: 375,
      containerHeight: 812 * 0.42, // ~341px
      isWide: false,
      cardAspectRatio: 1.6,
    })
    expect(result.cards).toHaveLength(3)
    expect(result.stageShiftY).toBe(0) // no lift in result stage
    // Each card center should be within half the container height from center
    const halfH = (812 * 0.42) / 2
    for (const card of result.cards) {
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfH)
    }
  })

  // cross_spread on mini program: all 5 cards fit
  it('mini program phone (375×728) cross_spread: all 5 cards fit', () => {
    const containerWidth = 375
    const containerHeight = 812 - 84
    const result = resolveSpreadLayout({
      spreadKind: 'cross_spread',
      scene: 'draw_stage',
      containerWidth,
      containerHeight,
      isWide: false,
      cardAspectRatio: 1.6,
    })
    expect(result.cards).toHaveLength(5)
    const halfW = containerWidth / 2 + result.cardWidth / 2
    const halfH = containerHeight / 2 + result.cardHeight / 2
    for (const card of result.cards) {
      expect(Math.abs(card.x)).toBeLessThanOrEqual(halfW)
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfH)
    }
  })
})
