/**
 * Name: phase_progress_model
 * Purpose: pure state model for overlay progress tracking.
 * Reason: keep progress state independent from rendering and animation orchestration.
 * Data flow: phase changes flow in; progress state flows out.
 */

import type { OverlayPhase } from '../../shared/animations/contracts'
import { getPhaseIndex, getPhaseSteps } from './phase_manifest'

export interface ProgressState {
  currentPhase: OverlayPhase
  currentPhaseIndex: number
  totalPhases: number
  progressRatio: number
  isComplete: boolean
}

export interface ProgressModel {
  state: ProgressState
  transitionTo(phase: OverlayPhase): void
  complete(): void
  reset(): void
}

export function createProgressModel(initialPhase: OverlayPhase = 'shuffling'): ProgressModel {
  const totalPhases = getPhaseSteps().length

  function calculateState(phase: OverlayPhase): ProgressState {
    const currentPhaseIndex = getPhaseIndex(phase)
    return {
      currentPhase: phase,
      currentPhaseIndex,
      totalPhases,
      progressRatio: (currentPhaseIndex + 1) / totalPhases,
      isComplete: currentPhaseIndex >= totalPhases - 1,
    }
  }

  let state: ProgressState = calculateState(initialPhase)

  return {
    get state() {
      return state
    },
    transitionTo(phase: OverlayPhase) {
      state = calculateState(phase)
    },
    complete() {
      state = {
        ...state,
        progressRatio: 1,
        isComplete: true,
      }
    },
    reset() {
      state = calculateState('shuffling')
    },
  }
}

export interface PhaseProgressItem {
  phase: OverlayPhase
  label: string
  isActive: boolean
  isCompleted: boolean
  isPending: boolean
}

export function calculatePhaseProgress(
  currentPhase: OverlayPhase,
): PhaseProgressItem[] {
  const currentIndex = getPhaseIndex(currentPhase)

  return getPhaseSteps().map((step, index) => ({
    phase: step.phase,
    label: step.label,
    isActive: index === currentIndex,
    isCompleted: index < currentIndex,
    isPending: index > currentIndex,
  }))
}
