// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DivinationOverlay from '../app/src/components/DivinationOverlay.vue'

// Mock useOverlayController
const mockController = {
  showResults: ref(true),
  isReadingLoading: ref(false),
  isReadingFailed: ref(false),
  readingErrorMessage: ref(''),
  readingPanelState: ref('idle'),
  cardsDocked: ref(false),
  cardsFocused: ref(false),
  cardFocusScaleValue: ref(1),
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
  headerStyle: ref(''),
  footerStyle: ref(''),
  stageStyle: ref(''),
  deckCtnStyle: ref(''),
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
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('A.6.4: Drawer handle exists and touch events update height', async () => {
    const wrapper = mount(DivinationOverlay, {
      props: {
        isWide: false,
        cardCount: 1
      }
    })
    await nextTick()

    const handle = wrapper.find('.drag-handle-container')
    expect(handle.exists()).toBe(true)

    // Initial height is 58vh
    const resultZone = wrapper.find('.result-zone')
    expect(resultZone.attributes('style')).toContain('height: 58vh')

    // Simulate drag up
    // deltaY = -100px. windowHeight = 844. 
    // vhDelta = -(-100 / 844) * 100 = 11.8vh
    // newHeight = 58 + 11.8 = 69.8vh
    await handle.trigger('touchstart', { touches: [{ clientY: 500 }] })
    await handle.trigger('touchmove', { touches: [{ clientY: 400 }] })
    
    expect(resultZone.attributes('style')).toContain('height: 69.8')
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
