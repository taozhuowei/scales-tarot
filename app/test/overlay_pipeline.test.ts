// @vitest-environment node

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPhasePipeline } from '../src/flows/shared/composables/animations/pipeline'
import type { PipelinePhase } from '../src/flows/shared/composables/animations/pipeline'
import type { TimelineOrchestrator } from '../src/core/gsap/timeline'
import type { OverlayPhase } from '../src/flows/shared/composables/animations/contracts'

function createMockOrchestrator(): TimelineOrchestrator {
  const timelines: unknown[] = []
  return {
    add: vi.fn((item) => { timelines.push(item); return item }),
    pause: vi.fn(),
    resume: vi.fn(),
    stepForward: vi.fn(),
    stepBackward: vi.fn(),
    seek: vi.fn(),
    clear: vi.fn(),
    kill: vi.fn(),
    setPlaybackRate: vi.fn(),
  } as unknown as TimelineOrchestrator
}

function createMockTimeline() {
  return {} as unknown as gsap.core.Timeline
}

function makePhase(phase: OverlayPhase, delayMs = 0): PipelinePhase {
  return {
    phase,
    build: (onComplete) => {
      setTimeout(onComplete, delayMs)
      return createMockTimeline()
    },
  }
}

describe('overlay_animation pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createPhasePipeline', () => {
    it('executes phases in order', async () => {
      const orchestrator = createMockOrchestrator()
      const order: OverlayPhase[] = []

      const phases: PipelinePhase[] = [
        makePhase('shuffling'),
        makePhase('cutting'),
        makePhase('drawing'),
        makePhase('revealing'),
      ]

      const pipeline = createPhasePipeline(orchestrator, phases, {
        onPhaseStart: (p) => order.push(`start:${p}` as unknown as OverlayPhase),
        onPhaseComplete: (p) => order.push(`complete:${p}` as unknown as OverlayPhase),
      })

      pipeline.run()
      vi.advanceTimersByTime(100)

      expect(order).toEqual([
        'start:shuffling',
        'complete:shuffling',
        'start:cutting',
        'complete:cutting',
        'start:drawing',
        'complete:drawing',
        'start:revealing',
        'complete:revealing',
      ])
    })

    it('can start from a middle phase', async () => {
      const orchestrator = createMockOrchestrator()
      const completed: OverlayPhase[] = []

      const phases: PipelinePhase[] = [
        makePhase('shuffling'),
        makePhase('cutting'),
        makePhase('drawing'),
        makePhase('revealing'),
      ]

      const pipeline = createPhasePipeline(orchestrator, phases, {
        onPhaseComplete: (p) => completed.push(p),
      })

      pipeline.run(2)
      vi.advanceTimersByTime(100)

      expect(completed).toEqual(['drawing', 'revealing'])
    })

    it('calls onPipelineComplete after the last phase', async () => {
      const orchestrator = createMockOrchestrator()
      const onComplete = vi.fn()

      const phases: PipelinePhase[] = [
        makePhase('shuffling'),
        makePhase('cutting'),
      ]

      const pipeline = createPhasePipeline(orchestrator, phases, {
        onPipelineComplete: onComplete,
      })

      pipeline.run()
      vi.advanceTimersByTime(100)

      expect(onComplete).toHaveBeenCalledOnce()
    })

    it('adds each timeline to the orchestrator', async () => {
      const orchestrator = createMockOrchestrator()
      const phases: PipelinePhase[] = [
        makePhase('shuffling'),
        makePhase('cutting'),
      ]

      const pipeline = createPhasePipeline(orchestrator, phases)
      pipeline.run()
      vi.advanceTimersByTime(100)

      expect(orchestrator.add).toHaveBeenCalledTimes(2)
    })

    it('skips null timelines and continues the chain', async () => {
      const orchestrator = createMockOrchestrator()
      const completed: OverlayPhase[] = []

      const phases: PipelinePhase[] = [
        { phase: 'shuffling', build: () => null },
        makePhase('cutting'),
      ]

      const pipeline = createPhasePipeline(orchestrator, phases, {
        onPhaseComplete: (p) => completed.push(p),
      })

      pipeline.run()
      vi.advanceTimersByTime(100)

      expect(completed).toEqual(['shuffling', 'cutting'])
      expect(orchestrator.add).toHaveBeenCalledTimes(1)
    })
  })
})
