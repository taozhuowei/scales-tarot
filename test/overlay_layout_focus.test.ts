// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveCardSize } from '../app/src/utils/overlay_layout/card_size_solver'
import { getFocusScale, getBadgeOverflowPx } from '../app/src/utils/overlay_layout/scene_layout'

describe('overlay_layout focus-scale and badge bounds', () => {
  describe('getFocusScale', () => {
    it('returns 1.42 for narrow screens', () => {
      expect(getFocusScale(false)).toBe(1.42)
    })

    it('returns 1.2 for wide screens', () => {
      expect(getFocusScale(true)).toBe(1.2)
    })
  })

  describe('getBadgeOverflowPx', () => {
    it('scales linearly with window width', () => {
      const at375 = getBadgeOverflowPx(375)
      const at750 = getBadgeOverflowPx(750)

      expect(at750).toBe(at375 * 2)
    })

    it('returns 6 for 375px width (12rpx)', () => {
      expect(getBadgeOverflowPx(375)).toBe(6)
    })
  })

  describe('resolveCardSize with focus and badge constraints', () => {
    it('reduces card width when focus scale is applied', () => {
      const withoutFocus = resolveCardSize({
        safeWidth: 375,
        safeHeight: 600,
        cardAspectRatio: 1.6,
        horizontalSlots: 3,
        verticalSlots: 3,
        focusScale: 1,
        badgeOverflowPx: 0,
      })

      const withFocus = resolveCardSize({
        safeWidth: 375,
        safeHeight: 600,
        cardAspectRatio: 1.6,
        horizontalSlots: 3,
        verticalSlots: 3,
        focusScale: 1.42,
        badgeOverflowPx: 0,
      })

      expect(withFocus.cardWidth).toBeLessThan(withoutFocus.cardWidth)
      expect(withFocus.cardHeight).toBeLessThan(withoutFocus.cardHeight)
    })

    it('reduces card width further when badge overflow is added', () => {
      const withFocusOnly = resolveCardSize({
        safeWidth: 375,
        safeHeight: 600,
        cardAspectRatio: 1.6,
        horizontalSlots: 3,
        verticalSlots: 3,
        focusScale: 1.42,
        badgeOverflowPx: 0,
      })

      const withFocusAndBadge = resolveCardSize({
        safeWidth: 375,
        safeHeight: 600,
        cardAspectRatio: 1.6,
        horizontalSlots: 3,
        verticalSlots: 3,
        focusScale: 1.42,
        badgeOverflowPx: 6,
      })

      expect(withFocusAndBadge.cardWidth).toBeLessThanOrEqual(withFocusOnly.cardWidth)
    })

    it('outer cards at focus scale plus badge margin fit inside safe frame', () => {
      const safeWidth = 375
      const safeHeight = 600
      const envelope = resolveCardSize({
        safeWidth,
        safeHeight,
        cardAspectRatio: 1.6,
        horizontalSlots: 3,
        verticalSlots: 3,
        focusScale: 1.42,
        badgeOverflowPx: 6,
      })

      // The right-most card center is at halfSpanX.
      // Its right edge after focus + badge must be <= safeWidth / 2.
      const halfSpanX = envelope.halfSpanX
      const cardRightEdge = halfSpanX + (envelope.cardWidth / 2 + 6) * 1.42
      expect(cardRightEdge).toBeLessThanOrEqual(safeWidth / 2 + 0.001)

      const halfSpanY = envelope.halfSpanY
      const cardBottomEdge = halfSpanY + envelope.cardHeight / 2 * 1.42
      expect(cardBottomEdge).toBeLessThanOrEqual(safeHeight / 2 + 0.001)
    })
  })
})
