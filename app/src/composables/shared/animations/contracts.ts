/**
 * Name: composables/shared/animations/contracts
 * Purpose: flow-orchestration + phase-runner + animation-atom type contracts.
 * Reason: decouple phase execution order from individual phase logic, and
 *   give atoms a shared signature; contracts live with the animation
 *   base layer that defines them.
 */

import type { DrawCardState } from './card_state'
import type { DeckGeometry } from '../../../core/deck/types'
import type { CardLayout } from '../../../core/sizing/layout_solver'
import type { gsap } from 'gsap'

export type OverlayPhase = 'shuffling' | 'cutting' | 'drawing' | 'revealing'

export interface PhaseContext {
  deckGeometry: DeckGeometry
  spreadSlots?: CardLayout[]
  getCurrentLayouts: () => { drawLayout: { cardWidth: number; cardHeight: number; stageShiftY: number; cards: CardLayout[] } }
  getTargetLayouts: () => { drawLayout: { cardWidth: number; cardHeight: number; stageShiftY: number; cards: CardLayout[] } }
  cardElements: {
    initials: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
    lefts: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
    rights: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
    piles: { x: number; y: number; rotation: number; scale: number; opacity: number; zIndex: number }[]
    draws: DrawCardState[]
    inners: { rotationY: number }[]
    stage: { y: number }
    deckCtn: { x: number }
    bg: { opacity: number }
    header: { y: number; opacity: number }
    footer: { y: number; opacity: number }
  }
  visible: {
    lefts: { value: boolean }
    rights: { value: boolean }
    piles: { value: boolean[] }
    draws: { value: boolean[] }
  }
  onPhaseChange: (phase: OverlayPhase) => void
}

export interface PhaseRunner {
  name: OverlayPhase
  run(context: PhaseContext, onComplete: () => void): unknown
}

/** Subset of PhaseContext that atoms typically need. */
export interface AtomContext {
  cardElements: PhaseContext['cardElements']
  visible: PhaseContext['visible']
}

/**
 * An atom is a pure function that writes its tweens into the given timeline
 * starting at `startAt` (a GSAP position parameter — number, label, or
 * relative offset like "+=0.1" / ">"). Atoms do NOT return the timeline —
 * the caller composes by calling multiple atoms in sequence.
 */
export type AtomFn<TConfig> = (
  timeline: gsap.core.Timeline,
  ctx: AtomContext,
  config: TConfig,
  startAt?: number | string,
) => void
