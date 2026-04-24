import { describe, it, expect } from 'vitest'
import { resolveSingleCardSize } from '../app/src/core/sizing/single_card_size_solver'
import type { SafeFrame } from '../app/src/core/viewport/types'

function makeSafeFrame(w: number, h: number): SafeFrame {
  return {
    x: 20,
    y: 60,
    width: w,
    height: h,
    centerX: 0,
    centerY: 0,
    bottomInset: 80,
  }
}

describe('single_card_size_solver', () => {
  it('baseline iPhone 14 Pro Max safe-frame hits the 180 cap', () => {
    // 390×760 is the baseline design safe-frame.
    const size = resolveSingleCardSize({
      safeFrame: makeSafeFrame(390, 760),
    })
    expect(size.width).toBe(180)
    expect(size.height).toBeCloseTo(180 * 1.6, 0)
  })

  it('smaller phone scales down proportionally', () => {
    // 320×568 (iPhone SE 1st gen) scaled safe-frame.
    const size = resolveSingleCardSize({
      safeFrame: makeSafeFrame(280, 480),
    })
    // baselineWidth = 285, scale = 280/390 ≈ 0.718
    // scaleBased = 285 * 0.718 ≈ 204
    // heightBased = 480 * 0.6 / 1.6 = 180
    // max = 204, cap = 180, but focus validation may pull it down slightly.
    expect(size.width).toBeGreaterThan(150)
    expect(size.width).toBeLessThanOrEqual(180)
    expect(size.height).toBeCloseTo(size.width * 1.6, 0)
  })

  it('desktop wide screen is capped at 180', () => {
    const size = resolveSingleCardSize({
      safeFrame: makeSafeFrame(1392, 549),
    })
    expect(size.width).toBe(180)
    expect(size.height).toBeCloseTo(288, 0)
  })

  it('focusScale 1.42 on narrow screen still fits inside safe-frame', () => {
    const safeFrame = makeSafeFrame(340, 650)
    const size = resolveSingleCardSize({
      safeFrame,
      focusScale: 1.42,
    })
    // focused height must not exceed safe-frame height.
    expect(size.height * 1.42).toBeLessThanOrEqual(safeFrame.height + 0.1)
    // focused width must not exceed safe-frame width.
    expect(size.width * 1.42).toBeLessThanOrEqual(safeFrame.width + 0.1)
  })

  it('never goes below the 100 minimum', () => {
    const size = resolveSingleCardSize({
      safeFrame: makeSafeFrame(100, 100),
    })
    expect(size.width).toBe(100)
  })

  it('gap is always 16', () => {
    const size = resolveSingleCardSize({
      safeFrame: makeSafeFrame(390, 760),
    })
    expect(size.gap).toBe(16)
  })
})
