/**
 * Name: spread_spec
 * Purpose: define generic spread spec types that support built-in and future custom spreads.
 * Reason: the core solver must work with any spread id without source edits.
 * Data flow: spread id flows in; spread spec data (slots, envelope, orientation) flows out.
 */

export type SpreadId = string
export type SpreadScene = 'draw_stage' | 'result_stage'

export interface SpreadSlotSpec {
  slotId: string
  /** Relative X position in slot-pitch units. */
  rx: number
  /** Relative Y position in slot-pitch units. */
  ry: number
}

export interface SpreadEnvelopeRequirement {
  /** Maximum horizontal slots that must fit inside the safe frame (including animation). */
  horizontalSlots: number
  /** Maximum vertical slots that must fit inside the safe frame (including animation). */
  verticalSlots: number
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

export interface SpreadLayoutContext {
  scene: SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  envelope: CardEnvelope
  headerHeight?: number
}

export interface CardEnvelope {
  cardWidth: number
  cardHeight: number
  gap: number
  horizontalSlots: number
  verticalSlots: number
  /** Distance between adjacent slot centers along X (= cardWidth + gap). */
  slotPitchX: number
  /** Distance between adjacent slot centers along Y (= cardHeight + gap). */
  slotPitchY: number
  /** Half of the total horizontal extent at full layout (centered). */
  halfSpanX: number
  /** Half of the total vertical extent at full layout (centered). */
  halfSpanY: number
  /** Total horizontal extent occupied at full layout. */
  fullSpanX: number
  /** Total vertical extent occupied at full layout. */
  fullSpanY: number
}

export interface SpreadSpec {
  id: SpreadId
  /** Default slot layout (used when wideSlots is absent or on narrow viewports). */
  slots: SpreadSlotSpec[]
  /** Optional wide-specific slot layout. */
  wideSlots?: SpreadSlotSpec[]
  /** Worst-case envelope requirements for sizing. */
  envelope: SpreadEnvelopeRequirement
  /** Optional custom layout resolver for complex spreads.
   *  If omitted, the generic grid solver is used. */
  resolveLayout?: (ctx: SpreadLayoutContext) => SpreadLayoutResult
}

/**
 * Built-in envelope constraints.
 * - Shuffle always spreads two card widths horizontally.
 * - Cut dictates 3 slots along the active axis.
 * - Draw stacks the spread's full layout.
 */
export function getBuiltInEnvelopeRequirement(
  spreadId: SpreadId,
  isWide: boolean,
): SpreadEnvelopeRequirement {
  const cutH = isWide ? 3 : 1
  const cutV = isWide ? 1 : 3
  const shuffleH = 2
  const shuffleV = 1

  let drawH: number
  let drawV: number

  switch (spreadId) {
    case 'single_card':
      drawH = 1
      drawV = 1
      break
    case 'three_card':
      drawH = isWide ? 3 : 1
      drawV = isWide ? 1 : 3
      break
    case 'cross_spread':
      drawH = 3
      drawV = 3
      break
    default:
      // Future custom spreads default to a conservative 3x3 envelope
      drawH = 3
      drawV = 3
  }

  return {
    horizontalSlots: Math.max(cutH, shuffleH, drawH),
    verticalSlots: Math.max(cutV, shuffleV, drawV),
  }
}
