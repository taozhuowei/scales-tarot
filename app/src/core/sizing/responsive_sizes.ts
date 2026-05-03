/**
 * Name: core/sizing/responsive_sizes
 * Purpose: pixel-valued sizes derived from the canvas width via `k`,
 *          plus the platform-window-info adapter (`readViewport`) that
 *          turns `uni.getWindowInfo()` shaped data into a `PhysicalViewport`.
 * Reason: the previous `scale.ts` mixed five concerns into a single 473-line
 *          file. Splitting the sizes derivation + viewport adapter out gives
 *          the layout solver a small, pure, dependency it can rely on
 *          without dragging in the Vue composable or rAF shims.
 * Data flow: canvasWidth ──▶ deriveSizes ──▶ ResponsiveSizes;
 *            uni.getWindowInfo()-shaped data ──▶ readViewport ──▶
 *            PhysicalViewport (caller pipes width through pickCanvasWidth
 *            for the layout solver path).
 *
 * Purity: every export here is a pure value or pure function. No Vue, no
 *         uni APIs, no DOM. Trivially testable.
 */

import {
  BASELINE_ACTION_AREA_HEIGHT,
  BASELINE_DRAWER_MIN_HEIGHT,
  BASELINE_FONT_L,
  BASELINE_FONT_M,
  BASELINE_FONT_S,
  BASELINE_FONT_XL,
  BASELINE_FONT_XS,
  BASELINE_FONT_XXL,
  BASELINE_GAP,
  BASELINE_HEADER_HEIGHT,
  BASELINE_MARGIN,
  deriveScale,
} from './responsive_breakpoints'

// ---------------------------------------------------------------------------
// Sizes interface — the single source of truth for derived px values.
// ---------------------------------------------------------------------------

/**
 * Pixel-valued sizes, all derived from `canvasWidth` via `k`.
 * Every px field is rounded to the nearest integer so consumers never
 * see sub-pixel values that would force fractional layouts.
 */
export interface ResponsiveSizes {
  /** Logical canvas width (clamped to [375, 440]). */
  canvasWidth: number
  /** Scale factor relative to iPhone 8 baseline. */
  k: number
  /** Header height in px (baseline 80 × k, rounded). */
  headerHeight: number
  /** Outer / page margin in px (baseline 16 × k, rounded). */
  margin: number
  /** Inter-card gap in px (baseline 12 × k, rounded). */
  gap: number
  /** Minimum drawer initial height in px (baseline 120 × k, rounded). */
  drawerMinHeight: number
  /** Bottom action area height in px (baseline 96 × k, rounded). */
  actionAreaHeight: number
  /** Hero / display font size in px (baseline 32 × k, rounded). */
  fontXXL: number
  /** Large heading font size in px (baseline 24 × k, rounded). */
  fontXL: number
  /** Heading font size in px (baseline 22 × k, rounded). */
  fontL: number
  /** Medium body font size in px (baseline 16 × k, rounded). */
  fontM: number
  /** Small body font size in px (baseline 14 × k, rounded). */
  fontS: number
  /** Extra-small caption font size in px (baseline 12 × k, rounded). */
  fontXS: number
}

/**
 * Pure derivation: given a canvas width, return all derived px sizes.
 * Each px field is rounded to the nearest integer.
 *
 * Pure function: same input always produces the same output.
 */
export function deriveSizes(canvasWidth: number): ResponsiveSizes {
  const k = deriveScale(canvasWidth)
  return {
    canvasWidth,
    k,
    headerHeight: Math.round(BASELINE_HEADER_HEIGHT * k),
    margin: Math.round(BASELINE_MARGIN * k),
    gap: Math.round(BASELINE_GAP * k),
    drawerMinHeight: Math.round(BASELINE_DRAWER_MIN_HEIGHT * k),
    actionAreaHeight: Math.round(BASELINE_ACTION_AREA_HEIGHT * k),
    fontXXL: Math.round(BASELINE_FONT_XXL * k),
    fontXL: Math.round(BASELINE_FONT_XL * k),
    fontL: Math.round(BASELINE_FONT_L * k),
    fontM: Math.round(BASELINE_FONT_M * k),
    fontS: Math.round(BASELINE_FONT_S * k),
    fontXS: Math.round(BASELINE_FONT_XS * k),
  }
}

// ---------------------------------------------------------------------------
// Viewport adapter — pure conversion from platform window info to a
// PhysicalViewport. The layout solver consumes this shape directly, so the
// adapter lives alongside the sizes it ultimately drives. Width is left
// unclamped so callers can either feed the raw viewport into `pickScreenMode`-
// style branches or pipe it through `pickCanvasWidth` to get the canvas
// value the solver actually uses.
// ---------------------------------------------------------------------------

/**
 * Physical viewport metrics in CSS pixels. The `width` field is the caller's
 * responsibility — typically the result of `pickCanvasWidth(realWidth)` when
 * fed into the layout solver, or the raw viewport width when used for
 * screen-mode classification.
 */
export interface PhysicalViewport {
  /** Logical canvas width (caller's responsibility — typically pickCanvasWidth(real)). */
  width: number
  /** Real viewport height in px. Not clamped. */
  height: number
  /** Top safe-area inset (status bar / notch) in px. */
  safeAreaTop: number
  /** Bottom safe-area inset in px. */
  safeAreaBottom: number
}

/**
 * Shape of the platform-supplied window info we accept. Kept structurally
 * typed so callers can pass `uni.getWindowInfo()` results directly without
 * an explicit conversion.
 */
export interface WindowInfoShape {
  windowWidth: number
  windowHeight: number
  safeAreaInsets?: { top?: number; bottom?: number; left?: number; right?: number }
}

/**
 * Adapter: convert platform window info into a PhysicalViewport.
 *
 * Pure / no side effects. Does NOT clamp the width — pipe through
 * `pickCanvasWidth` at the call site if you want the canvas value the
 * layout solver should use. Negative or fractional inputs are coerced to
 * non-negative integers so downstream math sees stable values.
 */
export function readViewport(info: WindowInfoShape): PhysicalViewport {
  // Single source of zero-defaults: if `safeAreaInsets` is missing entirely
  // (older runtimes / mini-program edge cases) substitute a fully-populated
  // object so each field read below sees a real number, no per-field `?? 0`.
  const insets = info.safeAreaInsets ?? { top: 0, bottom: 0 }
  return {
    width: Math.max(0, Math.floor(info.windowWidth)),
    height: Math.max(0, Math.floor(info.windowHeight)),
    safeAreaTop: Math.max(0, Math.floor(insets.top ?? 0)),
    safeAreaBottom: Math.max(0, Math.floor(insets.bottom ?? 0)),
  }
}
