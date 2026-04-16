/**
 * Name: motion_metrics
 * Purpose: resolve shuffle spread, cut spacing, safe motion extents, and animation distances.
 * Reason: all motion bounds must come from the same safe-frame + card-size source.
 * Data flow: safe frame + spread id + config flow in; concrete distances flow out.
 */

import type { OverlaySafeFrame } from './overlay_safe_frame'
import type { CardEnvelope, SpreadId } from './spread_spec'
import { getBuiltInEnvelopeRequirement } from './spread_spec'
import { resolveCardSize } from './card_size_solver'

export type CutAxis = 'horizontal' | 'vertical'

export interface MotionMetricsInput {
  safeFrame: OverlaySafeFrame
  cardAspectRatio: number
  spreadId: SpreadId
  isWide: boolean
  cutPileCount: number
  deckCount: number
  focusScale?: number
  badgeOverflowPx?: number
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Resolve every distance the overlay's animations need from the single safe frame.
 */
export function resolveMotionMetrics(input: MotionMetricsInput): MotionMetrics {
  const { safeFrame, cardAspectRatio, spreadId, isWide, cutPileCount, deckCount, focusScale, badgeOverflowPx } = input
  const { width: safeWidth, height: safeHeight } = safeFrame

  const spreadRequirement = getBuiltInEnvelopeRequirement(spreadId, isWide)
  const cutAxis: CutAxis = isWide ? 'horizontal' : 'vertical'
  const cutHorizontalSlots = cutAxis === 'horizontal' ? Math.max(cutPileCount, 1) : 1
  const cutVerticalSlots = cutAxis === 'vertical' ? Math.max(cutPileCount, 1) : 1

  const envelope = resolveCardSize({
    safeWidth,
    safeHeight,
    cardAspectRatio,
    horizontalSlots: Math.max(spreadRequirement.horizontalSlots, cutHorizontalSlots),
    verticalSlots: Math.max(spreadRequirement.verticalSlots, cutVerticalSlots),
    focusScale,
    badgeOverflowPx,
  })

  const { cardWidth, cardHeight, gap, slotPitchX, slotPitchY } = envelope
  const safeHalfWidth = safeWidth / 2
  const safeHalfHeight = safeHeight / 2

  // Shuffle spread
  const shuffleEdgeMargin = 12
  const minShuffleSpread = slotPitchX / 2
  const maxShuffleSpread = Math.max(minShuffleSpread, safeHalfWidth - cardWidth / 2 - shuffleEdgeMargin)
  const targetShuffleSpread = cardWidth + gap
  const shuffleSpreadX = clamp(targetShuffleSpread, minShuffleSpread, maxShuffleSpread)

  // Cut pile spacing
  const pilesAlongAxis = Math.max(1, cutPileCount)
  const cutAxisAvailable = cutAxis === 'horizontal' ? safeWidth : safeHeight
  const cutAxisCardSize = cutAxis === 'horizontal' ? cardWidth : cardHeight
  const minPileSpacing = cutAxis === 'horizontal' ? slotPitchX : slotPitchY
  const cutAxisSlackEachSide = (cutAxisAvailable - cutAxisCardSize) / 2
  const maxPileSpacing = pilesAlongAxis > 1
    ? Math.max(minPileSpacing, (cutAxisAvailable - cutAxisCardSize) / (pilesAlongAxis - 1) - 4)
    : minPileSpacing
  const targetPileSpacing = cutAxisCardSize + Math.min(gap * 1.4, cutAxisSlackEachSide / 4 + gap)
  const cutPileSpacing = clamp(targetPileSpacing, minPileSpacing, maxPileSpacing)

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
