/**
 * Name: core/layout/spread_layout_calculator
 * Purpose: compute the spread slot structure from a spec and card size.
 * Reason: isolate slot geometry math into a single pure module.
 * Data flow: spread spec + card size flow in; positioned slots flow out.
 */

import type { SpreadSpec, SpreadSlot, SpreadGeometry } from './types'
import type { CardSize } from '../sizing/types'

export function calculateSpreadGeometry(
  cardSize: CardSize,
  horizontalSlots: number,
  verticalSlots: number,
): SpreadGeometry {
  const { width: cardWidth, height: cardHeight, gap } = cardSize
  const slotPitchX = cardWidth + gap
  const slotPitchY = cardHeight + gap
  const hSlots = Math.max(1, Math.floor(horizontalSlots))
  const vSlots = Math.max(1, Math.floor(verticalSlots))

  return {
    cardWidth,
    cardHeight,
    slotPitchX,
    slotPitchY,
    halfSpanX: ((hSlots - 1) * slotPitchX) / 2,
    halfSpanY: ((vSlots - 1) * slotPitchY) / 2,
    fullSpanX: hSlots * cardWidth + (hSlots - 1) * gap,
    fullSpanY: vSlots * cardHeight + (vSlots - 1) * gap,
  }
}

export function resolveSpreadSlots(
  spec: SpreadSpec,
  isWide: boolean,
  cardSize: CardSize,
): SpreadSlot[] {
  const slotDefs = (isWide && spec.wideSlots?.length) ? spec.wideSlots : spec.slots
  const { width: cardWidth, height: cardHeight, gap } = cardSize
  const slotPitchX = cardWidth + gap
  const slotPitchY = cardHeight + gap

  return slotDefs.map(slot => ({
    slotId: slot.slotId,
    x: slot.rx * slotPitchX,
    y: slot.ry * slotPitchY,
  }))
}
