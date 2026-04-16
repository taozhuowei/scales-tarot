/**
 * Name: core/deck/deck_calculator
 * Purpose: pure function to calculate deck geometry from safe frame and card count.
 * Reason: isolate deck positioning math from animation and controller state.
 */

import type { SafeFrame } from '../viewport/types'
import type { DeckGeometry } from './types'

export function resolveDeckGeometry(safeFrame: SafeFrame, cardCount: number): DeckGeometry {
  return {
    centerX: safeFrame.centerX,
    centerY: safeFrame.centerY,
    cardOffsetStep: { x: 0, y: -0.8 },
    totalOffset: { x: 0, y: -(cardCount - 1) * 0.8 },
  }
}
