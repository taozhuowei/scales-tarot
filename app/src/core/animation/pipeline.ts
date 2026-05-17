/**
 * Name: animation/pipeline
 * Purpose: phase pipeline composer.
 * Reason: the controller provides an ordered phase list and the pipeline executes them
 *   in sequence; inserting or removing a phase does not require rewriting controller flow.
 * Data flow: ordered phase builders + orchestrator flow in; sequential timeline execution flows out.
 */

// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import type { gsap } from 'gsap'
import type { OverlayPhase } from './phases/registry'
import type { TimelineOrchestrator } from '../gsap/timeline'

export interface PipelinePhase {
  phase: OverlayPhase
  build: (onComplete: () => void) => gsap.core.Timeline | null
}

export interface PhasePipeline {
  run(fromIndex?: number): void
}

export interface PhasePipelineCallbacks {
  onPhaseStart?: (phase: OverlayPhase) => void
  onPhaseComplete?: (phase: OverlayPhase) => void
  onPipelineComplete?: () => void
}

/**
 * Create a phase pipeline bound to a timeline orchestrator.
 * The pipeline executes phases in order, adding each returned timeline to the orchestrator.
 */
export function createPhasePipeline(
  orchestrator: TimelineOrchestrator,
  phases: PipelinePhase[],
  callbacks?: PhasePipelineCallbacks,
): PhasePipeline {
  return {
    run(fromIndex = 0) {
      function step(index: number) {
        if (index >= phases.length) {
          callbacks?.onPipelineComplete?.()
          return
        }
        const item = phases[index]
        callbacks?.onPhaseStart?.(item.phase)
        const timeline = item.build(() => {
          callbacks?.onPhaseComplete?.(item.phase)
          step(index + 1)
        })
        if (timeline) {
          orchestrator.add(timeline)
        } else {
          callbacks?.onPhaseComplete?.(item.phase)
          step(index + 1)
        }
      }
      step(fromIndex)
    },
  }
}

