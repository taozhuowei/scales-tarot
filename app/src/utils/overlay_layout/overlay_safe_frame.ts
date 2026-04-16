/**
 * Name: overlay_safe_frame
 * Purpose: single source of truth for the overlay safe frame.
 * Reason: both scene layout and motion metrics must consume the same insets,
 *   center offset, and reserved spacing so animations and resting layouts never disagree.
 * Data flow: viewport metrics and scene flow in; safe width/height, insets, and stage center flow out.
 */

import type { OverlayViewportMetrics } from '../overlay_viewport'
import type { SpreadScene } from './spread_spec'

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

const DEFAULT_SIDE_INSET_DRAW = 24
const DEFAULT_SIDE_INSET_RESULT = 20
const DEFAULT_TOP_EXTRA_DRAW = 12
const DEFAULT_TOP_EXTRA_RESULT = 8
const DEFAULT_BOTTOM_MIN_DRAW = 56
const DEFAULT_BOTTOM_MIN_RESULT = 44
const DEFAULT_BOTTOM_RATIO_DRAW = 0.2
const DEFAULT_BOTTOM_RATIO_RESULT = 0.16

/**
 * Resolve the overlay safe frame for a given scene and viewport.
 * This is the only place where side/top/bottom insets are computed.
 */
export function resolveOverlaySafeFrame(
  scene: SpreadScene,
  viewport: OverlayViewportMetrics,
): OverlaySafeFrame {
  const sideInset = scene === 'result_stage' ? DEFAULT_SIDE_INSET_RESULT : DEFAULT_SIDE_INSET_DRAW
  const topInset =
    Math.max(0, viewport.headerBottom - viewport.topBarHeight) +
    (scene === 'result_stage' ? DEFAULT_TOP_EXTRA_RESULT : DEFAULT_TOP_EXTRA_DRAW)
  const bottomInset = Math.min(
    viewport.footerReserve,
    Math.max(
      scene === 'result_stage' ? DEFAULT_BOTTOM_MIN_RESULT : DEFAULT_BOTTOM_MIN_DRAW,
      viewport.stageHeight * (scene === 'result_stage' ? DEFAULT_BOTTOM_RATIO_RESULT : DEFAULT_BOTTOM_RATIO_DRAW),
    ),
  )

  const width = Math.max(0, viewport.stageWidth - sideInset * 2)
  const height = Math.max(0, viewport.stageHeight - topInset - bottomInset)

  return {
    width,
    height,
    centerYOffset: (topInset - bottomInset) / 2,
    topInset,
    bottomInset,
    sideInset,
    stageCenterX: 0,
    stageCenterY: (topInset - bottomInset) / 2,
  }
}
