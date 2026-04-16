/**
 * Name: overlay_safe_frame
 * Purpose: single source of truth for the overlay safe frame.
 * Reason: both scene layout and motion metrics must consume the same insets,
 *   center offset, and reserved spacing so animations and resting layouts never disagree.
 * Data flow: viewport metrics and scene flow in; safe width/height, insets, and stage center flow out.
 */

// TODO: phase1 migration shim — this file delegates to core/viewport modules.

import type { OverlayViewportMetrics } from '../overlay_viewport'
import type { SpreadScene } from './spread_spec'
import { resolveSafeFrame } from '../../core/viewport/safe_frame_calculator'
import type { ViewportMetrics, UiInsetsConfig } from '../../core/viewport/types'

export interface OverlaySafeFrame {
  width: number
  height: number
  centerYOffset: number
  topInset: number
  bottomInset: number
  sideInset: number
  stageCenterX: number
  stageCenterY: number
}

function toViewportMetrics(viewport: OverlayViewportMetrics): ViewportMetrics {
  return {
    width: viewport.stageWidth,
    height: viewport.stageHeight,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    dpr: 1,
  }
}

function getDefaultInsets(): UiInsetsConfig {
  return {
    topBarHeight: 0,
    headerIconSize: 44,
    headerMarginRpx: 60,
    footerReserveRpx: 164,
    footerReserveMinPx: 48,
    resultStageWidthRatio: 0.44,
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
}

/**
 * Resolve the overlay safe frame for a given scene and viewport.
 * This is the only place where side/top/bottom insets are computed.
 */
export function resolveOverlaySafeFrame(
  scene: SpreadScene,
  viewport: OverlayViewportMetrics,
): OverlaySafeFrame {
  const insets = getDefaultInsets()
  const metrics = toViewportMetrics(viewport)
  const safeFrame = resolveSafeFrame(metrics, insets, {
    scene,
    topBarHeight: viewport.topBarHeight,
    precomputedStage: {
      stageWidth: viewport.stageWidth,
      stageHeight: viewport.stageHeight,
      headerBottom: viewport.headerBottom,
      footerReserve: viewport.footerReserve,
    },
  })

  return {
    width: safeFrame.width,
    height: safeFrame.height,
    centerYOffset: safeFrame.centerY,
    topInset: safeFrame.y,
    bottomInset: safeFrame.bottomInset,
    sideInset: safeFrame.x,
    stageCenterX: safeFrame.centerX,
    stageCenterY: safeFrame.centerY,
  }
}
