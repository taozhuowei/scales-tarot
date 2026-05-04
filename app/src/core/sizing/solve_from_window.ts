/**
 * Name: core/sizing/solve_from_window
 * Purpose: thin adapter that bridges `uni.getWindowInfo()` to a solved
 *          `SceneLayout` for a given scene. Centralizes the
 *          window-info → readViewport → pickCanvasWidth → solveLayout
 *          pipeline that was previously duplicated across composables.
 * Reason: two composables (`use_active_view`, `use_idle_deck_animation`)
 *          repeated the same 11-line setup verbatim, triggering the
 *          jscpd duplicate-code gate. Extracting the common path keeps
 *          the call sites declarative — each one names the scene it
 *          wants and pulls the field it needs out of the result.
 *
 *          Kept deliberately small: no fallback policy is encoded here,
 *          because callers want different fallbacks (zero-geometry vs.
 *          default card sizes). Callers wrap the call in their own
 *          try/catch and supply scene-specific defaults on failure.
 *
 * Data flow: uni.getWindowInfo() ──▶ readViewport ──▶ pickCanvasWidth ──▶
 *            deriveSizes ──▶ solveLayout({viewport, sizes, scene}) ──▶
 *            { layout, windowHeight }.
 */

import type { SceneKind, SceneLayout } from './layout_solver'
import { solveLayout } from './layout_solver'
import { deriveSizes, pickCanvasWidth, readViewport } from './scale'

export interface SolveFromWindowResult {
  /** The solved layout for the requested scene. */
  layout: SceneLayout
  /**
   * Raw window height as reported by `uni.getWindowInfo()`. Some callers
   * need this independently of the layout (e.g. exit-tween push distance).
   */
  windowHeight: number
}

/**
 * Resolve a `SceneLayout` from the current `uni.getWindowInfo()` snapshot.
 * Throws whatever `uni.getWindowInfo()` throws — callers are expected to
 * wrap this in a try/catch and supply scene-appropriate defaults on failure.
 */
export function solveLayoutFromWindow(scene: SceneKind): SolveFromWindowResult {
  const winInfo = uni.getWindowInfo()
  const rawViewport = readViewport({
    windowWidth: winInfo.windowWidth,
    windowHeight: winInfo.windowHeight,
    safeAreaInsets: winInfo.safeAreaInsets,
  })
  const viewport = { ...rawViewport, width: pickCanvasWidth(rawViewport.width) }
  const layout = solveLayout({
    viewport,
    sizes: deriveSizes(viewport.width),
    scene,
  })
  return { layout, windowHeight: winInfo.windowHeight }
}
