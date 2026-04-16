/**
 * Name: overlay_viewport
 * Purpose: compute overlay viewport, safe-area, and result panel dimensions.
 * Reason: keep WeChat-safe spacing and result-zone height out of component and GSAP code.
 * Data flow: window metrics and menu button bounds flow in; stage/result/header metrics flow out.
 */

// TODO: phase1 migration shim — this file delegates to core/viewport modules.

import {
  resolveStageMetrics,
  type StageMetrics,
} from '../core/viewport/safe_frame_calculator'
import type { ViewportMetrics, UiInsetsConfig } from '../core/viewport/types'

export interface OverlayMenuButtonRect {
  top: number
  height: number
}

export interface OverlayViewportInput {
  windowWidth: number
  windowHeight: number
  isWide: boolean
  showResults: boolean
  menuButtonRect?: OverlayMenuButtonRect | null
}

export interface OverlayViewportMetrics extends StageMetrics {}

const HEADER_ICON_SIZE_PX = 44
const STAGE_WIDTH_RATIO_WIDE = 0.44
const RESULT_STAGE_HEIGHT_RATIO = 0.42

function getDefaultInsets(windowWidth: number, isMiniProgram: boolean, showResults: boolean): UiInsetsConfig {
  return {
    topBarHeight: 0,
    headerIconSize: HEADER_ICON_SIZE_PX,
    headerMarginRpx: isMiniProgram
      ? (showResults ? 80 : 140)
      : (showResults ? 20 : 60),
    footerReserveRpx: isMiniProgram ? 196 : 164,
    footerReserveMinPx: 48,
    resultStageWidthRatio: STAGE_WIDTH_RATIO_WIDE,
    resultStageHeightRatio: RESULT_STAGE_HEIGHT_RATIO,
    sideInsetDraw: 24,
    sideInsetResult: 20,
    topExtraDraw: 12,
    topExtraResult: 8,
    bottomMinDraw: 56,
    bottomMinResult: 44,
    bottomRatioDraw: 0.2,
    bottomRatioResult: 0.16,
  }
}

/**
 * Resolve stage and result panel metrics for both H5 and WeChat mini program layouts.
 */
export function resolveOverlayViewport(input: OverlayViewportInput): OverlayViewportMetrics {
  const { windowWidth, windowHeight, isWide, showResults, menuButtonRect } = input
  const isMiniProgram = Boolean(menuButtonRect)
  const topBarHeight = menuButtonRect ? menuButtonRect.top + menuButtonRect.height + 8 : 0

  const metrics: ViewportMetrics = {
    width: windowWidth,
    height: windowHeight,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    dpr: 1,
  }

  const insets = getDefaultInsets(windowWidth, isMiniProgram, showResults)

  return resolveStageMetrics(metrics, insets, {
    isWide,
    showResults,
    topBarHeight,
  })
}
