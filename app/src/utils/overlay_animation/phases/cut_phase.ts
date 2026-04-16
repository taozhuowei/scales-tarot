/**
 * Name: cut_phase
 * Purpose: pure cut animation logic.
 * Reason: one phase per file; no cross-phase orchestration.
 * Data flow: pile rest positions and lead/trail offsets flow in; GSAP timeline flows out.
 */

import gsap from 'gsap'
import { getCutPileRestPosition, type CutAxis } from '../../overlay_layout/motion_metrics'
import type { CenterCardState } from '../types'

export interface CutPhaseConfig {
  pileCount: number
  pileSpacing: number
  axis: CutAxis
  cutLeadingOffset: { x: number; y: number }
  cutTrailingOffset: { x: number; y: number }
}

export interface CutPhaseContext {
  piles: CenterCardState[]
  pilesVisible: { value: boolean[] }
  refreshPiles: () => void
}

/**
 * Build cut phase GSAP timeline for any pile count.
 */
export function buildCutPhase(
  context: CutPhaseContext,
  config: CutPhaseConfig,
  onComplete: () => void,
): gsap.core.Timeline {
  const { piles, pilesVisible } = context
  const { pileCount, pileSpacing, axis, cutLeadingOffset, cutTrailingOffset } = config
  const N = Math.max(1, pileCount)

  const restPositions = Array.from({ length: N }, (_, i) =>
    getCutPileRestPosition(i, N, pileSpacing, axis),
  )

  const timeline = gsap.timeline({
    onComplete,
    onUpdate: () => context.refreshPiles(),
  })

  // Initial: every pile centred on the deck, visible.
  timeline.add(() => {
    for (let i = 0; i < N; i++) {
      Object.assign(piles[i], { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 + i })
    }
    const visible = Array.from({ length: piles.length }, (_, i) => i < N)
    pilesVisible.value = visible
    context.refreshPiles()
  })

  // Spread piles out to their resting positions.
  timeline.to(piles.slice(0, N), {
    x: (i: number) => restPositions[i].x,
    y: (i: number) => restPositions[i].y,
    duration: 0.7,
    ease: 'power3.out',
  })

  // Cut: leading pile crosses to trailing slot, trailing pile crosses to leading slot.
  if (N >= 2) {
    timeline.to(piles[0], {
      x: cutTrailingOffset.x,
      y: cutTrailingOffset.y,
      zIndex: 10 + N + 2,
      duration: 0.7,
      ease: 'power2.inOut',
    }, '+=0.15')

    timeline.to(piles[N - 1], {
      x: cutLeadingOffset.x,
      y: cutLeadingOffset.y,
      zIndex: 10 + N + 1,
      duration: 0.7,
      ease: 'power2.inOut',
    }, '<')
  }

  // Collapse every pile back to the centre.
  timeline.to(piles.slice(0, N), {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    duration: 0.45,
    ease: 'power2.out',
  }, '+=0.2')

  // Hide piles so the unified deck takes over again.
  timeline.add(() => {
    pilesVisible.value = piles.map(() => false)
    context.refreshPiles()
  })

  return timeline
}

/**
 * Allocate enough pile state slots up to `maxPiles`.
 */
export function createCutInitialStates(maxPiles: number = 8): {
  piles: CenterCardState[]
} {
  const piles: CenterCardState[] = Array.from({ length: maxPiles }, (_, i) => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 0,
    zIndex: 10 + i,
  }))
  return { piles }
}
