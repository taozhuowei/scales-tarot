// @vitest-environment node

/**
 * Test suite for the proportional-sizes layout solver.
 *
 * Coverage matrix: 5 viewports × 2 scenes = 10 cases. The new solver is a
 * pure function of (PhysicalViewport, ResponsiveSizes, scene) and produces
 * a single 1:1.6 stage rect (= result card on the reading scene), three
 * draw piles tiling the stage horizontally with `gap` breathing, and a
 * bottom-sheet drawer pinned to the stage's lower edge.
 *
 * Inputs are passed as plain literals — no window mocking, no DOM access.
 */

import { describe, expect, it } from 'vitest'
import {
  solveLayout,
  type SceneKind,
} from '../app/src/core/sizing/layout_solver'
import {
  deriveSizes,
  pickCanvasWidth,
  CARD_ASPECT_RATIO,
  RESULT_CARD_FILL_RATIO,
  type PhysicalViewport,
} from '../app/src/core/sizing/scale'
import { INITIAL_DRAWER_HEIGHT_RATIO } from '../app/src/core/config/layout_constants'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a PhysicalViewport with the canvas width clamped to the supported
 * envelope [375, 440]. Matches the runtime call sites — every consumer
 * pipes the raw viewport width through `pickCanvasWidth` before feeding it
 * to the solver, so the test reproduces that exact shape.
 */
function makeViewport(
  actualWidth: number,
  height: number,
  safeTop = 0,
  safeBottom = 0,
): PhysicalViewport {
  return {
    width: pickCanvasWidth(actualWidth),
    height,
    safeAreaTop: safeTop,
    safeAreaBottom: safeBottom,
  }
}

interface ViewportFixture {
  label: string
  actualWidth: number
  height: number
  safeAreaTop: number
  safeAreaBottom: number
}

// Real-device matrix. Each row is a popular shipping device sized at the
// logical pixel values its stock browser reports at default zoom. The two
// rows beyond MAX_CANVAS_WIDTH (iPad portrait, MacBook Air) verify that
// large screens collapse to the canvas cap (440) for the solver while the
// rest of the screen stays empty / centred at the CSS layer.
const VIEWPORTS: ViewportFixture[] = [
  { label: 'iPhone 8 (375×667)', actualWidth: 375, height: 667, safeAreaTop: 20, safeAreaBottom: 0 },
  { label: 'iPhone 12 (390×844)', actualWidth: 390, height: 844, safeAreaTop: 47, safeAreaBottom: 34 },
  { label: 'iPhone 17 Pro Max (440×956)', actualWidth: 440, height: 956, safeAreaTop: 47, safeAreaBottom: 34 },
  { label: 'iPad portrait (768×1024)', actualWidth: 768, height: 1024, safeAreaTop: 0, safeAreaBottom: 0 },
  { label: 'MacBook Air (1440×900)', actualWidth: 1440, height: 900, safeAreaTop: 0, safeAreaBottom: 0 },
]

const SCENES: SceneKind[] = ['draw_stage', 'reading_stage']

const EPS = 1e-6

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('layout_solver — proportional-sizes layout solver', () => {
  for (const fixture of VIEWPORTS) {
    for (const scene of SCENES) {
      it(`${fixture.label} / ${scene}: produces a valid layout`, () => {
        const viewport = makeViewport(
          fixture.actualWidth,
          fixture.height,
          fixture.safeAreaTop,
          fixture.safeAreaBottom,
        )
        const sizes = deriveSizes(viewport.width)
        const layout = solveLayout({ viewport, sizes, scene })

        // -------------------------------------------------------------------
        // (0) Sanity — all sizes positive and finite.
        // -------------------------------------------------------------------
        expect(layout.cardWidth).toBeGreaterThan(0)
        expect(layout.cardHeight).toBeGreaterThan(0)
        expect(layout.drawCardWidth).toBeGreaterThan(0)
        expect(layout.drawCardHeight).toBeGreaterThan(0)
        expect(Number.isFinite(layout.drawer.initialHeight)).toBe(true)

        // -------------------------------------------------------------------
        // (1) Stage centered horizontally in the canvas; pinned below the
        //     header (safeAreaTop + margin + headerHeight).
        // -------------------------------------------------------------------
        expect(layout.stage.x).toBeCloseTo((viewport.width - layout.stage.width) / 2, 5)
        expect(layout.stage.y).toBeCloseTo(
          viewport.safeAreaTop + sizes.margin + sizes.headerHeight,
          5,
        )

        // -------------------------------------------------------------------
        // (2) Stage 1.6 aspect ratio.
        // -------------------------------------------------------------------
        expect(Math.abs(layout.stage.height / layout.stage.width - CARD_ASPECT_RATIO))
          .toBeLessThan(1e-6)

        // -------------------------------------------------------------------
        // (3) Stage stays inside the viewport.
        // -------------------------------------------------------------------
        expect(layout.stage.x).toBeGreaterThanOrEqual(-EPS)
        expect(layout.stage.y).toBeGreaterThanOrEqual(-EPS)
        expect(layout.stage.x + layout.stage.width).toBeLessThanOrEqual(viewport.width + EPS)
        expect(layout.stage.y + layout.stage.height).toBeLessThanOrEqual(
          viewport.height - viewport.safeAreaBottom + EPS,
        )

        // -------------------------------------------------------------------
        // (4) Draw card: 3 piles tile the stage horizontally with `gap`
        //     breathing on each end and between piles.
        //     stageW = 3 × drawCardWidth + 4 × gap.
        // -------------------------------------------------------------------
        const reconstructedStageW =
          3 * layout.drawCardWidth + 4 * sizes.gap
        expect(reconstructedStageW).toBeCloseTo(layout.stage.width, 4)
        expect(layout.drawCardHeight / layout.drawCardWidth).toBeCloseTo(
          CARD_ASPECT_RATIO,
          5,
        )

        // -------------------------------------------------------------------
        // (5) Drawer geometry: bottom-sheet anchored to the result card's
        //     bottom edge for `initialTop`. On the reading scene the card
        //     is shrunk to RESULT_CARD_FILL_RATIO of the stage so the
        //     anchor sits higher; on the draw scene the card height equals
        //     the stage height (anchor at stage bottom).
        //
        //     Formula: cardBottom = stage.y + (stage.height + cardHeight) / 2
        //
        //     Per requirement N3, `initialHeight` is decoupled from
        //     `initialTop` and fixed at INITIAL_DRAWER_HEIGHT_RATIO of the
        //     viewport — the drawer may overlap the card on first reveal.
        //     `maxHeight` still represents the fully-expanded sheet bound
        //     by safeAreaBottom and is the reference for the upper bound
        //     of the drawer span.
        // -------------------------------------------------------------------
        expect(layout.drawer.rightAligned).toBe(false)
        expect(layout.drawer.width).toBeCloseTo(viewport.width, 5)
        const expectedCardHeight = scene === 'reading_stage'
          ? layout.stage.height * RESULT_CARD_FILL_RATIO
          : layout.stage.height
        const expectedDrawerTop =
          layout.stage.y + (layout.stage.height + expectedCardHeight) / 2
        expect(layout.drawer.initialTop).toBeCloseTo(expectedDrawerTop, 5)
        expect(layout.drawer.initialHeight).toBe(
          Math.round(viewport.height * INITIAL_DRAWER_HEIGHT_RATIO),
        )
        expect(layout.drawer.maxHeight).toBeCloseTo(
          viewport.height - viewport.safeAreaBottom,
          5,
        )

        // -------------------------------------------------------------------
        // (6) Envelope: 3 horizontal slots, 1 vertical slot, derived from
        //     the draw card size.
        // -------------------------------------------------------------------
        expect(layout.envelope.horizontalSlots).toBe(3)
        expect(layout.envelope.verticalSlots).toBe(1)
        expect(layout.envelope.cardWidth).toBeCloseTo(layout.drawCardWidth, 5)
        expect(layout.envelope.cardHeight).toBeCloseTo(layout.drawCardHeight, 5)
        expect(layout.envelope.gap).toBe(sizes.gap)

        // -------------------------------------------------------------------
        // (7) Cards array: single placeholder at stage center.
        // -------------------------------------------------------------------
        expect(layout.cards).toHaveLength(1)
        expect(layout.cards[0]?.slotId).toBe('center')
        expect(layout.cards[0]?.x).toBeCloseTo(0, 5)
        expect(layout.cards[0]?.y).toBeCloseTo(0, 5)
        expect(layout.stageShiftY).toBeCloseTo(0, 5)

        // -------------------------------------------------------------------
        // (8) Scene-specific assertions.
        // -------------------------------------------------------------------
        if (scene === 'reading_stage') {
          // Result card occupies RESULT_CARD_FILL_RATIO of the stage rect
          // on each axis (90%). Stage rect itself is unchanged.
          const expectedW = layout.stage.width * RESULT_CARD_FILL_RATIO
          const expectedH = layout.stage.height * RESULT_CARD_FILL_RATIO
          expect(layout.cardWidth).toBeCloseTo(expectedW, 5)
          expect(layout.cardHeight).toBeCloseTo(expectedH, 5)
          expect(layout.cards[0]?.width).toBeCloseTo(expectedW, 5)
          expect(layout.cards[0]?.height).toBeCloseTo(expectedH, 5)
        } else {
          // draw_stage: card size matches the 3-pile draw card.
          expect(layout.cardWidth).toBeCloseTo(layout.drawCardWidth, 5)
          expect(layout.cardHeight).toBeCloseTo(layout.drawCardHeight, 5)
        }
      })
    }
  }

  it('drawCardWidth / drawCardHeight are identical between scenes on the same viewport', () => {
    for (const fixture of VIEWPORTS) {
      const viewport = makeViewport(
        fixture.actualWidth,
        fixture.height,
        fixture.safeAreaTop,
        fixture.safeAreaBottom,
      )
      const sizes = deriveSizes(viewport.width)
      const draw = solveLayout({ viewport, sizes, scene: 'draw_stage' })
      const result = solveLayout({ viewport, sizes, scene: 'reading_stage' })
      expect(result.drawCardWidth).toBeCloseTo(draw.drawCardWidth, 5)
      expect(result.drawCardHeight).toBeCloseTo(draw.drawCardHeight, 5)
    }
  })

  it('Canvases above 440px collapse to the cap (large screen → phone-sized stage)', () => {
    const ipad = makeViewport(768, 1024, 0, 0)
    const desktop = makeViewport(1440, 900, 0, 0)
    expect(ipad.width).toBe(440)
    expect(desktop.width).toBe(440)
    const ipadTokens = deriveSizes(ipad.width)
    const desktopTokens = deriveSizes(desktop.width)
    expect(ipadTokens.canvasWidth).toBe(440)
    expect(desktopTokens.canvasWidth).toBe(440)
  })
})
