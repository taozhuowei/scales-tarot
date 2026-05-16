/**
 * Name: animation/state
 * Purpose: GSAP target object management decoupled from Vue view layer.
 * Reason: centralize all animation state objects that GSAP mutates.
 */

import { reactive } from 'vue'
import {
  createShuffleInitialStates,
  createCutInitialStates,
  createDrawInitialStates,
} from './initial_states'
import type { CardState, CenterCardState, DrawCardState, InnerState } from './types'

/** Maximum number of result cards a future spread could ever ask for. The
 *  animation state allocates this many GSAP targets up front to keep
 *  refs / arrays aligned regardless of the active spread. */
export const MAX_CARD_COUNT = 10

export interface AnimationStateOptions {
  deckCount: number
  shuffleHalfCount: number
  maxCutPiles: number
  maxCardCount: number
}

export interface AnimationState {
  bg: { opacity: number }
  stage: { y: number }
  header: { y: number; opacity: number }
  footer: { y: number; opacity: number }
  deckCtn: { x: number }
  initials: CardState[]
  lefts: CardState[]
  rights: CardState[]
  piles: CenterCardState[]
  draws: DrawCardState[]
  inners: InnerState[]
  resetShuffleVisualState(): void
  resetCutVisualState(): void
  resetDrawVisualState(): void
  resetInitialDeckState(): void
}

export function createAnimationState(opts: AnimationStateOptions): AnimationState {
  const _bg = reactive({ opacity: 0 })
  const _stage = reactive({ y: 0 })
  const _header = reactive({ y: 60, opacity: 0 })
  const _footer = reactive({ y: 60, opacity: 0 })
  const _deckCtn = reactive({ x: 0 })

  const { initials: rawInitials, lefts: rawLefts, rights: rawRights } = createShuffleInitialStates(
    opts.deckCount,
    opts.shuffleHalfCount,
  )
  const { piles: rawPiles } = createCutInitialStates(opts.maxCutPiles)
  const { draws: rawDraws, inners: rawInners } = createDrawInitialStates(opts.maxCardCount)

  const _initials = reactive(rawInitials)
  const _lefts = reactive(rawLefts)
  const _rights = reactive(rawRights)
  const _piles = reactive(rawPiles)
  const _draws = reactive(rawDraws)
  const _inners = reactive(rawInners)

  function resetShuffleVisualState() {
    _lefts.forEach((state) => {
      Object.assign(state, { x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0 })
    })
    _rights.forEach((state) => {
      Object.assign(state, { x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0 })
    })
  }

  function resetCutVisualState() {
    _piles.forEach((state, index) => {
      Object.assign(state, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 + index })
    })
  }

  function resetDrawVisualState() {
    _draws.forEach((state, index) => {
      Object.assign(state, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 0,
        zIndex: 20 - index,
        width: 0,
        height: 0,
      })
    })
    _inners.forEach((state) => {
      state.rotationY = 0
    })
  }

  function resetInitialDeckState() {
    _initials.forEach((state, index) => {
      Object.assign(state, { x: 0, y: -(index * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1 })
    })
  }

  return {
    bg: _bg,
    stage: _stage,
    header: _header,
    footer: _footer,
    deckCtn: _deckCtn,
    initials: _initials,
    lefts: _lefts,
    rights: _rights,
    piles: _piles,
    draws: _draws,
    inners: _inners,
    resetShuffleVisualState,
    resetCutVisualState,
    resetDrawVisualState,
    resetInitialDeckState,
  }
}
