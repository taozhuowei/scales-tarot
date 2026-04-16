// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveSceneLayout } from '../app/src/utils/overlay_layout/index'
import { resolveCardSize } from '../app/src/utils/overlay_layout/card_size_solver'
import type { OverlayViewportMetrics } from '../app/src/utils/overlay_viewport'

function makeViewport(
  windowWidth: number,
  windowHeight: number,
  isWide: boolean,
): OverlayViewportMetrics {
  return {
    topBarHeight: isWide ? 0 : 44,
    headerBottom: isWide ? 60 : 140,
    footerReserve: isWide ? 80 : 120,
    stageWidth: windowWidth,
    stageHeight: windowHeight,
    stageContainerHeight: windowHeight,
    resultHeight: 0,
  }
}

describe('overlay_layout scene bounds', () => {
  it('fits three_card spread inside a narrow iPhone viewport', () => {
    const layout = resolveSceneLayout({
      spreadId: 'three_card',
      scene: 'draw_stage',
      viewport: makeViewport(390, 844, false),
      isWide: false,
      cardAspectRatio: 1.6,
    })

    const maxX = Math.max(...layout.cards.map((c) => Math.abs(c.x)))
    const maxY = Math.max(...layout.cards.map((c) => Math.abs(c.y)))
    const halfSafeWidth = layout.envelope.fullSpanX / 2
    const halfSafeHeight = layout.envelope.fullSpanY / 2

    // Card centers plus half dimensions must stay inside the safe frame
    expect(maxX + layout.cardWidth / 2).toBeLessThanOrEqual(halfSafeWidth + 1)
    expect(maxY + layout.cardHeight / 2).toBeLessThanOrEqual(halfSafeHeight + 1)
  })

  it('fits cross_spread inside a wide iPad viewport', () => {
    const layout = resolveSceneLayout({
      spreadId: 'cross_spread',
      scene: 'draw_stage',
      viewport: makeViewport(1024, 768, true),
      isWide: true,
      cardAspectRatio: 1.6,
    })

    const maxX = Math.max(...layout.cards.map((c) => Math.abs(c.x)))
    const maxY = Math.max(...layout.cards.map((c) => Math.abs(c.y)))
    expect(maxX + layout.cardWidth / 2).toBeLessThanOrEqual(layout.envelope.fullSpanX / 2 + 1)
    expect(maxY + layout.cardHeight / 2).toBeLessThanOrEqual(layout.envelope.fullSpanY / 2 + 1)
  })

  it('keeps single_card inside safe frame on a small viewport', () => {
    const layout = resolveSceneLayout({
      spreadId: 'single_card',
      scene: 'result_stage',
      viewport: makeViewport(320, 568, false),
      isWide: false,
      cardAspectRatio: 1.6,
    })

    expect(layout.cards).toHaveLength(1)
    const card = layout.cards[0]
    expect(Math.abs(card.x) + card.width / 2).toBeLessThanOrEqual(layout.envelope.fullSpanX / 2 + 1)
    expect(Math.abs(card.y) + card.height / 2).toBeLessThanOrEqual(layout.envelope.fullSpanY / 2 + 1)
  })
})

describe('overlay_layout focus-scale + badge margin', () => {
  it('shrinks card width when focus scale is applied', () => {
    const base = resolveCardSize({
      safeWidth: 500,
      safeHeight: 800,
      cardAspectRatio: 1.6,
      horizontalSlots: 3,
      verticalSlots: 1,
      focusScale: 1,
      badgeOverflowPx: 0,
    })

    const focused = resolveCardSize({
      safeWidth: 500,
      safeHeight: 800,
      cardAspectRatio: 1.6,
      horizontalSlots: 3,
      verticalSlots: 1,
      focusScale: 1.42,
      badgeOverflowPx: 0,
    })

    expect(focused.cardWidth).toBeLessThan(base.cardWidth)
  })

  it('shrinks card width when badge overflow is applied', () => {
    const base = resolveCardSize({
      safeWidth: 400,
      safeHeight: 800,
      cardAspectRatio: 1.6,
      horizontalSlots: 3,
      verticalSlots: 1,
      focusScale: 1,
      badgeOverflowPx: 0,
    })

    const withBadge = resolveCardSize({
      safeWidth: 400,
      safeHeight: 800,
      cardAspectRatio: 1.6,
      horizontalSlots: 3,
      verticalSlots: 1,
      focusScale: 1,
      badgeOverflowPx: 12,
    })

    expect(withBadge.cardWidth).toBeLessThanOrEqual(base.cardWidth)
  })

  it('keeps focused card + badge within safe width for a 3-slot horizontal spread', () => {
    const safeWidth = 390
    const badgeOverflowPx = 6
    const focusScale = 1.42

    const envelope = resolveCardSize({
      safeWidth,
      safeHeight: 800,
      cardAspectRatio: 1.6,
      horizontalSlots: 3,
      verticalSlots: 1,
      focusScale,
      badgeOverflowPx,
    })

    // The outer edge of a focused card plus badge must not exceed safe half-width
    const halfSpan = envelope.halfSpanX
    const outerEdge = envelope.cardWidth / 2 + badgeOverflowPx
    const focusedOuterEdge = outerEdge * focusScale

    expect(halfSpan + focusedOuterEdge).toBeLessThanOrEqual(safeWidth / 2 + 1)
  })

  it('keeps focused card + badge within safe height for a vertical spread', () => {
    const safeHeight = 600
    const badgeOverflowPx = 6
    const focusScale = 1.2

    const envelope = resolveCardSize({
      safeWidth: 400,
      safeHeight,
      cardAspectRatio: 1.6,
      horizontalSlots: 1,
      verticalSlots: 3,
      focusScale,
      badgeOverflowPx,
    })

    const halfSpan = envelope.halfSpanY
    const outerEdge = envelope.cardHeight / 2 + badgeOverflowPx
    const focusedOuterEdge = outerEdge * focusScale

    expect(halfSpan + focusedOuterEdge).toBeLessThanOrEqual(safeHeight / 2 + 1)
  })
})
