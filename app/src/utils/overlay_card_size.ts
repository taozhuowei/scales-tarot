/**
 * Name: overlay_card_size
 * Purpose: calculate the maximum readable tarot card size for a spread scene.
 * Reason: separate card sizing from spread positioning so viewport adjustments stay modular.
 * Data flow: spread metadata and container bounds flow in; width and height flow to positioning.
 */

export type OverlayLayoutType = 'single' | 'row' | 'column' | 'cross'

export interface OverlayCardSizeInput {
  containerWidth: number
  containerHeight: number
  cardAspectRatio: number
  cardCount: number
  layoutType: OverlayLayoutType
  isWide: boolean
}

export const MIN_CARD_GAP = 16
export const MIN_CONTAINER_MARGIN = 24

/**
 * Resolve the largest card size that keeps the full spread readable inside the available frame.
 */
export function resolveOverlayCardSize(input: OverlayCardSizeInput): { width: number; height: number } {
  const {
    containerWidth,
    containerHeight,
    cardAspectRatio,
    cardCount,
    layoutType,
    isWide,
  } = input

  const availableWidth = Math.max(0, containerWidth - MIN_CONTAINER_MARGIN * 2)
  const availableHeight = Math.max(0, containerHeight - MIN_CONTAINER_MARGIN * 2)

  let maxWidth: number
  let maxHeight: number

  switch (layoutType) {
    case 'single': {
      maxWidth = Math.min(availableWidth, (availableHeight / cardAspectRatio) * 0.8)
      maxHeight = maxWidth * cardAspectRatio
      break
    }

    case 'row': {
      const totalGap = Math.max(0, cardCount - 1) * MIN_CARD_GAP
      const maxCardWidth = Math.max(0, availableWidth - totalGap) / Math.max(cardCount, 1)
      const maxCardHeightFromWidth = maxCardWidth * cardAspectRatio
      maxHeight = Math.min(maxCardHeightFromWidth, availableHeight * 0.7)
      maxWidth = maxHeight / cardAspectRatio
      break
    }

    case 'column': {
      const totalGap = Math.max(0, cardCount - 1) * MIN_CARD_GAP
      const maxCardHeight = Math.max(0, availableHeight - totalGap) / Math.max(cardCount, 1)
      const maxCardWidthFromHeight = maxCardHeight / cardAspectRatio
      maxWidth = Math.min(maxCardWidthFromHeight, availableWidth * 0.8)
      maxHeight = maxWidth * cardAspectRatio
      break
    }

    case 'cross': {
      const cellWidth = Math.max(0, availableWidth - MIN_CARD_GAP * 2) / 3
      const cellHeight = Math.max(0, availableHeight - MIN_CARD_GAP * 2) / 3
      maxWidth = Math.min(cellWidth, cellHeight / cardAspectRatio)
      maxHeight = maxWidth * cardAspectRatio

      const verticalSpace = cellHeight * 3 + MIN_CARD_GAP * 2
      const horizontalSpace = cellWidth * 3 + MIN_CARD_GAP * 2

      if (verticalSpace > availableHeight || horizontalSpace > availableWidth) {
        const scale = Math.min(
          availableHeight / Math.max(verticalSpace, 1),
          availableWidth / Math.max(horizontalSpace, 1),
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

  maxWidth = Math.max(88, Math.min(maxWidth, isWide ? 188 : 172))
  maxHeight = maxWidth * cardAspectRatio

  return { width: maxWidth, height: maxHeight }
}
