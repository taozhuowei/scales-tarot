/**
 * Name: use_lifecycle_types
 * Purpose: type definitions for use_lifecycle — separated to keep use_lifecycle.ts ≤ 150 lines.
 * Data flow: imported by use_lifecycle and use_animation_controller.
 */

import type { Ref } from 'vue'
import type { DrawCardState } from './shared/animations/card_state'
import type { OverlayPhase } from './shared/animations/contracts'
import type { SceneKind, SceneLayout } from '../core/sizing/layout_solver'
import type { ProgressModel } from './flows/divination/progress_model'
import type { PipelineSharedDeps } from './flows/divination/pipeline_deps'

export interface LifecycleAnimState {
  bg: { opacity: number }
  stage: { y: number }
  header: { y: number; opacity: number }
  footer: { y: number; opacity: number }
  deckCtn: { x: number }
  initials: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
  draws: DrawCardState[]
  refreshBg(): void
  refreshStage(): void
  refreshHeader(): void
  refreshFooter(): void
  refreshDeckCtn(): void
  refreshInitials(): void
  refreshDraws(): void
  resetInitialDeckState(): void
  resetShuffleVisualState(): void
  resetCutVisualState(): void
  resetDrawVisualState(): void
  setDrawCardSizes(layout: SceneLayout): void
  getAllTargets(): unknown[]
}

export interface LifecycleDeps extends PipelineSharedDeps {
  animState: LifecycleAnimState
  showResults: Ref<boolean>
  cardsLanded: Ref<boolean>
  entryAnimationComplete: Ref<boolean>
  phase: Ref<OverlayPhase>
  progressModel: ProgressModel
  cardCount: Ref<number>
  getSceneLayout: (scene: SceneKind) => SceneLayout
  autoRevealDelayMs: number
  transitionPhase: (nextPhase: OverlayPhase, onPhaseChange: (p: OverlayPhase) => void) => void
  callbacks: {
    onPhaseChange: (p: OverlayPhase) => void
    onPipelineComplete: () => void
    onDrawingStart?: () => void
    onResetReading: () => void
    onDestroyReading: () => void
  }
  resumeAnimations: () => void
}
