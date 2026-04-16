/**
 * Name: core/flow/phases/reveal_phase
 * Purpose: PhaseRunner implementation for the reveal phase.
 * Reason: migrated from utils/overlay_animation/phases/reveal_phase.ts to consume PhaseContext.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../../animation/types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../types'

export interface RevealPhaseConfig {
  cardCount: number
  drawLayout: {
    stageShiftY: number
    cards: { x: number; y: number }[]
  }
}

export function buildRevealPhaseRunner(config: RevealPhaseConfig): PhaseRunner {
  return {
    name: 'revealing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { stage, draws, inners, initials } = context.cardElements
      const { draws: drawsVisible } = context.visible
      const refreshStage = context.refresh.stage
      const refreshDraws = context.refresh.draws
      const refreshInners = context.refresh.inners
      const refreshInitials = context.refresh.initials
      const { cardCount, drawLayout } = config
      const targetX = drawLayout.cards.map((c) => c.x)
      const targetY = drawLayout.cards.map((c) => c.y)

      const timeline = gsap.timeline({
        onUpdate: () => {
          refreshStage()
          refreshDraws()
          refreshInners()
        },
      })

      timeline.add(() => {
        stage.y = -drawLayout.stageShiftY
        refreshStage()

        initials.forEach((state) => { state.opacity = 0 })
        refreshInitials()

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
            })
            inners[index].rotationY = 0
            visible[index] = true
          } else {
            Object.assign(state, {
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
              opacity: 0,
              zIndex: 20 - index,
            })
            inners[index].rotationY = 0
            visible[index] = false
          }
        })
        drawsVisible.value = visible
        refreshDraws()
        refreshInners()
      })

      const flipDuration = 1 + (cardCount - 1) * 0.4
      timeline.to(inners, {
        rotationY: 180,
        duration: 1,
        stagger: 0.4,
        ease: 'back.out(1.1)',
      }, 0.4)

      timeline.add(() => {
        onComplete()
      }, 0.4 + flipDuration + 0.4)

      return timeline as unknown as AnimationTimeline
    },
  }
}
