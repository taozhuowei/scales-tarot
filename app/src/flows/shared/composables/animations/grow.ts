/**
 * Name: flows/shared/composables/animations/grow
 * Purpose: animate cards' DOM width/height from current value to a target
 *          size. Used by the revealing phase to grow drawn cards from
 *          drawCardSize to resultCardSize.
 * Reason: extracting the size animation as an atom lets future phases
 *          (restart, reset) reuse the same primitive without duplicating
 *          GSAP plumbing.
 * Data flow: reveal builder constructs timeline, calls growAtom, then
 *          appends flipAtom — the two compose into the full reveal
 *          animation.
 */
import { prefersReducedMotion } from '../../../../core/utils/accessibility'
import type { AtomFn } from './contracts'

export interface GrowAtomConfig {
  cardCount: number
  /** Initial width to write before tween starts (typically drawCardWidth). */
  fromWidth: number
  fromHeight: number
  /** Target width to animate to (typically resultCardWidth). */
  toWidth: number
  toHeight: number
  /** Animation duration in seconds. */
  duration: number
  ease?: string
}

export const growAtom: AtomFn<GrowAtomConfig> = (timeline, ctx, config, startAt) => {
  const { draws } = ctx.cardElements
  const targets = draws.slice(0, config.cardCount)

  // Reset to fromSize before tween starts so the animation begins from
  // the documented initial state regardless of prior phase residue.
  timeline.set(targets, { width: config.fromWidth, height: config.fromHeight }, startAt)

  if (prefersReducedMotion()) {
    timeline.set(targets, { width: config.toWidth, height: config.toHeight }, '>')
    return
  }

  timeline.to(
    targets,
    {
      width: config.toWidth,
      height: config.toHeight,
      duration: config.duration,
      ease: config.ease ?? 'power2.out',
    },
    '>',
  )
}
