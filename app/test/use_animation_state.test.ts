// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useAnimationState } from '../src/flows/shared/composables/animations/use_animation_state'

function mountHarness(opts: {
  deckCount: number
  shuffleHalfCount: number
  maxCutPiles: number
  maxCardCount: number
}) {
  let exposed: ReturnType<typeof useAnimationState> | null = null
  const Harness = defineComponent({
    setup() {
      exposed = useAnimationState(opts)
      return () => h('div')
    },
  })
  mount(Harness)
  return exposed!
}

describe('useAnimationState', () => {
  it('initializes style refs with correct defaults', () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    expect(state.bgStyle.value).toEqual({ opacity: '0' })
    expect(state.headerStyle.value).toEqual({ transform: 'translateY(60px)', opacity: '0' })
    expect(state.footerStyle.value).toEqual({ transform: 'translateY(60px)', opacity: '0' })
    expect(state.drawsVisible.value).toEqual([false, false, false, false, false])
  })

  it('setDrawCardSizes updates size refs and drawsSizeStyle', async () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    state.setDrawCardSizes({
      cards: [{ x: 0, y: 0, width: 120, height: 192, rotateDeg: 0, zIndex: 20 }],
      stageShiftY: 0,
      cardWidth: 120,
      cardHeight: 192,
      safeTopInset: 0,
      safeBottomInset: 0,
      safeSideInset: 0,
      envelope: {
        cardWidth: 120,
        cardHeight: 192,
        gap: 16,
        horizontalSlots: 1,
        verticalSlots: 1,
        slotPitchX: 136,
        slotPitchY: 208,
        halfSpanX: 0,
        halfSpanY: 0,
        fullSpanX: 120,
        fullSpanY: 192,
      },
    })
    await nextTick()

    expect(state.layoutCardWidth.value).toBe(120)
    expect(state.layoutCardHeight.value).toBe(192)
    expect(state.drawsSizeStyle.value[0]).toEqual({ width: '120px', height: '192px' })
    expect(state.overlayVarsStyle.value).toContain('--card-width: 120px')
    expect(state.overlayVarsStyle.value).toContain('--card-height: 192px')
  })

  it('watchEffect auto-syncs bgStyle when bg.opacity changes', async () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    state.bg.opacity = 0.5
    await nextTick()
    expect(state.bgStyle.value).toEqual({ opacity: '0.5' })

    state.bg.opacity = 1
    await nextTick()
    expect(state.bgStyle.value).toEqual({ opacity: '1' })
  })

  it('watchEffect auto-syncs drawsStyle when draws mutate', async () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    Object.assign(state.draws[0], { x: 10, y: 20, rotation: 15, scale: 1.1, opacity: 0.8, zIndex: 25 })
    await nextTick()

    expect(state.drawsStyle.value[0].transform).toContain('translateX(calc(-50% + 10px))')
    expect(state.drawsStyle.value[0].transform).toContain('translateY(calc(-50% + 20px))')
    expect(state.drawsStyle.value[0].transform).toContain('rotate(15deg)')
    expect(state.drawsStyle.value[0].transform).toContain('scale(1.1)')
    expect(state.drawsStyle.value[0].opacity).toBe('0.8')
    expect(state.drawsStyle.value[0].zIndex).toBe('25')
  })

  it('card style string does NOT contain will-change: transform', async () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    Object.assign(state.draws[0], { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 20 })
    await nextTick()

    expect(state.drawsStyle.value[0].willChange).toBeUndefined()
  })

  it('resetShuffleVisualState clears lefts and rights', async () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    state.leftsVisible.value = true
    state.lefts[0].x = 100
    state.rights[0].x = 100

    state.resetShuffleVisualState()
    await nextTick()

    expect(state.leftsVisible.value).toBe(false)
    expect(state.leftsStyle.value[0].transform).toContain('translateX(0px)')
    expect(state.rightsStyle.value[0].opacity).toBe('0')
  })

  it('resetDrawVisualState clears draws and inners', async () => {
    const state = mountHarness({ deckCount: 12, shuffleHalfCount: 6, maxCutPiles: 3, maxCardCount: 5 })

    state.drawsVisible.value = [true, false, false, false, false]
    state.draws[0].x = 50
    state.inners[0].rotationY = 180

    state.resetDrawVisualState()
    await nextTick()

    expect(state.drawsVisible.value[0]).toBe(false)
    expect(state.drawsStyle.value[0].transform).toContain('translateX(calc(-50% + 0px))')
    expect(state.innersStyle.value[0]).toEqual({ transform: 'rotateY(0deg)' })
  })

  it('getAllTargets returns all animation target objects', () => {
    const state = mountHarness({ deckCount: 2, shuffleHalfCount: 1, maxCutPiles: 1, maxCardCount: 1 })

    const targets = state.getAllTargets()
    expect(targets).toContain(state.bg)
    expect(targets).toContain(state.stage)
    expect(targets).toContain(state.draws[0])
    expect(targets).toContain(state.inners[0])
  })
})
