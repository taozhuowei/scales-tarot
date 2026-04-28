/**
 * Name: useOverlayLayout
 * Purpose: encapsulate viewport, safe-frame, and scene-layout calculations for the overlay.
 * Reason: separates layout math from the controller so both can be tested and reasoned about independently.
 * Data flow: window size + spread metadata flow in; layout results and metrics flow out.
 */

import type { Ref } from 'vue'
import {
  resolveSceneLayout,
  resolveOverlayViewport,
  buildOverlaySafeFrame,
  resolveMotionMetrics,
  type SceneLayoutResult,
} from '../utils/overlay_layout/index'
import { WIDE_BREAKPOINT, RESULT_SHEET_FRACTION } from '../core/config/layout_constants'

export interface UseOverlayLayoutDeps {
  isWide: Ref<boolean>
  spreadKind: string
  cutPileCount: number
  deckCount: number
}

export function useOverlayLayout(deps: UseOverlayLayoutDeps) {
  function getMenuButtonRect() {
    // #ifdef MP-WEIXIN
    try {
      const { top, height } = uni.getMenuButtonBoundingClientRect()
      return { top, height }
    } catch {
      return { top: 44, height: 32 }
    }
    // #endif
    return null
  }

  function getViewportMetrics(showResults: boolean) {
    const { windowWidth, windowHeight } = uni.getWindowInfo()
    return resolveOverlayViewport({
      windowWidth,
      windowHeight,
      isWide: deps.isWide.value,
      showResults,
      menuButtonRect: getMenuButtonRect(),
    })
  }

  /**
   * Resolve the scene layout for the current spread and viewport.
   * Draw and result stages each solve their own card size against their own
   * safe frame and slot grid. The reveal animation transitions between the two
   * sizes — there is no shared/master size and no CSS focus-scale.
   */
  function getSceneLayout(scene: 'draw_stage' | 'result_stage'): SceneLayoutResult {
    const viewport = getViewportMetrics(scene === 'result_stage')
    return resolveSceneLayout({
      spreadId: deps.spreadKind,
      scene,
      viewport,
      isWide: deps.isWide.value,
      cardAspectRatio: 1.6,
      resultSheetFraction: scene === 'draw_stage' ? RESULT_SHEET_FRACTION : undefined,
    })
  }

  function getMotionMetrics(scene: 'draw_stage' | 'result_stage' = 'draw_stage') {
    const viewport = getViewportMetrics(scene === 'result_stage')
    const safeFrame = buildOverlaySafeFrame(
      scene,
      viewport,
      scene === 'draw_stage' ? RESULT_SHEET_FRACTION : undefined,
    )

    return resolveMotionMetrics({
      safeFrame,
      cardAspectRatio: 1.6,
      spreadId: deps.spreadKind,
      isWide: deps.isWide.value,
      cutPileCount: deps.cutPileCount,
      deckCount: deps.deckCount,
    })
  }

  function getOverlayLayouts() {
    const drawViewport = getViewportMetrics(false)
    const drawLayout = getSceneLayout('draw_stage')
    const resultLayout = getSceneLayout('result_stage')
    return { drawViewport, drawLayout, resultLayout }
  }

  function checkWidth(windowWidth: number): boolean {
    const wasWide = deps.isWide.value
    deps.isWide.value = windowWidth >= WIDE_BREAKPOINT
    return wasWide !== deps.isWide.value
  }

  return {
    getViewportMetrics,
    getSceneLayout,
    getMotionMetrics,
    getOverlayLayouts,
    getMenuButtonRect,
    checkWidth,
    RESULT_SHEET_FRACTION,
  }
}
