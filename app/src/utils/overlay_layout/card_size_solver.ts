/**
 * Name: card_size_solver
 * Purpose: compute the maximum safe card size and gap using safe frame, spread spec,
 *   animation envelope, focus scale, and badge expansion.
 * Reason: single source of truth for card sizing so layout, shuffle, cut, and focus
 *   states all agree on the same bounds and no frame can overflow.
 * Data flow: safe frame + envelope requirement + focus/badge params flow in;
 *   card size, gap, and slot pitches flow out.
 */

import type { CardEnvelope } from './spread_spec'

export type CardSizeResult = CardEnvelope

export interface CardSizeInput {
  safeWidth: number
  safeHeight: number
  cardAspectRatio: number
  horizontalSlots: number
  verticalSlots: number
  gap?: number
  minCardWidth?: number
  maxCardWidth?: number
  /** Focus scale applied during reveal (e.g. 1.42 narrow, 1.2 wide). */
  focusScale?: number
  /** Badge overflow in px beyond card edge (e.g. 12rpx converted to px). */
  badgeOverflowPx?: number
}

export const DEFAULT_ENVELOPE_GAP = 16
const DEFAULT_MIN_CARD_WIDTH = 64
const DEFAULT_MAX_CARD_WIDTH = 188

function constrainedWidth(
  safeSize: number,
  slotCount: number,
  gap: number,
  focusScale: number,
  badgeOverflowPx: number,
): number {
  const slots = Math.max(1, Math.floor(slotCount))
  // Original envelope constraint (slots fit edge-to-edge with gaps).
  const original = (Math.max(0, safeSize) - (slots - 1) * gap) / slots

  if (focusScale <= 1 && badgeOverflowPx <= 0) {
    return original
  }

  // Focus constraint: outer cards may scale up and badge may overhang.
  // halfSpan + (cardSize/2 + badgeOverflow) * focusScale <= safeSize/2
  // Solving for cardWidth gives:
  // cardWidth <= (safeSize - (slots-1)*gap - 2*badgeOverflowPx*focusScale) / (slots - 1 + focusScale)
  const numerator = safeSize - (slots - 1) * gap - 2 * badgeOverflowPx * focusScale
  const denominator = slots - 1 + focusScale
  if (numerator <= 0 || denominator <= 0) return 0
  const focused = numerator / denominator
  return Math.min(original, focused)
}

/**
 * Resolve the maximum card size that keeps every animation frame inside the safe frame,
 * including the focused reveal state and badge overflow.
 */
export function resolveCardSize(input: CardSizeInput): CardEnvelope {
  const {
    safeWidth,
    safeHeight,
    cardAspectRatio,
    gap = DEFAULT_ENVELOPE_GAP,
    minCardWidth = DEFAULT_MIN_CARD_WIDTH,
    maxCardWidth = DEFAULT_MAX_CARD_WIDTH,
    focusScale = 1,
    badgeOverflowPx = 0,
  } = input

  const hSlots = Math.max(1, Math.floor(input.horizontalSlots))
  const vSlots = Math.max(1, Math.floor(input.verticalSlots))

  const widthFromHorizontal = constrainedWidth(safeWidth, hSlots, gap, focusScale, badgeOverflowPx)
  const heightFromVertical = constrainedWidth(safeHeight, vSlots, gap, focusScale, badgeOverflowPx)
  const widthFromVertical = heightFromVertical / Math.max(cardAspectRatio, 0.0001)

  let cardWidth = Math.min(widthFromHorizontal, widthFromVertical)
  cardWidth = Math.max(minCardWidth, Math.min(cardWidth, maxCardWidth))
  const cardHeight = cardWidth * cardAspectRatio

  const slotPitchX = cardWidth + gap
  const slotPitchY = cardHeight + gap

  return {
    cardWidth,
    cardHeight,
    gap,
    horizontalSlots: hSlots,
    verticalSlots: vSlots,
    slotPitchX,
    slotPitchY,
    halfSpanX: ((hSlots - 1) * slotPitchX) / 2,
    halfSpanY: ((vSlots - 1) * slotPitchY) / 2,
    fullSpanX: hSlots * cardWidth + (hSlots - 1) * gap,
    fullSpanY: vSlots * cardHeight + (vSlots - 1) * gap,
  }
}
