/**
 * Name: motion_metrics
 * Purpose: resolve shuffle spread, cut spacing, safe motion extents, and animation distances.
 * Reason: all motion bounds must come from the same safe-frame + card-size source.
 * Data flow: safe frame + spread id + config flow in; concrete distances flow out.
 */

import type { SafeFrame } from '../../core/viewport/types'
import type { CardEnvelope, SpreadId } from './spread_spec'
import { getBuiltInEnvelopeRequirement } from './spread_spec'
import { resolveCardSize } from '../../core/sizing/card_size_solver'
import { resolveSingleCardSize } from '../../core/sizing/single_card_size_solver'
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
  const { safeFrame, cardAspectRatio, spreadId, isWide, cutPileCount, deckCount } = input
  const { width: safeWidth, height: safeHeight } = safeFrame

  const spreadRequirement = getBuiltInEnvelopeRequirement(spreadId, isWide)
  const cutAxis: CutAxis = isWide ? 'horizontal' : 'vertical'
  const cutHorizontalSlots = cutAxis === 'horizontal' ? Math.max(cutPileCount, 1) : 1
  const cutVerticalSlots = cutAxis === 'vertical' ? Math.max(cutPileCount, 1) : 1

  // Card size: single-card uses its own dedicated solver; multi-card spreads
  // continue to use the envelope-based solver.
  let envelope: CardEnvelope
  if (spreadId === 'single_card') {
    const singleSize = resolveSingleCardSize({ safeFrame })
    const { width: cw, height: ch, gap: g } = singleSize
    const spx = cw + g
    const spy = ch + g
    const hSlots = Math.max(1, cutHorizontalSlots)
    const vSlots = Math.max(1, cutVerticalSlots)
    envelope = {
      cardWidth: cw,
      cardHeight: ch,
      gap: g,
      horizontalSlots: hSlots,
      verticalSlots: vSlots,
      slotPitchX: spx,
      slotPitchY: spy,
      halfSpanX: ((hSlots - 1) * spx) / 2,
      halfSpanY: ((vSlots - 1) * spy) / 2,
      fullSpanX: hSlots * cw + (hSlots - 1) * g,
      fullSpanY: vSlots * ch + (vSlots - 1) * g,
    }
  } else {
    const size = resolveCardSize({
      safeFrame,
      cardAspectRatio,
      requirement: spreadRequirement,
    })
    const { width: cw, height: ch, gap: g } = size
    const spx = cw + g
    const spy = ch + g
    const hSlots = Math.max(spreadRequirement.horizontalSlots, cutHorizontalSlots)
    const vSlots = Math.max(spreadRequirement.verticalSlots, cutVerticalSlots)
    envelope = {
      cardWidth: cw,
      cardHeight: ch,
      gap: g,
      horizontalSlots: hSlots,
      verticalSlots: vSlots,
      slotPitchX: spx,
      slotPitchY: spy,
      halfSpanX: ((hSlots - 1) * spx) / 2,
      halfSpanY: ((vSlots - 1) * spy) / 2,
      fullSpanX: hSlots * cw + (hSlots - 1) * g,
      fullSpanY: vSlots * ch + (vSlots - 1) * g,
    }
  }

  const { cardWidth, cardHeight, gap } = envelope
  const slotPitchX = cardWidth + gap
  const slotPitchY = cardHeight + gap
  const safeHalfWidth = safeWidth / 2
  const safeHalfHeight = safeHeight / 2

  // Shuffle spread
  const shuffleEdgeMargin = SHUFFLE_EDGE_MARGIN
  const minShuffleSpread = slotPitchX / 2
  const maxShuffleSpread = Math.max(minShuffleSpread, safeHalfWidth - cardWidth / 2 - shuffleEdgeMargin)
  const targetShuffleSpread = cardWidth + gap
  const shuffleSpreadX = clamp(targetShuffleSpread, minShuffleSpread, maxShuffleSpread)

  // Cut pile spacing
  const pilesAlongAxis = Math.max(1, cutPileCount)
  const cutAxisCardSize = cutAxis === 'horizontal' ? cardWidth : cardHeight
  
  // 固定间距：无论屏幕多大，移动距离仅为牌的尺寸 + 卡牌间距常量 (gap)
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
    envelope: {
      cardWidth,
      cardHeight,
      gap,
      horizontalSlots: Math.max(spreadRequirement.horizontalSlots, cutHorizontalSlots),
      verticalSlots: Math.max(spreadRequirement.verticalSlots, cutVerticalSlots),
      slotPitchX,
      slotPitchY,
      halfSpanX: ((Math.max(spreadRequirement.horizontalSlots, cutHorizontalSlots) - 1) * slotPitchX) / 2,
      halfSpanY: ((Math.max(spreadRequirement.verticalSlots, cutVerticalSlots) - 1) * slotPitchY) / 2,
      fullSpanX: Math.max(spreadRequirement.horizontalSlots, cutHorizontalSlots) * cardWidth + (Math.max(spreadRequirement.horizontalSlots, cutHorizontalSlots) - 1) * gap,
      fullSpanY: Math.max(spreadRequirement.verticalSlots, cutVerticalSlots) * cardHeight + (Math.max(spreadRequirement.verticalSlots, cutVerticalSlots) - 1) * gap,
    },
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
