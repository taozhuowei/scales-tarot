/**
 * Name: core/flow/phases/reveal_phase
 * Purpose: PhaseRunner implementation for the reveal phase.
 * Reason: implementation of smooth scale-up from base size to result size.
 * Data flow: draws cards from base size and smoothly scales to result size.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../../../core/animation/types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../core/flow/types'
import { prefersReducedMotion } from '../../../utils/accessibility'

export interface RevealPhaseConfig {
  cardCount: number
  drawCardWidth: number
  resultCardWidth: number
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
      const { cardCount, drawLayout, drawCardWidth, resultCardWidth } = config
      const targetX = drawLayout.cards.map((c) => c.x)
      const targetY = drawLayout.cards.map((c) => c.y)

      // Reveal animates from the draw-stage card size to the result-stage card
      // size (which is independently solved per spread). No extra emphasis
      // scale — the result size IS the target.
      const finalScale = resultCardWidth / Math.max(drawCardWidth, 1)

      const timeline = gsap.timeline({
        onComplete: () => {
          onComplete()
        }
      })

      // Ensure initial visibility and positions (at base scale 1)
      timeline.add(() => {
        const visible = [...drawsVisible.value]
        draws.forEach((state, index) => {
          if (index < cardCount) {
            Object.assign(state, {
              x: targetX[index],
              y: targetY[index],
              rotation: 0,
              scale: 1, // Start from base scale
              opacity: 1,
              zIndex: 20 - index,
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
        timeline.set(draws.slice(0, cardCount), { scale: finalScale })
        return timeline 
      }

      // Smooth scale-up for all revealed cards
      timeline.to(draws.slice(0, cardCount), {
        scale: finalScale,
        duration: 0.75,
        ease: 'power2.out',
      }, "+=0.1")

      return timeline 
    },
  }
}
