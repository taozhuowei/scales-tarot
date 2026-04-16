// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  createProgressModel,
  calculatePhaseProgress,
} from '../app/src/utils/overlay_progress/phase_progress_model'
import type { OverlayPhase } from '../app/src/utils/overlay_animations/types'

describe('overlay_progress/phase_progress_model', () => {
  describe('createProgressModel', () => {
    it('initializes with correct default state', () => {
      const model = createProgressModel('shuffling')

      expect(model.state.currentPhase).toBe('shuffling')
      expect(model.state.currentPhaseIndex).toBe(0)
      expect(model.state.totalPhases).toBe(4)
      expect(model.state.progressRatio).toBe(0.25)
      expect(model.state.isComplete).toBe(false)
    })

    it('initializes with custom initial phase', () => {
      const model = createProgressModel('drawing')

      expect(model.state.currentPhase).toBe('drawing')
      expect(model.state.currentPhaseIndex).toBe(2)
      expect(model.state.progressRatio).toBe(0.75)
      expect(model.state.isComplete).toBe(false)
    })

    it('transitionTo updates state correctly', () => {
      const model = createProgressModel('shuffling')

      model.transitionTo('cutting')
      expect(model.state.currentPhase).toBe('cutting')
      expect(model.state.currentPhaseIndex).toBe(1)
      expect(model.state.progressRatio).toBe(0.5)

      model.transitionTo('revealing')
      expect(model.state.currentPhase).toBe('revealing')
      expect(model.state.currentPhaseIndex).toBe(3)
      expect(model.state.progressRatio).toBe(1)
      expect(model.state.isComplete).toBe(true)
    })

    it('complete marks as complete', () => {
      const model = createProgressModel('drawing')

      model.complete()
      expect(model.state.progressRatio).toBe(1)
      expect(model.state.isComplete).toBe(true)
    })

    it('reset restores initial state', () => {
      const model = createProgressModel('revealing')

      model.reset()
      expect(model.state.currentPhase).toBe('shuffling')
      expect(model.state.currentPhaseIndex).toBe(0)
      expect(model.state.progressRatio).toBe(0.25)
      expect(model.state.isComplete).toBe(false)
    })
  })

  describe('calculatePhaseProgress', () => {
    it('calculates progress for shuffling phase', () => {
      const progress = calculatePhaseProgress('shuffling')

      expect(progress).toHaveLength(4)
      expect(progress[0].isActive).toBe(true)
      expect(progress[0].isCompleted).toBe(false)
      expect(progress[1].isPending).toBe(true)
      expect(progress[1].isActive).toBe(false)
      expect(progress[1].isCompleted).toBe(false)
    })

    it('calculates progress for revealing phase', () => {
      const progress = calculatePhaseProgress('revealing')

      expect(progress[3].isActive).toBe(true)
      expect(progress[0].isCompleted).toBe(true)
      expect(progress[1].isCompleted).toBe(true)
      expect(progress[2].isCompleted).toBe(true)
    })

    it('calculates progress for drawing phase', () => {
      const progress = calculatePhaseProgress('drawing')

      expect(progress[2].isActive).toBe(true)
      expect(progress[0].isCompleted).toBe(true)
      expect(progress[1].isCompleted).toBe(true)
      expect(progress[3].isPending).toBe(true)
    })

    it('includes correct labels', () => {
      const progress = calculatePhaseProgress('cutting')

      expect(progress[0].label).toBe('洗牌')
      expect(progress[1].label).toBe('切牌')
      expect(progress[2].label).toBe('抽牌')
      expect(progress[3].label).toBe('解读')
    })
  })
})
