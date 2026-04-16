/**
 * Name: spread_layout (compatibility shim)
 * Purpose: backward-compatible public API that delegates to the new foldered layout system.
 */

import { resolveSpreadLayout as resolveSpreadLayoutCore } from './overlay_layout/spread_solver'
import { resolveCardSize } from './overlay_layout/card_size_solver'
import type { SceneLayoutResult } from './overlay_layout/scene_layout'
import { getSpreadCardCount } from './overlay_layout/spread_registry'
import { getBuiltInEnvelopeRequirement } from './overlay_layout/spread_spec'
import type { SpreadLayoutInput, SpreadLayoutResult, SpreadKind, SpreadScene } from './overlay_layout_types'

export type {
  SpreadCardLayout,
  SpreadLayoutInput,
  SpreadLayoutResult,
  SpreadKind,
  SpreadScene,
} from './overlay_layout_types'

export interface SpreadLayoutResultWithEnvelope extends SpreadLayoutResult {
  envelope: {
    cardWidth: number
    cardHeight: number
    gap: number
    horizontalSlots: number
    verticalSlots: number
    slotPitchX: number
    slotPitchY: number
    halfSpanX: number
    halfSpanY: number
    fullSpanX: number
    fullSpanY: number
  }
}

export { getSpreadCardCount }

/**
 * Resolve spread layout for given input parameters.
 * Delegates directly to the spread solver (no safe-frame insets) to preserve
 * legacy behavior where draw_stage and result_stage yield identical card sizes.
 */
export function resolveSpreadLayout(input: SpreadLayoutInput): SpreadLayoutResultWithEnvelope {
  const {
    spreadKind,
    scene,
    containerWidth,
    containerHeight,
    isWide,
    cardAspectRatio,
    headerHeight,
  } = input

  const envelope = resolveCardSize({
    safeWidth: containerWidth,
    safeHeight: containerHeight,
    cardAspectRatio,
    ...getBuiltInEnvelopeRequirement(spreadKind, isWide),
  })

  const result = resolveSpreadLayoutCore({
    spreadId: spreadKind,
    scene,
    containerWidth,
    containerHeight,
    isWide,
    envelope,
    headerHeight,
  })

  return {
    cardWidth: result.cardWidth,
    cardHeight: result.cardHeight,
    stageShiftY: result.stageShiftY,
    cards: result.cards,
    envelope: envelopeFromCardSize(envelope),
  }
}

function envelopeFromCardSize(size: SceneLayoutResult['envelope']): SpreadLayoutResultWithEnvelope['envelope'] {
  return {
    cardWidth: size.cardWidth,
    cardHeight: size.cardHeight,
    gap: size.gap,
    horizontalSlots: size.horizontalSlots,
    verticalSlots: size.verticalSlots,
    slotPitchX: size.slotPitchX,
    slotPitchY: size.slotPitchY,
    halfSpanX: size.halfSpanX,
    halfSpanY: size.halfSpanY,
    fullSpanX: size.fullSpanX,
    fullSpanY: size.fullSpanY,
  }
}
