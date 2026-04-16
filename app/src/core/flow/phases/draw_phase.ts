/**
 * Name: core/flow/phases/draw_phase
 * Purpose: PhaseRunner implementation for the draw phase.
 * Reason: migrated from utils/overlay_animation/phases/draw_phase.ts to consume PhaseContext.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../../animation/types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../types'

export interface DrawPhaseConfig {
  cardCount: number
  cardHeight: number
  stageHeight: number
  liftY: number
  targetX: number[]
  targetY: number[]
  autoRevealDelayMs: number
}

export function buildDrawPhaseRunner(config: DrawPhaseConfig): PhaseRunner {
  return {
    name: 'drawing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { initials, draws, inners, stage, deckCtn } = context.cardElements
      const { draws: drawsVisible } = context.visible
      const refreshInitials = context.refresh.initials
      const refreshDraws = context.refresh.draws
      const refreshInners = context.refresh.inners
      const refreshStage = context.refresh.stage
      const refreshDeckCtn = context.refresh.deckCtn
      const {
        cardCount,
        cardHeight,
        stageHeight,
        liftY,
        targetX,
        targetY,
        autoRevealDelayMs,
      } = config

      const drawStartTime = 0.88
      const pullDuration = 0.18
      const fallDuration = 0.78
      const reboundDuration = 0.34
      const settleDuration = 0.82
      const stageFollowStart = drawStartTime + pullDuration - 0.02
      const deckExitStart = stageFollowStart + 0.06

      const dealOverlapBudget = 1.6
      const perCardDelay = cardCount > 1
        ? Math.min(0.34, dealOverlapBudget / (cardCount - 1))
        : 0

      const lastCardLandingTime = drawStartTime
        + (cardCount - 1) * perCardDelay
        + pullDuration
        + fallDuration
        + reboundDuration
        + settleDuration

      const alignTime = lastCardLandingTime + 0.28

      const flipPerCardDuration = 1
      const flipOverlapBudget = 1.4
      const flipStagger = cardCount > 1
        ? Math.min(0.4, flipOverlapBudget / (cardCount - 1))
        : 0
      const flipDuration = flipPerCardDuration + (cardCount - 1) * flipStagger

      const revealDelay = autoRevealDelayMs / 1000
      const revealingStart = alignTime + 1.2 + flipDuration + 0.1 + revealDelay
      const finishTime = revealingStart + 0.3

      const preRotations = Array.from({ length: cardCount }, () => (Math.random() - 0.5) * 15)

      const timeline = gsap.timeline({
        onUpdate: () => {
          refreshDeckCtn()
          refreshStage()
          refreshInitials()
          refreshDraws()
          refreshInners()
        },
      })

      // Stage lift
      timeline
        .to(stage, {
          y: -liftY * 0.84,
          duration: 0.92,
          ease: 'power2.inOut',
        }, stageFollowStart)
        .to(stage, {
          y: -liftY,
          duration: 0.58,
          ease: 'power3.out',
        }, '>')

      // Deck exit
      timeline.to(initials, {
        opacity: 0,
        y: (index: number) => -cardHeight * 1.12 - index * 1.6,
        scale: 0.74,
        rotation: (index: number) => (index - 5.5) * 0.7,
        duration: 1.08,
        stagger: 0.018,
        ease: 'power2.in',
      }, deckExitStart)

      // Per-card deal animations
      for (let i = 0; i < cardCount; i++) {
        const cardTime = drawStartTime + i * perCardDelay

        timeline.add(() => {
          Object.assign(draws[i], {
            x: 0,
            y: i === 0 ? 0 : -stageHeight,
            rotation: 0,
            scale: 0.98,
            opacity: 1,
            zIndex: 20 - i,
          })
          const visible = [...drawsVisible.value]
          visible[i] = true
          drawsVisible.value = visible
          refreshDraws()
        }, cardTime)

        timeline.to(draws[i], {
          x: targetX[i] * 0.08,
          y: -cardHeight * 0.18,
          rotation: preRotations[i],
          scale: 1.03,
          duration: pullDuration,
          ease: 'power2.out',
        }, '>')

        timeline.to(draws[i], {
          x: targetX[i],
          y: targetY[i] + cardHeight * 0.86,
          duration: fallDuration,
          ease: 'power2.in',
        }, '>')

        timeline.to(draws[i], {
          y: targetY[i] + cardHeight * 0.18,
          rotation: preRotations[i] * 0.3,
          scale: 0.98,
          duration: reboundDuration,
          ease: 'power2.out',
        }, '>')

        timeline.to(draws[i], {
          y: targetY[i],
          rotation: 0,
          scale: 1,
          duration: settleDuration,
          ease: 'power3.out',
        }, '>')
      }

      // Alignment
      timeline.to(draws, {
        x: (index: number) => targetX[index],
        y: (index: number) => targetY[index],
        rotation: 0,
        duration: 0.8,
        ease: 'power3.inOut',
      }, alignTime + 0.1)

      // Flip
      timeline.to(inners, {
        rotationY: 180,
        duration: flipPerCardDuration,
        stagger: flipStagger,
        ease: 'back.out(1.1)',
      }, alignTime + 1.2)

      // Phase change
      timeline.add(() => {
        context.onPhaseChange('revealing')
      }, revealingStart)

      // Complete
      timeline.add(() => {
        onComplete()
      }, finishTime)

      return timeline as unknown as AnimationTimeline
    },
  }
}
