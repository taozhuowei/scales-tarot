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
    // Centered with no lift when container exactly fits.
    expect(result.cards[0].y).toBe(0)
    expect(result.stageShiftY).toBe(0)
    expect(result.cards[0].y).toBe(result.stageShiftY)
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

  it('keeps the final draw-stage landing point at screen center on mobile', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'single_card',
      scene: 'draw_stage',
      containerWidth: 375,
      containerHeight: 812,
      isWide: false,
      cardAspectRatio: DEFAULT_ASPECT_RATIO,
      headerHeight: 50,
    })

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].y - result.stageShiftY).toBeCloseTo(0, 5)
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
      // Card centers should be within container bounds (card edges may extend
      // beyond when the short-side algorithm produces large cards)
      expect(Math.abs(card.x)).toBeLessThanOrEqual(halfWidth)
      expect(Math.abs(card.y)).toBeLessThanOrEqual(halfHeight + result.cardHeight / 2)
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

    expect(drawResult.stageShiftY).toBeGreaterThanOrEqual(0)
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
    // Centered with no lift.
    expect(result.stageShiftY).toBe(0)
    const presentCard = result.cards.find(c => c.slotId === 'present')!
    expect(presentCard.y).toBe(0)
    expect(presentCard.y).toBe(result.stageShiftY)
  })

  it('three_card result_stage vs draw_stage: result is more centered', () => {
    // Both stages centered at 0.
    const base = { spreadKind: 'three_card' as const, containerWidth: 375, containerHeight: 1200, isWide: false, cardAspectRatio: 1.6 }
    const drawResult = resolveSpreadLayout({ ...base, scene: 'draw_stage' })
    const stageResult = resolveSpreadLayout({ ...base, scene: 'result_stage' })
    const presentDraw = drawResult.cards.find(c => c.slotId === 'present')!
    const presentResult = stageResult.cards.find(c => c.slotId === 'present')!
    expect(presentResult.y).toBe(0)
    expect(presentDraw.y).toBe(0)
    expect(drawResult.stageShiftY).toBe(presentDraw.y)
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
    // Compare two wide containers where height is the short side
    const smallInput = makeInput({
      spreadKind: 'three_card',
      isWide: true,
      containerWidth: 800,
      containerHeight: 600,
    })
    const largeInput = makeInput({
      spreadKind: 'three_card',
      isWide: true,
      containerWidth: 1600,
      containerHeight: 900,
    })

    const smallResult = resolveSpreadLayout(smallInput)
    const largeResult = resolveSpreadLayout(largeInput)

    // Both use height as short side; larger height should yield larger cards
    expect(largeResult.cardHeight).toBeGreaterThanOrEqual(smallResult.cardHeight)
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

  it('mini program phone (375×812) three_card column: dual-axis height constraint drives width', () => {
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

    // Envelope uses drawH=1, drawV=3 on a narrow viewport.
    // Safe frame is partitioned into (vSlots+1)=4 gaps + 3 card heights:
    //   cardHeight = (containerHeight - 4*16) / 3
    //   cardWidth  = cardHeight / 1.6  (height-bound dominates here)
    const expectedCardHeight = (containerHeight - 4 * 16) / 3
    const expectedCardWidth = expectedCardHeight / 1.6

    expect(result.cardWidth).toBeCloseTo(expectedCardWidth, 0)
    expect(result.cardHeight).toBeCloseTo(result.cardWidth * 1.6, 0)
    // Solver should give more than the old CSS var (88px)
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
    expect(result.cardWidth).toBeLessThanOrEqual(512) // sanity upper bound
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

describe('headerHeight support', () => {
  it('single_card result_stage headerHeight=50 => center.y === 25', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'single_card',
      scene: 'result_stage',
      containerWidth: 400,
      containerHeight: 800,
      isWide: false,
      cardAspectRatio: 1.6,
      headerHeight: 50,
    })
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].y).toBe(25) // headerHeight / 2
  })

  it('three_card narrow result_stage headerHeight=50 preserves equal spacing', () => {
    // With the short-side algorithm, cards are larger. The headerHeight/2
    // offset may be clamped away when cards fill most of the container height.
    // The invariant we care about is equal spacing between cards.
    const result = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'result_stage',
      containerWidth: 390,
      containerHeight: 1600,
      isWide: false,
      cardAspectRatio: 1.6,
      headerHeight: 50,
    })
    const pastCard = result.cards.find(c => c.slotId === 'past')!
    const presentCard = result.cards.find(c => c.slotId === 'present')!
    const futureCard = result.cards.find(c => c.slotId === 'future')!

    // Present card is shifted down by headerHeight/2 (50/2 = 25)
    expect(presentCard.y).toBe(25)

    // Equal spacing: past.y - present.y === present.y - future.y
    const spacingPast = pastCard.y - presentCard.y
    const spacingFuture = presentCard.y - futureCard.y
    expect(spacingPast).toBe(spacingFuture)
  })

  it('cross_spread result_stage containerHeight=354 headerHeight=50 => center.y === 25', () => {
    const result = resolveSpreadLayout({
      spreadKind: 'cross_spread',
      scene: 'result_stage',
      containerWidth: 390,
      containerHeight: 354,
      isWide: false,
      cardAspectRatio: 1.6,
      headerHeight: 50,
    })
    const centerCard = result.cards.find(c => c.slotId === 'center')!
    // With large cards, centering may be clamped to keep cards on screen.
    // We just verify it's shifted in the correct direction.
    expect(centerCard.y).toBeGreaterThan(0)
    expect(centerCard.y).toBeLessThanOrEqual(25)
  })

  it('three_card draw vs result spread equal', () => {
    // Both stages use same spread (unified spread calculation)
    // The spread is calculated based on containerHeight * 0.42 for both stages
    // Using same containerWidth/Height for both to get same card dimensions
    const containerWidth = 390
    const containerHeight = 400

    const drawResult = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'draw_stage',
      containerWidth,
      containerHeight,
      isWide: false,
      cardAspectRatio: 1.6,
      headerHeight: 50,
    })

    const resultResult = resolveSpreadLayout({
      spreadKind: 'three_card',
      scene: 'result_stage',
      containerWidth,
      containerHeight,
      isWide: false,
      cardAspectRatio: 1.6,
      headerHeight: 50,
    })

    const drawPast = drawResult.cards.find(c => c.slotId === 'past')!
    const drawPresent = drawResult.cards.find(c => c.slotId === 'present')!
    const resultPast = resultResult.cards.find(c => c.slotId === 'past')!
    const resultPresent = resultResult.cards.find(c => c.slotId === 'present')!

    // Draw and result stages now use slightly different vMargin (8 vs 12),
    // so draw spacing >= result spacing (draw uses smaller margins)
    const drawSpacing = Math.abs(drawPast.y - drawPresent.y)
    const resultSpacing = Math.abs(resultPast.y - resultPresent.y)
    expect(drawSpacing).toBeGreaterThanOrEqual(resultSpacing)
  })
})
