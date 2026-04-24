// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  resolveStageMetrics,
  resolveSafeFrame,
  getDefaultInsets,
} from '../app/src/core/viewport/safe_frame_calculator'
import type { ViewportMetrics, UiInsetsConfig } from '../app/src/core/viewport/types'

const baseViewport: ViewportMetrics = {
  width: 390,
  height: 844,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  dpr: 2,
}

const baseInsets: UiInsetsConfig = {
  topBarHeight: 0,
  headerIconSize: 44,
  headerMarginRpx: 20,
  footerReserveRpx: 164,
  footerReserveMinPx: 48,
  resultStageWidthRatio: 0.54,
  resultStageHeightRatio: 0.42,
  sideInsetDraw: 24,
  sideInsetResult: 20,
  topExtraDraw: 12,
  topExtraResult: 8,
  bottomMinDraw: 56,
  bottomMinResult: 44,
  bottomRatioDraw: 0.2,
  bottomRatioResult: 0.16,
}

describe('safe_frame_calculator', () => {
  describe('getDefaultInsets', () => {
    it('returns H5 defaults when isMiniProgram=false', () => {
      const insets = getDefaultInsets(390, false)
      expect(insets.headerMarginRpx).toBe(60)
      expect(insets.footerReserveRpx).toBe(164)
    })

    it('returns mini-program defaults when isMiniProgram=true', () => {
      const insets = getDefaultInsets(390, true)
      expect(insets.headerMarginRpx).toBe(140)
      expect(insets.footerReserveRpx).toBe(196)
    })
  })

  describe('resolveStageMetrics', () => {
    it('draw_stage narrow: stageWidth === viewport.width, stageHeight = height - topBarHeight', () => {
      const metrics = resolveStageMetrics(baseViewport, baseInsets, {
        isWide: false,
        showResults: false,
        topBarHeight: 44,
      })
      expect(metrics.stageWidth).toBe(390)
      expect(metrics.stageHeight).toBe(800)
      expect(metrics.resultHeight).toBe(0)
    })

    it('draw_stage wide: same as narrow but isWide irrelevant because showResults=false', () => {
      const metrics = resolveStageMetrics(baseViewport, baseInsets, {
        isWide: true,
        showResults: false,
        topBarHeight: 0,
      })
      expect(metrics.stageWidth).toBe(390)
      expect(metrics.stageHeight).toBe(844)
    })

    it('result_stage narrow: stageHeight = height * 0.42, resultHeight = remainder', () => {
      const metrics = resolveStageMetrics(baseViewport, baseInsets, {
        isWide: false,
        showResults: true,
        topBarHeight: 0,
      })
      expect(metrics.stageHeight).toBe(Math.round(844 * 0.42)) // 354
      expect(metrics.resultHeight).toBe(844 - metrics.stageHeight) // 490
    })

    it('result_stage wide: stageWidth = width * 0.54, stageHeight = full height', () => {
      const metrics = resolveStageMetrics(baseViewport, baseInsets, {
        isWide: true,
        showResults: true,
        topBarHeight: 0,
      })
      expect(metrics.stageWidth).toBe(Math.round(390 * 0.54))
      expect(metrics.stageHeight).toBe(844)
      // Current implementation returns height for resultHeight in wide mode
      expect(metrics.resultHeight).toBe(844)
    })

    it('headerBottom includes topBarHeight + margin + iconSize', () => {
      const metrics = resolveStageMetrics(baseViewport, baseInsets, {
        isWide: false,
        showResults: false,
        topBarHeight: 44,
      })
      const marginPx = Math.round((20 / 750) * 390) // 10
      expect(metrics.headerBottom).toBe(44 + marginPx + 44) // 98
    })

    it('footerReserve respects min px when converted rpx is smaller', () => {
      const insets: UiInsetsConfig = { ...baseInsets, footerReserveRpx: 50, footerReserveMinPx: 100 }
      const metrics = resolveStageMetrics(baseViewport, insets, {
        isWide: false,
        showResults: false,
        topBarHeight: 0,
      })
      expect(metrics.footerReserve).toBe(100)
    })

    it('caps footerReserve at FOOTER_RESERVE_MAX_PX on wide screens', () => {
      const wideViewport: ViewportMetrics = { width: 1440, height: 900, safeAreaTop: 0, safeAreaBottom: 0, dpr: 1 }
      const metrics = resolveStageMetrics(wideViewport, baseInsets, {
        isWide: false,
        showResults: false,
        topBarHeight: 0,
      })
      const uncapped = Math.round((164 / 750) * 1440) // 315
      expect(uncapped).toBeGreaterThan(120)
      expect(metrics.footerReserve).toBe(120)
    })

    it('caps header margin at HEADER_MARGIN_MAX_PX on wide screens', () => {
      const wideViewport: ViewportMetrics = { width: 1440, height: 900, safeAreaTop: 0, safeAreaBottom: 0, dpr: 1 }
      const metrics = resolveStageMetrics(wideViewport, baseInsets, {
        isWide: false,
        showResults: false,
        topBarHeight: 0,
      })
      const uncapped = Math.round((20 / 750) * 1440) // 38
      expect(uncapped).toBeLessThan(80)
      // With baseInsets.headerMarginRpx=20, 1440px gives 38px, which is below 80px cap
      expect(metrics.headerBottom).toBe(0 + 38 + 44)

      // Now test with H5 default margin (60 rpx) which would be 115px on 1440px
      const h5Insets = { ...baseInsets, headerMarginRpx: 60 }
      const h5Metrics = resolveStageMetrics(wideViewport, h5Insets, {
        isWide: false,
        showResults: false,
        topBarHeight: 0,
      })
      const h5Uncapped = Math.round((60 / 750) * 1440) // 115
      expect(h5Uncapped).toBeGreaterThan(80)
      expect(h5Metrics.headerBottom).toBe(0 + 80 + 44) // capped at 80
    })

    it('does not cap rpx values on small screens', () => {
      const metrics = resolveStageMetrics(baseViewport, baseInsets, {
        isWide: false,
        showResults: false,
        topBarHeight: 0,
      })
      const expectedFooter = Math.max(48, Math.round((164 / 750) * 390)) // 85
      expect(expectedFooter).toBeLessThan(120)
      expect(metrics.footerReserve).toBe(expectedFooter)
    })
  })

  describe('resolveSafeFrame', () => {
    it('draw_stage: insets use draw values', () => {
      const safeFrame = resolveSafeFrame(baseViewport, baseInsets, {
        scene: 'draw_stage',
        topBarHeight: 44,
      })
      expect(safeFrame.x).toBe(baseInsets.sideInsetDraw)
      expect(safeFrame.width).toBe(390 - baseInsets.sideInsetDraw * 2)
    })

    it('result_stage: insets use result values', () => {
      const safeFrame = resolveSafeFrame(baseViewport, baseInsets, {
        scene: 'result_stage',
        topBarHeight: 0,
      })
      expect(safeFrame.x).toBe(baseInsets.sideInsetResult)
    })

    it('incorporates safeAreaTop and safeAreaBottom into insets', () => {
      const viewport: ViewportMetrics = { ...baseViewport, safeAreaTop: 20, safeAreaBottom: 20 }
      const safeFrame = resolveSafeFrame(viewport, baseInsets, {
        scene: 'draw_stage',
        topBarHeight: 0,
      })
      const headerBottom = baseInsets.headerIconSize + Math.round((20 / 750) * 390)
      const topInset = Math.max(0, headerBottom - 0) + baseInsets.topExtraDraw + 20
      const footerReserve = Math.max(baseInsets.footerReserveMinPx, Math.round((164 / 750) * 390))
      const bottomInset = Math.min(
        footerReserve,
        Math.max(baseInsets.bottomMinDraw, 844 * baseInsets.bottomRatioDraw),
      ) + 20
      expect(safeFrame.y).toBe(topInset)
      expect(safeFrame.bottomInset).toBe(bottomInset)
    })

    it('uses precomputedStage when provided', () => {
      const safeFrame = resolveSafeFrame(baseViewport, baseInsets, {
        scene: 'draw_stage',
        topBarHeight: 0,
        precomputedStage: {
          stageWidth: 200,
          stageHeight: 400,
          headerBottom: 60,
          footerReserve: 30,
        },
      })
      expect(safeFrame.width).toBe(200 - baseInsets.sideInsetDraw * 2)
      expect(safeFrame.height).toBe(400 - (60 + baseInsets.topExtraDraw) - (30 + 0))
    })

    it('width and height are never negative', () => {
      const tinyViewport: ViewportMetrics = { width: 10, height: 10, safeAreaTop: 0, safeAreaBottom: 0, dpr: 1 }
      const safeFrame = resolveSafeFrame(tinyViewport, baseInsets, {
        scene: 'draw_stage',
        topBarHeight: 0,
      })
      expect(safeFrame.width).toBeGreaterThanOrEqual(0)
      expect(safeFrame.height).toBeGreaterThanOrEqual(0)
    })

    it('centerY calculation for draw_stage includes footerReserve/2 offset', () => {
      const safeFrame = resolveSafeFrame(baseViewport, baseInsets, {
        scene: 'draw_stage',
        topBarHeight: 0,
      })
      const topInset = Math.max(0, baseInsets.headerIconSize + Math.round((20 / 750) * 390)) + baseInsets.topExtraDraw
      const bottomInset = Math.min(baseInsets.footerReserveMinPx, Math.max(baseInsets.bottomMinDraw, 844 * 0.2))
      const expectedCenterY = (topInset - bottomInset) / 2 + baseInsets.footerReserveMinPx / 2
      expect(safeFrame.centerY).toBe(expectedCenterY)
    })

    it('centerY for result_stage omits footerReserve/2 offset', () => {
      const drawFrame = resolveSafeFrame(baseViewport, baseInsets, {
        scene: 'draw_stage',
        topBarHeight: 0,
      })
      const resultFrame = resolveSafeFrame(baseViewport, baseInsets, {
        scene: 'result_stage',
        topBarHeight: 0,
      })
      expect(resultFrame.centerY).not.toBe(drawFrame.centerY)
      const headerBottom = baseInsets.headerIconSize + Math.round((20 / 750) * 390)
      const topInset = Math.max(0, headerBottom - 0) + baseInsets.topExtraResult
      const footerReserve = Math.max(baseInsets.footerReserveMinPx, Math.round((164 / 750) * 390))
      // resolveSafeFrame uses precomputedStage defaults with showResults=false,
      // so bottomInset uses stage.stageHeight=844 and bottomRatioDraw=0.2
      const bottomInset = Math.min(
        footerReserve,
        Math.max(baseInsets.bottomMinDraw, 844 * baseInsets.bottomRatioDraw),
      )
      const expectedCenterY = (topInset - bottomInset) / 2
      expect(resultFrame.centerY).toBe(expectedCenterY)
    })
  })
})
