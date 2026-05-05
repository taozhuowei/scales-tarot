/**
 * Name: pipeline_shared_deps
 * Purpose: shared dependency-injection contract used by both the
 *          lifecycle composable (`use_lifecycle`) and the run-pipeline
 *          command (`commands/start`). Both surfaces orchestrate the
 *          same animation pipeline, so they take the same orchestrator,
 *          deck/layout/motion getters, and phase context fields.
 * Reason: the two interfaces had drifted into a copy-paste pair (8-line
 *          identical fragment caught by jscpd). Extracting the common
 *          base prevents silent shape divergence and keeps the two
 *          consumer interfaces small — each one now only declares the
 *          fields unique to its surface.
 * Data flow: caller → DI object → consumed by phase-pipeline
 *            orchestration code.
 */

import type { TimelineOrchestrator } from '../animation/adapters/gsap'
import type { PhaseContext } from '../core/flow/types'
import type { SceneKind, SceneLayout } from '../core/sizing/layout_solver'
import type { MotionMetrics } from './use_overlay_layout'

/** Shape returned by the `getOverlayLayouts` callback. */
export interface OverlayLayoutsSnapshot {
  drawViewport: { stageHeight: number }
  drawLayout: SceneLayout
  /**
   * Result-stage card sizing snapshot. Both "full" and "shrunk" sizes are
   * carried so the reveal pipeline can grow the card to its full
   * safe-area size before the drawer mounts, then animate down to the
   * drawer-reserved size when the drawer slides up.
   */
  resultLayout: {
    cardWidth: number
    cardHeight: number
    cardWidthFull: number
    cardHeightFull: number
  }
}

/**
 * Common dependency contract shared by `LifecycleDeps` (use_lifecycle)
 * and `RunPipelineCommandDeps` (commands/start). Each consumer extends
 * this with its own surface-specific fields.
 */
export interface PipelineSharedDeps {
  orchestrator: TimelineOrchestrator
  getDeckCenter: () => { centerX: number; centerY: number }
  getOverlayLayouts: () => OverlayLayoutsSnapshot
  getMotionMetrics: (scene: SceneKind) => MotionMetrics
  cardElements: PhaseContext['cardElements']
  visible: PhaseContext['visible']
  deckCount: number
  cutPileCount: number
}
