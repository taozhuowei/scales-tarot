/**
 * Name: core/sizing/card_size_solver
 * Purpose: compute card size based on the viewport's short side with safety limits.
 * Reason: implement "short-side sizing" with safety bounds to prevent screen overflow.
 */

import type { CardSize, SpreadEnvelopeRequirement } from './types'
import type { SafeFrame } from '../viewport/types'

import { DEFAULT_ENVELOPE_GAP, MIN_CARD_WIDTH, MAX_CARD_WIDTH, CARD_SIZE_FILL_RATIO } from '../config/layout_constants'

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
 * Short-side fill ratio: cards occupy 85% of the short dimension,
 * leaving safety margins for UI elements and animations.
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

  const isPortrait = safeFrame.width <= safeFrame.height

  let cardWidth: number

  if (isPortrait) {
    // Fit to width: cardWidth * hSlots + gap * (hSlots - 1) = safeFrame.width * fillRatio
    cardWidth = ((Math.max(0, safeFrame.width) - (hSlots - 1) * gap) / hSlots) * CARD_SIZE_FILL_RATIO
  } else {
    // Fit to height: cardHeight * vSlots + gap * (vSlots - 1) = safeFrame.height * fillRatio
    const cardHeight = ((Math.max(0, safeFrame.height) - (vSlots - 1) * gap) / vSlots) * CARD_SIZE_FILL_RATIO
    cardWidth = cardHeight / Math.max(cardAspectRatio, 0.0001)
  }

  // Apply absolute limits
  cardWidth = Math.max(minCardWidth, Math.min(cardWidth, maxCardWidth))
  const cardHeight = cardWidth * cardAspectRatio

  return {
    width: cardWidth,
    height: cardHeight,
    gap,
  }
}
