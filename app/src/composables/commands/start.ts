/**
 * Name: commands/start
 * Purpose: run the four-phase animation pipeline from a given start index.
 * Reason: extracted from phase_pipeline to isolate pipeline orchestration as a
 *         standalone command. Receives all deps via DI, creates no state.
 * Data flow: deps in → GSAP timeline side-effects out; callbacks fire on phase change.
 */

import type { gsap } from 'gsap'
import type { Ref } from 'vue'
import { createPhasePipeline, type PipelinePhase } from '../../animation/pipeline'
import type { TimelineOrchestrator } from '../../animation/adapters/gsap'
import type { PhaseContext, PhaseRunner, OverlayPhase } from '../../core/flow/types'
import type { SceneKind, SceneLayout } from '../../core/sizing/layout_solver'
import type { MotionMetrics } from '../use_overlay_layout'
import { buildPhaseContext, buildPhaseRunners } from './pipeline_builder'

export interface RunPipelineCommandDeps {
  orchestrator: TimelineOrchestrator
  getDeckCenter: () => { centerX: number; centerY: number }
  getOverlayLayouts: () => {
    drawViewport: { stageHeight: number }
    drawLayout: SceneLayout
    resultLayout: { cardWidth: number; cardHeight: number }
  }
  getMotionMetrics: (scene: SceneKind) => MotionMetrics
  cardElements: PhaseContext['cardElements']
  visible: PhaseContext['visible']
  deckCount: number
  setDrawCardSizes: (layout: SceneLayout) => void
  cutPileCount: number
  cardCountRef: Ref<number>
  autoRevealDelayMs: number
  cardsLandedRef: Ref<boolean>
  onPhaseChange: (phase: OverlayPhase) => void
  settleEntryAnimation: () => void
  openReadingPanel: () => void
  onDrawingStart?: () => void
  onPipelineComplete: () => void
}

function adaptPhaseRunner(runner: PhaseRunner, context: PhaseContext): PipelinePhase {
  return {
    phase: runner.name,
    build: (onComplete) => {
      const tl = runner.run(context, onComplete)
      return tl as gsap.core.Timeline | null
    },
  }
}

export function runPipelineCommand(startIndex: number, deps: RunPipelineCommandDeps): void {
  const phaseContext = buildPhaseContext({
    getDeckCenter: deps.getDeckCenter,
    getOverlayLayouts: deps.getOverlayLayouts,
    cardElements: deps.cardElements,
    visible: deps.visible,
    deckCount: deps.deckCount,
    onPhaseChange: deps.onPhaseChange,
  })
  const phaseRunners = buildPhaseRunners({
    getMotionMetrics: deps.getMotionMetrics,
    getOverlayLayouts: deps.getOverlayLayouts,
    setDrawCardSizes: deps.setDrawCardSizes,
    cutPileCount: deps.cutPileCount,
    cardCountRef: deps.cardCountRef,
    autoRevealDelayMs: deps.autoRevealDelayMs,
    cardsLandedRef: deps.cardsLandedRef,
  })
  const ordered = phaseRunners.map((runner) => adaptPhaseRunner(runner, phaseContext))

  const pipeline = createPhasePipeline(deps.orchestrator, ordered, {
    onPhaseStart: (startedPhase: OverlayPhase) => {
      deps.onPhaseChange(startedPhase)
      if (startedPhase === 'shuffling') deps.settleEntryAnimation()
      if (startedPhase === 'drawing') deps.onDrawingStart?.()
      if (startedPhase === 'revealing') deps.openReadingPanel()
    },
    onPipelineComplete: () => { deps.onPipelineComplete() },
  })

  pipeline.run(startIndex)
}
