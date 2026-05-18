/**
 * Name: flows/shared/composables/animations/visibility
 * Purpose: visibility flags for lefts, rights, piles, and draws.
 * Reason: isolate v-show/v-if toggles from animation state and style sync.
 */

import { ref, type Ref } from 'vue'

export interface VisibilityControllerOptions {
  shuffleHalfCount: number
  maxCutPiles: number
  maxCardCount: number
}

export interface VisibilityController {
  leftsVisible: Ref<boolean>
  rightsVisible: Ref<boolean>
  pilesVisible: Ref<boolean[]>
  drawsVisible: Ref<boolean[]>
  resetShuffleVisualState(): void
  resetCutVisualState(): void
  resetDrawVisualState(): void
}

export function createVisibilityController(opts: VisibilityControllerOptions): VisibilityController {
  const leftsVisible = ref(false)
  const rightsVisible = ref(false)
  const pilesVisible = ref<boolean[]>(Array(opts.maxCutPiles).fill(false))
  const drawsVisible = ref<boolean[]>(Array(opts.maxCardCount).fill(false))

  function resetShuffleVisualState() {
    leftsVisible.value = false
    rightsVisible.value = false
  }

  function resetCutVisualState() {
    pilesVisible.value = Array(opts.maxCutPiles).fill(false)
  }

  function resetDrawVisualState() {
    drawsVisible.value = Array(opts.maxCardCount).fill(false)
  }

  return {
    leftsVisible,
    rightsVisible,
    pilesVisible,
    drawsVisible,
    resetShuffleVisualState,
    resetCutVisualState,
    resetDrawVisualState,
  }
}
