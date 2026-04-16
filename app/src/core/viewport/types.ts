/**
 * Name: core/viewport/types
 * Purpose: core viewport and safe frame types used by layout and animation systems.
 * Reason: isolate primitive geometric types from higher-level overlay layout code.
 */

export interface ViewportMetrics {
  width: number
  height: number
  safeAreaTop: number
  safeAreaBottom: number
  dpr: number
}

export interface SafeFrame {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
  bottomInset: number
}

export interface UiInsetsConfig {
  /** Top bar height in px (menu button area). */
  topBarHeight: number
  /** Header icon size in px. */
  headerIconSize: number
  /** Header margin expressed in rpx; converted using viewport width. */
  headerMarginRpx: number
  /** Footer reserve expressed in rpx; converted using viewport width. */
  footerReserveRpx: number
  /** Minimum footer reserve in px after conversion. */
  footerReserveMinPx: number
  /** Stage width ratio in wide result mode. */
  resultStageWidthRatio: number
  /** Stage height ratio in narrow result mode. */
  resultStageHeightRatio: number
  /** Side inset for draw stage. */
  sideInsetDraw: number
  /** Side inset for result stage. */
  sideInsetResult: number
  /** Extra top inset for draw stage. */
  topExtraDraw: number
  /** Extra top inset for result stage. */
  topExtraResult: number
  /** Minimum bottom inset for draw stage. */
  bottomMinDraw: number
  /** Minimum bottom inset for result stage. */
  bottomMinResult: number
  /** Bottom inset ratio for draw stage. */
  bottomRatioDraw: number
  /** Bottom inset ratio for result stage. */
  bottomRatioResult: number
}
