/**
 * Name: core/flow/phases/cut_phase
 * Purpose: PhaseRunner implementation for the cut phase.
 * Reason: migrated from utils/overlay_animation/phases/cut_phase.ts to consume PhaseContext.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../../animation/types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../types'

export interface CutPhaseConfig {
  pileCount: number
  pileSpacing: number
  axis: 'horizontal' | 'vertical'
  cutLeadingOffset: { x: number; y: number }
  cutTrailingOffset: { x: number; y: number }
}

function getCutPileRestPosition(
  pileIndex: number,
  pileCount: number,
  pileSpacing: number,
  axis: 'horizontal' | 'vertical',
): { x: number; y: number } {
  const offset = (pileIndex - (pileCount - 1) / 2) * pileSpacing
  return axis === 'horizontal' ? { x: offset, y: 0 } : { x: 0, y: offset }
}

export function buildCutPhaseRunner(config: CutPhaseConfig): PhaseRunner {
  return {
    name: 'cutting' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { piles } = context.cardElements
      const { piles: pilesVisible } = context.visible
      const refreshPiles = context.refresh.piles
      const N = Math.max(1, config.pileCount)

      const restPositions = Array.from({ length: N }, (_, i) =>
        getCutPileRestPosition(i, N, config.pileSpacing, config.axis),
      )

      const timeline = gsap.timeline({
        onComplete,
        onUpdate: () => refreshPiles(),
      })

      timeline.add(() => {
        for (let i = 0; i < N; i++) {
          Object.assign(piles[i], { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 + i })
        }
        const visible = Array.from({ length: piles.length }, (_, i) => i < N)
        pilesVisible.value = visible
        refreshPiles()
      })

      timeline.to(piles.slice(0, N), {
        x: (i: number) => restPositions[i].x,
        y: (i: number) => restPositions[i].y,
        duration: 0.7,
        ease: 'power3.out',
      })

      if (N >= 2) {
        timeline.to(piles[0], {
          x: config.cutTrailingOffset.x,
          y: config.cutTrailingOffset.y,
          zIndex: 10 + N + 2,
          duration: 0.7,
          ease: 'power2.inOut',
        }, '+=0.15')

        timeline.to(piles[N - 1], {
          x: config.cutLeadingOffset.x,
          y: config.cutLeadingOffset.y,
          zIndex: 10 + N + 1,
          duration: 0.7,
          ease: 'power2.inOut',
        }, '<')
      }

      timeline.to(piles.slice(0, N), {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
      }, '+=0.2')

      timeline.add(() => {
        pilesVisible.value = piles.map(() => false)
        refreshPiles()
      })

      return timeline as unknown as AnimationTimeline
    },
  }
}
