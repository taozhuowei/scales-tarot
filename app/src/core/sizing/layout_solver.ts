/**
 * Name: core/sizing/layout_solver
 * Purpose: pure layout solver for the tarot reading flow. Given a viewport,
 *          ResponsiveSizes, and a scene kind, returns a fully described
 *          SceneLayout (card rects, drawer geometry, stage rect, animation
 *          envelope) — every value derived from a single 1:1.6 stage rect
 *          centered horizontally in the canvas.
 *
 *          This file is a small facade: the type surface lives in
 *          `layout_solver_types.ts` and the per-scene pure computers live
 *          in `layout_solver_computers.ts`. `solveLayout` orchestrates
 *          them and assembles the final `SceneLayout`. Public API
 *          unchanged from before the split — every type and the function
 *          itself are re-exported here so downstream importers stay
 *          identical.
 *
 * Reason: the previous monolithic 345-line implementation accumulated
 *         types + four computers + the orchestrator in one file. Splitting
 *         them keeps each piece small and reviewable while the public
 *         contract (types + `solveLayout`) is preserved exactly.
 *
 * Purity: pure function. No window access, no DOM, no global state. The
 *         caller is responsible for collecting the viewport and sizes.
 *
 * Data flow:
 *   readViewport(windowInfo) ──▶ pickCanvasWidth ──┐
 *                                                  ├──▶ solveLayout({viewport, sizes, scene}) ──▶ SceneLayout
 *   deriveSizes(canvasWidth) ───────────────────────┘
 */

import {
  CARD_ASPECT_RATIO,
  MAX_CARD_WIDTH_PX,
  RESULT_CARD_FILL_RATIO,
  type PhysicalViewport,
  type ResponsiveSizes,
} from './scale'
import { INITIAL_DRAWER_HEIGHT_RATIO } from '../config/layout_constants'
import {
  computeDrawCardSize,
  computeDrawer,
  computeEnvelope,
  computeStage,
} from './layout_solver_computers'
import type {
  CardLayout,
  SceneLayout,
  SolveLayoutInput,
  StageRect,
} from './layout_solver_types'

// Re-export the type surface from the dedicated module so existing
// `import { ... } from '.../layout_solver'` calls keep working unchanged.
export type {
  CardLayout,
  DrawerGeometry,
  LayoutEnvelope,
  StageRect,
  SceneLayout,
  SceneKind,
  SolveLayoutInput,
} from './layout_solver_types'

/**
 * Reading scene's bottom band reservation: the bottom drawer covers the
 * lower 40 % of the viewport on first reveal and the ActionArea (decision-
 * phase CTAs) sits below it in the same band. Sum them so the reading
 * stage rect shrinks by the correct amount and the result card auto-fits
 * the remaining visible area instead of landing under the drawer.
 */
function readingStageReservation(
  viewport: PhysicalViewport,
  sizes: ResponsiveSizes,
): number {
  return (
    Math.round(viewport.height * INITIAL_DRAWER_HEIGHT_RATIO) +
    sizes.actionAreaHeight
  )
}

/**
 * Solve the reading-stage layout — single result card centred in the
 * shrunk stage with the bottom drawer anchored to the card's bottom edge.
 *
 * Card sizing: occupy `RESULT_CARD_FILL_RATIO` of the stage rect on each
 * axis, then clamp width to `MAX_CARD_WIDTH_PX` (PRD §8.2 phone-shell
 * envelope) and derive height from the clamped width via
 * `CARD_ASPECT_RATIO` so the 1:1.6 proportion is preserved when the cap
 * engages on the largest supported canvases.
 */
function solveReadingStageLayout(
  viewport: PhysicalViewport,
  sizes: ResponsiveSizes,
  stage: StageRect,
  draw: { width: number; height: number },
): SceneLayout {
  const unclampedCardWidth = stage.width * RESULT_CARD_FILL_RATIO
  const resultCardWidth = Math.min(unclampedCardWidth, MAX_CARD_WIDTH_PX)
  const resultCardHeight =
    resultCardWidth === unclampedCardWidth
      ? stage.height * RESULT_CARD_FILL_RATIO
      : resultCardWidth * CARD_ASPECT_RATIO

  const drawer = computeDrawer(viewport, stage, resultCardHeight)
  const envelope = computeEnvelope(draw.width, draw.height, sizes.gap)
  const cards: CardLayout[] = [
    {
      slotId: 'center',
      x: 0,
      y: 0,
      width: resultCardWidth,
      height: resultCardHeight,
      rotateDeg: 0,
      zIndex: 1,
    },
  ]
  return {
    cards,
    cardWidth: resultCardWidth,
    cardHeight: resultCardHeight,
    drawCardWidth: draw.width,
    drawCardHeight: draw.height,
    stageShiftY: 0,
    stage,
    drawer,
    envelope,
  }
}

/**
 * Solve the draw-stage layout — three-pile grid where each pile is one
 * draw card and the drawer stays anchored at the stage bottom (the
 * drawer is closed during shuffle / cut / draw, but the geometry is
 * still emitted for downstream consumers that branch on it).
 */
function solveDrawStageLayout(
  viewport: PhysicalViewport,
  sizes: ResponsiveSizes,
  stage: StageRect,
  draw: { width: number; height: number },
): SceneLayout {
  // cardBottom collapses to `stage.y + stage.height` per the formula in
  // computeDrawer's docstring when `cardHeight === stage.height`.
  const drawer = computeDrawer(viewport, stage, stage.height)
  const envelope = computeEnvelope(draw.width, draw.height, sizes.gap)
  const cards: CardLayout[] = [
    {
      slotId: 'center',
      x: 0,
      y: 0,
      width: draw.width,
      height: draw.height,
      rotateDeg: 0,
      zIndex: 1,
    },
  ]
  return {
    cards,
    cardWidth: draw.width,
    cardHeight: draw.height,
    drawCardWidth: draw.width,
    drawCardHeight: draw.height,
    stageShiftY: 0,
    stage,
    drawer,
    envelope,
  }
}

/**
 * Solve the layout for one scene.
 *
 * Pure function: identical inputs produce identical outputs, no side effects.
 *
 * Strategy
 * ────────
 *  1. Compute the stage rect — largest 1:1.6 box that fits the canvas
 *     after subtracting margins, header, safe areas, and (on the reading
 *     scene) the bottom drawer + action-area reservation. The stage is
 *     centred horizontally and pinned below the header.
 *  2. Compute the 3-pile draw card size from the stage (one card per pile).
 *  3. Dispatch to the per-scene composer:
 *     - reading_stage: `solveReadingStageLayout` (single result card +
 *       bottom drawer anchored to its bottom edge).
 *     - draw_stage: `solveDrawStageLayout` (one centered slot + drawer
 *       anchored to the stage bottom).
 */
export function solveLayout(input: SolveLayoutInput): SceneLayout {
  const { viewport, sizes, scene } = input
  const reservation = scene === 'reading_stage'
    ? readingStageReservation(viewport, sizes)
    : 0
  const stage = computeStage(viewport, sizes, reservation)
  const draw = computeDrawCardSize(stage, sizes)
  return scene === 'reading_stage'
    ? solveReadingStageLayout(viewport, sizes, stage, draw)
    : solveDrawStageLayout(viewport, sizes, stage, draw)
}
