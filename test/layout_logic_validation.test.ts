// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveSafeFrame, resolveStageMetrics, getDefaultInsets } from '../app/src/core/viewport/safe_frame_calculator'
import { resolveMotionMetrics } from '../app/src/utils/overlay_layout/motion_metrics'
import type { ViewportMetrics } from '../app/src/core/viewport/types'

const MOBILE_VIEWPORT: ViewportMetrics = {
  width: 390,
  height: 844,
  safeAreaTop: 47, // Dynamic safeAreaTop from uni.getSystemInfoSync
  safeAreaBottom: 34,
  dpr: 3,
}


const DESKTOP_VIEWPORT: ViewportMetrics = {
  width: 1440,
  height: 900,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  dpr: 2,
}

describe('Stage C.1: Layout Logic Validation (A.6 requirements)', () => {
  const insets = getDefaultInsets(390, false)

  describe('SafeFrame with dynamic SafeArea', () => {
    it('incorporates safeAreaTop into topInset', () => {
      const sf = resolveSafeFrame(MOBILE_VIEWPORT, insets, {
        scene: 'draw_stage',
        topBarHeight: 0,
      })

      // topInset = Math.max(0, headerBottom - 0) + topExtraDraw + safeAreaTop
      // headerBottom = 0 + 60/750*390 + 44 = 31 + 44 = 75
      // topInset = 75 + 12 + 47 = 134
      expect(sf.y).toBeGreaterThanOrEqual(130)
    })
  })

  describe('CardSizeSolver with MAX_CARD_WIDTH=512', () => {
    it('scales cards up on large screens without being capped at 188px', () => {
      const metrics = resolveStageMetrics(DESKTOP_VIEWPORT, insets, {
        isWide: true,
        showResults: false,
        topBarHeight: 0,
      })
      
      const sf = resolveSafeFrame(DESKTOP_VIEWPORT, insets, {
        scene: 'draw_stage',
        topBarHeight: 0,
        precomputedStage: metrics,
      })

      const mm = resolveMotionMetrics({
        safeFrame: sf,
        cardAspectRatio: 1.6,
        spreadId: 'single_card',
        isWide: true,
        cutPileCount: 1,
        deckCount: 78,
      })

      // On 1440px wide screen with isWide: true, card should be large.
      // requirement = { horizontalSlots: 3, verticalSlots: 1 }
      // safeFrame.width = 1440 - 24*2 = 1392. (1392-32)/3 = 453.
      // safeFrame.height = 900 - 171 - 180 = 549. (549-0)/1 = 549. width = 549/1.6 = 343.
      expect(mm.cardWidth).toBeGreaterThan(188)
      expect(mm.cardWidth).toBeLessThanOrEqual(512)
    })
  })

  describe('MotionMetrics: Fixed Gap', () => {
    it('uses a fixed gap regardless of screen size', () => {
      const mmMobile = resolveMotionMetrics({
        safeFrame: resolveSafeFrame(MOBILE_VIEWPORT, insets, { scene: 'draw_stage', topBarHeight: 0 }),
        cardAspectRatio: 1.6,
        spreadId: 'three_card',
        isWide: false,
        cutPileCount: 1,
        deckCount: 78,
      })

      const mmDesktop = resolveMotionMetrics({
        safeFrame: resolveSafeFrame(DESKTOP_VIEWPORT, insets, { scene: 'draw_stage', topBarHeight: 0 }),
        cardAspectRatio: 1.6,
        spreadId: 'three_card',
        isWide: false,
        cutPileCount: 1,
        deckCount: 78,
      })

      expect(mmMobile.gap).toBe(16)
      expect(mmDesktop.gap).toBe(16)
    })

    it('cutPileSpacing is cardWidth + 16', () => {
      const mm = resolveMotionMetrics({
        safeFrame: resolveSafeFrame(MOBILE_VIEWPORT, insets, { scene: 'draw_stage', topBarHeight: 0 }),
        cardAspectRatio: 1.6,
        spreadId: 'single_card',
        isWide: false,
        cutPileCount: 3,
        deckCount: 78,
      })

      // Vertical cut in narrow mode
      expect(mm.cutPileSpacing).toBe(mm.cardHeight + 16)
    })
  })
})
