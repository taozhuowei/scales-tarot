// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveOverlaySafeFrame } from '../app/src/utils/overlay_layout/overlay_safe_frame'
import type { OverlayViewportMetrics } from '../app/src/utils/overlay_viewport'

function makeViewport(overrides: Partial<OverlayViewportMetrics> = {}): OverlayViewportMetrics {
  return {
    topBarHeight: 0,
    headerBottom: 60,
    footerReserve: 80,
    stageWidth: 390,
    stageHeight: 844,
    stageContainerHeight: 844,
    resultHeight: 0,
    ...overrides,
  }
}

describe('overlay_safe_frame', () => {
  it('reserves top and bottom insets in draw stage', () => {
    const frame = resolveOverlaySafeFrame('draw_stage', makeViewport())

    expect(frame.topInset).toBeGreaterThan(0)
    expect(frame.bottomInset).toBeGreaterThan(0)
    expect(frame.width).toBeLessThan(390)
    expect(frame.height).toBeLessThan(844)
  })

  it('reserves smaller insets in result stage than draw stage', () => {
    const draw = resolveOverlaySafeFrame('draw_stage', makeViewport())
    const result = resolveOverlaySafeFrame('result_stage', makeViewport())

    expect(result.topInset).toBeLessThan(draw.topInset)
    expect(result.bottomInset).toBeLessThanOrEqual(draw.bottomInset)
  })

  it('caps bottom inset at footer reserve', () => {
    const viewport = makeViewport({ footerReserve: 10 })
    const frame = resolveOverlaySafeFrame('draw_stage', viewport)

    expect(frame.bottomInset).toBe(10)
  })

  it('centers the safe frame vertically via centerYOffset', () => {
    const viewport = makeViewport({ headerBottom: 60, footerReserve: 80 })
    const frame = resolveOverlaySafeFrame('draw_stage', viewport)

    // Draw stage: centerYOffset shifts up by footerReserve/2 to account for the action bar
    // that occupies the bottom of the viewport below the stage-container.
    expect(frame.centerYOffset).toBe((frame.topInset - frame.bottomInset) / 2 + viewport.footerReserve / 2)
    expect(frame.stageCenterY).toBe(frame.centerYOffset)
  })

  it('does not apply footerReserve offset in result stage', () => {
    const viewport = makeViewport({ headerBottom: 60, footerReserve: 80 })
    const frame = resolveOverlaySafeFrame('result_stage', viewport)

    expect(frame.centerYOffset).toBe((frame.topInset - frame.bottomInset) / 2)
  })

  it('side inset changes between draw and result stages', () => {
    const draw = resolveOverlaySafeFrame('draw_stage', makeViewport())
    const result = resolveOverlaySafeFrame('result_stage', makeViewport())

    expect(draw.sideInset).not.toBe(result.sideInset)
  })

  it('keeps width and height non-negative even with extreme insets', () => {
    const viewport = makeViewport({ headerBottom: 2000, footerReserve: 2000 })
    const frame = resolveOverlaySafeFrame('draw_stage', viewport)

    // Width only shrinks by side insets, which are modest.
    expect(frame.width).toBe(390 - frame.sideInset * 2)
    // Height clamps to 0 because top+bottom insets exceed stage height.
    expect(frame.height).toBe(0)
  })
})
