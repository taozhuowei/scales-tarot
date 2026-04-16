/**
 * Name: core/flow/phase_context_builder
 * Purpose: assemble a unified PhaseContext for all phase runners.
 * Reason: centralize context construction so phases receive a consistent contract.
 */

import type { AnimationEngine } from '../animation/types'
import type { DeckGeometry } from '../deck/types'
import type { CardLayout } from '../layout/types'
import type { OverlayPhase, PhaseContext } from './types'

export interface BuildPhaseContextInput {
  deckGeometry: DeckGeometry
  spreadSlots: CardLayout[]
  getCurrentLayouts: () => { drawLayout: { cardWidth: number; cardHeight: number; stageShiftY: number; cards: CardLayout[] } }
  getTargetLayouts: () => { drawLayout: { cardWidth: number; cardHeight: number; stageShiftY: number; cards: CardLayout[] } }
  engine: AnimationEngine
  cardElements: PhaseContext['cardElements']
  visible: PhaseContext['visible']
  refresh: PhaseContext['refresh']
  onPhaseChange: (phase: OverlayPhase) => void
}

export function buildPhaseContext(input: BuildPhaseContextInput): PhaseContext {
  return {
    deckGeometry: input.deckGeometry,
    spreadSlots: input.spreadSlots,
    getCurrentLayouts: input.getCurrentLayouts,
    getTargetLayouts: input.getTargetLayouts,
    cardElements: input.cardElements,
    visible: input.visible,
    refresh: input.refresh,
    onPhaseChange: input.onPhaseChange,
  }
}
