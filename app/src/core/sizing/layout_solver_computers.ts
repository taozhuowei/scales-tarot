/**
 * Name: core/sizing/layout_solver/computers
 * Purpose: per-scene pure computers that the public `solveLayout` facade
 *          composes — `computeStage`, `computeDrawCardSize`,
 *          `computeDrawer`, `computeEnvelope`. Each function is a small
 *          pure derivation; together they describe how the layout is
 *          built from a viewport + sizes pair.
 * Reason: extracted from the monolithic `layout_solver.ts` (was 345
 *          lines) so each computer stays auditable on its own and the
 *          facade focuses on orchestration only.
 *
 * Purity: every function here is pure. No window access, no DOM, no
 *         global state. The caller is responsible for collecting the
 *         viewport and sizes.
 */

import type { PhysicalViewport, ResponsiveSizes } from './scale'
import { CARD_ASPECT_RATIO } from './scale'
import type { DrawerGeometry, LayoutEnvelope, StageRect } from './layout_solver_types'

/**
 * Initial drawer height as a fraction of the viewport height (0..1).
 *
 * The drawer's top edge anchors to the result card's bottom so the drawer
 * naturally hugs the card. Historically `initialHeight` filled the entire
 * gap between that anchor and the safe-area bottom, which left the sheet
 * extremely shallow on tall phones (the card pushed the drawer down to a
 * sliver). Per new product requirement N3 the initial height now equals a
 * fixed fraction of the viewport — the drawer is allowed to overlap the
 * card on first reveal because the user can drag it back down to inspect
 * the card if needed. `maxHeight` still represents "fully expanded sheet"
 * and remains capped at viewport.height − safeAreaBottom.
 */
export const INITIAL_DRAWER_HEIGHT_RATIO = 0.4

/**
 * Compute the largest 1:1.6 stage rect that fits inside the canvas after
 * subtracting the header and the page margins on every side. The stage is
 * the visual region cards live in — it doubles as the result card rect on
 * the reading scene because there's exactly one card and the card fills it.
 *
 * `bottomReservation` (px, default 0) reserves additional vertical space at
 * the bottom of the canvas. Used by the reading scene to subtract the
 * drawer's initial height so the result card auto-shrinks and lifts up
 * into the remaining stage area when the bottom drawer covers the lower
 * portion of the viewport. The draw scene passes 0 — the draw stage uses
 * the full available height because the drawer is closed during draw.
 */
export function computeStage(
  viewport: PhysicalViewport,
  sizes: ResponsiveSizes,
  bottomReservation = 0,
): StageRect {
  const availableW = viewport.width - 2 * sizes.margin
  const availableH =
    viewport.height -
    viewport.safeAreaTop -
    viewport.safeAreaBottom -
    2 * sizes.margin -
    sizes.headerHeight -
    Math.max(0, bottomReservation)

  // Largest 1:1.6 (height/width) rect that fits in (availableW × availableH).
  // If the canvas is wide-and-short, height is the limiting dimension.
  // Floor the available height at 1px so a degenerate viewport (very tall
  // drawer, very short window) doesn't produce a negative stage size.
  const safeAvailableH = Math.max(1, availableH)
  const widthLimitedByH = safeAvailableH / CARD_ASPECT_RATIO
  const stageW = Math.min(availableW, widthLimitedByH)
  const stageH = stageW * CARD_ASPECT_RATIO

  // Centre the stage horizontally in the canvas; pin it below the header
  // (which itself sits below the safe-area top + page margin).
  const stageX = (viewport.width - stageW) / 2
  const stageY = viewport.safeAreaTop + sizes.margin + sizes.headerHeight

  return { x: stageX, y: stageY, width: stageW, height: stageH }
}

/**
 * Three-pile draw card size. The cut phase requires three piles laid out
 * horizontally inside the stage with a `gap` of breathing on each end and
 * between piles, so each pile gets `(stageW − 4 × gap) / 3`. The card is
 * still 1:1.6, so height follows.
 */
export function computeDrawCardSize(stage: StageRect, sizes: ResponsiveSizes): {
  width: number
  height: number
} {
  const width = (stage.width - 4 * sizes.gap) / 3
  return { width, height: width * CARD_ASPECT_RATIO }
}

/**
 * Drawer geometry in the new model: always a bottom sheet that opens
 * directly under the result card. The drawer's top edge anchors to the
 * card's bottom edge — not the stage's bottom edge — so the drawer
 * naturally hugs the (now-padded) result card on the reading scene.
 *
 * `cardHeight` is the card height to anchor against. On the reading scene
 * it equals `stage.height * RESULT_CARD_FILL_RATIO` when the unclamped
 * card width fits inside the MAX_CARD_WIDTH_PX phone-shell envelope, or
 * `MAX_CARD_WIDTH_PX * CARD_ASPECT_RATIO` when the cap engages so the
 * 1:1.6 proportion is preserved; on the draw scene the caller can pass
 * `stage.height` to keep the original "drawer at stage bottom" behaviour.
 *
 * The card is centred vertically in the stage rect (stage layer doesn't
 * shift it), so cardTop = stage.y + (stage.height - cardHeight) / 2 and
 * cardBottom = cardTop + cardHeight, which simplifies to
 *   stage.y + (stage.height + cardHeight) / 2.
 *
 * Per requirement N3: `initialHeight` is decoupled from `initialTop` and
 * fixed at `viewport.height * INITIAL_DRAWER_HEIGHT_RATIO`. The drawer is
 * therefore free to overlap the result card on first reveal — the user
 * drags it down to inspect the card if needed. `maxHeight` is unchanged
 * (still represents the fully expanded sheet bounded by safeAreaBottom).
 */
export function computeDrawer(
  viewport: PhysicalViewport,
  stage: StageRect,
  cardHeight: number,
): DrawerGeometry {
  const initialTop = stage.y + (stage.height + cardHeight) / 2
  const initialHeight = Math.round(viewport.height * INITIAL_DRAWER_HEIGHT_RATIO)
  const maxHeight = viewport.height - viewport.safeAreaBottom
  return {
    initialTop,
    initialHeight,
    maxHeight,
    width: viewport.width,
    rightAligned: false,
  }
}

/**
 * Animation envelope for the 3-pile draw / cut grid. Always horizontal in
 * the new model — the wide / narrow rotation of the grid is gone because
 * the stage rect is a single shape on every viewport.
 */
export function computeEnvelope(
  drawCardWidth: number,
  drawCardHeight: number,
  gap: number,
): LayoutEnvelope {
  const horizontalSlots = 3
  const verticalSlots = 1
  const fullSpanX = horizontalSlots * drawCardWidth + (horizontalSlots - 1) * gap
  const fullSpanY = drawCardHeight
  return {
    cardWidth: drawCardWidth,
    cardHeight: drawCardHeight,
    gap,
    horizontalSlots,
    verticalSlots,
    slotPitchX: drawCardWidth + gap,
    slotPitchY: drawCardHeight + gap,
    halfSpanX: fullSpanX / 2,
    halfSpanY: fullSpanY / 2,
    fullSpanX,
    fullSpanY,
  }
}
