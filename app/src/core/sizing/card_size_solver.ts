/**
 * Name: core/sizing/card_size_solver
 * Purpose: compute card size by subtracting all known physical reservations
 *          (edge margins, inter-card gaps) from the safe frame and dividing
 *          the remainder evenly across slots.
 * Reason: every reservation is a concrete pixel value with a physical meaning,
 *         no fill ratios or magic percentages. The result is "as large as
 *         possible while still fitting".
 */

import type { CardSize, SpreadEnvelopeRequirement } from './types'
import type { SafeFrame } from '../viewport/types'

import { DEFAULT_ENVELOPE_GAP, MIN_CARD_WIDTH, MAX_CARD_WIDTH } from '../config/layout_constants'

export { DEFAULT_ENVELOPE_GAP }

export interface CardSizeInput {
  safeFrame: SafeFrame
  cardAspectRatio: number
  requirement: SpreadEnvelopeRequirement
  gap?: number
  minCardWidth?: number
  maxCardWidth?: number
}

/**
 * The safe frame is partitioned into:
 *   - 2 edge margins (one each side, equal to `gap` for visual consistency)
 *   - (slots-1) inter-card gaps
 *   - `slots` card faces
 *
 * On each axis: total margin pixels = (slots + 1) * gap.
 * Solve for cardWidth on both axes and take the smaller.
 */
export function resolveCardSize(input: CardSizeInput): CardSize {
  const {
    safeFrame,
    cardAspectRatio,
    requirement,
    gap = DEFAULT_ENVELOPE_GAP,
    minCardWidth = MIN_CARD_WIDTH,
    maxCardWidth = MAX_CARD_WIDTH,
  } = input

  const hSlots = Math.max(1, Math.floor(requirement.horizontalSlots))
  const vSlots = Math.max(1, Math.floor(requirement.verticalSlots))
  const ratio = Math.max(0.1, cardAspectRatio)

  const safeW = Math.max(0, safeFrame.width)
  const safeH = Math.max(0, safeFrame.height)

  const widthAvailable = safeW - (hSlots + 1) * gap
  const heightAvailable = safeH - (vSlots + 1) * gap

  const widthBound = widthAvailable / hSlots
  const heightBound = heightAvailable / vSlots / ratio

  let cardWidth = Math.min(widthBound, heightBound)
  cardWidth = Math.max(minCardWidth, Math.min(cardWidth, maxCardWidth))
  const cardHeight = cardWidth * ratio

  return {
    width: cardWidth,
    height: cardHeight,
    gap,
  }
}
