/**
 * Name: card_size_solver
 * Purpose: compute the maximum safe card size and gap using safe frame, spread spec,
 *   animation envelope, focus scale, and badge expansion.
 * Reason: single source of truth for card sizing so layout, shuffle, cut, and focus
 *   states all agree on the same bounds and no frame can overflow.
 * Data flow: safe frame + envelope requirement + focus/badge params flow in;
 *   card size, gap, and slot pitches flow out.
 */

// TODO: phase1 migration shim — this file delegates to core/sizing modules
// and augments the result with legacy CardEnvelope fields.

import type { CardEnvelope } from './spread_spec'
import {
  resolveCardSize as resolveCoreCardSize,
  DEFAULT_ENVELOPE_GAP,
} from '../../core/sizing/card_size_solver'
import type { CardSizeInput as CoreCardSizeInput } from '../../core/sizing/card_size_solver'
import type { SafeFrame } from '../../core/viewport/types'

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

const DEFAULT_MIN_CARD_WIDTH = 64
const DEFAULT_MAX_CARD_WIDTH = 188

export { DEFAULT_ENVELOPE_GAP }

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

  const safeFrame: SafeFrame = {
    x: 0,
    y: 0,
    width: safeWidth,
    height: safeHeight,
    centerX: 0,
    centerY: 0,
    bottomInset: 0,
  }

  const coreInput: CoreCardSizeInput = {
    safeFrame,
    cardAspectRatio,
    requirement: {
      horizontalSlots: hSlots,
      verticalSlots: vSlots,
    },
    gap,
    minCardWidth,
    maxCardWidth,
    focusScale,
    badgeOverflowPx,
  }

  const coreSize = resolveCoreCardSize(coreInput)
  const cardWidth = coreSize.width
  const cardHeight = coreSize.height

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
