/**
 * Name: composables/overlay_layout/motion
 * Purpose: motion-metrics derivation for the overlay-layout composable.
 *          Computes shuffle-spread / cut-pile spacing / motion-bounds /
 *          per-pile card counts from the solver's envelope so the
 *          shuffle / cut / draw phase runners stay inside the safe frame.
 * Reason: extracted from `use_overlay_layout.ts` so the motion math sits
 *          alongside the documentation that explains the formulas
 *          without dragging in the scene-derivation or breakpoint code.
 * Data flow: solver envelope + isWide + cutPileCount + deckCount ──▶
 *            getMotionMetrics ──▶ MotionMetrics ──▶ shuffle / cut / draw
 *            phase runners.
 */

import type { Ref } from 'vue'
import { solveLayout, type LayoutEnvelope } from '../../core/sizing/layout_solver'
import { clamp } from '../../utils/math'
import { SHUFFLE_EDGE_MARGIN } from '../../core/config/layout_constants'
import { buildPhysicalViewport, getSizes, type Scene } from './scene'

/** Cut motion axis — horizontal on wide screens, vertical on narrow. */
export type CutAxis = 'horizontal' | 'vertical'

/** Motion metrics consumed by shuffle / cut / draw phase runners. */
export interface MotionMetrics {
  envelope: LayoutEnvelope
  cardWidth: number
  cardHeight: number
  gap: number
  safeHalfWidth: number
  safeHalfHeight: number
  shuffleSpreadX: number
  cutPileSpacing: number
  cutAxis: CutAxis
  cardsPerPile: number
  cutLeadingOffset: { x: number; y: number }
  cutTrailingOffset: { x: number; y: number }
}

/**
 * Resolve all motion metrics (shuffle spread, cut spacing, motion bounds)
 * for the requested scene. Pure derivation from the solver's envelope.
 *
 * Shuffle spread: targets one card width + gap, clamped between
 * `slotPitchX/2` (always visible) and `safeHalfWidth - cardWidth/2 -
 * SHUFFLE_EDGE_MARGIN` (never crosses the safe frame edge).
 *
 * Cut: piles align horizontally on wide screens (one row), vertically on
 * narrow (one column). Spacing must be card dimension + gap to avoid
 * overlap when piles share the same axis.
 */
export function getMotionMetrics(
  isWide: Ref<boolean>,
  cutPileCount: number,
  deckCount: number,
  scene: Scene,
): MotionMetrics {
  const viewport = buildPhysicalViewport()
  const sizes = getSizes(viewport)
  const layout = solveLayout({ viewport, sizes, scene })

  const cardWidth = layout.envelope.cardWidth
  const cardHeight = layout.envelope.cardHeight
  const gap = layout.envelope.gap
  const slotPitchX = layout.envelope.slotPitchX

  // Available height matches the solver's stage budget so shuffle/cut
  // motion never escapes the safe frame. Mirror the formula in
  // `computeStage` so the two stay aligned.
  const availableH =
    viewport.height -
    viewport.safeAreaTop -
    viewport.safeAreaBottom -
    2 * sizes.margin -
    sizes.headerHeight

  const safeHalfWidth = layout.stage.width / 2
  const safeHalfHeight = availableH / 2

  const minShuffleSpread = slotPitchX / 2
  const maxShuffleSpread = Math.max(
    minShuffleSpread,
    safeHalfWidth - cardWidth / 2 - SHUFFLE_EDGE_MARGIN,
  )
  const shuffleSpreadX = clamp(cardWidth + gap, minShuffleSpread, maxShuffleSpread)

  const cutAxis: CutAxis = isWide.value ? 'horizontal' : 'vertical'
  const cutPileSpacing = (cutAxis === 'horizontal' ? cardWidth : cardHeight) + gap

  const pilesAlongAxis = Math.max(1, cutPileCount)
  const halfRange = ((pilesAlongAxis - 1) / 2) * cutPileSpacing
  const cutLeadingOffset =
    cutAxis === 'horizontal' ? { x: -halfRange, y: 0 } : { x: 0, y: -halfRange }
  const cutTrailingOffset =
    cutAxis === 'horizontal' ? { x: halfRange, y: 0 } : { x: 0, y: halfRange }

  const cardsPerPile = Math.max(
    1,
    Math.floor(Math.max(1, deckCount) / pilesAlongAxis),
  )

  return {
    envelope: layout.envelope,
    cardWidth,
    cardHeight,
    gap,
    safeHalfWidth,
    safeHalfHeight,
    shuffleSpreadX,
    cutPileSpacing,
    cutAxis,
    cardsPerPile,
    cutLeadingOffset,
    cutTrailingOffset,
  }
}
