import { describe, expect, it } from 'vitest'
import { resolveDrawLayout } from '../app/src/core/layout/draw_layout_resolver'
import type { SpreadSlot } from '../app/src/core/layout/types'
import type { SafeFrame } from '../app/src/core/viewport/types'
import type { CardSize } from '../app/src/core/sizing/types'

const cardSize: CardSize = { width: 60, height: 100, gap: 12 }
const slotPitchY = cardSize.height + cardSize.gap // 112
const slotPitchX = cardSize.width + cardSize.gap // 72

function makeSafeFrame(w: number, h: number): SafeFrame {
  return {
    width: w,
    height: h,
    x: 0,
    y: 0,
    topInset: 0,
    bottomInset: 0,
    centerX: w / 2,
    centerY: h / 2,
  }
}

const singleSlots: SpreadSlot[] = [{ slotId: 'card', x: 0, y: 0 }]
const threePortraitSlots: SpreadSlot[] = [
  { slotId: 'past', x: 0, y: 20 },
  { slotId: 'present', x: 0, y: 0 },
  { slotId: 'future', x: 0, y: -20 },
]
const threeWideSlots: SpreadSlot[] = [
  { slotId: 'past', x: -80, y: 0 },
  { slotId: 'present', x: 0, y: 0 },
  { slotId: 'future', x: 80, y: 0 },
]
const crossSlots: SpreadSlot[] = [
  { slotId: 'center', x: 0, y: 0 },
  { slotId: 'north', x: 0, y: -80 },
  { slotId: 'south', x: 0, y: 80 },
  { slotId: 'west', x: -80, y: 0 },
  { slotId: 'east', x: 80, y: 0 },
]

describe('resolveDrawLayout', () => {
  it('single_card 390x844 phone: stageShiftY === cards[0].y and within safe bounds', () => {
    const safeFrame = makeSafeFrame(390, 844)
    const result = resolveDrawLayout('single_card', singleSlots, safeFrame, cardSize)

    expect(result.stageShiftY).toBe(result.cards[0].y)
    expect(Math.abs(result.cards[0].y)).toBeLessThanOrEqual(safeFrame.height / 2 - cardSize.height / 2)
    expect(result.cards[0].x).toBe(0)
  })

  it('three_card portrait 390x844: stageShiftY === present.y, adjacent spacing === slotPitchY, all within safe bounds', () => {
    const safeFrame = makeSafeFrame(390, 844)
    const result = resolveDrawLayout('three_card', threePortraitSlots, safeFrame, cardSize)

    const present = result.cards.find(c => c.slotId === 'present')!
    const past = result.cards.find(c => c.slotId === 'past')!
    const future = result.cards.find(c => c.slotId === 'future')!

    expect(result.stageShiftY).toBe(present.y)
    expect(past.y - present.y).toBe(slotPitchY)
    expect(present.y - future.y).toBe(slotPitchY)

    const minY = -safeFrame.height / 2 + cardSize.height / 2
    const maxY = safeFrame.height / 2 - cardSize.height / 2
    for (const card of result.cards) {
      expect(card.y).toBeGreaterThanOrEqual(minY)
      expect(card.y).toBeLessThanOrEqual(maxY)
    }
  })

  it('three_card wide/landscape 844x390: stageShiftY === past.y, left/right symmetric', () => {
    const safeFrame = makeSafeFrame(844, 390)
    const result = resolveDrawLayout('three_card', threeWideSlots, safeFrame, cardSize)

    const past = result.cards.find(c => c.slotId === 'past')!
    const present = result.cards.find(c => c.slotId === 'present')!
    const future = result.cards.find(c => c.slotId === 'future')!

    expect(result.stageShiftY).toBe(past.y)
    expect(present.y).toBe(past.y)
    expect(future.y).toBe(past.y)
    expect(past.x).toBe(-future.x)
    expect(present.x).toBe(0)
  })

  it('cross_spread portrait 390x844: stageShiftY === center.y, north/south within container bounds', () => {
    const safeFrame = makeSafeFrame(390, 844)
    const result = resolveDrawLayout('cross_spread', crossSlots, safeFrame, cardSize)

    const center = result.cards.find(c => c.slotId === 'center')!
    const north = result.cards.find(c => c.slotId === 'north')!
    const south = result.cards.find(c => c.slotId === 'south')!

    expect(result.stageShiftY).toBe(center.y)
    expect(north.y).toBe(center.y - slotPitchY)
    expect(south.y).toBe(center.y + slotPitchY)
    expect(north.y - cardSize.height / 2).toBeGreaterThanOrEqual(-safeFrame.height / 2)
    expect(south.y + cardSize.height / 2).toBeLessThanOrEqual(safeFrame.height / 2)
  })

  it('tiny screen 320x568: no overflow, stageShiftY === centerY, no NaN', () => {
    const safeFrame = makeSafeFrame(320, 568)

    const single = resolveDrawLayout('single_card', singleSlots, safeFrame, cardSize)
    expect(single.stageShiftY).toBe(single.cards[0].y)
    expect(Number.isNaN(single.stageShiftY)).toBe(false)

    const three = resolveDrawLayout('three_card', threePortraitSlots, safeFrame, cardSize)
    const present = three.cards.find(c => c.slotId === 'present')!
    expect(three.stageShiftY).toBe(present.y)
    expect(Number.isNaN(three.stageShiftY)).toBe(false)
    for (const card of three.cards) {
      expect(card.y - cardSize.height / 2).toBeGreaterThanOrEqual(-safeFrame.height / 2)
      expect(card.y + cardSize.height / 2).toBeLessThanOrEqual(safeFrame.height / 2)
    }

    const cross = resolveDrawLayout('cross_spread', crossSlots, safeFrame, cardSize)
    const center = cross.cards.find(c => c.slotId === 'center')!
    expect(cross.stageShiftY).toBe(center.y)
    expect(Number.isNaN(cross.stageShiftY)).toBe(false)
    for (const card of cross.cards) {
      expect(card.y - cardSize.height / 2).toBeGreaterThanOrEqual(-safeFrame.height / 2)
      expect(card.y + cardSize.height / 2).toBeLessThanOrEqual(safeFrame.height / 2)
      expect(card.x - cardSize.width / 2).toBeGreaterThanOrEqual(-safeFrame.width / 2)
      expect(card.x + cardSize.width / 2).toBeLessThanOrEqual(safeFrame.width / 2)
    }
  })

  it('large screen 1024x1366: no overflow, stageShiftY === centerY, no NaN', () => {
    const safeFrame = makeSafeFrame(1024, 1366)

    const single = resolveDrawLayout('single_card', singleSlots, safeFrame, cardSize)
    expect(single.stageShiftY).toBe(single.cards[0].y)
    expect(Number.isNaN(single.stageShiftY)).toBe(false)

    const threePortrait = resolveDrawLayout('three_card', threePortraitSlots, safeFrame, cardSize)
    const presentPortrait = threePortrait.cards.find(c => c.slotId === 'present')!
    expect(threePortrait.stageShiftY).toBe(presentPortrait.y)
    expect(Number.isNaN(threePortrait.stageShiftY)).toBe(false)
    for (const card of threePortrait.cards) {
      expect(card.y - cardSize.height / 2).toBeGreaterThanOrEqual(-safeFrame.height / 2)
      expect(card.y + cardSize.height / 2).toBeLessThanOrEqual(safeFrame.height / 2)
    }

    const threeWide = resolveDrawLayout('three_card', threeWideSlots, safeFrame, cardSize)
    const past = threeWide.cards.find(c => c.slotId === 'past')!
    expect(threeWide.stageShiftY).toBe(past.y)
    expect(Number.isNaN(threeWide.stageShiftY)).toBe(false)
    for (const card of threeWide.cards) {
      expect(card.x - cardSize.width / 2).toBeGreaterThanOrEqual(-safeFrame.width / 2)
      expect(card.x + cardSize.width / 2).toBeLessThanOrEqual(safeFrame.width / 2)
    }

    const cross = resolveDrawLayout('cross_spread', crossSlots, safeFrame, cardSize)
    const center = cross.cards.find(c => c.slotId === 'center')!
    expect(cross.stageShiftY).toBe(center.y)
    expect(Number.isNaN(cross.stageShiftY)).toBe(false)
    for (const card of cross.cards) {
      expect(card.y - cardSize.height / 2).toBeGreaterThanOrEqual(-safeFrame.height / 2)
      expect(card.y + cardSize.height / 2).toBeLessThanOrEqual(safeFrame.height / 2)
      expect(card.x - cardSize.width / 2).toBeGreaterThanOrEqual(-safeFrame.width / 2)
      expect(card.x + cardSize.width / 2).toBeLessThanOrEqual(safeFrame.width / 2)
    }
  })
})
