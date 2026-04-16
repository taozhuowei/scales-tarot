// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  PHASE_STEPS,
  getPhaseIndex,
  getPhaseStep,
  isValidPhase,
  getNextPhase,
} from '../app/src/utils/overlay_animation/phase_registry'
import type { OverlayPhase } from '../app/src/utils/overlay_animations/types'

describe('overlay_animation/phase_registry', () => {
  describe('PHASE_STEPS', () => {
    it('contains exactly 4 phases in order', () => {
      expect(PHASE_STEPS).toHaveLength(4)
      expect(PHASE_STEPS[0].phase).toBe('shuffling')
      expect(PHASE_STEPS[1].phase).toBe('cutting')
      expect(PHASE_STEPS[2].phase).toBe('drawing')
      expect(PHASE_STEPS[3].phase).toBe('revealing')
    })

    it('each phase has required properties', () => {
      PHASE_STEPS.forEach((step) => {
        expect(step.phase).toBeDefined()
        expect(step.label).toBeDefined()
        expect(step.activeIcon).toBeDefined()
        expect(step.inactiveIcon).toBeDefined()
        expect(step.label.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getPhaseIndex', () => {
    it('returns correct index for each phase', () => {
      expect(getPhaseIndex('shuffling')).toBe(0)
      expect(getPhaseIndex('cutting')).toBe(1)
      expect(getPhaseIndex('drawing')).toBe(2)
      expect(getPhaseIndex('revealing')).toBe(3)
    })

    it('returns -1 for invalid phase', () => {
      expect(getPhaseIndex('invalid' as OverlayPhase)).toBe(-1)
    })
  })

  describe('getPhaseStep', () => {
    it('returns correct step for each phase', () => {
      const shuffleStep = getPhaseStep('shuffling')
      expect(shuffleStep).toBeDefined()
      expect(shuffleStep?.label).toBe('洗牌')

      const revealStep = getPhaseStep('revealing')
      expect(revealStep).toBeDefined()
      expect(revealStep?.label).toBe('解读')
    })

    it('returns undefined for invalid phase', () => {
      expect(getPhaseStep('invalid' as OverlayPhase)).toBeUndefined()
    })
  })

  describe('isValidPhase', () => {
    it('returns true for valid phases', () => {
      expect(isValidPhase('shuffling')).toBe(true)
      expect(isValidPhase('cutting')).toBe(true)
      expect(isValidPhase('drawing')).toBe(true)
      expect(isValidPhase('revealing')).toBe(true)
    })

    it('returns false for invalid phases', () => {
      expect(isValidPhase('invalid')).toBe(false)
      expect(isValidPhase('')).toBe(false)
      expect(isValidPhase('result')).toBe(false)
    })
  })

  describe('getNextPhase', () => {
    it('returns next phase correctly', () => {
      expect(getNextPhase('shuffling')).toBe('cutting')
      expect(getNextPhase('cutting')).toBe('drawing')
      expect(getNextPhase('drawing')).toBe('revealing')
    })

    it('returns null for last phase', () => {
      expect(getNextPhase('revealing')).toBeNull()
    })
  })
})
