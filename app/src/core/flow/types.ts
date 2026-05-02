/**
 * Name: core/flow/types
 * Purpose: flow orchestration and phase runner types.
 * Reason: decouple phase execution order from individual phase logic.
 */

import type { DrawCardState } from '../../animation/types'
import type { DeckGeometry } from '../deck/types'
import type { CardLayout } from '../sizing/layout_solver'

export type OverlayPhase = 'shuffling' | 'cutting' | 'drawing' | 'revealing'

export interface PhaseContext {
  deckGeometry: DeckGeometry
  spreadSlots?: CardLayout[]
  getCurrentLayouts: () => { drawLayout: { cardWidth: number; cardHeight: number; stageShiftY: number; cards: CardLayout[] } }
  getTargetLayouts: () => { drawLayout: { cardWidth: number; cardHeight: number; stageShiftY: number; cards: CardLayout[] } }
  cardElements: {
    initials: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
    lefts: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
    rights: { x: number; y: number; rotation: number; scale: number; scaleY: number; opacity: number }[]
    piles: { x: number; y: number; rotation: number; scale: number; opacity: number; zIndex: number }[]
    draws: DrawCardState[]
    inners: { rotationY: number }[]
    stage: { y: number }
    deckCtn: { x: number }
    bg: { opacity: number }
    header: { y: number; opacity: number }
    footer: { y: number; opacity: number }
  }
  visible: {
    lefts: { value: boolean }
    rights: { value: boolean }
    piles: { value: boolean[] }
    draws: { value: boolean[] }
  }
  onPhaseChange: (phase: OverlayPhase) => void
}

export interface PhaseRunner {
  name: OverlayPhase
  run(context: PhaseContext, onComplete: () => void): unknown
}

export interface FlowOrchestrator {
  run(fromIndex?: number): void
  replayFrom(phaseName: OverlayPhase): void
  currentPhase(): OverlayPhase | null
}

export interface FlowOrchestratorCallbacks {
  onPhaseStart?: (phase: OverlayPhase) => void
  onPhaseComplete?: (phase: OverlayPhase) => void
  onPipelineComplete?: () => void
}
