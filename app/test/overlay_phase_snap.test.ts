// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  PHASE_MANIFEST,
  getPhaseSnap,
  getPhaseOrder,
  MAX_CUT_PILES,
  type PhaseSnapDeps,
} from '../src/core/animation/phases/registry'
import { MAX_CARD_COUNT } from '../src/core/animation/state'
import type { SceneLayout } from '../src/core/sizing/layout_solver'

/**
 * Build a fully-populated PhaseSnapDeps for snap-helper unit tests. Mirrors
 * the shape useLifecycle.getPhaseSnapDeps() builds at runtime; uses plain
 * arrays / refs so we can assert against direct mutations.
 */
function makeSnapDeps(overrides: Partial<{
  cardCount: number
  cutPileCount: number
  shuffleSpreadX: number
  cutPileSpacing: number
  cutAxis: 'horizontal' | 'vertical'
  drawCardWidth: number
  drawCardHeight: number
}> = {}): PhaseSnapDeps {
  const cardCount = overrides.cardCount ?? 3
  const cutPileCount = overrides.cutPileCount ?? 3
  const shuffleSpreadX = overrides.shuffleSpreadX ?? 120
  const cutPileSpacing = overrides.cutPileSpacing ?? 80
  const cutAxis = overrides.cutAxis ?? 'horizontal'
  const drawCardWidth = overrides.drawCardWidth ?? 100
  const drawCardHeight = overrides.drawCardHeight ?? 160

  const lefts = Array.from({ length: 6 }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
  }))
  const rights = Array.from({ length: 6 }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
  }))
  const piles = Array.from({ length: MAX_CUT_PILES }, (_, i) => ({
    x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 + i,
  }))
  const draws = Array.from({ length: MAX_CARD_COUNT }, (_, i) => ({
    x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 20 - i, width: 0, height: 0,
  }))
  const inners = Array.from({ length: MAX_CARD_COUNT }, () => ({ rotationY: 0 }))
  const initials = Array.from({ length: 12 }, (_, i) => ({
    x: 0, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
  }))

  const drawLayout: SceneLayout = {
    drawCardWidth,
    drawCardHeight,
    cardWidth: drawCardWidth,
    cardHeight: drawCardHeight,
    stageShiftY: 0,
    cards: Array.from({ length: cardCount }, (_, i) => ({
      x: (i - (cardCount - 1) / 2) * 110,
      y: 0,
      width: drawCardWidth,
      height: drawCardHeight,
    })),
  } as unknown as SceneLayout

  return {
    cardElements: {
      initials,
      lefts,
      rights,
      piles,
      draws,
      inners,
      stage: { y: 0 },
      deckCtn: { x: 0 },
      bg: { opacity: 1 },
      header: { y: 0, opacity: 1 },
      footer: { y: 0, opacity: 1 },
    },
    visible: {
      lefts: ref(false),
      rights: ref(false),
      piles: ref(Array.from({ length: MAX_CUT_PILES }, () => false)),
      draws: ref(Array.from({ length: MAX_CARD_COUNT }, () => false)),
    },
    draws,
    deckGeometry: { centerX: 0, centerY: 0 },
    drawLayout,
    cardCount,
    cutPileCount,
    shuffleSpreadX,
    cutPileSpacing,
    cutAxis,
    setDrawCardSizes: vi.fn(),
  }
}

describe('overlay_phase_snap', () => {
  describe('PHASE_MANIFEST', () => {
    it('has 4 entries with snapToEntryState fns in canonical order', () => {
      expect(PHASE_MANIFEST.map((m) => m.phase)).toEqual([
        'shuffling', 'cutting', 'drawing', 'revealing',
      ])
      PHASE_MANIFEST.forEach((m) => {
        expect(typeof m.snapToEntryState).toBe('function')
      })
    })

    it('getPhaseOrder mirrors the manifest', () => {
      expect(getPhaseOrder()).toEqual(['shuffling', 'cutting', 'drawing', 'revealing'])
    })

    it('getPhaseSnap returns a no-op for unknown phase', () => {
      const fn = getPhaseSnap('mystery' as never)
      expect(() => fn(makeSnapDeps())).not.toThrow()
    })
  })

  describe('snap shuffling (no-op)', () => {
    it('does not mutate visibility refs', () => {
      const deps = makeSnapDeps()
      const before = {
        lefts: deps.visible.lefts.value,
        rights: deps.visible.rights.value,
      }
      getPhaseSnap('shuffling')(deps)
      expect(deps.visible.lefts.value).toBe(before.lefts)
      expect(deps.visible.rights.value).toBe(before.rights)
    })
  })

  describe('snap cutting', () => {
    it('shows lefts/rights at spread positions with opacity 1', () => {
      const deps = makeSnapDeps({ shuffleSpreadX: 150 })
      getPhaseSnap('cutting')(deps)

      expect(deps.visible.lefts.value).toBe(true)
      expect(deps.visible.rights.value).toBe(true)

      deps.cardElements.lefts.forEach((s, i) => {
        expect(s.x).toBe(-150)
        expect(s.y).toBe(-(i * 0.8))
        expect(s.rotation).toBe(0)
        expect(s.scale).toBe(1)
        expect(s.opacity).toBe(1)
      })
      deps.cardElements.rights.forEach((s, i) => {
        expect(s.x).toBe(150)
        expect(s.y).toBe(-(i * 0.8))
        expect(s.opacity).toBe(1)
      })
    })

    it('preserves cardElements identity (no array swap)', () => {
      const deps = makeSnapDeps()
      const leftsRef = deps.cardElements.lefts
      const rightsRef = deps.cardElements.rights
      getPhaseSnap('cutting')(deps)
      expect(deps.cardElements.lefts).toBe(leftsRef)
      expect(deps.cardElements.rights).toBe(rightsRef)
    })
  })

  describe('snap drawing', () => {
    it('hides lefts/rights and shows N piles centred along horizontal axis', () => {
      const deps = makeSnapDeps({ cutPileCount: 3, cutPileSpacing: 100, cutAxis: 'horizontal' })
      getPhaseSnap('drawing')(deps)

      expect(deps.visible.lefts.value).toBe(false)
      expect(deps.visible.rights.value).toBe(false)

      const visiblePiles = deps.visible.piles.value
      expect(visiblePiles.slice(0, 3)).toEqual([true, true, true])
      expect(visiblePiles.slice(3)).toEqual(Array(MAX_CUT_PILES - 3).fill(false))

      // 3 piles centred → offsets -100, 0, +100
      const expectedX = [-100, 0, 100]
      for (let i = 0; i < 3; i++) {
        expect(deps.cardElements.piles[i].x).toBe(expectedX[i])
        expect(deps.cardElements.piles[i].y).toBe(0)
        expect(deps.cardElements.piles[i].opacity).toBe(1)
        expect(deps.cardElements.piles[i].zIndex).toBe(20 - i)
      }
    })

    it('positions piles along vertical axis when cutAxis is vertical', () => {
      const deps = makeSnapDeps({ cutPileCount: 2, cutPileSpacing: 80, cutAxis: 'vertical' })
      getPhaseSnap('drawing')(deps)

      // 2 piles → offsets -40, +40
      expect(deps.cardElements.piles[0].x).toBe(0)
      expect(deps.cardElements.piles[0].y).toBe(-40)
      expect(deps.cardElements.piles[1].x).toBe(0)
      expect(deps.cardElements.piles[1].y).toBe(40)
    })
  })

  describe('snap revealing', () => {
    it('calls setDrawCardSizes, lays out draws at target positions, hides extras', () => {
      const deps = makeSnapDeps({ cardCount: 3, drawCardWidth: 120, drawCardHeight: 200 })
      getPhaseSnap('revealing')(deps)

      // setDrawCardSizes invoked with the same drawLayout
      expect(deps.setDrawCardSizes).toHaveBeenCalledWith(deps.drawLayout)

      // First 3 draws positioned at the layout targets and visible
      const visibleDraws = deps.visible.draws.value
      for (let i = 0; i < 3; i++) {
        expect(deps.draws[i].x).toBe(deps.drawLayout.cards[i].x)
        expect(deps.draws[i].y).toBe(deps.drawLayout.cards[i].y)
        expect(deps.draws[i].width).toBe(120)
        expect(deps.draws[i].height).toBe(200)
        expect(deps.draws[i].opacity).toBe(1)
        expect(deps.draws[i].rotation).toBe(0)
        expect(deps.draws[i].scale).toBe(1)
        expect(deps.draws[i].zIndex).toBe(20 - i)
        expect(visibleDraws[i]).toBe(true)
      }
      // Remaining draws hidden
      for (let i = 3; i < deps.draws.length; i++) {
        expect(deps.draws[i].opacity).toBe(0)
        expect(visibleDraws[i]).toBe(false)
      }
      // All piles cleared
      expect(deps.visible.piles.value.every((v) => v === false)).toBe(true)
    })

    it('keeps the deps.draws reference identity equal to cardElements.draws', () => {
      const deps = makeSnapDeps()
      // PhaseSnapDeps.draws should point at the same array as cardElements.draws
      // (use_lifecycle wires both to animState.draws). The snap helper writes to
      // deps.draws — assert the contract holds for our test fixture.
      expect(deps.draws).toBe(deps.cardElements.draws)
    })

    it('hides every draw and clears piles when cardCount is 0', () => {
      // Edge case: zero-card spread. Solver still produces a drawLayout
      // (cards: []), but no draw should be visible and the snap must not
      // attempt to read drawLayout.cards[i] for any i.
      const deps = makeSnapDeps({ cardCount: 0 })
      // Override drawLayout to have an empty cards array (matches the real
      // solver's output for a 0-card scene).
      ;(deps as { drawLayout: SceneLayout }).drawLayout = {
        ...(deps.drawLayout as object),
        cards: [],
      } as SceneLayout

      expect(() => getPhaseSnap('revealing')(deps)).not.toThrow()

      // setDrawCardSizes still called once with the (empty-cards) layout.
      expect(deps.setDrawCardSizes).toHaveBeenCalledWith(deps.drawLayout)
      // No draw is visible.
      expect(deps.visible.draws.value.every((v) => v === false)).toBe(true)
      // All draws hidden (opacity 0).
      deps.draws.forEach((d) => expect(d.opacity).toBe(0))
      // Piles cleared regardless.
      expect(deps.visible.piles.value.every((v) => v === false)).toBe(true)
    })

    it('ignores cardCount entries beyond drawLayout.cards length without throwing', () => {
      // Edge case: cardCount overshoots the layout's available slots (would
      // happen if a layout solver mismatch slipped through). The snap's
      // `if (!target) continue` guard must skip those rather than crash.
      const deps = makeSnapDeps({ cardCount: 5 }) // factory layout has 3 cards
      // Trim the factory layout to fewer cards than cardCount.
      ;(deps as { drawLayout: SceneLayout }).drawLayout = {
        ...(deps.drawLayout as object),
        cards: (deps.drawLayout as { cards: { x: number; y: number; width: number; height: number }[] }).cards.slice(0, 2),
      } as SceneLayout
      ;(deps as { cardCount: number }).cardCount = 5

      expect(() => getPhaseSnap('revealing')(deps)).not.toThrow()

      // First 2 draws positioned at the layout targets and visible.
      expect(deps.draws[0].opacity).toBe(1)
      expect(deps.draws[1].opacity).toBe(1)
      // Draws 2..4 had no target — the loop continued past them so they were
      // never written and never marked visible. Subsequent indices fall into
      // the cleanup loop (i >= cardCount), which expects them hidden.
      // The 2..4 indices are in a "neither initialised nor cleaned" middle
      // zone; assert visibility still defaults to false (factory state).
      const visibleDraws = deps.visible.draws.value
      expect(visibleDraws[0]).toBe(true)
      expect(visibleDraws[1]).toBe(true)
      // The cleanup loop runs from cardCount (5) onward, so indices 2..4
      // remain at their factory default (false) — this verifies the snap
      // doesn't accidentally mark them true.
      expect(visibleDraws[2]).toBe(false)
      expect(visibleDraws[3]).toBe(false)
      expect(visibleDraws[4]).toBe(false)
    })
  })
})
