// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { createPhasePipeline, getDefaultPhaseOrder } from '../app/src/utils/overlay_animation/pipeline'
import type { PipelinePhase, TimelineOrchestrator } from '../app/src/utils/overlay_animation/pipeline'
import type { OverlayPhase } from '../app/src/utils/overlay_animation/types'

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
  describe('getDefaultPhaseOrder', () => {
    it('returns shuffling -> cutting -> drawing -> revealing', () => {
      expect(getDefaultPhaseOrder()).toEqual([
        'shuffling',
        'cutting',
        'drawing',
        'revealing',
      ])
    })
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
      // Allow microtasks to flush since onCompletes are synchronous in makePhase
      await new Promise((r) => setTimeout(r, 10))

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
      await new Promise((r) => setTimeout(r, 10))

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
      await new Promise((r) => setTimeout(r, 10))

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
      await new Promise((r) => setTimeout(r, 10))

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
      await new Promise((r) => setTimeout(r, 10))

      expect(completed).toEqual(['shuffling', 'cutting'])
      expect(orchestrator.add).toHaveBeenCalledTimes(1)
    })
  })
})
