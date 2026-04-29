// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, isRef } from 'vue'
import type { Ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { TarotCardInfo } from '../app/src/utils/tarot_reading'

// The controller calls storeToRefs(tarotStore); mocking the cards API the
// deck store reads at module init keeps useTarotStore() constructible
// without hitting the network. The reading + draw paths are not exercised
// by these tests, so they need no further mocking.
const mockFetchAllCards = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock('../app/src/api/cards', () => ({
  fetchAllCards: mockFetchAllCards,
}))

vi.mock('gsap', () => ({
  default: {
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
      to: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
      add: vi.fn().mockReturnThis(),
      kill: vi.fn(),
      clear: vi.fn(),
      timeScale: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      time: vi.fn(),
      seek: vi.fn(),
    })),
    to: vi.fn().mockReturnValue({ kill: vi.fn() }),
    killTweensOf: vi.fn(),
  },
  timeline: vi.fn(() => ({
    fromTo: vi.fn().mockReturnThis(),
    to: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    kill: vi.fn(),
    clear: vi.fn(),
    timeScale: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    time: vi.fn(),
    seek: vi.fn(),
  })),
  to: vi.fn().mockReturnValue({ kill: vi.fn() }),
  killTweensOf: vi.fn(),
}))

vi.mock('../app/src/utils/overlay_layout/index', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../app/src/utils/overlay_layout/index')>()
  return {
    ...mod,
    resolveSceneLayout: vi.fn(() => ({
      cardWidth: 172,
      cardHeight: 275,
      stageShiftY: 48,
      cards: [{ x: 0, y: 0, width: 172, height: 275 }],
      safeTopInset: 0,
      safeBottomInset: 0,
      safeSideInset: 0,
      envelope: {
        cardWidth: 172,
        cardHeight: 275,
        gap: 16,
        horizontalSlots: 1,
        verticalSlots: 1,
        slotPitchX: 188,
        slotPitchY: 291,
        halfSpanX: 0,
        halfSpanY: 0,
        fullSpanX: 172,
        fullSpanY: 275,
      },
    })),
  }
})

function makeCard(): TarotCardInfo {
  return {
    id: 'test_card',
    name: 'Test Card',
    nameEn: 'Test Card',
    number: 0,
    type: 'major',
    image: '/test.jpg',
    upright: {
      keywords: ['test'],
      meaning: 'Test upright meaning',
      sentiment: 'positive',
    },
    reversed: {
      keywords: ['test reversed'],
      meaning: 'Test reversed meaning',
      sentiment: 'negative',
    },
  }
}

describe('use_overlay_controller result-zone sizing', () => {
  const windowHeight = 844
  const windowWidth = 390

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.stubGlobal('uni', {
      getWindowInfo: () => ({
        windowWidth,
        windowHeight,
      }),
      onWindowResize: vi.fn(),
      offWindowResize: vi.fn(),
      getMenuButtonBoundingClientRect: () => ({
        top: 12,
        height: 32,
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function mountHarness(isWide: boolean | Ref<boolean> = false) {
    const isWideRef = isRef(isWide) ? isWide : ref(isWide)

    const { useOverlayController } = await import('../app/src/composables/use_overlay_controller')
    const { useTarotStore } = await import('../app/src/stores/tarot')

    const tarotStore = useTarotStore()
    tarotStore.drawnCards = [{ card: makeCard(), position: 'upright' }]
    tarotStore.currentQuestion = 'Test question'
    tarotStore.setPhase = vi.fn() as never
    tarotStore.revealResult = vi.fn() as never

    const themeStore = {
      cardBackImage: '',
      getUiAsset: vi.fn((name: string) => `/icons/${name}.png`),
    }

    let exposedController: ReturnType<typeof useOverlayController> | null = null

    const Harness = defineComponent({
      setup(_, { expose }) {
        const controller = useOverlayController({
          tarotStore: tarotStore as never,
          themeStore: themeStore as never,
          isWide: isWideRef as never,
          cardCount: ref(1),
          emit: (() => undefined) as never,
        })
        exposedController = controller
        expose({ controller })
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    return {
      wrapper,
      controller: exposedController!,
      isWideRef,
    }
  }

  // resultZoneStyle and stageContainerStyle were removed in d4cd310 when the
  // overlay flow stopped composing explicit sizing styles in the controller
  // (DivinationOverlay.vue now derives them from individual refs). Assertions
  // for those properties were dropped; remaining tests cover state/API surface.

  it('exposes reading error states through controller', async () => {
    const { controller } = await mountHarness()
    
    // Reading state properties should be exposed
    expect(controller.isReadingFailed).toBeDefined()
    expect(controller.isReadingLoading).toBeDefined()
    expect(controller.readingErrorMessage).toBeDefined()
    expect(controller.readingPanelState).toBeDefined()
    
    // These should be computed refs
    expect(controller.isReadingFailed.value).toBe(false)
    expect(controller.isReadingLoading.value).toBe(false)
  })

  it('provides retry functionality through controller', async () => {
    const { controller } = await mountHarness()
    
    expect(controller.retryReading).toBeTypeOf('function')
  })

  it('exposes overlayVarsStyle for CSS custom properties', async () => {
    const { controller } = await mountHarness()

    expect(controller.overlayVarsStyle).toBeDefined()
    expect(controller.overlayVarsStyle.value).toContain('--card-width:')
    expect(controller.overlayVarsStyle.value).toContain('--card-height:')
    expect(controller.overlayVarsStyle.value).toContain('--result-card-lift-y:')
  })

  it('overlayVarsStyle reflects result-card lift state', async () => {
    const isWideRef = ref(false)
    const { controller } = await mountHarness(isWideRef)

    const defaultStyle = controller.overlayVarsStyle.value
    expect(defaultStyle).toContain('--result-card-lift-y: 0px')

    controller.showResults.value = true
    await nextTick()

    const liftMatch = controller.overlayVarsStyle.value.match(/--result-card-lift-y: ([\d.]+)px/)
    expect(liftMatch).not.toBeNull()
    const liftY = parseFloat(liftMatch![1])
    expect(liftY).toBeGreaterThan(0)

    isWideRef.value = true
    await nextTick()
    expect(controller.overlayVarsStyle.value).toContain('--result-card-lift-y: 0px')
  })

  it('cardsFocused and cardsDocked reflect result state', async () => {
    const { controller } = await mountHarness()

    // Default state: no results, cards not landed
    expect(controller.cardsFocused.value).toBe(false)
    expect(controller.cardsDocked.value).toBe(false)

    // Simulate result phase
    controller.showResults.value = true
    await nextTick()

    // When results are shown but reading hasn't succeeded, cards are focused
    expect(controller.cardsFocused.value).toBe(true)
    expect(controller.cardsDocked.value).toBe(false)
  })
})
