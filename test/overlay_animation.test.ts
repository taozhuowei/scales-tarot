// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadingResult, TarotCardInfo } from '../app/src/utils/tarotReading'

const mockGlobalTimeline = vi.hoisted(() => ({
  timeScale: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}))

const mockKillTweensOf = vi.hoisted(() => vi.fn())

const activeTimers: ReturnType<typeof setTimeout>[] = []

function clearActiveTimers() {
  while (activeTimers.length > 0) {
    const timer = activeTimers.pop()
    if (timer) clearTimeout(timer)
  }
}

vi.mock('gsap', () => {
  function timeline(config?: { onComplete?: () => void }) {
    return {
      to() {
        return this
      },
      fromTo() {
        return this
      },
      add(callback: (() => void) | unknown, position?: number | string) {
        if (typeof callback === 'function') {
          const delay = typeof position === 'number' ? position * 1000 : 0
          const timer = setTimeout(() => callback(), delay)
          activeTimers.push(timer)
        }
        return this
      },
      kill() {
        return this
      },
      progress() {
        config?.onComplete?.()
        return this
      },
    }
  }

  function to(target: Record<string, number>, vars: Record<string, unknown>) {
    if ('value' in target && typeof vars.value === 'number') {
      target.value = vars.value
    }

    if (typeof vars.onUpdate === 'function') {
      vars.onUpdate()
    }

    return {
      kill: vi.fn(),
    }
  }

  return {
    default: {
      timeline,
      to,
      killTweensOf: mockKillTweensOf,
      globalTimeline: mockGlobalTimeline,
    },
  }
})

const mockResolveSpreadLayout = vi.hoisted(() => vi.fn())

vi.mock('../app/src/utils/spread_layout', () => ({
  resolveSpreadLayout: mockResolveSpreadLayout,
}))

function makeCard(): TarotCardInfo {
  return {
    id: 'the_sun',
    name: '太阳',
    nameEn: 'The Sun',
    number: 19,
    type: 'major',
    image: 'http://localhost:3000/static/themes/golden_dawn/tarot/major/major_arcana_19_the_sun.jpeg',
    upright: {
      keywords: ['明朗'],
      meaning: '正位含义',
      sentiment: 'positive',
    },
    reversed: {
      keywords: ['迟缓'],
      meaning: '逆位含义',
      sentiment: 'negative',
    },
  }
}

function makeReadingResult(): ReadingResult {
  const card = makeCard()
  return {
    result: 'positive',
    score: 7,
    cardDetails: [
      {
        card,
        position: 'upright',
        meaning: card.upright.meaning,
      },
    ],
  }
}

describe('use_overlay_animation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearActiveTimers()
    mockGlobalTimeline.timeScale.mockClear()
    mockGlobalTimeline.pause.mockClear()
    mockGlobalTimeline.resume.mockClear()
    mockKillTweensOf.mockClear()
    mockResolveSpreadLayout.mockImplementation(({ containerWidth, containerHeight }: { containerWidth: number; containerHeight: number }) => ({
      cardWidth: 172,
      cardHeight: 275,
      stageShiftY: 48,
      cards: [
        {
          x: 0,
          y: Math.round(containerHeight * 0.1),
          width: 172,
          height: 275,
        },
      ],
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
    clearActiveTimers()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function mountHarness() {
    const { useOverlayAnimation } = await import('../app/src/composables/use_overlay_animation')

    const tarotStore = {
      spreadKind: 'single_card',
      drawnCards: [
        {
          card: makeCard(),
          position: 'upright' as const,
        },
      ],
      readingResult: null,
      drawCards: vi.fn(),
      setPhase: vi.fn(),
      startReadingRequest: vi.fn().mockResolvedValue(makeReadingResult()),
      waitForReadingResult: vi.fn().mockResolvedValue(makeReadingResult()),
      revealResult: vi.fn(),
    }

    const themeStore = {
      cardBackImage: '',
    }

    let exposedAnimation: ReturnType<typeof useOverlayAnimation> | null = null

    const Harness = defineComponent({
      setup(_, { expose }) {
        const anim = useOverlayAnimation({
          tarotStore: tarotStore as never,
          themeStore: themeStore as never,
          isWide: ref(false),
          cardCount: ref(1),
          emit: (() => undefined) as never,
        })

        exposedAnimation = anim
        expose({ anim })
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    return {
      wrapper,
      tarotStore,
      anim: exposedAnimation!,
    }
  }

  it('updates playback controls through gsap global timeline', async () => {
    const { anim } = await mountHarness()

    anim.setPlaybackRate(2)
    expect(anim.playbackRate.value).toBe(2)
    expect(mockGlobalTimeline.timeScale).toHaveBeenLastCalledWith(2)

    anim.pauseAnimations()
    expect(anim.isPaused.value).toBe(true)
    expect(mockGlobalTimeline.pause).toHaveBeenCalled()

    anim.resumeAnimations()
    expect(anim.isPaused.value).toBe(false)
    expect(mockGlobalTimeline.resume).toHaveBeenCalled()
  })

  it('keeps drawing phase before the additional reveal delay elapses', async () => {
    const { anim, tarotStore } = await mountHarness()

    anim.replayFromPhase('drawing')
    expect(anim.phase.value).toBe('drawing')

    await vi.advanceTimersByTimeAsync(0)
    expect(tarotStore.drawCards).toHaveBeenCalledTimes(1)
    expect(tarotStore.startReadingRequest).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(7000)
    expect(anim.phase.value).toBe('drawing')

    await vi.advanceTimersByTimeAsync(250)
    expect(anim.phase.value).toBe('revealing')
    expect(tarotStore.setPhase).toHaveBeenCalledWith('revealing')
  })

  it('can replay directly from revealing phase for dev tools', async () => {
    const { anim, tarotStore } = await mountHarness()

    anim.replayFromPhase('revealing')
    expect(anim.phase.value).toBe('revealing')
    expect(tarotStore.setPhase).toHaveBeenCalledWith('revealing')
    expect(tarotStore.drawCards).not.toHaveBeenCalled()
  })
})
