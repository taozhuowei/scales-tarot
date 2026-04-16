// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createTimelineOrchestrator, killAnimationTargets } from '../app/src/utils/overlay_animation/timeline_orchestrator'

// Mock GSAP
vi.mock('gsap', () => {
  const mockTimeline = {
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    timeScale: vi.fn(),
    time: vi.fn((t?: number) => t ?? 0),
    seek: vi.fn(),
    clear: vi.fn(),
    kill: vi.fn(),
    add: vi.fn(function(this: unknown) { return this }),
  }

  const killTweensOfMock = vi.fn()

  return {
    default: {
      timeline: vi.fn(() => mockTimeline),
      killTweensOf: killTweensOfMock,
    },
    timeline: vi.fn(() => mockTimeline),
    killTweensOf: killTweensOfMock,
  }
})

describe('overlay_animation/timeline_orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTimelineOrchestrator', () => {
    it('creates orchestrator with default state', () => {
      const orchestrator = createTimelineOrchestrator()

      expect(orchestrator.isPaused).toBe(false)
      expect(orchestrator.playbackRate).toBe(1)
    })

    it('creates paused orchestrator when specified', () => {
      const orchestrator = createTimelineOrchestrator(true)

      expect(orchestrator.isPaused).toBe(true)
    })

    it('tracks play state correctly', () => {
      const orchestrator = createTimelineOrchestrator()

      orchestrator.play()
      expect(orchestrator.isPaused).toBe(false)
    })

    it('tracks pause state correctly', () => {
      const orchestrator = createTimelineOrchestrator()

      orchestrator.pause()
      expect(orchestrator.isPaused).toBe(true)
    })

    it('tracks resume state correctly', () => {
      const orchestrator = createTimelineOrchestrator(true)

      orchestrator.resume()
      expect(orchestrator.isPaused).toBe(false)
    })

    it('tracks playback rate changes', () => {
      const orchestrator = createTimelineOrchestrator()

      orchestrator.setPlaybackRate(2)
      expect(orchestrator.playbackRate).toBe(2)

      orchestrator.setPlaybackRate(0.5)
      expect(orchestrator.playbackRate).toBe(0.5)
    })

    it('delegates seek to timeline', () => {
      const orchestrator = createTimelineOrchestrator()

      orchestrator.seek(5)
      expect(orchestrator.timeline.seek).toHaveBeenCalledWith(5)

      orchestrator.seek('+=1')
      expect(orchestrator.timeline.seek).toHaveBeenCalledWith('+=1')
    })

    it('delegates clear to timeline', () => {
      const orchestrator = createTimelineOrchestrator()

      orchestrator.clear()
      expect(orchestrator.timeline.clear).toHaveBeenCalled()
    })

    it('delegates kill to timeline', () => {
      const orchestrator = createTimelineOrchestrator()

      orchestrator.kill()
      expect(orchestrator.timeline.kill).toHaveBeenCalled()
    })
  })

  describe('killAnimationTargets', () => {
    it('delegates to gsap.killTweensOf', async () => {
      const { default: gsap } = await import('gsap')

      const targets = [{ x: 0 }, { y: 0 }]
      killAnimationTargets(targets)

      expect(gsap.killTweensOf).toHaveBeenCalledWith(targets)
    })
  })
})
