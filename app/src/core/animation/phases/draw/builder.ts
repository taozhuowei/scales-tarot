/**
 * Name: core/flow/phases/draw_phase
 * Purpose: PhaseRunner implementation for the draw phase.
 * Reason: migrated from utils/overlay_animation/phases/draw_phase.ts to consume PhaseContext.
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import gsap from 'gsap'
import type { AnimationTimeline } from '../../types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../flow/types'
import { prefersReducedMotion } from '../../../utils/accessibility'
import { randomInRange } from '../../../utils/secure_random'

/**
 * Cosmetic jitter (a few degrees of pre-flip rotation per card). Routed
 * through `secure_random` so the repo-wide rule against the global
 * insecure RNG holds; randomness quality does not affect correctness here.
 */
function jitterDeg(min: number, max: number): number {
  return randomInRange(min, max)
}

export interface DrawPhaseConfig {
  cardCount: number
  /** Draw-stage card width. Used to set draws[i].width on entry so the
   *  DOM real size equals the solver-computed size before any tween runs. */
  cardWidth: number
  cardHeight: number
  stageHeight: number
  liftY: number
  targetX: number[]
  targetY: number[]
  autoRevealDelayMs: number
  /** Called when the last card finishes settling at its final position. */
  onCardsLanded?: () => void
}

export function buildDrawPhaseRunner(config: DrawPhaseConfig): PhaseRunner {
  return {
    name: 'drawing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { initials, draws, stage, deckCtn } = context.cardElements
      const { draws: drawsVisible } = context.visible
      const {
        cardCount,
        cardWidth,
        cardHeight,
        stageHeight,
        liftY,
        targetX,
        targetY,
        autoRevealDelayMs,
        onCardsLanded,
      } = config

      if (prefersReducedMotion()) {
        const timeline = gsap.timeline()
        timeline.add(() => {
          stage.y = -liftY
          Object.assign(deckCtn, { x: 0 })
          initials.forEach((state, index) => {
            Object.assign(state, { opacity: 0, y: -cardHeight * 1.12 - index * 1.6, scale: 0.74 })
          })
          const visible = [...drawsVisible.value]
          for (let i = 0; i < cardCount; i++) {
            Object.assign(draws[i], {
              x: targetX[i],
              y: targetY[i],
              rotation: 0,
              scale: 1,
              opacity: 1,
              zIndex: 20 - i,
              width: cardWidth,
              height: cardHeight,
            })
            // Cards land face-DOWN. The reveal phase owns the flip animation
            // (see animation/atoms/flip + phases/reveal/builder). Per the
            // design rule cards must be enlarged before flipping, so the flip
            // can no longer happen here.
            visible[i] = true
          }
          drawsVisible.value = visible
          if (onCardsLanded) onCardsLanded()
        }, 0)
        timeline.add(() => {
          context.onPhaseChange('revealing')
        }, 0.1)
        timeline.add(() => {
          onComplete()
        }, 0.1)
        return timeline 
      }

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

      // Flip is now owned by the reveal phase (see animation/atoms/flip).
      // Per requirement N2: the historical 1.0s "breath" between alignment
      // and the reveal hand-off was dead weight on top of the alignment
      // tween + per-card settle, so it has been removed. `revealDelay`
      // (driven by AUTO_REVEAL_DELAY_MS) is also 0 by default — kept as a
      // dial for future tuning without touching this builder.
      const revealDelay = autoRevealDelayMs / 1000
      const revealingStart = alignTime + revealDelay
      const finishTime = revealingStart + 0.3

      const preRotations = Array.from({ length: cardCount }, () => jitterDeg(-7.5, 7.5))

      const timeline = gsap.timeline()

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
            width: cardWidth,
            height: cardHeight,
          })
          const visible = [...drawsVisible.value]
          visible[i] = true
          drawsVisible.value = visible
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

      // Notify when last card settles — drives cardsFocused / cardsDocked state
      if (onCardsLanded) {
        timeline.add(() => { onCardsLanded() }, lastCardLandingTime)
      }

      // Alignment
      timeline.to(draws, {
        x: (index: number) => targetX[index],
        y: (index: number) => targetY[index],
        rotation: 0,
        duration: 0.8,
        ease: 'power3.inOut',
      }, alignTime + 0.1)

      // Flip animation lives in the reveal phase now. See
      // animation/phases/reveal/builder.ts for the grow + flip composition.

      // Phase change
      timeline.add(() => {
        context.onPhaseChange('revealing')
      }, revealingStart)

      // Complete
      timeline.add(() => {
        onComplete()
      }, finishTime)

      return timeline 
    },
  }
}
