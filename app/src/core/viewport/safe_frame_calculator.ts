/**
 * Name: core/viewport/safe_frame_calculator
 * Purpose: compute the safe frame from raw viewport metrics and UI insets.
 * Reason: consolidate stage-size and inset math into one pure, testable function.
 */

import type { ViewportMetrics, SafeFrame, UiInsetsConfig } from './types'

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
    toPx(insets.headerMarginRpx, width) +
    insets.headerIconSize

  const footerReserve = Math.max(
    insets.footerReserveMinPx,
    toPx(insets.footerReserveRpx, width),
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
    (isResult ? insets.topExtraResult : insets.topExtraDraw)
  const bottomInset = Math.min(
    stage.footerReserve,
    Math.max(
      isResult ? insets.bottomMinResult : insets.bottomMinDraw,
      stage.stageHeight * (isResult ? insets.bottomRatioResult : insets.bottomRatioDraw),
    ),
  )

  const width = Math.max(0, stage.stageWidth - sideInset * 2)
  const height = Math.max(0, stage.stageHeight - topInset - bottomInset)

  return {
    x: sideInset,
    y: topInset,
    width,
    height,
    centerX: 0,
    centerY: (topInset - bottomInset) / 2,
    bottomInset,
  }
}
