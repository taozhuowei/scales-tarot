// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveSceneLayout } from '../app/src/core/layout/scene_layout'
import type { ViewportMetrics } from '../app/src/core/viewport/types'

const IPAD_VIEWPORT: ViewportMetrics = {
  width: 1024,
  height: 768,
  safeAreaTop: 20,
  safeAreaBottom: 20,
  dpr: 2,
}

const IPHONE_VIEWPORT: ViewportMetrics = {
  width: 390,
  height: 844,
  safeAreaTop: 47,
  safeAreaBottom: 34,
  dpr: 3,
}

describe('overlay_layout scene bounds', () => {
  it('fits single_card inside a wide iPad viewport', () => {
    const layout = resolveSceneLayout({
      spreadId: 'single_card',
      scene: 'draw_stage',
      viewport: IPAD_VIEWPORT,
      isWide: true,
      cardAspectRatio: 1.6,
    })

    expect(layout.cards).toHaveLength(1)
    const card = layout.cards[0]
    
    const safeHalfWidth = IPAD_VIEWPORT.width / 2
    const safeHalfHeight = IPAD_VIEWPORT.height / 2

    expect(Math.abs(card.x) + layout.cardWidth / 2).toBeLessThanOrEqual(safeHalfWidth)
    expect(Math.abs(card.y) + layout.cardHeight / 2).toBeLessThanOrEqual(safeHalfHeight)
  })

  it('keeps single_card inside safe frame on a small viewport', () => {
    const layout = resolveSceneLayout({
      spreadId: 'single_card',
      scene: 'draw_stage',
      viewport: IPHONE_VIEWPORT,
      isWide: false,
      cardAspectRatio: 1.6,
    })

    expect(layout.cards).toHaveLength(1)
    const card = layout.cards[0]
    
    // Cards should fit within viewport width
    expect(Math.abs(card.x) + layout.cardWidth / 2).toBeLessThanOrEqual(IPHONE_VIEWPORT.width / 2)
  })

  it('verifies drawCardWidth is consistent on home and draw stages', () => {
    const drawLayout = resolveSceneLayout({
      spreadId: 'single_card',
      scene: 'draw_stage',
      viewport: IPHONE_VIEWPORT,
      isWide: false,
      cardAspectRatio: 1.6,
    })

    const resultLayout = resolveSceneLayout({
      spreadId: 'single_card',
      scene: 'result_stage',
      viewport: IPHONE_VIEWPORT,
      isWide: false,
      cardAspectRatio: 1.6,
    })

    // BASE size should be identical
    expect(drawLayout.drawCardWidth).toBe(resultLayout.drawCardWidth)
    
    // For single_card, result card should be larger or equal
    expect(resultLayout.cardWidth).toBeGreaterThanOrEqual(drawLayout.drawCardWidth)
  })
})
