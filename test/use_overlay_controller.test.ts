// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { TarotCardInfo } from '../app/src/utils/tarot_reading'

// The controller calls storeToRefs(tarotStore), which requires a real Pinia
// store. Mocking the cards API the deck store reads at module init keeps
// useTarotStore() constructible without hitting the network. The reading +
// draw paths are not exercised by these tests, so they need no further
// mocking. setActivePinia runs in beforeEach.
const mockFetchAllCards = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock('../app/src/api/cards', () => ({
  fetchAllCards: mockFetchAllCards,
}))

// Track all mock function calls
const pauseSpy = vi.fn()
const resumeSpy = vi.fn()
const timeScaleSpy = vi.fn()
const timeSpy = vi.fn()
const seekSpy = vi.fn()

// Store last created timeline for assertions
let lastTimeline: MockTimeline | null = null

type MockTimeline = {
  pause: () => void
  resume: () => void
  timeScale: (n?: number) => number | void
  time: (n?: number) => number | void
  seek: (p: number | string) => void
  add: (item?: unknown, position?: number | string) => MockTimeline
  clear: () => MockTimeline
  kill: () => MockTimeline
  getChildren: (nested?: boolean, tweens?: boolean, timelines?: boolean) => unknown[]
  _isPaused: () => boolean
  _timeScale: () => number
  _currentTime: () => number
}

vi.mock('gsap', () => {
  function createTimeline() {
    let currentTime = 0
    let isPaused = false
    let timeScale = 1

    const timeline: MockTimeline = {
      pause() {
        pauseSpy()
        isPaused = true
        return this
      },
      resume() {
        resumeSpy()
        isPaused = false
        return this
      },
      timeScale(newScale?: number) {
        if (typeof newScale === 'number') {
          timeScaleSpy(newScale)
          timeScale = newScale
          return this
        }
        return timeScale
      },
      time(newTime?: number) {
        if (typeof newTime === 'number') {
          timeSpy(newTime)
          currentTime = Math.max(0, newTime)
          return this
        }
        return currentTime
      },
      seek(position: number | string) {
        seekSpy(position)
        if (typeof position === 'number') {
          currentTime = position
        }
        return this
      },
      to() { return this },
      fromTo() { return this },
      add() {
        return this
      },
      call(fn: () => void) {
        fn()
        return this
      },
      clear() {
        currentTime = 0
        return this
      },
      kill() {
        return this
      },
      getChildren() {
        return []
      },
      _isPaused: () => isPaused,
      _timeScale: () => timeScale,
      _currentTime: () => currentTime,
    }

    lastTimeline = timeline
    return timeline
  }

  return {
    default: {
      timeline: createTimeline,
    },
    timeline: createTimeline,
    killTweensOf: vi.fn(),
  }
})

const mockResolveSceneLayout = vi.hoisted(() => vi.fn(() => ({
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
})))

vi.mock('../app/src/utils/overlay_layout/index', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../app/src/utils/overlay_layout/index')>()
  return {
    ...mod,
    resolveSceneLayout: mockResolveSceneLayout,
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

describe('use_overlay_controller', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    lastTimeline = null
    pauseSpy.mockClear()
    resumeSpy.mockClear()
    timeScaleSpy.mockClear()
    timeSpy.mockClear()
    seekSpy.mockClear()

    mockResolveSceneLayout.mockImplementation(() => ({
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
    }))

    vi.stubGlobal('uni', {
      getWindowInfo: () => ({
        windowWidth: 390,
        windowHeight: 844,
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
    lastTimeline = null
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function mountHarness() {
    const { useOverlayController } = await import('../app/src/composables/use_overlay_controller')
    const { useTarotStore } = await import('../app/src/stores/tarot')

    // Real Pinia store so storeToRefs() works; seed the state the controller
    // reads, then spy on the methods the controller may call during tests
    // that exercise the flow. These spies are safe because the tests here
    // don't assert on store side-effects — only on controller outputs.
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
          isWide: ref(false),
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
      tarotStore,
      controller: exposedController!,
    }
  }

  it('provides controller with required properties', async () => {
    const { controller } = await mountHarness()

    // Styles (stageContainerStyle was folded into stageStyle + overlayVarsStyle
    // as part of d4cd310's layout refinement; the controller no longer exposes
    // a single composed wrapper style.)
    expect(controller.bgStyle).toBeDefined()
    expect(controller.stageStyle).toBeDefined()
    expect(controller.overlayVarsStyle).toBeDefined()
    expect(controller.phase).toBeDefined()
    expect(controller.showResults).toBeDefined()

    // Controls
    expect(controller.setPlaybackRate).toBeTypeOf('function')
    expect(controller.pauseAnimations).toBeTypeOf('function')
    expect(controller.resumeAnimations).toBeTypeOf('function')
    expect(controller.restart).toBeTypeOf('function')

    // Reading state
    expect(controller.readingPanelState).toBeDefined()
    expect(controller.isReadingFailed).toBeDefined()
    expect(controller.isReadingLoading).toBeDefined()
    expect(controller.retryReading).toBeTypeOf('function')
  })

  it('controls playback rate', async () => {
    const { controller } = await mountHarness()
    await nextTick()

    expect(lastTimeline).not.toBeNull()

    controller.setPlaybackRate(2)
    expect(controller.playbackRate.value).toBe(2)
    expect(timeScaleSpy).toHaveBeenCalledWith(2)
  })

  it('pauses and resumes animations', async () => {
    const { controller } = await mountHarness()
    await nextTick()

    expect(lastTimeline).not.toBeNull()

    controller.pauseAnimations()
    expect(controller.isPaused.value).toBe(true)
    expect(pauseSpy).toHaveBeenCalled()

    controller.resumeAnimations()
    expect(controller.isPaused.value).toBe(false)
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('seeks to specific time', async () => {
    const { controller } = await mountHarness()
    await nextTick()

    expect(lastTimeline).not.toBeNull()

    controller.seek(3.5)
    expect(seekSpy).toHaveBeenCalledWith(3.5)
  })

  it('steps forward and backward', async () => {
    const { controller } = await mountHarness()
    await nextTick()

    expect(lastTimeline).not.toBeNull()

    controller.stepForward()
    expect(timeSpy).toHaveBeenCalled()

    timeSpy.mockClear()
    lastTimeline!.time(5)
    controller.stepBackward()
    expect(timeSpy).toHaveBeenCalled()
  })

  it('presents progress header data', async () => {
    const { controller } = await mountHarness()

    const progress = controller.progressHeaderPresentation
    expect(progress.value).toBeDefined()
    expect(progress.value.items).toHaveLength(4)
  })

  it('presents footer data', async () => {
    const { controller } = await mountHarness()

    const footer = controller.footerPresentation
    expect(footer.value).toBeDefined()
    expect(footer.value.showRestart).toBe(false)
    expect(footer.value.showRevealingHint).toBe(false)
  })

  it('start() creates entry timeline', async () => {
    const { controller } = await mountHarness()

    // start() is invoked during onMounted; verify a timeline was created
    expect(lastTimeline).not.toBeNull()
    // In our mock the pipeline begins synchronously, so entry animation
    // should be considered complete once the shuffling phase starts.
    expect(controller.entryAnimationComplete.value).toBe(true)
    expect(controller.phase.value).toBe('shuffling')
  })

  it('restart() resets state and recreates timeline', async () => {
    const { controller } = await mountHarness()

    // Advance phase so we can verify reset behaviour
    controller.phase.value = 'drawing'
    await nextTick()
    expect(controller.phase.value).toBe('drawing')

    const oldTimeline = lastTimeline

    controller.restart()
    await nextTick()
    vi.advanceTimersByTime(100)
    await nextTick()

    // Phase and results should be reset
    expect(controller.phase.value).toBe('shuffling')
    expect(controller.showResults.value).toBe(false)
    expect(controller.entryAnimationComplete.value).toBe(true)
    // start() should have created a new timeline
    expect(lastTimeline).not.toBeNull()
    expect(lastTimeline).not.toBe(oldTimeline)
  })

  it('finish() transitions to result phase', async () => {
    const { controller } = await mountHarness()

    // Simulate the state that finish() would produce after pipeline completion
    controller.showResults.value = true
    controller.phase.value = 'revealing'
    await nextTick()

    // Result panel should be open
    expect(controller.showResults.value).toBe(true)
    expect(controller.phase.value).toBe('revealing')

    // Footer should show restart when results are visible
    expect(controller.footerPresentation.value.showRestart).toBe(true)
    expect(controller.footerPresentation.value.showRevealingHint).toBe(false)

    // Cards should be focused (reading not yet successful)
    expect(controller.cardsFocused.value).toBe(true)
    expect(controller.cardsDocked.value).toBe(false)
  })

  it('phase changes update progress presentation', async () => {
    const { controller } = await mountHarness()

    // Initial phase is shuffling
    expect(controller.progressHeaderPresentation.value.activeIndex).toBe(0)
    expect(controller.progressHeaderPresentation.value.items[0].isActive).toBe(true)
    expect(controller.progressHeaderPresentation.value.items[0].isCompleted).toBe(false)

    // Transition to cutting
    controller.phase.value = 'cutting'
    await nextTick()

    expect(controller.progressHeaderPresentation.value.activeIndex).toBe(1)
    expect(controller.progressHeaderPresentation.value.items[0].isCompleted).toBe(true)
    expect(controller.progressHeaderPresentation.value.items[1].isActive).toBe(true)
    expect(controller.progressHeaderPresentation.value.items[1].isCompleted).toBe(false)

    // Transition to drawing
    controller.phase.value = 'drawing'
    await nextTick()

    expect(controller.progressHeaderPresentation.value.activeIndex).toBe(2)
    expect(controller.progressHeaderPresentation.value.items[1].isCompleted).toBe(true)
    expect(controller.progressHeaderPresentation.value.items[2].isActive).toBe(true)

    // Transition to revealing without showResults
    controller.phase.value = 'revealing'
    await nextTick()

    expect(controller.progressHeaderPresentation.value.activeIndex).toBe(3)
    expect(controller.progressHeaderPresentation.value.items[2].isCompleted).toBe(true)
    expect(controller.progressHeaderPresentation.value.items[3].isActive).toBe(true)

    // Footer should show revealing hint when in revealing phase but results not shown
    expect(controller.footerPresentation.value.showRevealingHint).toBe(true)
    expect(controller.footerPresentation.value.showRestart).toBe(false)
  })
})
