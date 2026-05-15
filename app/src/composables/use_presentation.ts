/**
 * Name: use_presentation
 * Purpose: derive progress header, footer, and phase step UI state from phase + results.
 * Reason: extracted from use_animation_controller to isolate presentation computeds.
 * Data flow: receives phase and showResults refs via DI; returns computed-only presentation.
 */

import { computed } from 'vue'
import type { Ref } from 'vue'
import {
  calculatePhaseProgress,
  presentProgressHeader,
  presentFooter,
} from '../core/utils/overlay_progress'
import type { OverlayPhase } from '../core/flow/types'

export interface UsePresentationOptions {
  phase: Ref<OverlayPhase>
  showResults: Ref<boolean>
  getUiAsset: (name: string) => string
}

export function usePresentation(opts: UsePresentationOptions) {
  const progressHeaderPresentation = computed(() =>
    presentProgressHeader(opts.phase.value, opts.getUiAsset)
  )
  const footerPresentation = computed(() =>
    presentFooter(opts.phase.value, opts.showResults.value)
  )
  const phaseSteps = computed(() => calculatePhaseProgress(opts.phase.value))
  const activePhaseIndex = computed(() =>
    phaseSteps.value.findIndex((s) => s.isActive)
  )

  return { progressHeaderPresentation, footerPresentation, phaseSteps, activePhaseIndex }
}
