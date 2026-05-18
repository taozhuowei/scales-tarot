/**
 * Name: flows/divination/composables/phases/shuffle
 * Purpose: PhaseRunner implementation for the shuffle phase.
 * Reason: self-contained PhaseRunner consuming PhaseContext (composed by pipeline_builder).
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import gsap from 'gsap'
import type { AnimationTimeline } from '../../../shared/composables/animations/card_state'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../../../shared/composables/animations/contracts'
import { prefersReducedMotion } from '../../../../core/utils/accessibility'

/** Default horizontal spread of the shuffle fan when motion-metrics
 *  produce a degenerate value (very narrow viewport). */
const SHUFFLE_SPREAD_X = 120

export interface ShufflePhaseConfig {
  spreadX: number
}

function createDefaultConfig(): ShufflePhaseConfig {
  return { spreadX: SHUFFLE_SPREAD_X }
}

/**
 * Shared GSAP ease for the shuffle phase. Extracted so the four legs of
 * the spread → settle motion stay in lock-step — if you want a softer or
 * sharper feel, change it once here instead of hunting four call sites.
 */
const SHUFFLE_EASE = 'power2.out'

export function buildShufflePhaseRunner(config?: Partial<ShufflePhaseConfig>): PhaseRunner {
  const cfg = { ...createDefaultConfig(), ...config }

  return {
    name: 'shuffling' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { initials, lefts, rights } = context.cardElements
      const leftsVisible = context.visible.lefts
      const rightsVisible = context.visible.rights

      if (prefersReducedMotion()) {
        const timeline = gsap.timeline({ onComplete })
        timeline.add(() => {
          initials.forEach((state) => { state.opacity = 0 })
          lefts.forEach((state) => { state.opacity = 0 })
          rights.forEach((state) => { state.opacity = 0 })
          leftsVisible.value = false
          rightsVisible.value = false
        }, 0)
        timeline.to({}, { duration: 0.1 })
        return timeline 
      }

      const timeline = gsap.timeline({
        onComplete,
      })

      timeline.add(() => {
        initials.forEach((state) => { state.opacity = 0 })

        lefts.forEach((state, index) => {
          state.opacity = 1
          state.x = 0
          state.y = -(index * 0.8)
          state.rotation = 0
          state.scale = 1
          state.scaleY = 1
        })

        rights.forEach((state, index) => {
          state.opacity = 1
          state.x = 0
          state.y = -4.8 - index * 0.8
          state.rotation = 0
          state.scale = 1
          state.scaleY = 1
        })

        leftsVisible.value = true
        rightsVisible.value = true
      }, 0)

      timeline
        .to(lefts, {
          x: -cfg.spreadX,
          y: (index: number) => -30 - index * 0.8,
          rotation: -16,
          duration: 0.5,
          ease: SHUFFLE_EASE,
        }, 0)
        .to(rights, {
          x: cfg.spreadX,
          y: (index: number) => 30 - index * 0.8,
          rotation: 16,
          duration: 0.5,
          ease: SHUFFLE_EASE,
        }, '<')
        .to(lefts, {
          x: 0,
          y: (index: number) => -(index * 1.6),
          rotation: -2,
          duration: 0.4,
          stagger: 0.06,
          ease: SHUFFLE_EASE,
        }, '+=0.2')
        .to(rights, {
          x: 0,
          y: (index: number) => -0.8 - index * 1.6,
          rotation: 2,
          duration: 0.4,
          stagger: 0.06,
          ease: SHUFFLE_EASE,
        }, '<0.03')
        .add(() => {
          lefts.forEach((state) => { state.opacity = 0 })
          rights.forEach((state) => { state.opacity = 0 })
          leftsVisible.value = false
          rightsVisible.value = false

          initials.forEach((state) => { state.opacity = 1; state.scaleY = 0.9 })
        })
        .to(initials, {
          scaleY: 1,
          duration: 0.2,
          ease: 'power1.out',
        })

      return timeline 
    },
  }
}
