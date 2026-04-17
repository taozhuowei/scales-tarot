/**
 * Name: core/layout/draw_layout_resolver
 * Purpose: resolve card layouts for the draw stage.
 * Reason: isolate draw-stage layout rules into a single pure module.
 * Data flow: spread slots + safe frame + card size flow in; positioned cards flow out.
 */

import type { SafeFrame } from '../viewport/types'
import type { CardSize } from '../sizing/types'
import type { SpreadSlot, CardLayout } from './types'
import { clamp } from './card_position_calculator'

export interface DrawLayoutResult {
  cards: CardLayout[]
  stageShiftY: number
}

export function resolveDrawLayout(
  spreadId: string,
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number = 0,
): DrawLayoutResult {
  switch (spreadId) {
    case 'single_card':
      return resolveSingleCardDraw(slots, safeFrame, cardSize)
    case 'three_card':
      return resolveThreeCardDraw(slots, safeFrame, cardSize, headerHeight)
    case 'cross_spread':
      return resolveCrossSpreadDraw(slots, safeFrame, cardSize, headerHeight)
    default:
      return resolveGenericDraw(slots, cardSize)
  }
}

function resolveGenericDraw(slots: SpreadSlot[], cardSize: CardSize): DrawLayoutResult {
  return {
    cards: slots.map((slot, index) => ({
      slotId: slot.slotId,
      x: slot.x,
      y: slot.y,
      width: cardSize.width,
      height: cardSize.height,
      rotateDeg: 0,
      zIndex: 20 + index,
    })),
    stageShiftY: 0,
  }
}

function resolveSingleCardDraw(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
): DrawLayoutResult {
  const { height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize
  const vMargin = Math.max(cardHeight * 0.05, 8)
  const minCenterY = -containerHeight / 2 + cardHeight / 2 + vMargin
  const maxCenterY = containerHeight / 2 - cardHeight / 2 - vMargin
  const centerY = (minCenterY <= maxCenterY) ? clamp(0, minCenterY, maxCenterY) : 0

  return {
    cards: slots.map(slot => ({
      slotId: slot.slotId,
      x: 0,
      y: centerY,
      width: cardWidth,
      height: cardHeight,
      rotateDeg: 0,
      zIndex: 20,
    })),
    stageShiftY: centerY,
  }
}

function resolveThreeCardDraw(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  _headerHeight: number,
): DrawLayoutResult {
  const { width: containerWidth, height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize
  const slotPitchX = cardWidth + cardSize.gap
  const slotPitchY = cardHeight + cardSize.gap
  const isWide = slots.length >= 3 && Math.abs(slots[0].x) > Math.abs(slots[0].y)

  if (isWide) {
    const hMargin = Math.max(cardWidth * 0.05, 8)
    const vMargin = Math.max(cardHeight * 0.05, 8)
    const maxCenterX = containerWidth / 2 - cardWidth / 2 - hMargin
    const sideOffset = Math.min(slotPitchX, maxCenterX)
    const minCenterY = -containerHeight / 2 + cardHeight / 2 + vMargin
    const maxCenterY = containerHeight / 2 - cardHeight / 2 - vMargin
    const centerY = (minCenterY <= maxCenterY) ? clamp(0, minCenterY, maxCenterY) : 0

    return {
      cards: [
        { slotId: 'past', x: -sideOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
        { slotId: 'present', x: 0, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
        { slotId: 'future', x: sideOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
      ],
      stageShiftY: centerY,
    }
  }

  const vMargin = Math.max(cardHeight * 0.05, 8)
  const halfGroupH = slotPitchY + cardHeight / 2
  const minCenterY = -containerHeight / 2 + halfGroupH + vMargin
  const maxCenterY = containerHeight / 2 - halfGroupH - vMargin
  const centerY = (minCenterY <= maxCenterY) ? clamp(0, minCenterY, maxCenterY) : 0

  return {
    cards: [
      { slotId: 'past', x: 0, y: centerY + slotPitchY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
      { slotId: 'present', x: 0, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
      { slotId: 'future', x: 0, y: centerY - slotPitchY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
    ],
    stageShiftY: centerY,
  }
}

function resolveCrossSpreadDraw(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  _headerHeight: number,
): DrawLayoutResult {
  const { height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize
  const slotPitchX = cardWidth + cardSize.gap
  const slotPitchY = cardHeight + cardSize.gap
  const vMargin = Math.max(cardHeight * 0.05, 8)
  const halfGroupH = slotPitchY + cardHeight / 2
  const minCenterY = -containerHeight / 2 + halfGroupH + vMargin
  const maxCenterY = containerHeight / 2 - halfGroupH - vMargin
  const centerY = (minCenterY <= maxCenterY) ? clamp(0, minCenterY, maxCenterY) : 0

  return {
    cards: [
      { slotId: 'center', x: 0, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
      { slotId: 'north', x: 0, y: centerY - slotPitchY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'south', x: 0, y: centerY + slotPitchY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'west', x: -slotPitchX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'east', x: slotPitchX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    ],
    stageShiftY: centerY,
  }
}
