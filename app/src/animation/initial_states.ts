/**
 * Name: animation/initial_states
 * Purpose: create initial animation state objects for all overlay element groups.
 * Reason: these pure factories are consumed by use_animation_state.ts.
 */

import type { CardState, CenterCardState, DrawCardState, InnerState } from './types'

export interface ShuffleInitialStates {
  initials: CardState[]
  lefts: CardState[]
  rights: CardState[]
}

export function createShuffleInitialStates(
  deckCount: number = 12,
  halfCount: number = Math.max(1, Math.floor(deckCount / 2)),
): ShuffleInitialStates {
  const initials: CardState[] = Array.from({ length: deckCount }, (_, i) => ({
    x: 0,
    y: -(i * 0.8),
    rotation: 0,
    scale: 1,
    scaleY: 1,
    opacity: 1,
  }))

  const lefts: CardState[] = Array.from({ length: halfCount }, () => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    scaleY: 1,
    opacity: 0,
  }))

  const rights: CardState[] = Array.from({ length: halfCount }, () => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    scaleY: 1,
    opacity: 0,
  }))

  return { initials, lefts, rights }
}

export interface CutInitialStates {
  piles: CenterCardState[]
}

export function createCutInitialStates(maxCutPiles: number = 3): CutInitialStates {
  const piles: CenterCardState[] = Array.from({ length: maxCutPiles }, (_, i) => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 0,
    zIndex: 10 + i,
  }))

  return { piles }
}

export interface DrawInitialStates {
  draws: DrawCardState[]
  inners: InnerState[]
}

export function createDrawInitialStates(maxCardCount: number = 10): DrawInitialStates {
  const draws: DrawCardState[] = Array.from({ length: maxCardCount }, (_, i) => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 0,
    zIndex: 20 - i,
    width: 0,
    height: 0,
  }))

  const inners: InnerState[] = Array.from({ length: maxCardCount }, () => ({
    rotationY: 0,
  }))

  return { draws, inners }
}
