/**
 * Pure spread layout calculation module
 * Calculates card positions and sizes for different tarot spread layouts
 * No Vue reactivity, no DOM access, no GSAP - pure functions only
 */

export type SpreadKind = 'single_card' | 'three_card' | 'cross_spread'
export type SpreadScene = 'draw_stage' | 'result_stage'

export interface SpreadLayoutInput {
  spreadKind: SpreadKind
  scene: SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  cardAspectRatio: number
}

export interface SpreadCardLayout {
  slotId: string
  x: number
  y: number
  width: number
  height: number
  rotateDeg: number
  zIndex: number
}

export interface SpreadLayoutResult {
  cardWidth: number
  cardHeight: number
  stageShiftY: number
  cards: SpreadCardLayout[]
}

/**
 * Get the number of cards for a spread kind
 */
export function getSpreadCardCount(spreadKind: SpreadKind): number {
  switch (spreadKind) {
    case 'single_card':
      return 1
    case 'three_card':
      return 3
    case 'cross_spread':
      return 5
    default:
      return 3
  }
}

// Minimum spacing between cards in pixels
const MIN_CARD_GAP = 16
const MIN_CONTAINER_MARGIN = 24

/**
 * Calculate maximum card size that fits within container
 */
function calculateMaxCardSize(
  containerWidth: number,
  containerHeight: number,
  cardAspectRatio: number,
  cardCount: number,
  layoutType: 'row' | 'column' | 'cross' | 'single',
  isWide: boolean,
): { width: number; height: number } {
  const availableWidth = containerWidth - MIN_CONTAINER_MARGIN * 2
  const availableHeight = containerHeight - MIN_CONTAINER_MARGIN * 2

  let maxWidth: number
  let maxHeight: number

  switch (layoutType) {
    case 'single': {
      // Single card: maximize within container
      maxWidth = Math.min(availableWidth, (availableHeight / cardAspectRatio) * 0.8)
      maxHeight = maxWidth * cardAspectRatio
      break
    }

    case 'row': {
      // Row layout: cards side by side horizontally
      const totalGap = (cardCount - 1) * MIN_CARD_GAP
      const maxCardWidth = (availableWidth - totalGap) / cardCount
      const maxCardHeightFromWidth = maxCardWidth * cardAspectRatio
      
      // Also constrain by height
      maxHeight = Math.min(maxCardHeightFromWidth, availableHeight * 0.7)
      maxWidth = maxHeight / cardAspectRatio
      break
    }

    case 'column': {
      // Column layout: cards stacked vertically
      const totalGap = (cardCount - 1) * MIN_CARD_GAP
      const maxCardHeight = (availableHeight - totalGap) / cardCount
      const maxCardWidthFromHeight = maxCardHeight / cardAspectRatio
      
      // Also constrain by width
      maxWidth = Math.min(maxCardWidthFromHeight, availableWidth * 0.8)
      maxHeight = maxWidth * cardAspectRatio
      break
    }

    case 'cross': {
      // Cross spread: center + 4 directions (north, south, west, east)
      // Layout is roughly 3x3 grid with corners empty
      const cellWidth = (availableWidth - MIN_CARD_GAP * 2) / 3
      const cellHeight = (availableHeight - MIN_CARD_GAP * 2) / 3
      
      maxWidth = Math.min(cellWidth, cellHeight / cardAspectRatio)
      maxHeight = maxWidth * cardAspectRatio
      
      // Additional constraint: ensure cross fits
      const verticalSpace = cellHeight * 3 + MIN_CARD_GAP * 2
      const horizontalSpace = cellWidth * 3 + MIN_CARD_GAP * 2
      
      if (verticalSpace > availableHeight || horizontalSpace > availableWidth) {
        const scale = Math.min(
          availableHeight / verticalSpace,
          availableWidth / horizontalSpace,
        )
        maxWidth *= scale
        maxHeight *= scale
      }
      break
    }

    default: {
      maxWidth = 120
      maxHeight = maxWidth * cardAspectRatio
    }
  }

  // Apply reasonable min/max bounds
  maxWidth = Math.max(88, Math.min(maxWidth, isWide ? 188 : 172))
  maxHeight = maxWidth * cardAspectRatio

  return { width: maxWidth, height: maxHeight }
}

/**
 * Build single card layout
 */
function buildSingleCardLayout(
  cardWidth: number,
  cardHeight: number,
  containerWidth: number,
  containerHeight: number,
  scene: SpreadScene,
): SpreadLayoutResult {
  const centerX = 0 // Relative to center
  const centerY = scene === 'draw_stage' 
    ? -containerHeight * 0.08 // Slight lift in draw stage
    : 0

  const stageShiftY = scene === 'draw_stage'
    ? Math.min(containerHeight * 0.12, cardHeight * 0.3)
    : 0

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

/**
 * Calculate fit score for a layout (higher is better, 1.0 = perfect fit)
 */
function calculateFitScore(
  cardWidth: number,
  cardHeight: number,
  containerWidth: number,
  containerHeight: number,
  layoutType: 'row' | 'column',
): number {
  const MIN_GAP = 16
  const MARGIN = 24
  
  const availableWidth = containerWidth - MARGIN * 2
  const availableHeight = containerHeight - MARGIN * 2
  
  if (layoutType === 'row') {
    // Row layout: cards side by side horizontally
    const totalGap = MIN_GAP * 2
    const requiredWidth = cardWidth * 3 + totalGap
    const widthFit = Math.min(1, availableWidth / requiredWidth)
    const heightFit = Math.min(1, availableHeight / (cardHeight * 1.4))
    return widthFit * heightFit
  } else {
    // Column layout: cards stacked vertically
    const totalGap = MIN_GAP * 2
    const requiredHeight = cardHeight * 3 + totalGap
    const heightFit = Math.min(1, availableHeight / requiredHeight)
    const widthFit = Math.min(1, availableWidth / (cardWidth * 1.4))
    return widthFit * heightFit
  }
}

/**
 * Build three card layout - chooses best orientation deterministically by fit
 */
function buildThreeCardLayout(
  cardWidth: number,
  cardHeight: number,
  containerWidth: number,
  containerHeight: number,
  _isWide: boolean,
  scene: SpreadScene,
): SpreadLayoutResult {
  const horizontal_margin = Math.max(cardWidth * 0.2, 24)
  const vertical_margin = Math.max(cardHeight * 0.12, 24)
  
  // Available space from center
  const maxCenterX = Math.max(0, containerWidth / 2 - cardWidth / 2 - horizontal_margin)
  const minCenterY = -containerHeight / 2 + cardHeight / 2 + vertical_margin
  const maxCenterY = containerHeight / 2 - cardHeight / 2 - vertical_margin

  // Calculate both row and column layouts
  const rowLayout = ((): SpreadLayoutResult => {
    const sideOffset = Math.min(cardWidth * 1.28, maxCenterX)
    const liftY = Math.min(containerHeight * 0.32, cardHeight * 1.26)
    // draw_stage: cards shift up so stage lift brings them to center; result_stage: center at 0
    const targetRowY = scene === 'draw_stage' ? liftY : 0
    const centeredRowY = Math.max(minCenterY, Math.min(maxCenterY, targetRowY))

    const stageShiftY = scene === 'draw_stage' ? liftY : 0

    return {
      cardWidth,
      cardHeight,
      stageShiftY,
      cards: [
        { slotId: 'past', x: -sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
        { slotId: 'present', x: 0, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
        { slotId: 'future', x: sideOffset, y: centeredRowY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
      ],
    }
  })()

  const columnLayout = ((): SpreadLayoutResult => {
    const availableSpan = Math.max(0, maxCenterY - minCenterY)
    const spread = Math.min(cardHeight * 1.12, availableSpan / 2)
    const liftY = Math.min(containerHeight * 0.16, cardHeight * 0.56)
    // draw_stage: cards shift up so stage lift brings them to center; result_stage: center at 0
    const targetCenterY = scene === 'draw_stage' ? liftY : 0
    const mobileCenterY = Math.max(minCenterY + spread, Math.min(maxCenterY - spread, targetCenterY))

    const stageShiftY = scene === 'draw_stage' ? liftY : 0

    return {
      cardWidth,
      cardHeight,
      stageShiftY,
      cards: [
        { slotId: 'past', x: 0, y: mobileCenterY + spread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 20 },
        { slotId: 'present', x: 0, y: mobileCenterY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 21 },
        { slotId: 'future', x: 0, y: mobileCenterY - spread, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 22 },
      ],
    }
  })()

  // Choose layout deterministically based on fit score
  const rowScore = calculateFitScore(cardWidth, cardHeight, containerWidth, containerHeight, 'row')
  const columnScore = calculateFitScore(cardWidth, cardHeight, containerWidth, containerHeight, 'column')
  
  // Prefer row if scores are equal (deterministic tie-breaking)
  return rowScore >= columnScore ? rowLayout : columnLayout
}

/**
 * Build cross spread layout (Celtic cross simplified - 5 cards)
 */
function buildCrossSpreadLayout(
  cardWidth: number,
  cardHeight: number,
  containerWidth: number,
  containerHeight: number,
  isWide: boolean,
  scene: SpreadScene,
): SpreadLayoutResult {
  // Cross spread layout:
  //     [N]
  // [W] [C] [E]
  //     [S]
  // 
  // Plus one additional card (typically to the right)
  
  const gap = Math.max(cardWidth * 0.15, 12)
  const liftY = isWide
    ? Math.min(containerHeight * 0.28, cardHeight)
    : Math.min(containerHeight * 0.12, cardHeight * 0.4)
  
  // Center position
  const centerX = 0
  const centerY = scene === 'draw_stage' 
    ? Math.max(-containerHeight * 0.1, Math.min(containerHeight * 0.1, liftY * 0.5))
    : 0

  // Calculate offsets
  const horizontalOffset = cardWidth + gap
  const verticalOffset = cardHeight + gap

  const stageShiftY = scene === 'draw_stage' ? liftY : 0

  return {
    cardWidth,
    cardHeight,
    stageShiftY,
    cards: [
      { slotId: 'center', x: centerX, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 25 },
      { slotId: 'north', x: centerX, y: centerY - verticalOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'south', x: centerX, y: centerY + verticalOffset, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'west', x: centerX - horizontalOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
      { slotId: 'east', x: centerX + horizontalOffset, y: centerY, width: cardWidth, height: cardHeight, rotateDeg: 0, zIndex: 24 },
    ],
  }
}

/**
 * Resolve spread layout for given input parameters
 * This is the main entry point for layout calculation
 */
export function resolveSpreadLayout(input: SpreadLayoutInput): SpreadLayoutResult {
  const { spreadKind, scene, containerWidth, containerHeight, isWide, cardAspectRatio } = input

  // Determine layout type and card count
  const cardCount = getSpreadCardCount(spreadKind)
  let layoutType: 'single' | 'row' | 'column' | 'cross'

  switch (spreadKind) {
    case 'single_card':
      layoutType = 'single'
      break
    case 'three_card':
      layoutType = isWide ? 'row' : 'column'
      break
    case 'cross_spread':
      layoutType = 'cross'
      break
    default:
      layoutType = 'row'
  }

  // Calculate card size
  const { width: cardWidth, height: cardHeight } = calculateMaxCardSize(
    containerWidth,
    containerHeight,
    cardAspectRatio,
    cardCount,
    layoutType,
    isWide,
  )

  // Build layout based on spread kind
  switch (spreadKind) {
    case 'single_card':
      return buildSingleCardLayout(cardWidth, cardHeight, containerWidth, containerHeight, scene)
    
    case 'three_card':
      return buildThreeCardLayout(cardWidth, cardHeight, containerWidth, containerHeight, isWide, scene)
    
    case 'cross_spread':
      return buildCrossSpreadLayout(cardWidth, cardHeight, containerWidth, containerHeight, isWide, scene)
    
    default:
      // Fallback to three card
      return buildThreeCardLayout(cardWidth, cardHeight, containerWidth, containerHeight, isWide, scene)
  }
}
