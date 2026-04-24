// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveCardSize } from '../app/src/core/sizing/card_size_solver'
import type { SafeFrame } from '../app/src/core/viewport/types'

function makeSafeFrame(w: number, h: number): SafeFrame {
  return {
    width: w,
    height: h,
    x: 0,
    y: 0,
    centerX: 0,
    centerY: 0,
    bottomInset: 0,
  }
}

describe('card_size_solver', () => {
  it('narrow screen: width is short side, height scales by aspect ratio', () => {
    // 390x844 narrow, three_card (1x3) → short side = 390, hSlots = 1
    const safeFrame = makeSafeFrame(390, 844)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 1, verticalSlots: 3 },
    })
    const expectedWidth = (390 - 0) / 1 * 0.85 // 331.5
    expect(size.width).toBeCloseTo(expectedWidth, 0)
    expect(size.height).toBeCloseTo(expectedWidth * 1.6, 0)
    expect(size.gap).toBe(16)
  })

  it('wide screen: height is short side, width scales by aspect ratio', () => {
    // 1366x768 wide, three_card (3x1) → short side = 768, vSlots = 1
    const safeFrame = makeSafeFrame(1366, 768)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 3, verticalSlots: 1 },
    })
    const expectedHeight = (768 - 0) / 1 * 0.85 // 652.8
    expect(size.height).toBeCloseTo(expectedHeight, 0)
    expect(size.width).toBeCloseTo(expectedHeight / 1.6, 0)
  })

  it('preserves fixed aspect ratio on any screen', () => {
    const narrow = resolveCardSize({
      safeFrame: makeSafeFrame(375, 812),
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 1, verticalSlots: 1 },
    })
    const wide = resolveCardSize({
      safeFrame: makeSafeFrame(1920, 1080),
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 1, verticalSlots: 1 },
    })
    expect(narrow.height / narrow.width).toBeCloseTo(1.6, 5)
    expect(wide.height / wide.width).toBeCloseTo(1.6, 5)
  })

  it('cross_spread 3x3 on narrow screen uses width as short side', () => {
    // 390x844, cross_spread (3x3) → short side = 390, hSlots = 3
    const safeFrame = makeSafeFrame(390, 844)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 3, verticalSlots: 3 },
    })
    const expectedWidth = (390 - 2 * 16) / 3 * 0.85 // 105.8
    expect(size.width).toBeCloseTo(expectedWidth, 0)
    expect(size.height).toBeCloseTo(expectedWidth * 1.6, 0)
  })

  it('cross_spread 3x3 on wide screen uses height as short side', () => {
    // 1366x768, cross_spread (3x3) → short side = 768, vSlots = 3
    const safeFrame = makeSafeFrame(1366, 768)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 3, verticalSlots: 3 },
    })
    const expectedHeight = (768 - 2 * 16) / 3 * 0.85 // 208.5
    expect(size.height).toBeCloseTo(expectedHeight, 0)
    expect(size.width).toBeCloseTo(expectedHeight / 1.6, 0)
  })

  it('long side slot count does not affect card size (wide three_card)', () => {
    // 1366x768 wide, three_card (3x1) → short side = 768 (height)
    // Changing horizontalSlots on the long side should not change card size
    const safeFrame = makeSafeFrame(1366, 768)
    const size3 = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 3, verticalSlots: 1 },
    })
    const size10 = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 10, verticalSlots: 1 },
    })
    // Both should produce the same size because width is the long side
    expect(size3.width).toBeCloseTo(size10.width, 0)
    expect(size3.height).toBeCloseTo(size10.height, 0)
  })

  it('respects maxCardWidth clamp', () => {
    const safeFrame = makeSafeFrame(2000, 2000)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 1, verticalSlots: 1 },
    })
    expect(size.width).toBe(512)
    expect(size.height).toBeCloseTo(512 * 1.6, 5)
  })

  it('respects minCardWidth clamp', () => {
    const safeFrame = makeSafeFrame(10, 10)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 3, verticalSlots: 3 },
      minCardWidth: 64,
    })
    expect(size.width).toBe(64)
    expect(size.height).toBeCloseTo(64 * 1.6, 5)
  })

  it('uses provided gap', () => {
    const safeFrame = makeSafeFrame(400, 800)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 2, verticalSlots: 1 },
      gap: 32,
    })
    expect(size.gap).toBe(32)
  })

  it('handles safeFrame smaller than required gap by returning minCardWidth', () => {
    const safeFrame = makeSafeFrame(10, 10)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 3, verticalSlots: 3 },
      minCardWidth: 64,
    })
    expect(size.width).toBe(64)
  })

  it('square safeFrame treats either side as short (width chosen for narrow logic)', () => {
    const safeFrame = makeSafeFrame(500, 500)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: 1.6,
      requirement: { horizontalSlots: 1, verticalSlots: 1 },
    })
    // width === height, so isWideScreen = false → width drives size
    const expectedWidth = (500 - 0) / 1 * 0.85 // 425
    expect(size.width).toBeCloseTo(expectedWidth, 0)
    expect(size.height).toBeCloseTo(expectedWidth * 1.6, 0)
  })
})
