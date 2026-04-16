// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveOverlayViewport } from '../app/src/utils/overlay_viewport'

const RESULT_STAGE_HEIGHT_RATIO = 0.42

function makeInput(overrides: Partial<Parameters<typeof resolveOverlayViewport>[0]> = {}) {
  return {
    windowWidth: 390,
    windowHeight: 844,
    isWide: false,
    showResults: false,
    menuButtonRect: null as { top: number; height: number } | null,
    ...overrides,
  }
}

describe('overlay_viewport', () => {
  describe('narrow viewport matrix', () => {
    it('draw stage fills full window height below top bar', () => {
      const metrics = resolveOverlayViewport(makeInput({ isWide: false, showResults: false }))

      expect(metrics.stageWidth).toBe(390)
      expect(metrics.stageHeight).toBe(844)
      expect(metrics.stageContainerHeight).toBe(844)
      expect(metrics.resultHeight).toBe(0)
    })

    it('result stage splits height using the layout ratio', () => {
      const metrics = resolveOverlayViewport(makeInput({ isWide: false, showResults: true }))

      expect(metrics.stageWidth).toBe(390)
      expect(metrics.stageContainerHeight).toBe(Math.round(844 * RESULT_STAGE_HEIGHT_RATIO))
      expect(metrics.stageHeight).toBe(metrics.stageContainerHeight)
      expect(metrics.resultHeight).toBe(844 - metrics.stageContainerHeight)
      // The two panels must sum to the full window height
      expect(metrics.stageContainerHeight + metrics.resultHeight).toBe(844)
    })

    it('headerBottom and footerReserve are positive', () => {
      const metrics = resolveOverlayViewport(makeInput())

      expect(metrics.headerBottom).toBeGreaterThan(0)
      expect(metrics.footerReserve).toBeGreaterThan(0)
    })
  })

  describe('wide viewport matrix', () => {
    it('draw stage fills full window', () => {
      const metrics = resolveOverlayViewport(makeInput({ isWide: true, showResults: false, windowWidth: 1200, windowHeight: 800 }))

      expect(metrics.stageWidth).toBe(1200)
      expect(metrics.stageHeight).toBe(800)
      expect(metrics.stageContainerHeight).toBe(800)
      expect(metrics.resultHeight).toBe(0)
    })

    it('result stage uses 44% width for stage and full height for result', () => {
      const metrics = resolveOverlayViewport(makeInput({ isWide: true, showResults: true, windowWidth: 1200, windowHeight: 800 }))

      expect(metrics.stageWidth).toBe(Math.round(1200 * 0.44))
      expect(metrics.stageHeight).toBe(800)
      expect(metrics.stageContainerHeight).toBe(800)
      expect(metrics.resultHeight).toBe(800)
    })
  })

  describe('mini program viewport matrix', () => {
    it('includes menu button rect in top bar height', () => {
      const metrics = resolveOverlayViewport(makeInput({
        menuButtonRect: { top: 12, height: 32 },
        showResults: false,
      }))

      expect(metrics.topBarHeight).toBe(12 + 32 + 8)
      // Header bottom must be below the top bar
      expect(metrics.headerBottom).toBeGreaterThan(metrics.topBarHeight)
    })

    it('result stage reserves larger footer for mini program', () => {
      const h5 = resolveOverlayViewport(makeInput({ isWide: false, showResults: true, menuButtonRect: null }))
      const mp = resolveOverlayViewport(makeInput({ isWide: false, showResults: true, menuButtonRect: { top: 12, height: 32 } }))

      expect(mp.footerReserve).toBeGreaterThan(h5.footerReserve)
    })
  })
})
