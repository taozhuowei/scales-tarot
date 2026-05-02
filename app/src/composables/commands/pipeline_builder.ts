/**
 * Name: commands/pipeline_builder
 * Purpose: pure helpers that build PhaseContext and PhaseRunner[] from deps.
 * Reason: extracted from commands/start to keep start.ts within the 180-line TS limit.
 * Data flow: deps in → phase context / runner array out; creates no state.
 */

import type { Ref } from 'vue'
import { buildShufflePhaseRunner } from '../../animation/phases/shuffle/builder'
import { buildCutPhaseRunner } from '../../animation/phases/cut/builder'
import { buildDrawPhaseRunner } from '../../animation/phases/draw/builder'
import { buildRevealPhaseRunner } from '../../animation/phases/reveal/builder'
import type { PhaseContext, PhaseRunner, OverlayPhase } from '../../core/flow/types'
import type { SceneKind, SceneLayout } from '../../core/sizing/layout_solver'
import type { MotionMetrics } from '../use_overlay_layout'

export function buildPhaseContext(deps: {
  getDeckCenter: () => { centerX: number; centerY: number }
  getOverlayLayouts: () => { drawLayout: SceneLayout }
  cardElements: PhaseContext['cardElements']
  visible: PhaseContext['visible']
  deckCount: number
  onPhaseChange: (phase: OverlayPhase) => void
}): PhaseContext {
  const { centerX, centerY } = deps.getDeckCenter()
  return {
    deckGeometry: {
      centerX,
      centerY,
      cardOffsetStep: { x: 0, y: -0.8 },
      totalOffset: { x: 0, y: -(deps.deckCount - 1) * 0.8 },
    },
    spreadSlots: [],
    getCurrentLayouts: () => {
      const { drawLayout } = deps.getOverlayLayouts()
      return { drawLayout }
    },
    getTargetLayouts: () => {
      const { drawLayout } = deps.getOverlayLayouts()
      return { drawLayout }
    },
    cardElements: deps.cardElements,
    visible: deps.visible,
    onPhaseChange: deps.onPhaseChange,
  }
}

export function buildPhaseRunners(deps: {
  getMotionMetrics: (scene: SceneKind) => MotionMetrics
  getOverlayLayouts: () => {
    drawViewport: { stageHeight: number }
    drawLayout: SceneLayout
    resultLayout: { cardWidth: number; cardHeight: number }
  }
  setDrawCardSizes: (layout: SceneLayout) => void
  cutPileCount: number
  cardCountRef: Ref<number>
  autoRevealDelayMs: number
  cardsLandedRef: Ref<boolean>
}): PhaseRunner[] {
  const metrics = deps.getMotionMetrics('draw_stage')
  return [
    buildShufflePhaseRunner({ spreadX: metrics.shuffleSpreadX }),
    buildCutPhaseRunner({
      pileCount: deps.cutPileCount,
      pileSpacing: metrics.cutPileSpacing,
      axis: metrics.cutAxis,
      cutLeadingOffset: metrics.cutLeadingOffset,
      cutTrailingOffset: metrics.cutTrailingOffset,
    }),
    {
      name: 'drawing',
      run(context: PhaseContext, onComplete: () => void) {
        const { drawLayout, drawViewport } = deps.getOverlayLayouts()
        deps.setDrawCardSizes(drawLayout)
        const runner = buildDrawPhaseRunner({
          cardCount: deps.cardCountRef.value,
          cardWidth: drawLayout.drawCardWidth,
          cardHeight: drawLayout.drawCardHeight,
          stageHeight: drawViewport.stageHeight,
          liftY: drawLayout.stageShiftY,
          targetX: drawLayout.cards.map((c) => c.x),
          targetY: drawLayout.cards.map((c) => c.y),
          autoRevealDelayMs: deps.autoRevealDelayMs,
          onCardsLanded: () => { deps.cardsLandedRef.value = true },
        })
        return runner.run(context, onComplete)
      },
    },
    {
      name: 'revealing',
      run(context: PhaseContext, onComplete: () => void) {
        const { drawLayout, resultLayout } = deps.getOverlayLayouts()
        deps.setDrawCardSizes(drawLayout)
        const runner = buildRevealPhaseRunner({
          cardCount: deps.cardCountRef.value,
          drawCardWidth: drawLayout.drawCardWidth,
          drawCardHeight: drawLayout.drawCardHeight,
          resultCardWidth: resultLayout.cardWidth,
          resultCardHeight: resultLayout.cardHeight,
          drawLayout: {
            stageShiftY: drawLayout.stageShiftY,
            cards: drawLayout.cards.map((c) => ({ x: c.x, y: c.y })),
          },
        })
        return runner.run(context, onComplete)
      },
    },
  ]
}
