/**
 * Name: motion_metrics
 * Purpose: resolve shuffle spread, cut spacing, safe motion extents, and animation distances.
 * Reason: all motion bounds must come from the same safe-frame + card-size source.
 * Data flow: safe frame + spread id + config flow in; concrete distances flow out.
 */

import type { SafeFrame } from '../../core/viewport/types'
import type { CardEnvelope, SpreadId } from './spread_spec'
import { getBaseEnvelopeRequirement } from './spread_spec'
import { resolveCardSize } from '../../core/sizing/card_size_solver'
import { SHUFFLE_EDGE_MARGIN } from '../../core/config/layout_constants'

export type CutAxis = 'horizontal' | 'vertical'

export interface MotionMetricsInput {
  safeFrame: SafeFrame
  cardAspectRatio: number
  spreadId: SpreadId
  isWide: boolean
  cutPileCount: number
  deckCount: number
}

export interface MotionMetrics {
  envelope: CardEnvelope
  cardWidth: number
  cardHeight: number
  gap: number
  safeHalfWidth: number
  safeHalfHeight: number
  shuffleSpreadX: number
  cutPileSpacing: number
  cutAxis: CutAxis
  cardsPerPile: number
  cutLeadingOffset: { x: number; y: number }
  cutTrailingOffset: { x: number; y: number }
}

import { clamp } from '../math'

/**
 * Resolve every distance the overlay's animations need from the single safe frame.
 */
export function resolveMotionMetrics(input: MotionMetricsInput): MotionMetrics {
  const { safeFrame, cardAspectRatio, isWide, cutPileCount, deckCount } = input
  const { width: safeWidth, height: safeHeight } = safeFrame

  // CRITICAL: Animations (Shuffle/Cut) MUST use the process-stage BASE requirement (3 slots)
  // to ensure they match the physical card dimensions used in those phases.
  const baseRequirement = getBaseEnvelopeRequirement(isWide)
  const cutAxis: CutAxis = isWide ? 'horizontal' : 'vertical'

  // Card size: unified solver based on the 3-slot base requirement.
  const size = resolveCardSize({
    safeFrame,
    cardAspectRatio,
    requirement: baseRequirement,
  })
  
  const { width: cardWidth, height: cardHeight, gap } = size
  const slotPitchX = cardWidth + gap
  const slotPitchY = cardHeight + gap
  const safeHalfWidth = safeWidth / 2
  const safeHalfHeight = safeHeight / 2

  const hSlots = Math.max(baseRequirement.horizontalSlots, isWide ? cutPileCount : 1)
  const vSlots = Math.max(baseRequirement.verticalSlots, isWide ? 1 : cutPileCount)
  
  const envelope: CardEnvelope = {
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

  // Shuffle spread
  const shuffleEdgeMargin = SHUFFLE_EDGE_MARGIN
  const minShuffleSpread = slotPitchX / 2
  const maxShuffleSpread = Math.max(minShuffleSpread, safeHalfWidth - cardWidth / 2 - shuffleEdgeMargin)
  const targetShuffleSpread = cardWidth + gap
  const shuffleSpreadX = clamp(targetShuffleSpread, minShuffleSpread, maxShuffleSpread)

  // Cut pile spacing
  const pilesAlongAxis = Math.max(1, cutPileCount)
  const cutAxisCardSize = cutAxis === 'horizontal' ? cardWidth : cardHeight
  
  // Fixed Spacing: pitch must be card dimension + gap to prevent overlap.
  const cutPileSpacing = cutAxisCardSize + gap

  const halfRange = ((pilesAlongAxis - 1) / 2) * cutPileSpacing
  const cutLeadingOffset = cutAxis === 'horizontal'
    ? { x: -halfRange, y: 0 }
    : { x: 0, y: -halfRange }
  const cutTrailingOffset = cutAxis === 'horizontal'
    ? { x: halfRange, y: 0 }
    : { x: 0, y: halfRange }

  const cardsPerPile = Math.max(1, Math.floor(Math.max(1, deckCount) / pilesAlongAxis))

  return {
    envelope,
    cardWidth,
    cardHeight,
    gap,
    safeHalfWidth,
    safeHalfHeight,
    shuffleSpreadX,
    cutPileSpacing,
    cutAxis,
    cardsPerPile,
    cutLeadingOffset,
    cutTrailingOffset,
  }
}

/**
 * Compute the resting position (centre) of a single cut pile within the cut layout.
 */
export function getCutPileRestPosition(
  pileIndex: number,
  pileCount: number,
  pileSpacing: number,
  axis: CutAxis,
): { x: number; y: number } {
  const offset = (pileIndex - (pileCount - 1) / 2) * pileSpacing
  return axis === 'horizontal' ? { x: offset, y: 0 } : { x: 0, y: offset }
}
