// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveCardSize, DEFAULT_ENVELOPE_GAP } from '../app/src/core/sizing/card_size_solver'
import { MIN_CARD_WIDTH, MAX_CARD_WIDTH } from '../app/src/core/config/layout_constants'
import type { SafeFrame } from '../app/src/core/viewport/types'

function makeSafeFrame(w: number, h: number): SafeFrame {
  return { width: w, height: h, x: 0, y: 0, centerX: 0, centerY: 0, bottomInset: 0 }
}

const RATIO = 1.6
const GAP = DEFAULT_ENVELOPE_GAP

/**
 * Reference solution: safe frame is partitioned into (slots+1) gaps + slots cards
 * on each axis. Card width is the smaller of the two axis-bounded solutions.
 */
function expectedCardWidth(w: number, h: number, hSlots: number, vSlots: number): number {
  const widthBound = (w - (hSlots + 1) * GAP) / hSlots
  const heightBound = ((h - (vSlots + 1) * GAP) / vSlots) / RATIO
  const raw = Math.min(widthBound, heightBound)
  return Math.max(MIN_CARD_WIDTH, Math.min(raw, MAX_CARD_WIDTH))
}

describe('card_size_solver — partition the safe frame into gaps + cards', () => {
  it('single card on a 390×844 narrow viewport', () => {
    const safeFrame = makeSafeFrame(390, 844)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 1, verticalSlots: 1 },
    })
    // widthBound  = (390 - 2*16) / 1 = 358
    // heightBound = (844 - 2*16) / 1 / 1.6 = 507.5
    expect(size.width).toBeCloseTo(expectedCardWidth(390, 844, 1, 1), 1)
    expect(size.height).toBeCloseTo(size.width * RATIO, 1)
  })

  it('three cards stacked on a 390×844 narrow viewport (height-bound)', () => {
    const safeFrame = makeSafeFrame(390, 844)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 1, verticalSlots: 3 },
    })
    // heightBound = (844 - 4*16) / 3 / 1.6 = 162.5
    expect(size.width).toBeCloseTo(expectedCardWidth(390, 844, 1, 3), 1)
  })

  it('three cards in a row on a 1366×768 wide viewport (width-bound)', () => {
    const safeFrame = makeSafeFrame(1366, 768)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 3, verticalSlots: 1 },
    })
    // widthBound = (1366 - 4*16) / 3 ≈ 434
    expect(size.width).toBeCloseTo(expectedCardWidth(1366, 768, 3, 1), 1)
  })

  it('clamps to MAX_CARD_WIDTH on very large viewports', () => {
    const safeFrame = makeSafeFrame(2000, 2000)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 1, verticalSlots: 1 },
    })
    expect(size.width).toBe(MAX_CARD_WIDTH)
  })

  it('clamps to MIN_CARD_WIDTH on degenerate inputs', () => {
    const safeFrame = makeSafeFrame(50, 50)
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 3, verticalSlots: 3 },
    })
    expect(size.width).toBe(MIN_CARD_WIDTH)
  })

  it('cards + edge margins + inter-card gaps fit inside the safe frame', () => {
    const configs = [
      { w: 375, h: 812, hSlots: 1, vSlots: 1 },
      { w: 375, h: 812, hSlots: 1, vSlots: 3 },
      { w: 1366, h: 768, hSlots: 3, vSlots: 1 },
      { w: 1024, h: 1024, hSlots: 3, vSlots: 3 },
      { w: 768, h: 1024, hSlots: 3, vSlots: 3 },
    ]

    for (const { w, h, hSlots, vSlots } of configs) {
      const safeFrame = makeSafeFrame(w, h)
      const size = resolveCardSize({
        safeFrame,
        cardAspectRatio: RATIO,
        requirement: { horizontalSlots: hSlots, verticalSlots: vSlots },
      })

      const totalWidth = size.width * hSlots + size.gap * (hSlots - 1) + 2 * size.gap
      const totalHeight = size.height * vSlots + size.gap * (vSlots - 1) + 2 * size.gap

      // Either the cards fit within the safe frame on both axes, or the size has
      // been clamped to MIN_CARD_WIDTH (in which case the input was degenerate).
      const wasClamped = size.width === MIN_CARD_WIDTH
      if (!wasClamped) {
        expect(totalWidth).toBeLessThanOrEqual(w + 0.5)
        expect(totalHeight).toBeLessThanOrEqual(h + 0.5)
      }
    }
  })

  it('floors fractional slot counts', () => {
    const safeFrame = makeSafeFrame(390, 844)
    const a = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 3.7, verticalSlots: 1 },
    })
    const b = resolveCardSize({
      safeFrame,
      cardAspectRatio: RATIO,
      requirement: { horizontalSlots: 3, verticalSlots: 1 },
    })
    expect(a.width).toBeCloseTo(b.width, 5)
  })
})
