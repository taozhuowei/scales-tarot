/**
 * Name: core/sizing/responsive_breakpoints
 * Purpose: holds the baseline pixel constants and the canvas-width clamp
 *          (`pickCanvasWidth`) plus the scale factor derivation
 *          (`deriveScale`) that drive the proportional sizing system.
 * Reason: the previous `scale.ts` mixed five concerns (constants, canvas
 *          clamp, sizes derivation, viewport adapter, Vue composable) into
 *          a single 473-line file. Splitting the constants + breakpoint
 *          helpers out gives the sizes module + composable a small, stable
 *          dependency it can re-export through the `scale.ts` facade so
 *          downstream importers stay unchanged.
 * Data flow: viewport width ──▶ pickCanvasWidth ──▶ deriveScale ──▶ k.
 *
 * Purity: every export here is a pure value or pure function. No Vue, no
 *         uni APIs, no DOM. Trivially testable.
 */

// ---------------------------------------------------------------------------
// Constants — iPhone 8 baseline (375 px) pixel values.
//
// All baselines are expressed for a 375 px logical canvas. When the device
// has a wider viewport (up to iPhone 17 Pro Max at 440 px), the sizes grow
// proportionally via `k = canvasWidth / 375`. Below 375 the canvas is
// pinned at 375 — the layout will overflow; we do not try to fit smaller
// devices because they fall below the supported envelope: a non-blocking
// "screen too small" banner is shown, but the layout still tries to render.
// ---------------------------------------------------------------------------

/** Smallest logical canvas width the scale system uses (iPhone 8). */
export const MIN_CANVAS_WIDTH = 375
/** Largest logical canvas width the scale system uses (iPhone 17 Pro Max). */
export const MAX_CANVAS_WIDTH = 440

/** Header total height at the iPhone 8 baseline (px). */
export const BASELINE_HEADER_HEIGHT = 80
/** Page side / outer margin at the baseline (px). */
export const BASELINE_MARGIN = 16
/** Inter-card gap at the baseline (px). */
export const BASELINE_GAP = 12
/** Minimum drawer initial height at the baseline (px). */
export const BASELINE_DRAWER_MIN_HEIGHT = 120
/** Bottom action area height at the baseline (px). */
export const BASELINE_ACTION_AREA_HEIGHT = 96
/** Hero / display font size at the baseline (px). */
export const BASELINE_FONT_XXL = 32
/** Large heading font size at the baseline (px). */
export const BASELINE_FONT_XL = 24
/** Heading font size at the baseline (px). */
export const BASELINE_FONT_L = 22
/** Medium body font size at the baseline (px). */
export const BASELINE_FONT_M = 16
/** Small body font size at the baseline (px). */
export const BASELINE_FONT_S = 14
/** Extra-small caption font size at the baseline (px). */
export const BASELINE_FONT_XS = 12

/** Card visual aspect ratio (height / width) — tarot cards are tall. */
export const CARD_ASPECT_RATIO = 1.6

/**
 * Result card occupies this fraction of the stage rect (each axis).
 * Stage stays at the maximum 1:1.6 safe-area rect; the result card sits
 * centred inside, padded uniformly so it never feels "edge-pressed".
 */
export const RESULT_CARD_FILL_RATIO = 0.9

// ---------------------------------------------------------------------------
// Pure functions — no Vue, no uni, no DOM. Trivially testable.
// ---------------------------------------------------------------------------

/**
 * Pick the logical canvas width for a real viewport width.
 *
 *   width <  375 → 375  (layout will overflow; we don't fit smaller devices)
 *   375 ≤ w ≤ 440 → rounded to integer (fractional viewports are coerced)
 *   width >  440 → 440  (any extra horizontal space becomes background)
 *
 * Non-finite inputs (NaN, -Infinity) collapse to MIN_CANVAS_WIDTH; +Infinity
 * collapses to MAX_CANVAS_WIDTH. The result is always an integer in
 * `[MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH]`, so downstream `deriveSizes`
 * receives a stable, integer canvas width regardless of caller.
 *
 * Pure function: same input always produces the same output.
 */
export function pickCanvasWidth(viewportWidth: number): number {
  // Order matters: clamp *up* (NaN, -Infinity, < MIN) before clamping *down*.
  // NaN compared with any operator is false, so the NaN branch must be the
  // explicit `Number.isNaN` check below — it cannot rely on `< MIN_CANVAS_WIDTH`.
  if (Number.isNaN(viewportWidth) || viewportWidth < MIN_CANVAS_WIDTH) {
    return MIN_CANVAS_WIDTH
  }
  if (viewportWidth > MAX_CANVAS_WIDTH) {
    return MAX_CANVAS_WIDTH
  }
  return Math.round(viewportWidth)
}

/**
 * Derive the global scale factor `k = canvasWidth / 375`.
 *
 * For canvas widths in the supported range the result is in
 * [1.0, 440 / 375 ≈ 1.1733]. Callers should pass canvas widths that
 * have already been clamped via `pickCanvasWidth`, but the function does
 * not enforce that — it is a pure ratio.
 */
export function deriveScale(canvasWidth: number): number {
  return canvasWidth / MIN_CANVAS_WIDTH
}
