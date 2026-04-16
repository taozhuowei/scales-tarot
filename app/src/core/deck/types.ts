/**
 * Name: core/deck/types
 * Purpose: deck geometry types for layout calculations.
 * Reason: decouple deck positioning from animation state.
 */

export interface DeckCardOffset {
  x: number
  y: number
}

export interface DeckGeometry {
  centerX: number
  centerY: number
  cardOffsetStep: DeckCardOffset
  totalOffset: DeckCardOffset
}
