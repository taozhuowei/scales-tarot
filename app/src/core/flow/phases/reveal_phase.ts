/**
 * Name: core/flow/phases/reveal_phase
 * Purpose: PhaseRunner implementation for the reveal phase.
 * Reason: migrated from utils/overlay_animation/phases/reveal_phase.ts to consume PhaseContext.
 * Data flow: draw phase has already flipped cards (rotationY=180); this phase confirms final
 * visible state, then waits for the CSS --card-focus-scale spring animation to settle before
 * signalling completion (which triggers the result panel to open).
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import gsap from 'gsap'
import type { AnimationTimeline } from '../../animation/types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../types'
import { prefersReducedMotion } from '../../../utils/accessibility'

export interface RevealPhaseConfig {
  cardCount: number
  drawLayout: {
    stageShiftY: number
    cards: { x: number; y: number }[]
  }
}

// Time to wait after the phase begins before calling onComplete.
// Must be long enough for the CSS --card-focus-scale spring (≈0.55 s) to settle
// plus a brief hold so the user can see the enlarged card before results slide in.
const FOCUS_SETTLE_DELAY = 0.7

export function buildRevealPhaseRunner(config: RevealPhaseConfig): PhaseRunner {
  return {
    name: 'revealing' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { draws, inners } = context.cardElements
      const { draws: drawsVisible } = context.visible
      const { cardCount, drawLayout } = config
      const targetX = drawLayout.cards.map((c) => c.x)
      const targetY = drawLayout.cards.map((c) => c.y)

      const timeline = gsap.timeline()

      // Confirm final card state — draw_phase already flipped cards (rotationY=180)
      // and animated them to target positions, so we only need to ensure visibility
      // and snap any residual drift to exact positions.
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
            })
            // Do NOT reset inners[index].rotationY — draw_phase already set it to 180.
            visible[index] = true
          } else {
            state.opacity = 0
            visible[index] = false
          }
        })
        drawsVisible.value = visible
      })

      if (prefersReducedMotion()) {
        timeline.add(() => {
          onComplete()
        }, 0.1)
        return timeline as unknown as AnimationTimeline
      }

      // Wait for the CSS --card-focus-scale spring to settle before signalling
      // completion, which triggers openResultPanel().
      timeline.add(() => {
        onComplete()
      }, FOCUS_SETTLE_DELAY)

      return timeline as unknown as AnimationTimeline
    },
  }
}
