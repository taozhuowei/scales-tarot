/**
 * Name: commands/replay_from_phase
 * Purpose: replay the animation pipeline starting from a specified phase.
 * Reason: extracted from phase_pipeline to isolate replay logic as a standalone command.
 *         Now delegates per-phase entry-state setup to PHASE_MANIFEST.snapToEntryState
 *         via getPhaseSnap() so the visual contract for each phase lives next to its
 *         metadata, not duplicated across this command and skip_to_reading.
 * Data flow: deps in → interrupts current animation, resets scene, snaps the visual
 *         state to the target phase's entry, then runs the pipeline from that index.
 *         The await-nextTick before runPipeline ensures visible-flag mutations have
 *         propagated to the DOM before phase builders read element refs.
 */

import { nextTick, type Ref } from 'vue'
import { getPhaseIndex, getPhaseSnap } from './phase_manifest'
import type { PhaseSnapDeps } from './phase_entry_snapshots'
import type { OverlayPhase } from '../../shared/animations/contracts'
import type { ProgressModel } from './progress_model'

export interface ReplayFromPhaseCommandDeps {
  interruptCurrentAnimation: () => void
  entryAnimationComplete: Ref<boolean>
  resetOverlayScene: () => void
  phaseRef: Ref<OverlayPhase>
  progressModel: ProgressModel
  onPhaseChange: (phase: OverlayPhase) => void
  runPipelineFn: (startIndex: number) => void
  getPhaseSnapDeps: () => PhaseSnapDeps
}

export async function replayFromPhaseCommand(
  targetPhase: OverlayPhase,
  deps: ReplayFromPhaseCommandDeps,
): Promise<void> {
  deps.interruptCurrentAnimation()
  deps.entryAnimationComplete.value = true
  deps.resetOverlayScene()

  const targetIndex = getPhaseIndex(targetPhase)
  if (targetIndex > 0) {
    getPhaseSnap(targetPhase)(deps.getPhaseSnapDeps())
  }

  deps.phaseRef.value = targetPhase
  deps.progressModel.transitionTo(targetPhase)
  deps.onPhaseChange(targetPhase)

  // Wait for the visible-flag refs to flush into the DOM before phase
  // builders run — without this, the first frame of e.g. drawing can read
  // stale piles[i] element refs and animate from the wrong start positions.
  await nextTick()
  deps.runPipelineFn(targetIndex)
}
