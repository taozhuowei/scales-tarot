/**
 * Name: composables/flows/divination/phases/cut
 * Purpose: PhaseRunner implementation for the cut phase.
 * Reason: self-contained PhaseRunner consuming PhaseContext (composed by pipeline_builder).
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import gsap from 'gsap'
import type { AnimationTimeline } from '../../../shared/animations/card_state'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../shared/animations/contracts'
import { prefersReducedMotion } from '../../../../core/utils/accessibility'

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

/**
 * Reset N piles to centred-stack rest state and toggle visibility for the
 * first N. Both the reduced-motion and the normal entry path call this
 * before their respective animations diverge — extracted to keep the two
 * branches honest about sharing the same starting state.
 */
function initPilesAtRest(
  piles: PhaseContext['cardElements']['piles'],
  pilesVisible: PhaseContext['visible']['piles'],
  N: number,
): void {
  for (let i = 0; i < N; i++) {
    Object.assign(piles[i], { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 + i })
  }
  pilesVisible.value = Array.from({ length: piles.length }, (_, i) => i < N)
}

export function buildCutPhaseRunner(config: CutPhaseConfig): PhaseRunner {
  return {
    name: 'cutting' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { piles } = context.cardElements
      const { piles: pilesVisible } = context.visible
      const N = Math.max(1, config.pileCount)

      const restPositions = Array.from({ length: N }, (_, i) =>
        getCutPileRestPosition(i, N, config.pileSpacing, config.axis),
      )

      if (prefersReducedMotion()) {
        const timeline = gsap.timeline({ onComplete })
        timeline.add(() => initPilesAtRest(piles, pilesVisible, N), 0)
        timeline.to({}, { duration: 0.1 })
        timeline.add(() => {
          pilesVisible.value = piles.map(() => false)
        })
        return timeline
      }

      const timeline = gsap.timeline({
        onComplete,
      })

      timeline.add(() => initPilesAtRest(piles, pilesVisible, N))

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
      })

      return timeline 
    },
  }
}
