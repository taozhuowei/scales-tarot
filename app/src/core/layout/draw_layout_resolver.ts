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
  const liftY = Math.min(containerHeight * 0.12, cardHeight * 0.3)
  const stageShiftY = liftY
  const minCenterY = -containerHeight / 2 + cardHeight / 2
  const maxCenterY = containerHeight / 2 - cardHeight / 2
  const centerY = clamp(liftY, minCenterY, maxCenterY)

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
    stageShiftY,
  }
}

function resolveThreeCardDraw(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number,
): DrawLayoutResult {
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
    const liftY = Math.min(containerHeight * 0.32, cardHeight * 1.26)
    const centeredRowY = clamp(liftY, minCenterY, maxCenterY)

    return {
      cards: [
        { slotId: 'past', x: -sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
        { slotId: 'present', x: 0, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
        { slotId: 'future', x: sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
      ],
      stageShiftY: liftY,
    }
  }

  const verticalAvailable = Math.max(0, (containerHeight / 2 - cardHeight / 2) - vMargin)
  const verticalSpread = Math.min(slotPitchY, verticalAvailable)
  const liftY = Math.min(containerHeight * 0.16, cardHeight * 0.56)
  const targetCenterY = Math.max(liftY, liftY + headerHeight / 2 + 60 - containerHeight * 0.29)
  const mobileCenterY = clamp(targetCenterY, minCenterY + verticalSpread, maxCenterY - verticalSpread)

  return {
    cards: [
      { slotId: 'past', x: 0, y: mobileCenterY + verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
      { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
      { slotId: 'future', x: 0, y: mobileCenterY - verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
    ],
    stageShiftY: liftY,
  }
}

function resolveCrossSpreadDraw(
  slots: SpreadSlot[],
  safeFrame: SafeFrame,
  cardSize: CardSize,
  headerHeight: number,
): DrawLayoutResult {
  const { height: containerHeight } = safeFrame
  const { width: cardWidth, height: cardHeight } = cardSize
  const slotPitchX = cardWidth + cardSize.gap
  const slotPitchY = cardHeight + cardSize.gap
  const isWide = slots.length >= 4 && Math.abs(slots[3].x) > Math.abs(slots[3].y)
  const liftY = isWide
    ? Math.min(containerHeight * 0.28, cardHeight)
    : Math.min(containerHeight * 0.12, cardHeight * 0.4)
  const hOffset = slotPitchX
  const vOffset = slotPitchY
  const maxCenterShift = Math.max(0, containerHeight / 2 - vOffset - cardHeight / 2)

  let centerY: number
  if (!isWide) {
    const targetCenterY = liftY + headerHeight / 2 + 60 - containerHeight * 0.29
    centerY = clamp(targetCenterY, -maxCenterShift, maxCenterShift)
    const minNorthY = -containerHeight / 2 + cardHeight / 2 + headerHeight + 8
    const northY = centerY - vOffset
    if (northY < minNorthY) {
      centerY = minNorthY + vOffset
    }
  } else {
    centerY = clamp(liftY * 0.5, -maxCenterShift, maxCenterShift)
  }

  return {
    cards: [
      { slotId: 'center', x: 0, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
      { slotId: 'north', x: 0, y: centerY - vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'south', x: 0, y: centerY + vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'west', x: -hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'east', x: hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    ],
    stageShiftY: liftY,
  }
}
