/**
 * Name: use_lifecycle
 * Purpose: overlay animation lifecycle — entry settling, scene reset, animation interruption,
 *          and pipeline orchestration (start / skip / replay).
 * Reason: extracted from use_animation_controller to isolate lifecycle concerns. Owns the
 *          construction of PhaseSnapDeps (closure over deps) so replay/skip can share the
 *          same snap-to-entry-state contract from PHASE_MANIFEST.
 * Data flow: receives all deps via DI; mutates shared refs for cardsLanded, entryAnimationComplete.
 */

import { nextTick } from 'vue'
import { killAnimationTargets } from '../core/gsap/tween'
import type { PhaseSnapDeps } from './flows/divination/phase_entry_snapshots'
import type { OverlayPhase } from './shared/animations/contracts'
import { runPipelineCommand } from './start'
import { skipToReadingCommand } from './skip_to_reading'
import { replayFromPhaseCommand } from './replay_from_phase'
import type { LifecycleDeps } from './use_lifecycle_types'

export type { LifecycleAnimState, LifecycleDeps } from './use_lifecycle_types'

export function useLifecycle(deps: LifecycleDeps) {
  function settleEntryAnimation(): void {
    const { animState, entryAnimationComplete } = deps
    animState.bg.opacity = 1
    animState.refreshBg()
    animState.initials.forEach((state, index) => {
      Object.assign(state, { x: 0, y: -(index * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1 })
    })
    animState.refreshInitials()
    animState.header.y = 0
    animState.header.opacity = 1
    animState.footer.y = 0
    animState.footer.opacity = 1
    animState.refreshHeader()
    animState.refreshFooter()
    entryAnimationComplete.value = true
  }

  function resetOverlayScene(): void {
    deps.showResults.value = false
    deps.cardsLanded.value = false
    deps.callbacks.onResetReading()
    const { animState } = deps
    animState.bg.opacity = 1
    animState.stage.y = 0
    animState.header.y = 0
    animState.header.opacity = 1
    animState.footer.y = 0
    animState.footer.opacity = 1
    animState.deckCtn.x = 0
    animState.refreshBg()
    animState.refreshStage()
    animState.refreshHeader()
    animState.refreshFooter()
    animState.refreshDeckCtn()
    animState.resetInitialDeckState()
    animState.resetShuffleVisualState()
    animState.resetCutVisualState()
    animState.resetDrawVisualState()
    const drawLayout = deps.getSceneLayout('draw_stage')
    animState.setDrawCardSizes(drawLayout)
  }

  function interruptCurrentAnimation(): void {
    deps.callbacks.onDestroyReading()
    deps.resumeAnimations()
    deps.orchestrator.clear()
    killAnimationTargets(deps.animState.getAllTargets())
  }

  /**
   * Build the dependency bundle consumed by PHASE_MANIFEST.snapToEntryState
   * helpers. Read fresh on each call so layout/metric changes (orientation,
   * resize) are picked up — the snap helpers themselves are pure functions.
   */
  function getPhaseSnapDeps(): PhaseSnapDeps {
    const drawLayout = deps.getSceneLayout('draw_stage')
    const metrics = deps.getMotionMetrics('draw_stage')
    const { centerX, centerY } = deps.getDeckCenter()
    return {
      cardElements: deps.cardElements,
      visible: deps.visible,
      draws: deps.animState.draws,
      deckGeometry: { centerX, centerY },
      drawLayout,
      cardCount: deps.cardCount.value,
      cutPileCount: deps.cutPileCount,
      shuffleSpreadX: metrics.shuffleSpreadX,
      cutPileSpacing: metrics.cutPileSpacing,
      cutAxis: metrics.cutAxis,
      setDrawCardSizes: (layout) => deps.animState.setDrawCardSizes(layout),
    }
  }

  function runPipeline(startIndex = 0): void {
    runPipelineCommand(startIndex, {
      orchestrator: deps.orchestrator,
      getDeckCenter: deps.getDeckCenter,
      getOverlayLayouts: deps.getOverlayLayouts,
      getMotionMetrics: deps.getMotionMetrics,
      cardElements: deps.cardElements,
      visible: deps.visible,
      deckCount: deps.deckCount,
      setDrawCardSizes: (layout) => deps.animState.setDrawCardSizes(layout),
      cutPileCount: deps.cutPileCount,
      cardCountRef: deps.cardCount,
      autoRevealDelayMs: deps.autoRevealDelayMs,
      cardsLandedRef: deps.cardsLanded,
      onPhaseChange: (p) => deps.transitionPhase(p, deps.callbacks.onPhaseChange),
      settleEntryAnimation,
      openReadingPanel: () => { deps.showResults.value = true },
      onDrawingStart: deps.callbacks.onDrawingStart,
      onPipelineComplete: deps.callbacks.onPipelineComplete,
    })
  }

  function start(): void {
    nextTick(() => {
      settleEntryAnimation()
      runPipeline(0)
    })
  }

  function skipToReading(): void {
    skipToReadingCommand({
      interruptCurrentAnimation,
      entryAnimationComplete: deps.entryAnimationComplete,
      resetOverlayScene,
      transitionPhase: (p) => deps.transitionPhase(p, deps.callbacks.onPhaseChange),
      openReadingPanel: () => { deps.showResults.value = true },
      refreshDraws: deps.animState.refreshDraws,
      onPipelineComplete: deps.callbacks.onPipelineComplete,
      getPhaseSnapDeps,
    })
  }

  function replayFromPhase(targetPhase: OverlayPhase): void {
    // The command is async (it awaits nextTick before runPipeline so the
    // visible-flag mutations flush). We can't await here — the lifecycle
    // surface is sync — but a `void` swallow would silently drop any
    // rejection from the command's internals (snap helpers, runPipeline).
    // Surface them via console.error so dev-tool failures aren't invisible.
    replayFromPhaseCommand(targetPhase, {
      interruptCurrentAnimation,
      entryAnimationComplete: deps.entryAnimationComplete,
      resetOverlayScene,
      phaseRef: deps.phase,
      progressModel: deps.progressModel,
      onPhaseChange: (p) => deps.transitionPhase(p, deps.callbacks.onPhaseChange),
      runPipelineFn: runPipeline,
      getPhaseSnapDeps,
    }).catch((err) => {
      console.error('[lifecycle] replayFromPhase failed', err)
    })
  }

  return {
    settleEntryAnimation,
    resetOverlayScene,
    interruptCurrentAnimation,
    runPipeline,
    start,
    skipToReading,
    replayFromPhase,
  }
}
