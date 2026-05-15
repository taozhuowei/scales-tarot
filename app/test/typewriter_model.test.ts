// @vitest-environment node

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createTypewriterModel,
  calculateFieldTiming,
  calculateKeywordTiming,
} from '../src/core/utils/typing/typewriter_model'

describe('typewriter_model', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createTypewriterModel', () => {
    it('types text progressively', () => {
      const onUpdate = vi.fn()
      const onComplete = vi.fn()

      const model = createTypewriterModel(
        { text: 'ABC', startDelay: 0, charInterval: 10 },
        { onUpdate, onComplete },
      )

      model.start()
      // First tick happens at startDelay (0) + initial callback
      expect(onUpdate).toHaveBeenLastCalledWith('', false)

      vi.advanceTimersByTime(0)  // startDelay: 0 triggers immediately
      expect(onUpdate).toHaveBeenLastCalledWith('A', false)

      vi.advanceTimersByTime(10)
      expect(onUpdate).toHaveBeenLastCalledWith('AB', false)

      vi.advanceTimersByTime(10)
      expect(onUpdate).toHaveBeenLastCalledWith('ABC', true)
      expect(onComplete).toHaveBeenCalled()
    })

    it('respects start delay', () => {
      const onUpdate = vi.fn()

      const model = createTypewriterModel(
        { text: 'AB', startDelay: 50, charInterval: 10 },
        { onUpdate, onComplete: vi.fn() },
      )

      model.start()
      expect(onUpdate).toHaveBeenLastCalledWith('', false)

      vi.advanceTimersByTime(49)
      expect(onUpdate).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1)
      expect(onUpdate).toHaveBeenLastCalledWith('A', false)
    })

    it('handles instant mode', () => {
      const onUpdate = vi.fn()
      const onComplete = vi.fn()

      const model = createTypewriterModel(
        { text: 'Instant', instant: true },
        { onUpdate, onComplete },
      )

      model.start()
      expect(onUpdate).toHaveBeenLastCalledWith('Instant', true)
      expect(onComplete).toHaveBeenCalled()
    })

    it('handles empty text', () => {
      const onUpdate = vi.fn()
      const onComplete = vi.fn()

      const model = createTypewriterModel(
        { text: '' },
        { onUpdate, onComplete },
      )

      model.start()
      expect(onUpdate).toHaveBeenLastCalledWith('', true)
      expect(onComplete).toHaveBeenCalled()
    })

    it('can be stopped', () => {
      const onUpdate = vi.fn()

      const model = createTypewriterModel(
        { text: 'ABC', startDelay: 0, charInterval: 10 },
        { onUpdate, onComplete: vi.fn() },
      )

      model.start()
      vi.advanceTimersByTime(5)
      expect(onUpdate).toHaveBeenLastCalledWith('A', false)

      model.stop()
      vi.advanceTimersByTime(100)
      // Should not have progressed further
      expect(onUpdate).toHaveBeenLastCalledWith('A', false)
      expect(model.isRunning()).toBe(false)
    })

    it('can be reset', () => {
      const onUpdate = vi.fn()

      const model = createTypewriterModel(
        { text: 'ABC', startDelay: 0, charInterval: 10 },
        { onUpdate, onComplete: vi.fn() },
      )

      model.start()
      vi.advanceTimersByTime(1)  // First tick gives 'A'
      expect(onUpdate.mock.calls.some(c => c[0] === 'A')).toBe(true)

      model.reset()
      expect(onUpdate).toHaveBeenLastCalledWith('', false)
    })

    it('reports running state correctly', () => {
      const model = createTypewriterModel(
        { text: 'ABC', startDelay: 0, charInterval: 10 },
        { onUpdate: vi.fn(), onComplete: vi.fn() },
      )

      expect(model.isRunning()).toBe(false)

      model.start()
      expect(model.isRunning()).toBe(true)

      vi.advanceTimersByTime(50)
      expect(model.isRunning()).toBe(false)
    })
  })

  describe('calculateFieldTiming', () => {
    it('calculates timing for first card, first field', () => {
      const timing = calculateFieldTiming(0, 0)
      expect(timing.startDelay).toBe(100)
      expect(timing.charInterval).toBe(18)
    })

    it('calculates timing for second card, third field', () => {
      const timing = calculateFieldTiming(1, 2)
      expect(timing.startDelay).toBe(100 + 200 + 2 * 50)
    })

    it('uses custom delays', () => {
      const timing = calculateFieldTiming(2, 1, 100, 50, 20)
      expect(timing.startDelay).toBe(100 + 2 * 50 + 1 * 20)
    })
  })

  describe('calculateKeywordTiming', () => {
    it('calculates timing for first keyword', () => {
      const timing = calculateKeywordTiming(0, 0)
      // baseDelay + cardDelay*0 + stepDelay*3 + 50 + keywordDelay*0
      expect(timing.startDelay).toBe(100 + 0 + 150 + 50)
      expect(timing.charInterval).toBe(16)
    })

    it('calculates timing for second keyword of second card', () => {
      const timing = calculateKeywordTiming(1, 1)
      // baseDelay + cardDelay*1 + stepDelay*3 + 50 + keywordDelay*1
      expect(timing.startDelay).toBe(100 + 200 + 150 + 50 + 40)
    })
  })
})
