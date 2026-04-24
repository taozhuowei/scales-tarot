/**
 * Name: core/sizing/single_card_size_solver
 * Purpose: single-card spread dedicated size calculator.
 * Reason: implement "short-side sizing" with safety bounds to prevent screen overflow.
 */

import type { SafeFrame } from '../viewport/types'
import type { CardSize } from './types'
import {
  CARD_ASPECT_RATIO,
  DEFAULT_ENVELOPE_GAP,
  SINGLE_CARD_MAX_WIDTH,
  SINGLE_CARD_MIN_WIDTH,
  SINGLE_CARD_BASELINE_SAFE_WIDTH,
  SINGLE_CARD_BASELINE_SAFE_HEIGHT,
  SINGLE_CARD_BASELINE_FILL_RATIO,
} from '../config/layout_constants'

export interface SingleCardSizeInput {
  safeFrame: SafeFrame
}

export function resolveSingleCardSize(input: SingleCardSizeInput): CardSize {
  const { safeFrame } = input
  const ratio = CARD_ASPECT_RATIO

  // Baseline design: iPhone 14 Pro Max safe-frame.
  const baselineWidth =
    (SINGLE_CARD_BASELINE_SAFE_HEIGHT * SINGLE_CARD_BASELINE_FILL_RATIO) / ratio
  const scale = safeFrame.width / SINGLE_CARD_BASELINE_SAFE_WIDTH

  const scaleBased = baselineWidth * scale
  const heightBased =
    (safeFrame.height * SINGLE_CARD_BASELINE_FILL_RATIO) / ratio

  const cardWidth = Math.max(
    SINGLE_CARD_MIN_WIDTH,
    Math.min(Math.max(scaleBased, heightBased), SINGLE_CARD_MAX_WIDTH),
  )

  return {
    width: cardWidth,
    height: cardWidth * ratio,
    gap: DEFAULT_ENVELOPE_GAP,
  }
}
