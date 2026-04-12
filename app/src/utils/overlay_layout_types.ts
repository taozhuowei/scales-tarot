/**
 * Name: overlay_layout_types
 * Purpose: share overlay spread layout types across sizing, positioning, and animation modules.
 * Reason: keep viewport, card sizing, and spread positioning modules loosely coupled.
 * Data flow: the overlay animation layer consumes these types from the pure layout modules.
 */

export type SpreadKind = 'single_card' | 'three_card' | 'cross_spread'
export type SpreadScene = 'draw_stage' | 'result_stage'

export interface SpreadLayoutInput {
  spreadKind: SpreadKind
  scene: SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  cardAspectRatio: number
  headerHeight?: number
}

export interface SpreadCardLayout {
  slotId: string
  x: number
  y: number
  width: number
  height: number
  rotateDeg: number
  zIndex: number
}

export interface SpreadLayoutResult {
  cardWidth: number
  cardHeight: number
  stageShiftY: number
  cards: SpreadCardLayout[]
}
