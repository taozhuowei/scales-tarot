/**
 * Name: spread_layout
 * Purpose: compose spread card sizing and positioning into a single pure layout solver.
 * Reason: preserve the existing public API while allowing size and position logic to evolve independently.
 * Data flow: generic spread input flows in; sized and positioned cards flow out.
 */

import { resolveOverlayCardPositions } from './overlay_card_positions'
import { resolveOverlayCardSize, type OverlayLayoutType } from './overlay_card_size'
import type {
  SpreadLayoutInput,
  SpreadLayoutResult,
  SpreadKind,
} from './overlay_layout_types'

export type {
  SpreadCardLayout,
  SpreadLayoutInput,
  SpreadLayoutResult,
  SpreadKind,
  SpreadScene,
} from './overlay_layout_types'

/**
 * Get the number of cards for a spread kind.
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

/**
 * Resolve spread layout for given input parameters.
 */
export function resolveSpreadLayout(input: SpreadLayoutInput): SpreadLayoutResult {
  const {
    spreadKind,
    scene,
    containerWidth,
    containerHeight,
    isWide,
    cardAspectRatio,
    headerHeight,
  } = input

  const cardCount = getSpreadCardCount(spreadKind)
  let layoutType: OverlayLayoutType

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

  const { width: cardWidth, height: cardHeight } = resolveOverlayCardSize({
    containerWidth,
    containerHeight,
    cardAspectRatio,
    cardCount,
    layoutType,
    isWide,
  })

  return resolveOverlayCardPositions({
    spreadKind,
    scene,
    containerWidth,
    containerHeight,
    isWide,
    cardWidth,
    cardHeight,
    headerHeight,
  })
}
