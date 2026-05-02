/**
 * Name: core/flow/phases/reveal_phase
 * Purpose: PhaseRunner implementation for the reveal phase.
 * Reason: animate the card's DOM real width/height (not transform scale)
 *         from draw-stage size to result-stage size, so the rendered box
 *         and the layout solver agree at every frame. Transform scale
 *         stays at 1 throughout — it is only used by the draw phase for
 *         the ±10% wobble FX.
 * Data flow: draws cards at draw size; tweens width/height to result size.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../../../animation/engine'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../core/flow/types'
import { prefersReducedMotion } from '../../../utils/accessibility'

export interface RevealPhaseConfig {
  cardCount: number
  drawCardWidth: number
  drawCardHeight: number
  resultCardWidth: number
  resultCardHeight: number
  drawLayout: {
    stageShiftY: number
    cards: { x: number; y: number }[]
  }
}

export function buildRevealPhaseRunner(config: RevealPhaseConfig): PhaseRunner {
  return {
    name: 'revealing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { draws } = context.cardElements
      const { draws: drawsVisible } = context.visible
      const {
        cardCount,
        drawLayout,
        drawCardWidth,
        drawCardHeight,
        resultCardWidth,
        resultCardHeight,
      } = config
      const targetX = drawLayout.cards.map((c) => c.x)
      const targetY = drawLayout.cards.map((c) => c.y)

      const timeline = gsap.timeline({
        onComplete: () => {
          onComplete()
        }
      })

      // Ensure initial visibility and positions (at draw-stage real size).
      // scale stays at 1 — size is encoded in width/height, not transform.
      timeline.add(() => {
        const visible = [...drawsVisible.value]
        draws.forEach((state, index) => {
          if (index < cardCount) {
            Object.assign(state, {
              x: targetX[index],
              y: targetY[index],
              rotation: 0,
              scale: 1,
              opacity: 1,
              zIndex: 20 - index,
              width: drawCardWidth,
              height: drawCardHeight,
            })
            visible[index] = true
          } else {
            state.opacity = 0
            visible[index] = false
          }
        })
        drawsVisible.value = visible
      })

      if (prefersReducedMotion()) {
        // Snap to final size; scale untouched at 1.
        timeline.set(draws.slice(0, cardCount), {
          width: resultCardWidth,
          height: resultCardHeight,
        })
        return timeline
      }

      // Animate DOM real width/height from draw size to result size.
      timeline.to(draws.slice(0, cardCount), {
        width: resultCardWidth,
        height: resultCardHeight,
        duration: 0.75,
        ease: 'power2.out',
      }, '+=0.1')

      return timeline
    },
  }
}
