/**
 * Name: animation/phases/fan/builder
 * Purpose: builds the idle-deck fan animation timeline (PRD §7.5.1).
 * Reason: extracted from IdleDeck.vue so the timeline logic is testable and
 *         reusable without touching the component.
 * Data flow: caller supplies GSAP proxy targets and a flush callback; this
 *           builder creates and returns a repeating GSAP timeline. Returns
 *           null when the user prefers reduced motion — caller should keep
 *           cards in their current (stacked) position and skip the loop.
 */

import gsap from 'gsap'
import { prefersReducedMotion } from '../../../core/utils/accessibility'

export interface FanAnimTarget {
  x: number
  y: number
  rotation: number
  scale: number
}

export interface FanBuilderOptions {
  /** GSAP proxy targets — one entry per card, mutated in place by GSAP. */
  targets: FanAnimTarget[]
  /** Called on every GSAP tick to flush target state to Vue reactive refs. */
  onUpdate: () => void
}

/**
 * Build the 5-frame looping fan timeline (PRD §7.5.1 fan animation).
 *
 * Frame 1 (0%):    stack centred — caller resets before calling this
 * Frame 2→3:       fan-out into symmetric arc, 1.0 s power2.inOut
 * Frame 3 hold:    full-fan rest, 1.5 s
 * Frame 4→5:       collapse back to centred stack, 1.0 s power2.inOut
 * Frame 5 hold:    rest before next loop, 1.0 s
 *
 * x spread = ±(n/2 * 10) px; arc depth = |offset| * 2.5 px;
 * rotation = offset * 8 deg.
 */
export function buildFanTimeline(options: FanBuilderOptions): gsap.core.Timeline | null {
  if (prefersReducedMotion()) return null

  const { targets, onUpdate } = options
  const center = (targets.length - 1) / 2
  const tl = gsap.timeline({ repeat: -1 })

  // Frame 2→3: fan out.
  tl.to(targets, {
    duration: 1.0,
    ease: 'power2.inOut',
    x: (i: number) => (i - center) * 10,
    y: (i: number) => Math.abs(i - center) * 2.5,
    rotation: (i: number) => (i - center) * 8,
    onUpdate,
  })

  // Frame 3: hold at full fan.
  tl.to({}, { duration: 1.5 })

  // Frame 4→5: collapse back to centred stack.
  tl.to(targets, {
    duration: 1.0,
    ease: 'power2.inOut',
    x: 0,
    y: 0,
    rotation: 0,
    onUpdate,
  })

  // Frame 5: hold before next loop iteration.
  tl.to({}, { duration: 1.0 })

  return tl
}
