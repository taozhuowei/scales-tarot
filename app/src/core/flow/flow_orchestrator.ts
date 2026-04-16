/**
 * Name: core/flow/flow_orchestrator
 * Purpose: sequential phase runner dispatcher backed by a GSAP timeline.
 * Reason: inserting/removing phases only requires editing the PhaseRunner array.
 */

import gsap from 'gsap'
import type { AnimationTimeline } from '../animation/types'
import type { FlowOrchestrator, FlowOrchestratorCallbacks, OverlayPhase, PhaseContext, PhaseRunner } from './types'

class MasterTimeline {
  private tl: gsap.core.Timeline

  constructor(paused = false) {
    this.tl = gsap.timeline({ paused })
  }

  add(child: AnimationTimeline | gsap.core.Timeline, position?: number | string): void {
    const native = child as unknown as gsap.core.Timeline
    this.tl.add(native, position)
  }

  pause(): void {
    this.tl.pause()
  }

  resume(): void {
    this.tl.resume()
  }

  play(): void {
    this.tl.play()
  }

  timeScale(scale: number): void {
    this.tl.timeScale(scale)
  }

  time(): number {
    return this.tl.time()
  }

  seek(position: number | string): void {
    this.tl.seek(position)
  }

  clear(): void {
    this.tl.clear()
    this.tl.time(0)
  }

  kill(): void {
    this.tl.kill()
  }
}

export interface TimelineLike {
  add(child: AnimationTimeline | gsap.core.Timeline, position?: number | string): void
  pause(): void
  resume(): void
  play(): void
  timeScale(scale: number): void
  time(): number
  seek(position: number | string): void
  clear(): void
  kill(): void
}

export function createFlowOrchestrator(
  phases: PhaseRunner[],
  context: PhaseContext,
  callbacks: FlowOrchestratorCallbacks,
  timeline: TimelineLike = new MasterTimeline(false),
): FlowOrchestrator {
  let currentPhase: OverlayPhase | null = null

  function step(index: number) {
    if (index >= phases.length) {
      callbacks.onPipelineComplete?.()
      return
    }
    const phase = phases[index]
    currentPhase = phase.name
    callbacks.onPhaseStart?.(phase.name)
    const child = phase.run(context, () => {
      callbacks.onPhaseComplete?.(phase.name)
      step(index + 1)
    })
    if (child) {
      timeline.add(child)
    } else {
      callbacks.onPhaseComplete?.(phase.name)
      step(index + 1)
    }
  }

  return {
    run(fromIndex = 0) {
      step(fromIndex)
      timeline.play()
    },
    replayFrom(phaseName) {
      const index = phases.findIndex((p) => p.name === phaseName)
      if (index >= 0) {
        timeline.clear()
        currentPhase = phaseName
        step(index)
        timeline.play()
      }
    },
    currentPhase() {
      return currentPhase
    },
  }
}
