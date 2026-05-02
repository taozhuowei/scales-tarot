/**
 * Name: commands/skip_to_reading
 * Purpose: skip directly to the revealing phase, bypassing shuffle/cut/draw animations.
 * Reason: extracted from phase_pipeline to isolate skip logic as a standalone command.
 * Data flow: deps in → interrupts timeline, resets scene, jumps to revealing state.
 */

import type { Ref } from 'vue'
import type { DrawCardState } from '../../animation/types'
import type { OverlayPhase } from '../../core/flow/types'
import type { SceneKind, SceneLayout } from '../../core/sizing/layout_solver'

export interface SkipToReadingCommandDeps {
  interruptCurrentAnimation: () => void
  entryAnimationComplete: Ref<boolean>
  resetOverlayScene: () => void
  transitionPhase: (phase: OverlayPhase) => void
  openReadingPanel: () => void
  getSceneLayout: (scene: SceneKind) => SceneLayout
  setDrawCardSizes: (layout: SceneLayout) => void
  draws: DrawCardState[]
  refreshDraws: () => void
  onPipelineComplete: () => void
}

export function skipToReadingCommand(deps: SkipToReadingCommandDeps): void {
  deps.interruptCurrentAnimation()
  deps.entryAnimationComplete.value = true
  deps.resetOverlayScene()
  deps.transitionPhase('revealing')
  deps.openReadingPanel()

  const layout = deps.getSceneLayout('draw_stage')
  deps.setDrawCardSizes(layout)
  deps.draws.forEach((draw, index) => {
    if (index >= layout.cards.length) return
    draw.x = layout.cards[index].x
    draw.y = layout.cards[index].y
    draw.scale = 1
    draw.opacity = 1
  })
  deps.refreshDraws()

  deps.onPipelineComplete()
}
