/**
 * Name: spread_solver
 * Purpose: build a generic solver that maps a spread spec into final card positions.
 * Reason: future custom spreads should not require editing the core solver.
 * Data flow: spread spec + scene + envelope flow in; positioned cards flow out.
 */

import type {
  SpreadId,
  SpreadScene,
  CardEnvelope,
  SpreadLayoutResult,
  SpreadCardLayout,
} from './spread_spec'
export type { SpreadLayoutResult, SpreadCardLayout } from './spread_spec'
import { getSpreadSpec } from './spread_registry'

export interface SpreadSolverInput {
  spreadId: SpreadId
  scene: SpreadScene
  containerWidth: number
  containerHeight: number
  isWide: boolean
  envelope: CardEnvelope
  headerHeight?: number
}

/**
 * Generic spread layout solver.
 * 1. Looks up the spread spec from the registry.
 * 2. If the spec provides a custom resolveLayout, delegates to it.
 * 3. Otherwise, places cards on a grid using slotPitchX / slotPitchY.
 */
export function resolveSpreadLayout(input: SpreadSolverInput): SpreadLayoutResult {
  const { spreadId, scene, containerWidth, containerHeight, isWide, envelope, headerHeight } = input
  const spec = getSpreadSpec(spreadId)

  if (spec?.resolveLayout) {
    return spec.resolveLayout({ scene, containerWidth, containerHeight, isWide, envelope, headerHeight })
  }

  // Generic grid placement for data-only spreads.
  const slots = (isWide && spec?.wideSlots?.length) ? spec!.wideSlots : (spec?.slots ?? [])
  const { cardWidth, cardHeight, slotPitchX, slotPitchY } = envelope

  const cards: SpreadCardLayout[] = slots.map((slot, index) => ({
    slotId: slot.slotId,
    x: slot.rx * slotPitchX,
    y: slot.ry * slotPitchY,
    width: cardWidth,
    height: cardHeight,
    rotateDeg: 0,
    zIndex: 20 + index,
  }))

  return {
    cardWidth,
    cardHeight,
    stageShiftY: 0,
    cards,
  }
}
