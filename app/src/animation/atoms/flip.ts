/**
 * Name: animation/atoms/flip
 * Purpose: animate cards' inner 3D rotationY from 0 to 180 (or any target),
 *          flipping the cards from face-down to face-up.
 * Reason: previously inline in the drawing phase. Extracting as an atom
 *          lets the revealing phase trigger the flip AFTER cards have
 *          grown (matches the "card already enlarged before flipping"
 *          design rule).
 * Data flow: reveal builder calls flipAtom after growAtom; flip operates
 *          on `inners` state objects (rotationY).
 */
import { prefersReducedMotion } from '../../core/utils/accessibility'
import type { AtomFn } from './types'

export interface FlipAtomConfig {
  cardCount: number
  /** Target rotation in degrees (typically 180 to show face). */
  targetRotation: number
  /** Per-card flip duration in seconds. */
  duration: number
  /** Stagger between cards in seconds. */
  stagger: number
  ease?: string
}

export const flipAtom: AtomFn<FlipAtomConfig> = (timeline, ctx, config, startAt) => {
  const { inners } = ctx.cardElements
  const targets = inners.slice(0, config.cardCount)

  if (prefersReducedMotion()) {
    timeline.set(targets, { rotationY: config.targetRotation }, startAt)
    return
  }

  timeline.to(
    targets,
    {
      rotationY: config.targetRotation,
      duration: config.duration,
      stagger: config.stagger,
      ease: config.ease ?? 'power3.out',
    },
    startAt,
  )
}
