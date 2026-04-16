/**
 * Name: core/layout/types
 * Purpose: pure layout types with no animation/progress coupling.
 * Reason: decouple layout algebra from animation and viewport state.
 */

export interface SpreadSlotDef {
  slotId: string
  rx: number
  ry: number
}

export interface SpreadSlot {
  slotId: string
  x: number
  y: number
}

export interface CardLayout {
  slotId: string
  x: number
  y: number
  width: number
  height: number
  rotateDeg: number
  zIndex: number
}

export interface SpreadGeometry {
  cardWidth: number
  cardHeight: number
  slotPitchX: number
  slotPitchY: number
  halfSpanX: number
  halfSpanY: number
  fullSpanX: number
  fullSpanY: number
}

export interface SpreadSpec {
  id: string
  name: string
  slotCount: number
  horizontalSlots: number
  verticalSlots: number
  slots: SpreadSlotDef[]
  wideSlots?: SpreadSlotDef[]
  slotResolver?: string
}
