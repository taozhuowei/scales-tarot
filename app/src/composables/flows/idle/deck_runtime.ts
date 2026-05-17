/**
 * Name: composables/flows/idle/deck_runtime
 * Purpose: idle Deck-stage runtime state — the 12-card fan-stack size
 *          constant, the mutable PlayDeckRuntime container shape shared by
 *          the fan controller and the click guard, and its factory.
 * Reason: split out of use_play_deck_animation so the cross-flow
 *          orchestrator residue keeps only the phase state-machine. The
 *          runtime container is a single-responsibility idle-deck concern
 *          consumed by fan_controller and click_handler (both flows/idle).
 *          Behaviour-preserving: the interface and factory body are
 *          byte-identical to their inlined originals.
 * Data flow: pure state container — createPlayDeckRuntime() builds refs +
 *          mutable holders; no side-effects.
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { gsap } from 'gsap'

/** Cards stacked in the idle fan deck (docs/prd/animation.md（动画分帧）). */
export const DECK_SIZE = 12

/**
 * Internal mutable state container for the play-deck animation. Holders
 * wrap primitive values that mutate inside GSAP callbacks / lifecycle
 * hooks without losing reference identity.
 *
 * Note: the `cards` array is dedicated to the fan stack — it MUST NOT
 * be reused with animationController.cardElements. The fan stack is a
 * 12-card visual decoration; the divination rig has its own initials/
 * lefts/rights/piles/draws targets and reuses different DOM nodes.
 * Sharing the proxy array would cause GSAP target collisions when the
 * watcher flips phase mid-animation.
 */
export interface PlayDeckRuntime {
  cardWidth: Ref<number>
  cardHeight: Ref<number>
  cardsStyle: Ref<Record<string, string>[]>
  hintOpacity: Ref<number>
  isStartingDivination: Ref<boolean>
  cards: { x: number; y: number; rotation: number; scale: number }[]
  hintState: { opacity: number }
  timelineHolder: { value: gsap.core.Timeline | null }
  animatingHolder: { value: boolean }
  lockTimerHolder: { value: ReturnType<typeof setTimeout> | null }
}

/** Build the runtime container — refs + mutable holders only. */
export function createPlayDeckRuntime(): PlayDeckRuntime {
  return {
    cardWidth: ref(100),
    cardHeight: ref(160),
    cardsStyle: ref<Record<string, string>[]>(Array(DECK_SIZE).fill({})),
    hintOpacity: ref(0),
    isStartingDivination: ref(false),
    cards: Array(DECK_SIZE).fill(0).map(() => ({ x: 0, y: 0, rotation: 0, scale: 1 })),
    hintState: { opacity: 0 },
    timelineHolder: { value: null },
    animatingHolder: { value: false },
    lockTimerHolder: { value: null },
  }
}
