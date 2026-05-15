/**
 * Name: composables/play/fan_controller
 * Purpose: imperative GSAP plumbing for the idle 12-card fan loop. Owns
 *          the timeline reference, the per-card transform flush, and the
 *          reset-to-stack snap used during phase hand-off.
 * Reason: extracted from use_play_deck_animation (P3-2) — keeping the
 *          fan-loop side-effects in their own module lets the main
 *          composable read as a state-machine and stays under the 300-
 *          line file-size cap. Behaviour-preserving: the function bodies
 *          are byte-identical to the inlined `createFanController` they
 *          replaced, only the file boundary changed.
 * Data flow:
 *          - the runtime container (PlayDeckRuntime) is owned by the
 *            main composable; this module mutates it via reference.
 *          - buildFanTimeline owns the actual GSAP keyframes (lives
 *            under animation/phases/fan/), this module only kicks it
 *            off, kills it, and bridges its onUpdate back into the
 *            reactive cardsStyle ref.
 */

import { gsap } from 'gsap'
import { prefersReducedMotion } from '../../core/utils/accessibility'
import { buildFanTimeline } from '../../animation/phases/fan/builder'
import type { FanController, PlayDeckRuntime } from './types'

/**
 * Build the fan-loop controller around a runtime container. All
 * imperative GSAP plumbing for the idle fan stays here so the main
 * composable body reads as a state-machine.
 */
export function createFanController(rt: PlayDeckRuntime): FanController {
  function flushCardsStyle(): void {
    rt.cardsStyle.value = rt.cards.map((c) => ({
      transform: `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.rotation}deg) scale(${c.scale})`,
      willChange: rt.animatingHolder.value ? 'transform' : 'auto',
    }))
  }
  function resetCardsToStack(): void {
    rt.cards.forEach((c) => { c.x = 0; c.y = 0; c.rotation = 0; c.scale = 1 })
    flushCardsStyle()
  }
  function killFanTimeline(): void {
    if (rt.timelineHolder.value) {
      rt.timelineHolder.value.kill()
      rt.timelineHolder.value = null
    }
    gsap.killTweensOf(rt.cards)
    rt.animatingHolder.value = false
  }
  function startFanLoop(): void {
    killFanTimeline()
    resetCardsToStack()
    rt.animatingHolder.value = !prefersReducedMotion()
    rt.timelineHolder.value = buildFanTimeline({ targets: rt.cards, onUpdate: flushCardsStyle })
  }
  return { flushCardsStyle, resetCardsToStack, killFanTimeline, startFanLoop }
}
