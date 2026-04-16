/**
 * Name: reveal_phase
 * Purpose: pure reveal animation logic.
 * Reason: one phase per file; no cross-phase orchestration logic.
 * Data flow: current positions and layout metrics flow in; GSAP timeline flows out.
 */

import gsap from 'gsap'
import type { CenterCardState, InnerState } from '../types'
import type { SceneLayoutResult } from '../../overlay_layout/scene_layout'

export interface RevealPhaseConfig {
  cardCount: number
  drawLayout: SceneLayoutResult
}

export interface RevealPhaseContext {
  stage: { y: number }
  draws: CenterCardState[]
  inners: InnerState[]
  drawsVisible: { value: boolean[] }
  initials: { opacity: number }[]
  refreshStage: () => void
  refreshDraws: () => void
  refreshInners: () => void
  refreshInitials: () => void
}

/**
 * Build reveal phase GSAP timeline.
 */
export function buildRevealPhase(
  context: RevealPhaseContext,
  config: RevealPhaseConfig,
  onComplete: () => void,
): gsap.core.Timeline {
  const { stage, draws, inners, drawsVisible, initials } = context
  const { cardCount, drawLayout } = config
  const targetX = drawLayout.cards.map((c: { x: number }) => c.x)
  const targetY = drawLayout.cards.map((c: { y: number }) => c.y)

  const timeline = gsap.timeline({
    onUpdate: () => {
      context.refreshStage()
      context.refreshDraws()
      context.refreshInners()
    },
  })

  // Set initial state
  timeline.add(() => {
    stage.y = -drawLayout.stageShiftY
    context.refreshStage()

    initials.forEach((state) => { state.opacity = 0 })
    context.refreshInitials()

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
    context.refreshDraws()
    context.refreshInners()
  })

  // Flip animation
  const flipDuration = 1 + (cardCount - 1) * 0.4
  timeline.to(inners, {
    rotationY: 180,
    duration: 1,
    stagger: 0.4,
    ease: 'back.out(1.1)',
  }, 0.4)

  // Complete
  timeline.add(() => {
    onComplete()
  }, 0.4 + flipDuration + 0.4)

  return timeline
}

/**
 * Setup reveal initial state without animation.
 */
export function setupRevealInitialState(
  context: RevealPhaseContext,
  config: RevealPhaseConfig,
): void {
  const { stage, draws, inners, drawsVisible, initials } = context
  const { cardCount, drawLayout } = config
  const targetX = drawLayout.cards.map((c) => c.x)
  const targetY = drawLayout.cards.map((c) => c.y)

  stage.y = -drawLayout.stageShiftY
  context.refreshStage()

  initials.forEach((state) => { state.opacity = 0 })
  context.refreshInitials()

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
      inners[index].rotationY = 180
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
  context.refreshDraws()
  context.refreshInners()
}
