/**
 * Name: phase_registry
 * Purpose: define and manage overlay animation phases metadata.
 * Reason: centralize phase definitions so progress UI and orchestration stay in sync.
 * Data flow: phase configuration flows out to progress model and timeline orchestrator.
 */

import type { OverlayPhase } from './types'
export type { OverlayPhase } from './types'

export interface PhaseStep {
  phase: OverlayPhase
  label: string
  activeIcon: string
  inactiveIcon: string
}

export const PHASE_STEPS: PhaseStep[] = [
  {
    phase: 'shuffling',
    label: '洗牌',
    activeIcon: 'icon_wands',
    inactiveIcon: 'icon_wands_inactive',
  },
  {
    phase: 'cutting',
    label: '切牌',
    activeIcon: 'icon_swords',
    inactiveIcon: 'icon_swords_inactive',
  },
  {
    phase: 'drawing',
    label: '抽牌',
    activeIcon: 'icon_cups',
    inactiveIcon: 'icon_cups_inactive',
  },
  {
    phase: 'revealing',
    label: '解读',
    activeIcon: 'icon_pentacles',
    inactiveIcon: 'icon_pentacles_inactive',
  },
]

export function getPhaseIndex(phase: OverlayPhase): number {
  return PHASE_STEPS.findIndex((s) => s.phase === phase)
}

export function getPhaseStep(phase: OverlayPhase): PhaseStep | undefined {
  return PHASE_STEPS.find((s) => s.phase === phase)
}

export function isValidPhase(phase: string): phase is OverlayPhase {
  return PHASE_STEPS.some((s) => s.phase === phase)
}

export function getPhaseSteps(): PhaseStep[] {
  return PHASE_STEPS
}

export function getNextPhase(phase: OverlayPhase): OverlayPhase | null {
  const index = getPhaseIndex(phase)
  if (index < 0 || index >= PHASE_STEPS.length - 1) {
    return null
  }
  return PHASE_STEPS[index + 1].phase
}
