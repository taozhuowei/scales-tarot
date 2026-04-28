/**
 * Name: core/layout/result_layout_resolver
 * Purpose: resolve card layouts for the result stage.
 * Reason: isolate result-stage layout rules into a single pure module.
 * Data flow: spread slots + safe frame + card size flow in; positioned cards flow out.
 */

import type { SafeFrame } from '../viewport/types'
import type { CardSize } from '../sizing/types'
import type { SpreadSlot, CardLayout } from './types'
import { clamp } from './card_position_calculator'

export interface ResultLayoutResult {
  cards: CardLayout[]
  stageShiftY: number
}

export function resolveResultLayout(
  spreadId: string,
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number = 0,
  zIndexes?: Record<string, number>,
): ResultLayoutResult {
  switch (spreadId) {
    case 'single_card':
      return resolveSingleCardResult(slots, safeFrame, cardSize, headerHeight, zIndexes)
    case 'three_card':
      return resolveThreeCardResult(slots, safeFrame, cardSize, headerHeight, zIndexes)
    case 'cross_spread':
      return resolveCrossSpreadResult(slots, safeFrame, cardSize, headerHeight, zIndexes)
    default:
      return resolveGenericResult(slots, safeFrame, cardSize, headerHeight, zIndexes)
  }
}

function resolveGenericResult(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number,
  zIndexes?: Record<string, number>,
): ResultLayoutResult {
  const { height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize

  const maxSlotY = Math.max(...slots.map(s => s.y), 0)
  const minSlotY = Math.min(...slots.map(s => s.y), 0)
  const halfLayoutHeight = (maxSlotY - minSlotY) / 2 + cardHeight / 2

  const vMargin = Math.max(cardHeight * 0.08, 12)
  const minCenterY = -containerHeight / 2 + halfLayoutHeight + vMargin
  const maxCenterY = containerHeight / 2 - halfLayoutHeight - vMargin
  const targetCenterY = headerHeight / 2
  const centerY = clamp(targetCenterY, minCenterY, maxCenterY)

  return {
    cards: slots.map((slot, index) => ({
      slotId: slot.slotId,
      x: slot.x,
      y: slot.y + centerY,
      width: cardWidth,
      height: cardHeight,
      rotateDeg: 0,
      zIndex: zIndexes?.[slot.slotId] ?? (20 + index),
    })),
    stageShiftY: 0,
  }
}

function resolveSingleCardResult(
  _slots: SpreadSlot[],
  _safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number,
  zIndexes?: Record<string, number>,
): ResultLayoutResult {
  return {
    cards: [{
      slotId: 'center',
      x: 0,
      y: headerHeight / 2,
      width: cardSize.width,
      height: cardSize.height,
      rotateDeg: 0,
      zIndex: zIndexes?.center ?? 20,
    }],
    stageShiftY: 0,
  }
}

function resolveThreeCardResult(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number,
  zIndexes?: Record<string, number>,
): ResultLayoutResult {
  const { width: containerWidth, height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize
  const slotPitchX = cardWidth + cardSize.gap
  const slotPitchY = cardHeight + cardSize.gap
  const hMargin = Math.max(cardWidth * 0.08, 12)
  const vMargin = Math.max(cardHeight * 0.06, 12)
  const maxCenterX = Math.max(0, containerWidth / 2 - cardWidth / 2 - hMargin)
  const minCenterY = -containerHeight / 2 + cardHeight / 2 + vMargin
  const maxCenterY = containerHeight / 2 - cardHeight / 2 - vMargin
  const isWide = slots.length >= 3 && Math.abs(slots[0].x) > Math.abs(slots[0].y)

  if (isWide) {
    const sideOffset = Math.min(slotPitchX, maxCenterX)
    const centeredRowY = clamp(0, minCenterY, maxCenterY)

    return {
      cards: [
        { slotId: 'past', x: -sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.past ?? 20 },
        { slotId: 'present', x: 0, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.present ?? 21 },
        { slotId: 'future', x: sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.future ?? 22 },
      ],
      stageShiftY: 0,
    }
  }

  const verticalAvailable = Math.max(0, (containerHeight / 2 - cardHeight / 2) - vMargin)
  const verticalSpread = Math.min(slotPitchY, verticalAvailable)
  const targetCenterY = headerHeight / 2
  const mobileCenterY = clamp(targetCenterY, minCenterY + verticalSpread, maxCenterY - verticalSpread)

  return {
    cards: [
      { slotId: 'past', x: 0, y: mobileCenterY + verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.past ?? 20 },
      { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.present ?? 21 },
      { slotId: 'future', x: 0, y: mobileCenterY - verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.future ?? 22 },
    ],
    stageShiftY: 0,
  }
}

function resolveCrossSpreadResult(
  _slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number,
  zIndexes?: Record<string, number>,
): ResultLayoutResult {
  const { width: containerWidth, height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize
  const slotPitchX = cardWidth + cardSize.gap
  const slotPitchY = cardHeight + cardSize.gap

  // Adaptive spacing: ensure card centers + half-cards + margin fit in container
  const hMargin = Math.max(cardWidth * 0.05, 8)
  const vMargin = Math.max(cardHeight * 0.05, 8)
  
  const hOffset = Math.min(slotPitchX, Math.max(0, containerWidth / 2 - cardWidth / 2 - hMargin))
  const vOffset = Math.min(slotPitchY, Math.max(0, containerHeight / 2 - cardHeight / 2 - vMargin))
  
  const centerY = clamp(headerHeight / 2, -containerHeight * 0.05, containerHeight * 0.05)

  return {
    cards: [
      { slotId: 'center', x: 0, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.center ?? 25 },
      { slotId: 'north', x: 0, y: centerY - vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.north ?? 24 },
      { slotId: 'south', x: 0, y: centerY + vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.south ?? 24 },
      { slotId: 'west', x: -hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.west ?? 24 },
      { slotId: 'east', x: hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: zIndexes?.east ?? 24 },
    ],
    stageShiftY: 0,
  }
}

