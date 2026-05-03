/**
 * Name: composables/overlay_layout/breakpoints
 * Purpose: holds the breakpoint constants and helpers used by the
 *          overlay-layout composable: the wide-screen side-drawer width,
 *          the PC-mode threshold, the mini-program menu-button rect
 *          reader, and the topBarHeight resolution.
 * Reason: extracted from `use_overlay_layout.ts` (was 361 lines) so the
 *          breakpoint math + platform chrome adapter stays small,
 *          testable, and can be re-exported via the composable facade
 *          without changing any downstream import paths.
 * Data flow: viewport width ──▶ checkWidth(deps.isWide) toggles the
 *            wide-screen flag; mini-program capsule rect ──▶
 *            resolveTopBarHeight ──▶ topBarHeight metric.
 */

import { MAX_CANVAS_WIDTH } from '../../core/sizing/scale'

/**
 * Side-column drawer width (px) used by the wide-screen reading layout.
 * The wide split is rendered by ReadingSplitView at the view layer and is
 * not visible to the solver — the constant lives here so `getViewportMetrics`
 * can still expose `stageWidth = viewport.width − sideDrawerWidth` for the
 * legacy callers until that UI is removed in a later step.
 */
export const WIDE_SIDE_DRAWER_WIDTH_PX = 480

/**
 * PC-mode breakpoint (px). Below this the bottom-sheet drawer wins; at or
 * above it the side-column reading layout wins. Equal to the canvas cap
 * (440) plus the side-column drawer width (480). Stays here for the same
 * reason as `WIDE_SIDE_DRAWER_WIDTH_PX` — the wide-split UI cleanup is
 * deferred to a later step.
 */
export const PC_BREAKPOINT = MAX_CANVAS_WIDTH + WIDE_SIDE_DRAWER_WIDTH_PX // 920

/**
 * Read the mini-program capsule rect when running in WeChat MP. Returns
 * `null` on H5 so the caller can treat the absence of a capsule uniformly.
 */
export function getMenuButtonRect(): { top: number; height: number } | null {
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

/**
 * Derive the topBarHeight (capsule + small breathing room) from the MP
 * capsule rect. H5 has no capsule, so the topBarHeight is 0.
 */
export function resolveTopBarHeight(rect: { top: number; height: number } | null): number {
  if (!rect) return 0
  return rect.top + rect.height + 8
}

/**
 * Update an `isWide` ref when the window size crosses the PC breakpoint.
 * Returns true iff `isWide` actually changed so the caller can short-
 * circuit redundant relayouts.
 *
 * The threshold is `PC_BREAKPOINT` (920 = phone-stage 440 + side drawer
 * 480), the smallest viewport on which the side-column reading layout
 * fits next to the phone-sized stage. Below 920 we render the bottom-
 * sheet drawer; above we render the side column.
 */
export function checkWidth(isWide: { value: boolean }, windowWidth: number): boolean {
  const wasWide = isWide.value
  isWide.value = windowWidth >= PC_BREAKPOINT
  return wasWide !== isWide.value
}
