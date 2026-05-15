// @vitest-environment node

/**
 * Test suite for the proportional scale module.
 *
 * Coverage: only the pure exported functions —
 *   - pickCanvasWidth (clamps viewport width into [375, 440])
 *   - deriveScale     (k = canvasWidth / 375)
 *   - deriveSizes    (px sizes = baseline × k, rounded)
 *
 * `useResponsiveScale` is a Vue composable that depends on the uni
 * runtime and `requestAnimationFrame`; it is intentionally out of scope
 * for this suite (would require mocking the platform layer).
 *
 * Inputs are passed as plain literals — no DOM, no uni, no Vue.
 */

import { beforeEach, describe, expect, it } from 'vitest'
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
  MAX_CANVAS_WIDTH,
  MIN_CANVAS_WIDTH,
  deriveScale,
  deriveSizes,
  pickCanvasWidth,
  useResponsiveScale,
} from '../src/core/sizing/scale'

/**
 * Hard-coded expected token values at canvas 440 (k = 440/375 ≈ 1.17333…).
 *
 * Reason these are literals, not `Math.round(BASELINE_X * k)`: the rounding
 * mode of the implementation is part of its contract. If a future change
 * swapped `Math.round` for `Math.floor` (or vice-versa) a formula-based
 * assertion would silently keep passing — both sides would shift together.
 * Pinning the exact integers means any rounding-mode regression fails loudly.
 */
const EXPECTED_AT_440 = {
  headerHeight: 94,
  margin: 19,
  gap: 14,
  drawerMinHeight: 141,
  actionAreaHeight: 113,
  fontXXL: 38,
  fontXL: 28,
  fontL: 26,
  fontM: 19,
  fontS: 16,
  fontXS: 14,
} as const

describe('scale — pickCanvasWidth', () => {
  it('clamps narrow viewports up to MIN_CANVAS_WIDTH (375)', () => {
    expect(pickCanvasWidth(0)).toBe(MIN_CANVAS_WIDTH)
    expect(pickCanvasWidth(200)).toBe(MIN_CANVAS_WIDTH)
    expect(pickCanvasWidth(374)).toBe(MIN_CANVAS_WIDTH)
  })

  it('passes through widths inside the supported range as-is', () => {
    expect(pickCanvasWidth(375)).toBe(375)
    expect(pickCanvasWidth(400)).toBe(400)
    expect(pickCanvasWidth(440)).toBe(440)
  })

  it('clamps wide viewports down to MAX_CANVAS_WIDTH (440)', () => {
    expect(pickCanvasWidth(441)).toBe(MAX_CANVAS_WIDTH)
    expect(pickCanvasWidth(768)).toBe(MAX_CANVAS_WIDTH)
    expect(pickCanvasWidth(1440)).toBe(MAX_CANVAS_WIDTH)
    expect(pickCanvasWidth(9999)).toBe(MAX_CANVAS_WIDTH)
  })

  it('handles non-finite inputs by collapsing to the appropriate bound', () => {
    // NaN and -Infinity are "less than MIN" in the implementation's eyes.
    expect(pickCanvasWidth(NaN)).toBe(375)
    expect(pickCanvasWidth(-Infinity)).toBe(375)
    // +Infinity is greater than MAX → clamps down to 440.
    expect(pickCanvasWidth(Infinity)).toBe(440)
  })

  it('rounds fractional inputs inside the supported range to integers', () => {
    // Contract: fractional viewports are coerced to the nearest integer
    // canvas width so downstream `deriveSizes` always sees an integer.
    expect(pickCanvasWidth(390.6)).toBe(391)
    expect(pickCanvasWidth(390.4)).toBe(390)
  })
})

describe('scale — deriveScale', () => {
  it('returns exactly 1.0 at the baseline canvas (375)', () => {
    expect(deriveScale(375)).toBe(1)
  })

  it('returns 440/375 at the maximum canvas (440)', () => {
    expect(deriveScale(440)).toBeCloseTo(440 / 375, 10)
  })

  it('is linear at intermediate canvas widths', () => {
    expect(deriveScale(400)).toBeCloseTo(400 / 375, 10)
  })
})

describe('scale — deriveSizes at iPhone 8 baseline (375)', () => {
  it('returns each token equal to its baseline value', () => {
    const t = deriveSizes(375)
    expect(t.canvasWidth).toBe(375)
    expect(t.k).toBe(1)
    expect(t.headerHeight).toBe(BASELINE_HEADER_HEIGHT)
    expect(t.margin).toBe(BASELINE_MARGIN)
    expect(t.gap).toBe(BASELINE_GAP)
    expect(t.drawerMinHeight).toBe(BASELINE_DRAWER_MIN_HEIGHT)
    expect(t.actionAreaHeight).toBe(BASELINE_ACTION_AREA_HEIGHT)
    expect(t.fontXXL).toBe(BASELINE_FONT_XXL)
    expect(t.fontXL).toBe(BASELINE_FONT_XL)
    expect(t.fontL).toBe(BASELINE_FONT_L)
    expect(t.fontM).toBe(BASELINE_FONT_M)
    expect(t.fontS).toBe(BASELINE_FONT_S)
    expect(t.fontXS).toBe(BASELINE_FONT_XS)
  })
})

describe('scale — deriveSizes at iPhone 17 Pro Max (440)', () => {
  it('scales each token by 440/375 and rounds to the spec literals', () => {
    const k = 440 / 375
    const t = deriveSizes(440)
    expect(t.canvasWidth).toBe(440)
    expect(t.k).toBeCloseTo(k, 10)

    // All nine assertions use hard-coded integers — see EXPECTED_AT_440 for
    // why (a `Math.round` → `Math.floor` regression would otherwise pass).
    expect(t.headerHeight).toBe(EXPECTED_AT_440.headerHeight) // 94
    expect(t.margin).toBe(EXPECTED_AT_440.margin) // 19
    expect(t.gap).toBe(EXPECTED_AT_440.gap) // 14
    expect(t.drawerMinHeight).toBe(EXPECTED_AT_440.drawerMinHeight) // 141
    expect(t.actionAreaHeight).toBe(EXPECTED_AT_440.actionAreaHeight) // 113
    expect(t.fontXXL).toBe(EXPECTED_AT_440.fontXXL) // 38
    expect(t.fontXL).toBe(EXPECTED_AT_440.fontXL) // 28
    expect(t.fontL).toBe(EXPECTED_AT_440.fontL) // 26
    expect(t.fontM).toBe(EXPECTED_AT_440.fontM) // 19
    expect(t.fontS).toBe(EXPECTED_AT_440.fontS) // 16
    expect(t.fontXS).toBe(EXPECTED_AT_440.fontXS) // 14
  })
})

describe('scale — deriveSizes token integrity', () => {
  it('returns integer values for every px field across the supported range', () => {
    for (const canvas of [375, 390, 400, 414, 428, 440]) {
      const t = deriveSizes(canvas)
      expect(Number.isInteger(t.headerHeight)).toBe(true)
      expect(Number.isInteger(t.margin)).toBe(true)
      expect(Number.isInteger(t.gap)).toBe(true)
      expect(Number.isInteger(t.drawerMinHeight)).toBe(true)
      expect(Number.isInteger(t.actionAreaHeight)).toBe(true)
      expect(Number.isInteger(t.fontXXL)).toBe(true)
      expect(Number.isInteger(t.fontXL)).toBe(true)
      expect(Number.isInteger(t.fontL)).toBe(true)
      expect(Number.isInteger(t.fontM)).toBe(true)
      expect(Number.isInteger(t.fontS)).toBe(true)
      expect(Number.isInteger(t.fontXS)).toBe(true)
    }
  })

  it('exposes a `k` field equal to deriveScale(canvasWidth) for several inputs', () => {
    for (const canvas of [375, 390, 400, 414, 428, 440]) {
      expect(deriveSizes(canvas).k).toBe(deriveScale(canvas))
    }
  })
})

/**
 * Singleton behaviour for `useResponsiveScale` — verifies the module-level
 * state survives across calls (so N consumers share ONE listener) and that
 * `dispose()` resets it cleanly so a future call rebuilds fresh refs.
 *
 * The test runs in node env (`@vitest-environment node` declared at the top
 * of the file), where `uni` and the rAF globals do not exist. We stub them
 * minimally in `beforeEach` so the composable's platform-touching paths
 * resolve to deterministic values. The stub is reset every test so any
 * residual singleton state from a prior test leaks at most one assertion.
 */
describe('scale — useResponsiveScale singleton', () => {
  beforeEach(() => {
    // Minimal `uni` stub — the composable touches only these three methods.
    // Pinning a 375 px viewport keeps the derived sizes deterministic and
    // matches the iPhone 8 baseline used by the other suites.
    ;(globalThis as { uni?: unknown }).uni = {
      getWindowInfo: () => ({
        windowWidth: 375,
        windowHeight: 667,
        safeAreaInsets: { top: 0, bottom: 0 },
      }),
      onWindowResize: () => { /* no-op */ },
      offWindowResize: () => { /* no-op */ },
    }
  })

  it('returns the same `sizes` / `viewport` ref objects across calls', () => {
    const a = useResponsiveScale()
    const b = useResponsiveScale()
    // Object identity: every consumer shares ONE subscription point. If
    // this regresses (e.g. someone reverts the singleton), the CSS-variable
    // bridge ends up duplicating listeners and the bridge in pages/main
    // silently drifts from the descendants' independently-subscribed refs.
    expect(a.sizes).toBe(b.sizes)
    expect(a.viewport).toBe(b.viewport)
    a.dispose()
  })

  it('rebuilds fresh refs after `dispose()` resets the singleton', () => {
    const first = useResponsiveScale()
    const sizesBeforeDispose = first.sizes
    first.dispose()

    // After disposal the module-level singleton is null again, so the next
    // call MUST construct fresh refs — the disposed ones are unreachable.
    const second = useResponsiveScale()
    expect(second.sizes).not.toBe(sizesBeforeDispose)
    second.dispose()
  })
})
