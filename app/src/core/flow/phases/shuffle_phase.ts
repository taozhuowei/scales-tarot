/**
 * Name: core/flow/phases/shuffle_phase
 * Purpose: PhaseRunner implementation for the shuffle phase.
 * Reason: migrated from utils/overlay_animation/phases/shuffle_phase.ts to consume PhaseContext.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../../animation/types'
import type { OverlayPhase, PhaseContext, PhaseRunner } from '../types'

export interface ShufflePhaseConfig {
  spreadX: number
}

function createDefaultConfig(): ShufflePhaseConfig {
  return { spreadX: 120 }
}

export function buildShufflePhaseRunner(config?: Partial<ShufflePhaseConfig>): PhaseRunner {
  const cfg = { ...createDefaultConfig(), ...config }

  return {
    name: 'shuffling' as OverlayPhase,
    run(context: PhaseContext, onComplete: () => void): AnimationTimeline {
      const { initials, lefts, rights } = context.cardElements
      const leftsVisible = context.visible.lefts
      const rightsVisible = context.visible.rights
      const refreshInitials = context.refresh.initials
      const refreshLefts = context.refresh.lefts
      const refreshRights = context.refresh.rights

      const timeline = gsap.timeline({
        onComplete,
        onUpdate: () => {
          refreshInitials()
          refreshLefts()
          refreshRights()
        },
      })

      timeline.add(() => {
        initials.forEach((state) => { state.opacity = 0 })
        refreshInitials()

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
        refreshLefts()
        refreshRights()
      }, 0)

      timeline
        .to(lefts, {
          x: -cfg.spreadX,
          y: (index: number) => -30 - index * 0.8,
          rotation: -16,
          duration: 0.5,
          ease: 'power2.out',
        }, 0)
        .to(rights, {
          x: cfg.spreadX,
          y: (index: number) => 30 - index * 0.8,
          rotation: 16,
          duration: 0.5,
          ease: 'power2.out',
        }, '<')
        .to(lefts, {
          x: 0,
          y: (index: number) => -(index * 1.6),
          rotation: -2,
          duration: 0.4,
          stagger: 0.06,
          ease: 'power2.out',
        }, '+=0.2')
        .to(rights, {
          x: 0,
          y: (index: number) => -0.8 - index * 1.6,
          rotation: 2,
          duration: 0.4,
          stagger: 0.06,
          ease: 'power2.out',
        }, '<0.03')
        .add(() => {
          lefts.forEach((state) => { state.opacity = 0 })
          rights.forEach((state) => { state.opacity = 0 })
          leftsVisible.value = false
          rightsVisible.value = false
          refreshLefts()
          refreshRights()

          initials.forEach((state) => { state.opacity = 1; state.scaleY = 0.9 })
          refreshInitials()
        })
        .to(initials, {
          scaleY: 1,
          duration: 0.2,
          ease: 'power1.out',
        })

      return timeline as unknown as AnimationTimeline
    },
  }
}
