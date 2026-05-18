/**
 * Name: flows/shared/composables/animations/use_animation_state
 * Purpose: own all GSAP target objects, visibility flags, style refs, refresh callbacks, and per-group reset functions.
 * Reason: separates animation state management from the overlay controller for better modularity.
 * Data flow: receives layout results and options; returns reactive styles, states, and helpers.
 */

import { createAnimationState } from './state'
import { createStyleReconciler } from './style_sync'
import { createVisibilityController } from './visibility'
import type { AnimationState } from './state'

/**
 * Flatten every tweenable target into one array. Inlined verbatim from the
 * former animation/adapters/gsap (P1: adapters dissolved into core/gsap; this
 * state-shaped helper belongs with the state it enumerates, not in the
 * library-only core/gsap layer).
 */
function getAllTargets(state: AnimationState): unknown[] {
  return [
    state.bg,
    state.stage,
    state.header,
    state.footer,
    state.deckCtn,
    ...state.initials,
    ...state.lefts,
    ...state.rights,
    ...state.piles,
    ...state.draws,
    ...state.inners,
  ]
}

export function useAnimationState(opts: {
  deckCount: number
  shuffleHalfCount: number
  maxCutPiles: number
  maxCardCount: number
}) {
  const state = createAnimationState(opts)
  const reconciler = createStyleReconciler(state, {
    shuffleHalfCount: opts.shuffleHalfCount,
    maxCutPiles: opts.maxCutPiles,
    maxCardCount: opts.maxCardCount,
  })
  const visibility = createVisibilityController({
    shuffleHalfCount: opts.shuffleHalfCount,
    maxCutPiles: opts.maxCutPiles,
    maxCardCount: opts.maxCardCount,
  })

  function resetShuffleVisualState() {
    state.resetShuffleVisualState()
    visibility.resetShuffleVisualState()
  }

  function resetCutVisualState() {
    state.resetCutVisualState()
    visibility.resetCutVisualState()
  }

  function resetDrawVisualState() {
    state.resetDrawVisualState()
    visibility.resetDrawVisualState()
  }

  return {
    bg: state.bg,
    stage: state.stage,
    header: state.header,
    footer: state.footer,
    deckCtn: state.deckCtn,
    initials: state.initials,
    lefts: state.lefts,
    rights: state.rights,
    piles: state.piles,
    draws: state.draws,
    inners: state.inners,
    leftsVisible: visibility.leftsVisible,
    rightsVisible: visibility.rightsVisible,
    pilesVisible: visibility.pilesVisible,
    drawsVisible: visibility.drawsVisible,
    layoutCardWidth: reconciler.layoutCardWidth,
    layoutCardHeight: reconciler.layoutCardHeight,
    bgStyle: reconciler.bgStyle,
    stageStyle: reconciler.stageStyle,
    headerStyle: reconciler.headerStyle,
    footerStyle: reconciler.footerStyle,
    deckCtnStyle: reconciler.deckCtnStyle,
    initialsStyle: reconciler.initialsStyle,
    leftsStyle: reconciler.leftsStyle,
    rightsStyle: reconciler.rightsStyle,
    pilesStyle: reconciler.pilesStyle,
    drawsStyle: reconciler.drawsStyle,
    drawsSizeStyle: reconciler.drawsSizeStyle,
    innersStyle: reconciler.innersStyle,
    overlayVarsStyle: reconciler.overlayVarsStyle,
    refreshBg: reconciler.refreshBg,
    refreshStage: reconciler.refreshStage,
    refreshHeader: reconciler.refreshHeader,
    refreshFooter: reconciler.refreshFooter,
    refreshDeckCtn: reconciler.refreshDeckCtn,
    refreshInitials: reconciler.refreshInitials,
    refreshLefts: reconciler.refreshLefts,
    refreshRights: reconciler.refreshRights,
    refreshPiles: reconciler.refreshPiles,
    refreshDraws: reconciler.refreshDraws,
    refreshInners: reconciler.refreshInners,
    resetShuffleVisualState,
    resetCutVisualState,
    resetDrawVisualState,
    resetInitialDeckState: state.resetInitialDeckState,
    setDrawCardSizes: reconciler.setDrawCardSizes,
    getAllTargets: () => getAllTargets(state),
  }
}
