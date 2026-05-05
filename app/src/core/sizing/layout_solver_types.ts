/**
 * Name: core/sizing/layout_solver/types
 * Purpose: output / input types for the layout solver. Holds the
 *          interfaces (`CardLayout`, `DrawerGeometry`, `LayoutEnvelope`,
 *          `StageRect`, `SceneLayout`, `SceneKind`, `SolveLayoutInput`)
 *          shared by the per-scene computers and the public solver
 *          facade.
 * Reason: extracted from the monolithic `layout_solver.ts` (was 345
 *          lines) so the type surface stays small and importable
 *          without dragging in the imperative solver code. Type-only
 *          consumers (style_reconciler, composables, views) keep their
 *          existing imports because the facade re-exports everything.
 */

import type { PhysicalViewport, ResponsiveSizes } from './scale'

/**
 * Single card placement on the stage. Coordinates are stage-relative with the
 * origin at the stage center (matches the existing style_reconciler contract).
 */
export interface CardLayout {
  slotId: string
  /** Stage-relative x of card center, origin = stage center. */
  x: number
  /** Stage-relative y of card center, origin = stage center. */
  y: number
  /** Card width in px. */
  width: number
  /** Card height in px. */
  height: number
  /** Card rotation in degrees. */
  rotateDeg: number
  /** Stack order. */
  zIndex: number
}

/** Drawer placement and size, in viewport-absolute px coordinates. */
export interface DrawerGeometry {
  /** Distance from the top of the viewport to the drawer's initial top edge. */
  initialTop: number
  /** Initial drawer height (= viewport.height - safeAreaBottom - initialTop). */
  initialHeight: number
  /** Maximum drawer height when fully expanded. */
  maxHeight: number
  /** Drawer width in px. */
  width: number
  /**
   * True when drawer is anchored to the right side. Always false in the new
   * model (drawer is always a bottom sheet) — the field is kept so consumers
   * that branch on it continue to compile until the wide-split UI is removed
   * in a later step.
   */
  rightAligned: boolean
}

/**
 * Sizing envelope for shuffle/cut motion bounds. Always derived from the
 * 3-pile draw-stage grid so animations stay inside the safe frame regardless
 * of which scene we're currently rendering.
 */
export interface LayoutEnvelope {
  cardWidth: number
  cardHeight: number
  gap: number
  horizontalSlots: number
  verticalSlots: number
  /** Distance between slot centers along x (= cardWidth + gap). */
  slotPitchX: number
  /** Distance between slot centers along y (= cardHeight + gap). */
  slotPitchY: number
  /** Half of the total horizontal extent of the slot grid. */
  halfSpanX: number
  /** Half of the total vertical extent of the slot grid. */
  halfSpanY: number
  /** Total horizontal extent of the slot grid. */
  fullSpanX: number
  /** Total vertical extent of the slot grid. */
  fullSpanY: number
}

/** Stage rectangle on the viewport (absolute px coordinates). */
export interface StageRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Full scene layout. Field names `cards`, `cardWidth`, `cardHeight`,
 * `drawCardWidth`, `drawCardHeight`, `stageShiftY` are preserved because
 * style_reconciler.ts depends on them.
 */
export interface SceneLayout {
  // ----- preserved field names (style_reconciler.ts depends on these) -----
  cards: CardLayout[]
  /**
   * Card width for the current scene. On the reading scene this is the
   * "shrunk" size (computed against the stage rect that already subtracts
   * the bottom drawer reservation) — matches the visual the user sees once
   * the drawer is open. The "full" size used the moment the reveal
   * animation lands (drawer not yet mounted) is exposed separately as
   * `cardWidthFull` / `cardHeightFull`.
   */
  cardWidth: number
  /** Card height for the current scene (see `cardWidth` for semantics). */
  cardHeight: number
  /**
   * Reading-scene card width before the drawer mounts — computed against
   * the full safe-area rect (no bottom drawer reservation), still capped
   * by `MAX_CARD_WIDTH_PX`. On `draw_stage` this equals `cardWidth`
   * because the draw stage doesn't reserve drawer space.
   */
  cardWidthFull: number
  /** Reading-scene card height before the drawer mounts. See `cardWidthFull`. */
  cardHeightFull: number
  /** Uniform draw-stage card width (shuffle / cut / draw share this size). */
  drawCardWidth: number
  /** Uniform draw-stage card height. */
  drawCardHeight: number
  /**
   * Vertical offset applied to the stage layer. Always 0 in the new model
   * — the card is centred in the stage rect on every scene, so no shift
   * is required to align the result card with the draw card.
   */
  stageShiftY: number
  // ----- new fields -----
  stage: StageRect
  drawer: DrawerGeometry
  envelope: LayoutEnvelope
}

export type SceneKind = 'draw_stage' | 'reading_stage'

export interface SolveLayoutInput {
  viewport: PhysicalViewport
  sizes: ResponsiveSizes
  scene: SceneKind
}
