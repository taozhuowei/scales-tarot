/**
 * Name: composables/overlay_layout/scene
 * Purpose: scene + viewport derivation for the overlay-layout composable.
 *          Builds the physical viewport from `uni.getWindowInfo()`,
 *          exposes the legacy `ViewportMetrics` shape (stageWidth /
 *          stageHeight / topBarHeight kept for backward compatibility),
 *          and resolves the `SceneLayout` (solver output + safe-inset
 *          compatibility fields the debug overlay reads).
 * Reason: extracted from `use_overlay_layout.ts` so the scene-derivation
 *          path stays focused — viewport adapter + solver call + legacy
 *          field shimming, nothing else. The composable facade composes
 *          this module with `motion.ts` and `breakpoints.ts`.
 * Data flow: window info ──▶ buildPhysicalViewport ──▶
 *            getViewportMetrics / getSceneLayout ──▶ template + animation
 *            controller consumers.
 */

import type { Ref } from 'vue'
import {
  solveLayout,
  type SceneLayout as SolverSceneLayout,
} from '../../core/sizing/layout_solver'
import {
  deriveSizes,
  pickCanvasWidth,
  readViewport,
  type PhysicalViewport,
  type ResponsiveSizes,
} from '../../core/sizing/scale'
import { WIDE_SIDE_DRAWER_WIDTH_PX, getMenuButtonRect, resolveTopBarHeight } from './breakpoints'

/** Scene = phase grouping the solver understands. */
export type Scene = 'draw_stage' | 'reading_stage'

/**
 * Viewport metrics that include both the new physical viewport and the
 * legacy `stageWidth/stageHeight/stageContainerHeight/topBarHeight` keys
 * still consumed by the animation controller and overlay components.
 */
export interface ViewportMetrics {
  width: number
  height: number
  safeAreaTop: number
  safeAreaBottom: number
  dpr: number
  stageWidth: number
  stageHeight: number
  stageContainerHeight: number
  topBarHeight: number
}

/**
 * Scene layout consumed by templates and animation phases. Extends the pure
 * `SolverSceneLayout` with three legacy `safe*Inset` fields that the
 * `DivinationOverlay` debug overlay still reads.
 */
export interface SceneLayout extends SolverSceneLayout {
  /** Distance from viewport top to the top of the stage usable area (px). */
  safeTopInset: number
  /** Distance from viewport bottom edge to the stage usable area bottom (px). */
  safeBottomInset: number
  /** Distance from viewport left/right edges to the usable card area (px). */
  safeSideInset: number
}

/**
 * Resolve the proportional sizes for a physical viewport. The sizes are
 * derived from the canvas width (already clamped to [375, 440] by
 * `buildPhysicalViewport`), so passing the viewport here is equivalent to
 * passing the canvas width directly.
 */
export function getSizes(viewport: PhysicalViewport): ResponsiveSizes {
  return deriveSizes(viewport.width)
}

/**
 * Build the physical viewport the solver works in.
 *
 * Two stages:
 *   1. `readViewport()` adapts the platform window-info into our shape
 *      (real, unclamped width + height + safe areas).
 *   2. `pickCanvasWidth()` clamps the width into the supported envelope
 *      [375, 440] so the layout is always sized as if the screen were a
 *      phone; the actual extra space on tablets / desktops is filled by
 *      background and centering at the CSS layer.
 *
 * `showResults` does NOT affect the underlying viewport — it influences
 * the stage rectangle the solver derives, so the conversion stays
 * shape-stable here and the caller passes `scene` to the solver further
 * down. The platform `topBarHeight` is no longer carried inside the
 * viewport — the proportional `sizes.headerHeight` absorbs the chrome
 * reservation. The capsule rect read is preserved as a side-effect call
 * because future work may surface it as a separate inset.
 */
export function buildPhysicalViewport(): PhysicalViewport {
  void resolveTopBarHeight(getMenuButtonRect()) // preserved side-effect call
  const win = uni.getWindowInfo()
  const raw = readViewport({
    windowWidth: win.windowWidth,
    windowHeight: win.windowHeight,
    safeAreaInsets: win.safeAreaInsets,
  })
  return { ...raw, width: pickCanvasWidth(raw.width) }
}

/**
 * Public viewport metrics — combines the physical viewport with the legacy
 * `stageWidth/stageHeight/stageContainerHeight/topBarHeight` keys that
 * downstream consumers (animation controller, overlay components) still
 * use today. Wide-screen branch retained for the legacy ReadingSplitView
 * pipeline (will be dropped when the wide-split UI is cleaned up).
 */
export function getViewportMetrics(isWide: Ref<boolean>, showResults: boolean): ViewportMetrics {
  const viewport = buildPhysicalViewport()
  const wide = isWide.value
  const stageWidth = showResults && wide ? viewport.width - WIDE_SIDE_DRAWER_WIDTH_PX : viewport.width
  const stageHeight = viewport.height
  const stageContainerHeight = showResults ? stageHeight : viewport.height
  return {
    width: viewport.width,
    height: viewport.height,
    safeAreaTop: viewport.safeAreaTop,
    safeAreaBottom: viewport.safeAreaBottom,
    dpr: 1,
    stageWidth,
    stageHeight,
    stageContainerHeight,
    topBarHeight: 0,
  }
}

/**
 * Resolve the scene layout for `draw_stage` or `reading_stage` by
 * delegating to the pure solver, then attach the legacy `safe*Inset`
 * compatibility fields the overlay debug rectangle expects.
 */
export function getSceneLayout(scene: Scene): SceneLayout {
  const viewport = buildPhysicalViewport()
  const sizes = getSizes(viewport)
  const solved = solveLayout({ viewport, sizes, scene })
  const safeTopInset = viewport.safeAreaTop + sizes.margin + sizes.headerHeight
  const safeBottomInset = sizes.actionAreaHeight + viewport.safeAreaBottom
  const safeSideInset = sizes.margin
  return { ...solved, safeTopInset, safeBottomInset, safeSideInset }
}
