/**
 * Name: composables/flows/divination/skip_to_reading
 * Purpose: skip directly to the revealing phase, bypassing shuffle/cut/draw animations.
 * Reason: extracted from the phase pipeline to isolate skip logic as a standalone command.
 *         Now reuses the manifest's snap-to-revealing-entry helper so the visual state
 *         contract for revealing lives in one place (registry.ts) — previously this
 *         command hand-rolled a draws[i] assignment loop that drifted from the contract.
 * Data flow: deps in → interrupts timeline, resets scene, snaps to revealing entry
 *         visual state via PHASE_MANIFEST, opens reading panel, fires onPipelineComplete.
 */

import type { Ref } from 'vue'
import { getPhaseSnap } from './phase_manifest'
import type { PhaseSnapDeps } from './phase_entry_snapshots'
import type { OverlayPhase } from '../../shared/animations/contracts'

export interface SkipToReadingCommandDeps {
  interruptCurrentAnimation: () => void
  entryAnimationComplete: Ref<boolean>
  resetOverlayScene: () => void
  transitionPhase: (phase: OverlayPhase) => void
  openReadingPanel: () => void
  refreshDraws: () => void
  onPipelineComplete: () => void
  getPhaseSnapDeps: () => PhaseSnapDeps
}

export function skipToReadingCommand(deps: SkipToReadingCommandDeps): void {
  deps.interruptCurrentAnimation()
  deps.entryAnimationComplete.value = true
  deps.resetOverlayScene()

  // Snap visual state to revealing entry — sets card sizes, positions
  // each draw at its draw-stage target, hides unused draws and piles.
  getPhaseSnap('revealing')(deps.getPhaseSnapDeps())
  deps.refreshDraws()

  deps.transitionPhase('revealing')
  deps.openReadingPanel()
  deps.onPipelineComplete()
}
