/**
 * Name: built_in_layouts
 * Purpose: preserve the exact layout behavior for built-in spreads.
 * Reason: these spreads have scene-specific lift/clamp rules that are best owned
 *   by the spread registry rather than encoded in a generic solver switch.
 * Data flow: envelope and container bounds flow in; positioned slots flow out.
 */

import type {
  CardEnvelope,
  SpreadCardLayout,
  SpreadLayoutContext,
  SpreadLayoutResult,
} from './spread_spec'

export function buildSingleCardLayout(ctx: SpreadLayoutContext): SpreadLayoutResult {
  const { scene, containerHeight, envelope, headerHeight } = ctx
  const { cardWidth, cardHeight } = envelope
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
      y: (headerHeight ?? 0) / 2,
      width: cardWidth,
      height: cardHeight,
      rotateDeg: 0,
      zIndex: 20,
    }],
  }
}

export function buildThreeCardLayout(ctx: SpreadLayoutContext): SpreadLayoutResult {
  const { scene, containerWidth, containerHeight, isWide, envelope, headerHeight } = ctx
  const { cardWidth, cardHeight, slotPitchX, slotPitchY } = envelope
  const hMargin = Math.max(cardWidth * 0.08, 12)
  const vMargin = Math.max(cardHeight * 0.06, 12)
  const maxCenterX = Math.max(0, containerWidth / 2 - cardWidth / 2 - hMargin)
  const minCenterY = -containerHeight / 2 + cardHeight / 2 + vMargin
  const maxCenterY = containerHeight / 2 - cardHeight / 2 - vMargin

  if (isWide) {
    const sideOffset = Math.min(slotPitchX, maxCenterX)
    const liftY = Math.min(containerHeight * 0.32, cardHeight * 1.26)
    const targetRowY = scene === 'draw_stage' ? liftY : 0
    const centeredRowY = clamp(targetRowY, minCenterY, maxCenterY)

    return buildResult(cardWidth, cardHeight, scene === 'draw_stage' ? liftY : 0, [
      { slotId: 'past', x: -sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
      { slotId: 'present', x: 0, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
      { slotId: 'future', x: sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
    ])
  }

  const verticalAvailable = Math.max(0, (containerHeight / 2 - cardHeight / 2) - vMargin)
  const verticalSpread = Math.min(slotPitchY, verticalAvailable)

  if (scene === 'draw_stage') {
    const liftY = Math.min(containerHeight * 0.16, cardHeight * 0.56)
    const targetCenterY = Math.max(liftY, liftY + (headerHeight ?? 0) / 2 + 60 - containerHeight * 0.29)
    const mobileCenterY = clamp(targetCenterY, minCenterY + verticalSpread, maxCenterY - verticalSpread)

    return buildResult(cardWidth, cardHeight, liftY, [
      { slotId: 'past', x: 0, y: mobileCenterY + verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
      { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
      { slotId: 'future', x: 0, y: mobileCenterY - verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
    ])
  }

  const targetCenterY = (headerHeight ?? 0) / 2
  const mobileCenterY = clamp(targetCenterY, minCenterY + verticalSpread, maxCenterY - verticalSpread)

  return buildResult(cardWidth, cardHeight, 0, [
    { slotId: 'past', x: 0, y: mobileCenterY + verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
    { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
    { slotId: 'future', x: 0, y: mobileCenterY - verticalSpread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
  ])
}

export function buildCrossSpreadLayout(ctx: SpreadLayoutContext): SpreadLayoutResult {
  const { scene, containerHeight, isWide, envelope, headerHeight } = ctx
  const { cardWidth, cardHeight, slotPitchX, slotPitchY } = envelope
  const liftY = isWide
    ? Math.min(containerHeight * 0.28, cardHeight)
    : Math.min(containerHeight * 0.12, cardHeight * 0.4)
  const hOffset = slotPitchX
  const vOffset = slotPitchY
  const centerX = 0

  const maxCenterShift = Math.max(0, containerHeight / 2 - vOffset - cardHeight / 2)

  if (scene === 'draw_stage') {
    let centerY: number
    if (!isWide) {
      const targetCenterY = liftY + (headerHeight ?? 0) / 2 + 60 - containerHeight * 0.29
      centerY = clamp(targetCenterY, -maxCenterShift, maxCenterShift)
      const minNorthY = -containerHeight / 2 + cardHeight / 2 + (headerHeight ?? 0) + 8
      const northY = centerY - vOffset
      if (northY < minNorthY) {
        centerY = minNorthY + vOffset
      }
    } else {
      centerY = clamp(liftY * 0.5, -maxCenterShift, maxCenterShift)
    }

    return buildResult(cardWidth, cardHeight, liftY, [
      { slotId: 'center', x: centerX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
      { slotId: 'north', x: centerX, y: centerY - vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'south', x: centerX, y: centerY + vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'west', x: centerX - hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'east', x: centerX + hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    ])
  }

  const centerY = clamp((headerHeight ?? 0) / 2, -containerHeight * 0.1, containerHeight * 0.1)

  return buildResult(cardWidth, cardHeight, 0, [
    { slotId: 'center', x: centerX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
    { slotId: 'north', x: centerX, y: centerY - vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    { slotId: 'south', x: centerX, y: centerY + vOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    { slotId: 'west', x: centerX - hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    { slotId: 'east', x: centerX + hOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
  ])
}

function buildResult(
  cardWidth: number,
  cardHeight: number,
  stageShiftY: number,
  cards: SpreadCardLayout[],
): SpreadLayoutResult {
  return { cardWidth, cardHeight, stageShiftY, cards }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
