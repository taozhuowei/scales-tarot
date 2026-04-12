/**
 * Name: overlay_card_positions
 * Purpose: calculate spread slot positions independently from card sizing.
 * Reason: keep scene-specific positioning rules isolated from viewport and animation code.
 * Data flow: card dimensions and scene bounds flow in; positioned spread slots flow to the overlay.
 */

import type {
  SpreadCardLayout,
  SpreadKind,
  SpreadLayoutResult,
  SpreadScene,
} from './overlay_layout_types'

export interface OverlayCardPositionInput {
  spreadKind: SpreadKind
  scene: SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  cardWidth: number
  cardHeight: number
  headerHeight?: number
}

/**
 * Build card positions for a spread after sizing has already been resolved.
 */
export function resolveOverlayCardPositions(input: OverlayCardPositionInput): SpreadLayoutResult {
  const {
    spreadKind,
    scene,
    containerWidth,
    containerHeight,
    isWide,
    cardWidth,
    cardHeight,
    headerHeight,
  } = input

  switch (spreadKind) {
    case 'single_card':
      return buildSingleCardLayout(cardWidth, cardHeight, containerHeight, scene, headerHeight)
    case 'three_card':
      return buildThreeCardLayout(cardWidth, cardHeight, containerWidth, containerHeight, isWide, scene, headerHeight)
    case 'cross_spread':
      return buildCrossSpreadLayout(cardWidth, cardHeight, containerHeight, isWide, scene, headerHeight)
    default:
      return buildThreeCardLayout(cardWidth, cardHeight, containerWidth, containerHeight, isWide, scene, headerHeight)
  }
}

function buildSingleCardLayout(
  cardWidth: number,
  cardHeight: number,
  containerHeight: number,
  scene: SpreadScene,
  headerHeight: number = 0,
): SpreadLayoutResult {
  const centerX = 0

  if (scene === 'draw_stage') {
    const liftY = Math.min(containerHeight * 0.12, cardHeight * 0.3)
    const stageShiftY = liftY
    const minCenterY = -containerHeight / 2 + cardHeight / 2
    const maxCenterY = containerHeight / 2 - cardHeight / 2
    const centerY = clamp(liftY, minCenterY, maxCenterY)

    return {
      cardWidth,
      cardHeight,
      stageShiftY,
      cards: [{
        slotId: 'center',
        x: centerX,
        y: centerY,
        width: cardWidth,
        height: cardHeight,
        rotateDeg: 0,
        zIndex: 20,
      }],
    }
  }

  return {
    cardWidth,
    cardHeight,
    stageShiftY: 0,
    cards: [{
      slotId: 'center',
      x: centerX,
      y: headerHeight / 2,
      width: cardWidth,
      height: cardHeight,
      rotateDeg: 0,
      zIndex: 20,
    }],
  }
}

function buildThreeCardLayout(
  cardWidth: number,
  cardHeight: number,
  containerWidth: number,
  containerHeight: number,
  isWide: boolean,
  scene: SpreadScene,
  headerHeight: number = 0,
): SpreadLayoutResult {
  const horizontalMargin = Math.max(cardWidth * 0.2, 24)
  const verticalMargin = Math.max(cardHeight * 0.12, 24)
  const maxCenterX = Math.max(0, containerWidth / 2 - cardWidth / 2 - horizontalMargin)
  const minCenterY = -containerHeight / 2 + cardHeight / 2 + verticalMargin
  const maxCenterY = containerHeight / 2 - cardHeight / 2 - verticalMargin

  const rowLayout = (() => {
    const sideOffset = Math.min(cardWidth * 1.28, maxCenterX)
    const liftY = Math.min(containerHeight * 0.32, cardHeight * 1.26)
    const targetRowY = scene === 'draw_stage' ? liftY : 0
    const centeredRowY = clamp(targetRowY, minCenterY, maxCenterY)

    return buildSpreadResult(cardWidth, cardHeight, scene === 'draw_stage' ? liftY : 0, [
      { slotId: 'past', x: -sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
      { slotId: 'present', x: 0, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
      { slotId: 'future', x: sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
    ])
  })()

  if (isWide) {
    return rowLayout
  }

  const resultContainerHeight = containerHeight * 0.42
  const spread = Math.min(cardHeight * 1.12, (resultContainerHeight * 0.88) / 2)

  if (scene === 'draw_stage') {
    const liftY = Math.min(containerHeight * 0.16, cardHeight * 0.56)
    const targetCenterY = Math.max(liftY, liftY + headerHeight / 2 + 60 - containerHeight * 0.29)
    const mobileCenterY = clamp(targetCenterY, minCenterY + spread, maxCenterY - spread)

    return buildSpreadResult(cardWidth, cardHeight, liftY, [
      { slotId: 'past', x: 0, y: mobileCenterY + spread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
      { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
      { slotId: 'future', x: 0, y: mobileCenterY - spread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
    ])
  }

  const targetCenterY = headerHeight / 2
  const mobileCenterY = clamp(targetCenterY, minCenterY + spread, maxCenterY - spread)

  return buildSpreadResult(cardWidth, cardHeight, 0, [
    { slotId: 'past', x: 0, y: mobileCenterY + spread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
    { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
    { slotId: 'future', x: 0, y: mobileCenterY - spread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
  ])
}

function buildCrossSpreadLayout(
  cardWidth: number,
  cardHeight: number,
  containerHeight: number,
  isWide: boolean,
  scene: SpreadScene,
  headerHeight: number = 0,
): SpreadLayoutResult {
  const gap = Math.max(cardWidth * 0.15, 12)
  const liftY = isWide
    ? Math.min(containerHeight * 0.28, cardHeight)
    : Math.min(containerHeight * 0.12, cardHeight * 0.4)
  const horizontalOffset = cardWidth + gap
  const verticalOffset = cardHeight + gap
  const centerX = 0

  if (scene === 'draw_stage') {
    let centerY: number
    if (!isWide) {
      const targetCenterY = liftY + headerHeight / 2 + 60 - containerHeight * 0.29
      centerY = clamp(targetCenterY, -containerHeight * 0.1, containerHeight * 0.1)
      const minNorthY = -containerHeight / 2 + cardHeight / 2 + headerHeight + 8
      const northY = centerY - verticalOffset
      if (northY < minNorthY) {
        centerY = minNorthY + verticalOffset
      }
    } else {
      centerY = clamp(liftY * 0.5, -containerHeight * 0.1, containerHeight * 0.1)
    }

    return buildSpreadResult(cardWidth, cardHeight, liftY, [
      { slotId: 'center', x: centerX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
      { slotId: 'north', x: centerX, y: centerY - verticalOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'south', x: centerX, y: centerY + verticalOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'west', x: centerX - horizontalOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'east', x: centerX + horizontalOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    ])
  }

  const centerY = clamp(headerHeight / 2, -containerHeight * 0.1, containerHeight * 0.1)

  return buildSpreadResult(cardWidth, cardHeight, 0, [
    { slotId: 'center', x: centerX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
    { slotId: 'north', x: centerX, y: centerY - verticalOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    { slotId: 'south', x: centerX, y: centerY + verticalOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    { slotId: 'west', x: centerX - horizontalOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    { slotId: 'east', x: centerX + horizontalOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
  ])
}

function buildSpreadResult(
  cardWidth: number,
  cardHeight: number,
  stageShiftY: number,
  cards: SpreadCardLayout[],
): SpreadLayoutResult {
  return {
    cardWidth,
    cardHeight,
    stageShiftY,
    cards,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
