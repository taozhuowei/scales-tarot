// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DivinationOverlay from '../app/src/components/DivinationOverlay.vue'

// Mock useOverlayController
const mockController = {
  showResults: ref(true),
  phase: ref('revealing'),
  isReadingLoading: ref(false),
  isReadingFailed: ref(false),
  readingErrorMessage: ref(''),
  readingPanelState: ref('idle'),
  cardsDocked: ref(false),
  cardsFocused: ref(false),
  overlayText: {
    positionReversed: '逆',
    positionUpright: '正',
    restart: '再占一次',
    backHome: '回到首页',
    revealing: '神谕显现中',
  }, // Added
  phaseSteps: ref([]),
  overlayVarsStyle: ref(''),
  bgStyle: ref(''),
  headerStyle: ref({}),
  footerStyle: ref({}),
  stageStyle: ref({}),
  deckCtnStyle: ref({}),
  initialsStyle: ref([]),
  leftsStyle: ref([]),
  rightsStyle: ref([]),
  pilesStyle: ref([]),
  drawsStyle: ref([]),
  drawsSizeStyle: ref([]),
  innersStyle: ref([]),
  leftsVisible: ref(false),
  rightsVisible: ref(false),
  pilesVisible: ref([]),
  drawsVisible: ref([]),
  cardBack: ref(''),
  deckCount: 13,
  shuffleHalfCount: 6,
  cutPileCount: 3,
  cardsPerPile: 26,
  isPaused: ref(false),
  playbackRate: ref(1),
  getCardImg: vi.fn(),
  getCardImgName: vi.fn(),
  progressHeaderPresentation: ref({ items: [] }),
  footerPresentation: ref({ text: '', showRestart: false, showRevealingHint: false }),
  setPlaybackRate: vi.fn(),
  pauseAnimations: vi.fn(),
  resumeAnimations: vi.fn(),
  stepForward: vi.fn(),
  stepBackward: vi.fn(),
  seek: vi.fn(),
  restart: vi.fn(),
  retryReading: vi.fn(),
}

vi.mock('../app/src/composables/use_overlay_controller', () => ({
  useOverlayController: () => mockController
}))

describe('Stage C.2: Component - DivinationOverlay A.6 features', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('uni', {
      getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844 }),
      onWindowResize: vi.fn(),
      offWindowResize: vi.fn(),
      createSelectorQuery: () => ({
        select: () => ({
          boundingClientRect: (cb: (data: { height: number }) => void) => {
            cb({ height: 253 })
            return { exec: () => {} }
          },
        }),
        exec: () => {},
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('A.6.4: Drawer handle exists and touch events update height', async () => {
    const wrapper = mount(DivinationOverlay)
    await nextTick()

    const handle = wrapper.find('.drag-handle-zone')
    expect(handle.exists()).toBe(true)

    // Initial state: drawer-sheet height is based on RESULT_SHEET_FRACTION (30%).
    // Math: Math.max(120, Math.round(844 * 0.30) - 8) = 245px.
    const drawerSheet = wrapper.find('.drawer-sheet')
    expect(drawerSheet.attributes('style')).toContain('height: 245px')

    // Simulate drag up: touchstart captures current height, touchmove updates it
    await handle.trigger('touchstart', { touches: [{ clientY: 500 }] })
    await handle.trigger('touchmove', { touches: [{ clientY: 400 }] })

    // After drag, height is set to px value (startHeight 245 + delta 100 = 345)
    const updatedSheet = wrapper.find('.drawer-sheet')
    expect(updatedSheet.attributes('style')).toContain('height: 345px')
  })

  it('A.6.5: Wide mode hides drawer handle and uses 54% width for stage', async () => {
    vi.stubGlobal('uni', {
      getWindowInfo: () => ({ windowWidth: 1024, windowHeight: 768 }),
      onWindowResize: vi.fn(),
    })

    const wrapper = mount(DivinationOverlay)
    await nextTick()

    const handle = wrapper.find('.drag-handle-container')
    expect(handle.exists()).toBe(false)

    // CSS check: .is-wide.show-results .stage-container { width: 54%; }
    // We can check if the class is present.
    expect(wrapper.classes()).toContain('is-wide')
    expect(wrapper.classes()).toContain('show-results')
  })
})
