/**
 * Name: shuffle_phase
 * Purpose: pure shuffle animation logic.
 * Reason: one phase per file; no cross-phase orchestration.
 * Data flow: animation states + spread config flow in; GSAP timeline flows out.
 */

import gsap from 'gsap'
import type { CardState } from '../types'

export interface ShufflePhaseConfig {
  spreadX: number
}

export interface ShufflePhaseContext {
  initials: CardState[]
  lefts: CardState[]
  rights: CardState[]
  leftsVisible: { value: boolean }
  rightsVisible: { value: boolean }
  refreshInitials: () => void
  refreshLefts: () => void
  refreshRights: () => void
}

/**
 * Build shuffle phase GSAP timeline.
 */
export function buildShufflePhase(
  context: ShufflePhaseContext,
  config: ShufflePhaseConfig,
  onComplete: () => void,
): gsap.core.Timeline {
  const { initials, lefts, rights, leftsVisible, rightsVisible } = context
  const { spreadX } = config

  const timeline = gsap.timeline({
    onComplete,
    onUpdate: () => {
      context.refreshInitials()
      context.refreshLefts()
      context.refreshRights()
    },
  })

  // Set up initial shuffle state
  timeline.add(() => {
    initials.forEach((state) => { state.opacity = 0 })
    context.refreshInitials()

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
    context.refreshLefts()
    context.refreshRights()
  }, 0)

  // Spread animations
  timeline
    .to(lefts, {
      x: -spreadX,
      y: (index: number) => -30 - index * 0.8,
      rotation: -16,
      duration: 0.5,
      ease: 'power2.out',
    }, 0)
    .to(rights, {
      x: spreadX,
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
      context.refreshLefts()
      context.refreshRights()

      initials.forEach((state) => { state.opacity = 1; state.scaleY = 0.9 })
      context.refreshInitials()
    })
    .to(initials, {
      scaleY: 1,
      duration: 0.2,
      ease: 'power1.out',
    })

  return timeline
}

/**
 * Create initial state for shuffle animation groups.
 */
export function createShuffleInitialStates(
  deckCount: number = 12,
  halfCount: number = Math.max(1, Math.floor(deckCount / 2)),
): {
  initials: CardState[]
  lefts: CardState[]
  rights: CardState[]
} {
  const initials: CardState[] = Array.from({ length: deckCount }, (_, i) => ({
    x: 0,
    y: -(i * 0.8),
    rotation: 0,
    scale: 1,
    scaleY: 1,
    opacity: 1,
  }))

  const lefts: CardState[] = Array.from({ length: halfCount }, () => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    scaleY: 1,
    opacity: 0,
  }))

  const rights: CardState[] = Array.from({ length: halfCount }, () => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    scaleY: 1,
    opacity: 0,
  }))

  return { initials, lefts, rights }
}
