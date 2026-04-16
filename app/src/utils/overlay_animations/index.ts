/**
 * Name: overlay_animations/index (compatibility shim)
 * Purpose: backward-compatible re-export of the new foldered animation system.
 */

export * from '../overlay_animation/types'
export {
  buildShufflePhase as buildShuffleTimeline,
  createShuffleInitialStates,
  type ShufflePhaseConfig as ShuffleAnimationConfig,
  type ShufflePhaseContext as ShuffleAnimationContext,
} from '../overlay_animation/phases/shuffle_phase'
export {
  buildCutPhase as buildCutTimeline,
  createCutInitialStates,
  type CutPhaseConfig as CutAnimationConfig,
  type CutPhaseContext as CutAnimationContext,
} from '../overlay_animation/phases/cut_phase'
export {
  buildDrawPhase as buildDrawTimeline,
  createDrawInitialStates,
  type DrawPhaseConfig as DrawAnimationConfig,
  type DrawPhaseContext as DrawAnimationContext,
} from '../overlay_animation/phases/draw_phase'
export {
  buildRevealPhase as buildRevealTimeline,
  setupRevealInitialState,
  type RevealPhaseConfig as RevealAnimationConfig,
  type RevealPhaseContext as RevealAnimationContext,
} from '../overlay_animation/phases/reveal_phase'
