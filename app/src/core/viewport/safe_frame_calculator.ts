/**
 * Name: core/viewport/safe_frame_calculator
 * Purpose: compute the safe frame from raw viewport metrics and UI insets.
 * Reason: consolidate stage-size and inset math into one pure, testable function.
 */

import type { ViewportMetrics, SafeFrame, UiInsetsConfig } from './types'
import * as LC from '../config/layout_constants'

export interface StageMetrics {
  topBarHeight: number
  headerBottom: number
  footerReserve: number
  stageWidth: number
  stageHeight: number
  stageContainerHeight: number
  resultHeight: number
}

function toPx(rpx: number, windowWidth: number): number {
  return Math.round((rpx / 750) * windowWidth)
}

export interface SafeFrameState {
  scene: 'draw_stage' | 'result_stage'
  topBarHeight: number
  /** If provided, skip stage metrics recomputation and use these values directly. */
  precomputedStage?: Pick<
    StageMetrics,
    'stageWidth' | 'stageHeight' | 'headerBottom' | 'footerReserve'
  >
}

export function getDefaultInsets(windowWidth: number, isMiniProgram: boolean = false): UiInsetsConfig {
  return {
    topBarHeight: isMiniProgram ? 44 : 0,
    headerIconSize: LC.HEADER_ICON_SIZE,
    headerMarginRpx: isMiniProgram ? LC.HEADER_MARGIN_RPX_MP : LC.HEADER_MARGIN_RPX_H5,
    footerReserveRpx: isMiniProgram ? LC.FOOTER_RESERVE_RPX_MP : LC.FOOTER_RESERVE_RPX_H5,
    footerReserveMinPx: LC.FOOTER_RESERVE_MIN_PX,
    resultStageWidthRatio: LC.RESULT_WIDE_WIDTH_FRACTION,
    resultStageHeightRatio: LC.RESULT_NARROW_HEIGHT_FRACTION,
    sideInsetDraw: LC.SIDE_INSET_DRAW,
    sideInsetResult: LC.SIDE_INSET_RESULT,
    topExtraDraw: LC.TOP_EXTRA_DRAW,
    topExtraResult: LC.TOP_EXTRA_RESULT,
    bottomMinDraw: LC.BOTTOM_MIN_DRAW,
    bottomMinResult: LC.BOTTOM_MIN_RESULT,
    bottomRatioDraw: LC.BOTTOM_RATIO_DRAW,
    bottomRatioResult: LC.BOTTOM_RATIO_RESULT,
  }
}

/**
 * Resolve the stage metrics (topBarHeight, headerBottom, footerReserve, stageWidth, stageHeight)
 * from raw viewport metrics. Migrated from overlay_viewport.ts.
 */
export function resolveStageMetrics(
  metrics: ViewportMetrics,
  insets: UiInsetsConfig,
  state: { isWide: boolean; showResults: boolean; topBarHeight: number },
): StageMetrics {
  const { width, height } = metrics
  const { isWide, showResults, topBarHeight } = state

  const stageWidth =
    showResults && isWide
      ? Math.round(width * insets.resultStageWidthRatio)
      : width

  const stageHeight = showResults
    ? isWide
      ? height
      : Math.round(height * insets.resultStageHeightRatio)
    : Math.max(0, height - topBarHeight)

  const headerBottom =
    topBarHeight +
    Math.min(toPx(insets.headerMarginRpx, width), LC.HEADER_MARGIN_MAX_PX) +
    insets.headerIconSize

  const footerReserve = Math.max(
    insets.footerReserveMinPx,
    Math.min(toPx(insets.footerReserveRpx, width), LC.FOOTER_RESERVE_MAX_PX),
  )

  const stageContainerHeight = showResults ? stageHeight : height
  const resultHeight = showResults
    ? isWide
      ? height
      : Math.max(0, height - stageContainerHeight)
    : 0

  return {
    topBarHeight,
    headerBottom,
    footerReserve,
    stageWidth,
    stageHeight,
    stageContainerHeight,
    resultHeight,
  }
}

/**
 * Resolve the overlay safe frame for a given viewport, insets, and layout state.
 * This merges the legacy safe-frame logic (from overlay_safe_frame.ts) with the
 * stage-size logic migrated from overlay_viewport.ts.
 *
 * Device safe areas (safeAreaTop / safeAreaBottom) are now incorporated into the
 * top and bottom insets so notches and gesture bars are respected.
 */
export function resolveSafeFrame(
  metrics: ViewportMetrics,
  insets: UiInsetsConfig,
  state: SafeFrameState,
): SafeFrame {
  const stage = state.precomputedStage ?? resolveStageMetrics(metrics, insets, {
    isWide: false,
    showResults: false,
    topBarHeight: state.topBarHeight,
  })

  const isResult = state.scene === 'result_stage'
  const sideInset = isResult ? insets.sideInsetResult : insets.sideInsetDraw
  const topInset =
    Math.max(0, stage.headerBottom - state.topBarHeight) +
    (isResult ? insets.topExtraResult : insets.topExtraDraw) +
    metrics.safeAreaTop

  const bottomInset = Math.min(
    stage.footerReserve,
    Math.max(
      isResult ? insets.bottomMinResult : insets.bottomMinDraw,
      stage.stageHeight * (isResult ? insets.bottomRatioResult : insets.bottomRatioDraw),
    ),
  ) + metrics.safeAreaBottom

  const width = Math.max(0, stage.stageWidth - sideInset * 2)
  const height = Math.max(0, stage.stageHeight - topInset - bottomInset)

  return {
    x: sideInset,
    y: topInset,
    width,
    height,
    centerX: 0,
    centerY: (topInset - bottomInset) / 2 + (isResult ? 0 : stage.footerReserve / 2),
    bottomInset,
  }
}
