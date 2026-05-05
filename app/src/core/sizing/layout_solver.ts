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
 * Result-card sizing primitive — given a stage rect, return the card
 * `(width, height)` that occupies `RESULT_CARD_FILL_RATIO` of the rect
 * on each axis with the width capped at `MAX_CARD_WIDTH_PX`. When the
 * cap engages, height is derived from the capped width via
 * `CARD_ASPECT_RATIO` so the 1:1.6 proportion is preserved on the
 * largest supported canvases.
 *
 * Used by both the "full" and "shrunk" reading-stage card derivations:
 *  - full  → stage rect computed without drawer reservation (safe area
 *            ≈ 80–90 % of viewport on a typical phone, so the resulting
 *            card width hits the 240 px cap on every supported viewport).
 *  - shrunk → stage rect with the drawer reservation already subtracted
 *             (the original sizing used while the bottom drawer is open).
 */
function fitResultCard(stage: StageRect): { width: number; height: number } {
  const unclampedW = stage.width * RESULT_CARD_FILL_RATIO
  const width = Math.min(unclampedW, MAX_CARD_WIDTH_PX)
  const height =
    width === unclampedW
      ? stage.height * RESULT_CARD_FILL_RATIO
      : width * CARD_ASPECT_RATIO
  return { width, height }
}

/**
 * Solve the reading-stage layout — single result card centred in the
 * shrunk stage with the bottom drawer anchored to the card's bottom edge.
 *
 * Two card sizes are emitted:
 *   1. shrunk (`cardWidth` / `cardHeight`) — fitted to the drawer-reserved
 *      stage rect. This is what the user sees once the drawer mounts
 *      (drawer covers the lower band, card sits in the remaining space).
 *      Drawer geometry is anchored to *this* size's card bottom so the
 *      drawer hugs the card after the user-visible shrink animation.
 *   2. full (`cardWidthFull` / `cardHeightFull`) — fitted to the full
 *      safe-area stage rect (no drawer reservation). The reveal pipeline
 *      grows the card to this size first; the parent then animates it
 *      down to the shrunk size when the drawer mounts.
 *
 * On every supported phone canvas (375–440 px) both sizes hit the 240 px
 * width cap because the unclamped width (≈90 % of stage width) exceeds
 * 240 px in both rectangles. The visual difference is in the height: the
 * full rect's stage is taller, so the full card is taller too (and the
 * shrunk card sits above the drawer instead of being clipped by it).
 */
function solveReadingStageLayout(
  viewport: PhysicalViewport,
  sizes: ResponsiveSizes,
  stageShrunk: StageRect,
  stageFull: StageRect,
  draw: { width: number; height: number },
): SceneLayout {
  const shrunk = fitResultCard(stageShrunk)
  const full = fitResultCard(stageFull)

  const drawer = computeDrawer(viewport, stageShrunk, shrunk.height)
  const envelope = computeEnvelope(draw.width, draw.height, sizes.gap)
  const cards: CardLayout[] = [
    {
      slotId: 'center',
      x: 0,
      y: 0,
      width: shrunk.width,
      height: shrunk.height,
      rotateDeg: 0,
      zIndex: 1,
    },
  ]
  return {
    cards,
    cardWidth: shrunk.width,
    cardHeight: shrunk.height,
    cardWidthFull: full.width,
    cardHeightFull: full.height,
    drawCardWidth: draw.width,
    drawCardHeight: draw.height,
    stageShiftY: 0,
    stage: stageShrunk,
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
    // The draw stage doesn't reserve drawer space, so "full" and "shrunk"
    // collapse to the same size. Exposing both keeps the SceneLayout shape
    // uniform across scenes for consumers that want to read the full size
    // without branching on scene.
    cardWidthFull: draw.width,
    cardHeightFull: draw.height,
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
  if (scene === 'reading_stage') {
    // Two stage rects feed the reading scene:
    //   - stageShrunk: the safe-area minus the bottom drawer reservation
    //     (= INITIAL_DRAWER_HEIGHT_RATIO × viewport.height + actionAreaH).
    //     This is the rect the result card lives in *while the drawer is
    //     open*; everything else (drawer geometry, draw card size, motion
    //     envelope) anchors to it because the draw-pile grid still shares
    //     the same horizontal extent.
    //   - stageFull: the full safe-area rect (no drawer reservation).
    //     This is the rect the result card grows into right after reveal,
    //     before the drawer mounts. Used only to derive `cardWidthFull` /
    //     `cardHeightFull`.
    const reservation = readingStageReservation(viewport, sizes)
    const stageShrunk = computeStage(viewport, sizes, reservation)
    const stageFull = computeStage(viewport, sizes, 0)
    const draw = computeDrawCardSize(stageShrunk, sizes)
    return solveReadingStageLayout(viewport, sizes, stageShrunk, stageFull, draw)
  }
  const stage = computeStage(viewport, sizes, 0)
  const draw = computeDrawCardSize(stage, sizes)
  return solveDrawStageLayout(viewport, sizes, stage, draw)
}
