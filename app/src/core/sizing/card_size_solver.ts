/**
 * Name: core/sizing/card_size_solver
 * Purpose: compute the maximum safe card size and gap inside a safe frame.
 * Reason: isolate sizing algebra into a single pure module with no external state.
 */

import type { CardSize, SpreadEnvelopeRequirement } from './types'
import type { SafeFrame } from '../viewport/types'

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

export interface CardSizeInput {
  safeFrame: SafeFrame
  cardAspectRatio: number
  requirement: SpreadEnvelopeRequirement
  gap?: number
  minCardWidth?: number
  maxCardWidth?: number
  /** Focus scale applied during reveal (e.g. 1.42 narrow, 1.2 wide). */
  focusScale?: number
  /** Badge overflow in px beyond card edge (e.g. 12rpx converted to px). */
  badgeOverflowPx?: number
}

/**
 * Resolve the maximum card size that keeps every animation frame inside the safe frame,
 * including the focused reveal state and badge overflow.
 */
export function resolveCardSize(input: CardSizeInput): CardSize {
  const {
    safeFrame,
    cardAspectRatio,
    requirement,
    gap = DEFAULT_ENVELOPE_GAP,
    minCardWidth = DEFAULT_MIN_CARD_WIDTH,
    maxCardWidth = DEFAULT_MAX_CARD_WIDTH,
    focusScale = 1,
    badgeOverflowPx = 0,
  } = input

  const hSlots = Math.max(1, Math.floor(requirement.horizontalSlots))
  const vSlots = Math.max(1, Math.floor(requirement.verticalSlots))

  const widthFromHorizontal = constrainedWidth(safeFrame.width, hSlots, gap, focusScale, badgeOverflowPx)
  const heightFromVertical = constrainedWidth(safeFrame.height, vSlots, gap, focusScale, badgeOverflowPx)
  const widthFromVertical = heightFromVertical / Math.max(cardAspectRatio, 0.0001)

  let cardWidth = Math.min(widthFromHorizontal, widthFromVertical)
  cardWidth = Math.max(minCardWidth, Math.min(cardWidth, maxCardWidth))
  const cardHeight = cardWidth * cardAspectRatio

  return {
    width: cardWidth,
    height: cardHeight,
    gap,
  }
}
