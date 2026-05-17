/**
 * Name: composables/flows/divination/use_phases
 * Purpose: manage OverlayPhase lifecycle and progress model.
 * Reason: extracted from use_animation_controller to isolate phase transition concerns.
 * Data flow: receives no external deps; exposes phase ref, progress model, and transitionPhase command.
 */

import { ref } from 'vue'
import { createProgressModel } from './progress_model'
import type { OverlayPhase } from '../../shared/animations/contracts'
import type { ProgressModel } from './progress_model'

export function usePhases() {
  const phase = ref<OverlayPhase>('shuffling')
  const progressModel: ProgressModel = createProgressModel('shuffling')

  function transitionPhase(
    nextPhase: OverlayPhase,
    onPhaseChange: (p: OverlayPhase) => void,
  ): void {
    phase.value = nextPhase
    progressModel.transitionTo(nextPhase)
    onPhaseChange(nextPhase)
  }

  return { phase, progressModel, transitionPhase }
}
