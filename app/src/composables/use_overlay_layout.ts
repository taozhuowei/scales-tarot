/**
 * Name: use_overlay_layout
 * Purpose: thin Vue composable that adapts platform window info to the
 *          pure `solveLayout` solver and exposes scene + motion + deck
 *          metrics to the controllers and components. Acts as a facade
 *          over three internal modules:
 *            - `overlay_layout/breakpoints` — wide-screen threshold +
 *              mini-program chrome adapter.
 *            - `overlay_layout/scene` — viewport + scene-layout
 *              derivation.
 *            - `overlay_layout/motion` — shuffle / cut / draw motion
 *              math.
 * Reason: the previous monolithic 361-line implementation accumulated
 *          three independent concerns in one file. Splitting them keeps
 *          each concern small + testable while the public API
 *          (`useOverlayLayout` + `MotionMetrics`) stays unchanged for
 *          downstream importers (animation controller, pipeline builder,
 *          start command, lifecycle types).
 * Data flow: window info + spread metadata flow in; SceneLayout, motion
 *          metrics, and deck centre flow out.
 */

import type { Ref } from 'vue'
import { checkWidth as checkWidthHelper } from './overlay_layout/breakpoints'
import {
  getSceneLayout,
  getViewportMetrics,
  type SceneLayout,
  type Scene,
  type ViewportMetrics,
} from './overlay_layout/scene'
import {
  getMotionMetrics as resolveMotionMetrics,
  type CutAxis,
  type MotionMetrics,
} from './overlay_layout/motion'

// Re-export the public types so existing importers keep compiling.
export type { SceneLayout, ViewportMetrics, MotionMetrics, CutAxis }

export interface UseOverlayLayoutDeps {
  isWide: Ref<boolean>
  /** Retained in the API for source compatibility — current layout always
   *  resolves a single centred slot (single_card spread). */
  spreadKind: string
  cutPileCount: number
  deckCount: number
}

export function useOverlayLayout(deps: UseOverlayLayoutDeps) {
  /**
   * Public viewport metrics — combines the physical viewport with the legacy
   * `stageWidth/stageHeight/stageContainerHeight/topBarHeight` keys that
   * downstream consumers (animation controller, overlay components) still
   * use today.
   */
  function getViewport(showResults: boolean): ViewportMetrics {
    return getViewportMetrics(deps.isWide, showResults)
  }

  /**
   * Resolve all motion metrics for the requested scene. Pure derivation
   * from the solver's envelope.
   */
  function getMotion(scene: Scene = 'draw_stage'): MotionMetrics {
    return resolveMotionMetrics(deps.isWide, deps.cutPileCount, deps.deckCount, scene)
  }

  /**
   * Convenience accessor returning all three layouts the controller needs at
   * once. Resolved from a single window snapshot so the three results are
   * mutually consistent.
   */
  function getOverlayLayouts(): {
    drawViewport: ViewportMetrics
    drawLayout: SceneLayout
    resultLayout: SceneLayout
  } {
    const drawViewport = getViewport(false)
    const drawLayout = getSceneLayout('draw_stage')
    const resultLayout = getSceneLayout('reading_stage')
    return { drawViewport, drawLayout, resultLayout }
  }

  /**
   * Update `deps.isWide` when the window size crosses the PC breakpoint.
   * Returns true iff `isWide` actually changed so the caller can short-
   * circuit redundant relayouts.
   */
  function checkWidth(windowWidth: number): boolean {
    return checkWidthHelper(deps.isWide, windowWidth)
  }

  /**
   * Centre point the deck animates around at rest. Stage-relative
   * coordinates (origin = stage centre): x is always 0 because the deck
   * stays horizontally centred; y matches the central slot's y so the
   * deck visually sits where the drawn cards will land.
   */
  function getDeckCenter(): { centerX: number; centerY: number } {
    const drawLayout = getSceneLayout('draw_stage')
    const centerSlot = drawLayout.cards[0]
    return { centerX: 0, centerY: centerSlot ? centerSlot.y : 0 }
  }

  return {
    getViewportMetrics: getViewport,
    getSceneLayout,
    getMotionMetrics: getMotion,
    getOverlayLayouts,
    checkWidth,
    getDeckCenter,
  }
}
