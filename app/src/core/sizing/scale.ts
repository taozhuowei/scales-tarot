/**
 * Name: core/sizing/scale
 * Purpose: facade for the proportional-scale system. Re-exports the
 *          breakpoint constants + helpers (`pickCanvasWidth`,
 *          `deriveScale`), the sizes derivation (`deriveSizes`,
 *          `ResponsiveSizes`), and the platform viewport adapter
 *          (`readViewport`, `PhysicalViewport`, `WindowInfoShape`) from
 *          their dedicated modules, then layers the Vue composable
 *          (`useResponsiveScale`) on top — the only piece in this file
 *          that touches uni platform APIs. The rAF/cAF browser-global
 *          shim it depends on lives in `raf_shim.ts`.
 * Reason: the previous monolithic 473-line `scale.ts` mixed five concerns
 *          (constants, canvas clamp, sizes derivation, viewport adapter,
 *          Vue composable). Splitting the pure pieces into
 *          `responsive_breakpoints.ts` + `responsive_sizes.ts` (and the
 *          rAF/cAF shim into `raf_shim.ts`) keeps the public API stable
 *          for downstream importers while letting each file stay focused
 *          and well below the 300-line file budget.
 * Data flow: uni.getWindowInfo() / uni.onWindowResize ──▶
 *            pickCanvasWidth(viewportWidth) ──▶ deriveScale(canvasWidth) ──▶
 *            deriveSizes(canvasWidth) ──▶ Readonly<Ref<ResponsiveSizes>>
 *            consumed by UI surfaces.
 */

import { ref, readonly, onScopeDispose, getCurrentScope } from 'vue'
import type { Ref } from 'vue'
import {
  deriveScale,
  pickCanvasWidth,
} from './responsive_breakpoints'
import {
  deriveSizes,
  readViewport,
  type ResponsiveSizes,
  type PhysicalViewport,
} from './responsive_sizes'
import { raf, caf } from './raf_shim'

// Re-export the public surface from the split modules so existing importers
// (`import { ... } from '.../core/sizing/scale'`) keep compiling without any
// changes. The order mirrors the original `scale.ts` to make the diff
// reviewable; downstream files have no reason to import from the split
// modules directly.
export {
  MIN_CANVAS_WIDTH,
  MAX_CANVAS_WIDTH,
  BASELINE_HEADER_HEIGHT,
  BASELINE_MARGIN,
  BASELINE_GAP,
  BASELINE_DRAWER_MIN_HEIGHT,
  BASELINE_ACTION_AREA_HEIGHT,
  BASELINE_FONT_XXL,
  BASELINE_FONT_XL,
  BASELINE_FONT_L,
  BASELINE_FONT_M,
  BASELINE_FONT_S,
  BASELINE_FONT_XS,
  CARD_ASPECT_RATIO,
  RESULT_CARD_FILL_RATIO,
  MAX_CARD_WIDTH_PX,
  pickCanvasWidth,
  deriveScale,
} from './responsive_breakpoints'
export {
  deriveSizes,
  readViewport,
  type ResponsiveSizes,
  type PhysicalViewport,
  type WindowInfoShape,
} from './responsive_sizes'

/**
 * Sub-pixel jitter threshold. If a recomputed `k` differs from the previous
 * by less than this fraction, the sizes are not updated. 0.5% lines up
 * with "less than half a pixel" on every size derived from k * baseline,
 * ensuring rounded outputs are stable while reactivity stays cheap.
 */
const SCALE_JITTER_THRESHOLD = 0.005

// ---------------------------------------------------------------------------
// Composable — reactive viewport + sizes with rAF coalescing.
// ---------------------------------------------------------------------------

/**
 * Reactive viewport metrics surfaced alongside the sizes. Identical shape
 * to `PhysicalViewport` — kept as a type alias so the composable's state
 * uses one source of truth with the pure adapter `readViewport`.
 */
export type ResponsiveViewport = PhysicalViewport

/** Return shape of `useResponsiveScale`. */
export interface ResponsiveScaleState {
  /** Reactive sizes; updated when viewport width changes (rAF coalesced). */
  sizes: Readonly<Ref<ResponsiveSizes>>
  /** Reactive viewport metrics (width, height, safe areas). */
  viewport: Readonly<Ref<ResponsiveViewport>>
  /**
   * Tear-down hook: removes the `uni.onWindowResize` listener and cancels any
   * pending rAF. Idempotent — safe to call multiple times. Inside a Vue scope
   * (component setup or `effectScope`) this runs automatically via
   * `onScopeDispose`; outside any scope (e.g. ad-hoc unit-test harness)
   * callers must invoke it manually to avoid leaking the listener.
   */
  dispose: () => void
}

/**
 * Read the current viewport from uni APIs and adapt to `ResponsiveViewport`.
 * Side-effecting wrapper around the pure `readViewport(info)` adapter — the
 * composable's only point of contact with the platform.
 */
function readViewportFromUni(): ResponsiveViewport {
  return readViewport(uni.getWindowInfo())
}

/**
 * Decide whether two scale factors differ enough to warrant a token update.
 * Returns `true` when the relative change `|next - prev| / prev` exceeds
 * the jitter threshold. Garbage `next` values (NaN, ±Infinity) are ignored
 * so a malformed window event cannot poison the reactive state. An invalid
 * or non-positive `prev` (uninitialised, NaN) is treated as "no previous
 * value" and forces an update.
 */
function scaleChangedSignificantly(prev: number, next: number): boolean {
  if (!Number.isFinite(next)) return false // ignore garbage updates
  if (!Number.isFinite(prev) || prev <= 0) return true
  return Math.abs(next - prev) / prev >= SCALE_JITTER_THRESHOLD
}

/**
 * Module-level singleton state for `useResponsiveScale`. Persists across
 * calls so every consumer subscribes to the SAME refs and only ONE
 * `uni.onWindowResize` listener is registered for the entire application
 * lifetime. `null` until the first call; reset to `null` by `dispose()`
 * so a future call after disposal can reinitialize cleanly (which is the
 * only path tests / SSR re-entries need).
 */
let singletonState: ResponsiveScaleState | null = null

/**
 * Per-scope cleanup facade. Registered every time `useResponsiveScale` is
 * called inside an active Vue scope. The hook is a deliberate no-op: the
 * singleton outlives any single scope, so registering `dispose` here would
 * tear down the listener the moment any one consumer's scope ends, breaking
 * the others. Only the explicit `dispose()` (or app teardown) releases the
 * underlying listener.
 */
function registerScopedNoOpDispose(): void {
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => { /* singleton outlives per-scope teardown */ })
  }
}

/**
 * Build the singleton state on the first call to `useResponsiveScale`.
 * Wires the `uni.onWindowResize` listener with rAF coalescing + sub-pixel
 * jitter short-circuit, and returns the resulting state object so the
 * caller can stash it in `singletonState`.
 */
function buildSingletonState(): ResponsiveScaleState {
  const initialViewport = readViewportFromUni()
  const initialCanvas = pickCanvasWidth(initialViewport.width)
  const viewport = ref<ResponsiveViewport>(initialViewport)
  const sizes = ref<ResponsiveSizes>(deriveSizes(initialCanvas))

  // 0 sentinel = no pending frame. Number both because `raf` returns `number`
  // on H5 and because `setTimeout` returns `number` in the shim path.
  let pendingFrame = 0
  let disposed = false

  /** Recompute viewport + sizes; called inside the rAF callback. */
  const recompute = (): void => {
    pendingFrame = 0
    if (disposed) return
    const nextViewport = readViewportFromUni()
    viewport.value = nextViewport
    const nextCanvas = pickCanvasWidth(nextViewport.width)
    const nextK = deriveScale(nextCanvas)
    if (!scaleChangedSignificantly(sizes.value.k, nextK)) return
    sizes.value = deriveSizes(nextCanvas)
  }

  // Resize listener: coalesces bursts to the next animation frame, so
  // multiple rapid resize events produce a single token update. Aligning
  // with the next frame also lands the update in the gap between GSAP
  // ticks, avoiding reactivity work mid-animation.
  const resizeHandler = (): void => {
    if (disposed || pendingFrame !== 0) return
    pendingFrame = raf(recompute)
  }
  uni.onWindowResize(resizeHandler)

  // Idempotent tear-down. First call removes the listener, cancels any
  // pending frame, and resets the module-level singleton so a subsequent
  // `useResponsiveScale()` call rebuilds fresh state.
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    uni.offWindowResize(resizeHandler)
    if (pendingFrame !== 0) {
      caf(pendingFrame)
      pendingFrame = 0
    }
    singletonState = null
  }

  return {
    sizes: readonly(sizes) as Readonly<Ref<ResponsiveSizes>>,
    viewport: readonly(viewport) as Readonly<Ref<ResponsiveViewport>>,
    dispose,
  }
}

/**
 * Vue composable: exposes reactive `sizes` + `viewport`, recomputes on
 * `uni.onWindowResize`, coalesces resize bursts to the next animation
 * frame, and short-circuits sub-pixel jitter so reactivity stays cheap.
 *
 * Singleton behavior: this composable is a module-level singleton. The
 * first call builds the refs and registers ONE `uni.onWindowResize`
 * listener. Subsequent calls return the SAME `sizes` / `viewport` refs
 * (object identity preserved) and do NOT register additional listeners.
 * This means N consumers across the app share one subscription — useful
 * for the CSS variable bridge pattern where one root component exports
 * sizes as custom properties for the whole tree.
 *
 * Cleanup: each call still registers its own `onScopeDispose` so the
 * caller's Vue scope owns its own cleanup hook (the hook is a no-op
 * facade — it does NOT tear down the underlying singleton, because other
 * scopes may still be using it). The real `dispose()` is exposed on the
 * returned object: calling it tears down the listener, cancels any
 * pending rAF, and resets `singletonState = null` so a future call
 * reinitialises. This is intended for tests / SSR re-entry, not normal
 * runtime use.
 *
 * Outside a Vue scope (ad-hoc unit-test harness) `onScopeDispose` is
 * skipped and the caller must invoke `dispose()` manually.
 */
export function useResponsiveScale(): ResponsiveScaleState {
  if (singletonState !== null) {
    registerScopedNoOpDispose()
    return singletonState
  }
  singletonState = buildSingletonState()
  registerScopedNoOpDispose()
  return singletonState
}
