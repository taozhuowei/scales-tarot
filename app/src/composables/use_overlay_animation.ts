/**
 * Name: use_overlay_animation
 * Purpose: orchestrate overlay GSAP timelines while consuming pure viewport, layout, and reading-flow modules.
 * Reason: keep animation sequencing decoupled from card sizing, positioning, and request lifecycle rules.
 * Data flow: store state flows into pure layout/request helpers; GSAP state flows out to Vue style bindings.
 */

import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'
import gsap from 'gsap'
import { useTarotStore } from '../stores/tarot'
import { useThemeStore } from '../stores/theme'
import { CARD_BACK_IMAGE } from '../constants'
import {
  resolveOverlayCutLayout,
  resolveOverlayRevealMotion,
  resolveOverlaySceneLayout,
  type OverlaySceneLayout,
} from '../utils/overlay_layout'
import { createOverlayReadingFlow } from '../utils/overlay_reading_flow'
import {
  resolveOverlayViewport,
  type OverlayMenuButtonRect,
  type OverlayViewportMetrics,
} from '../utils/overlay_viewport'

const MAX_CARD_COUNT = 5
const AUTO_REVEAL_DELAY_MS = 800
const ENTRY_TO_SHUFFLE_DELAY_MS = 300

type OverlayPhase = 'shuffling' | 'cutting' | 'drawing' | 'revealing'
type ReadingPanelState = 'loading' | 'success' | 'error'

interface CardState {
  x: number
  y: number
  rotation: number
  scale: number
  scaleY: number
  opacity: number
}

interface CenterCardState {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
  zIndex: number
}

interface InnerState {
  rotationY: number
}

export function useOverlayAnimation(deps: {
  tarotStore: ReturnType<typeof useTarotStore>
  themeStore: ReturnType<typeof useThemeStore>
  isWide: Ref<boolean>
  cardCount: Ref<number>
  emit: ((event: 'complete') => void) & ((event: 'restart') => void)
}) {
  const phase = ref<OverlayPhase>('shuffling')
  const showResults = ref(false)
  const entryAnimationComplete = ref(false)
  const playbackRate = ref(1)
  const isPaused = ref(false)

  const layoutCardWidth = ref(172)
  const layoutCardHeight = ref(275)
  const overlayVarsStyle = computed(() =>
    `--card-width: ${layoutCardWidth.value}px; --card-height: ${layoutCardHeight.value}px`,
  )

  const masterTimeline = gsap.timeline({ paused: false })
  const cardBack = computed(() => deps.themeStore.cardBackImage || CARD_BACK_IMAGE)

  const readingFlow = createOverlayReadingFlow({
    hasResult: () => deps.tarotStore.readingResult !== null,
    startRequest: () => deps.tarotStore.startReadingRequest(),
    waitForResult: () => deps.tarotStore.waitForReadingResult(),
    getErrorMessage: () => deps.tarotStore.readingError,
  })

  const readingPanelState = computed<ReadingPanelState>(() => {
    if (readingFlow.status.value === 'failed') {
      return 'error'
    }

    if (readingFlow.status.value === 'ready' && deps.tarotStore.readingResult) {
      return 'success'
    }

    return 'loading'
  })
  const readingErrorMessage = computed(() => readingFlow.errorMessage.value ?? '')
  const isReadingFailed = computed(() => readingPanelState.value === 'error')
  const isReadingLoading = computed(() => readingPanelState.value === 'loading')

  function getCardImg(index: number): string {
    return deps.tarotStore.drawnCards[index]?.card.image || cardBack.value
  }

  const _bg = { opacity: 0 }
  const _stage = { y: 0 }
  const _header = { y: 60, opacity: 0 }
  const _footer = { y: 60, opacity: 0 }
  const _deckCtn = { x: 0 }
  const _initials: CardState[] = Array.from({ length: 12 }, (_, i) => ({
    x: 0, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
  }))
  const _lefts: CardState[] = Array.from({ length: 6 }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
  }))
  const _rights: CardState[] = Array.from({ length: 6 }, () => ({
    x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
  }))
  const _cutTop: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
  const _cutMid: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
  const _cutBot: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
  const _draws: CenterCardState[] = Array.from({ length: MAX_CARD_COUNT }, (_, i) => ({
    x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 20 - i,
  }))
  const _inners: InnerState[] = Array.from({ length: MAX_CARD_COUNT }, () => ({ rotationY: 0 }))

  const bgStyle = ref('opacity: 0')
  const stageStyle = ref('')
  const headerStyle = ref('transform: translateY(60px); opacity: 0')
  const footerStyle = ref('transform: translateY(60px); opacity: 0')
  const deckCtnStyle = ref('')
  const initialsStyle = ref<string[]>(
    _initials.map((_, i) => `transform: translateY(${-i * 0.8}px)`),
  )
  const leftsVisible = ref(false)
  const leftsStyle = ref<string[]>(Array.from({ length: 6 }, () => ''))
  const rightsVisible = ref(false)
  const rightsStyle = ref<string[]>(Array.from({ length: 6 }, () => ''))
  const cutTopVisible = ref(false)
  const cutMidVisible = ref(false)
  const cutBotVisible = ref(false)
  const cutTopStyle = ref('')
  const cutMidStyle = ref('')
  const cutBotStyle = ref('')
  const drawsVisible = ref<boolean[]>(Array(MAX_CARD_COUNT).fill(false))
  const drawsStyle = ref<string[]>(Array(MAX_CARD_COUNT).fill(''))
  const drawsSizeStyle = ref<{ width: string; height: string }[]>(
    Array.from({ length: MAX_CARD_COUNT }, () => ({ width: '', height: '' })),
  )
  const innersStyle = ref<string[]>(Array(MAX_CARD_COUNT).fill(''))

  const stageContainerHeightPx = ref(uni.getWindowInfo().windowHeight)
  const stageContainerStyle = computed(() => {
    if (deps.isWide.value || !showResults.value) {
      return 'height: 100vh'
    }

    return `height: ${stageContainerHeightPx.value}px`
  })
  const resultZoneStyle = computed(() => {
    if (!showResults.value) {
      return ''
    }

    const { windowHeight } = uni.getWindowInfo()
    if (deps.isWide.value) {
      return `height: ${windowHeight}px`
    }

    return `height: ${Math.max(windowHeight - stageContainerHeightPx.value, 0)}px`
  })

  function _cardStyleStr(state: CardState): string {
    const scaleY = state.scaleY !== 1 ? ` scaleY(${state.scaleY})` : ''
    return (
      `transform: translateX(${state.x}px) translateY(${state.y}px) rotate(${state.rotation}deg) scale(${state.scale})${scaleY};` +
      ` opacity: ${state.opacity}; will-change: transform`
    )
  }

  function _centerStyleStr(state: CenterCardState): string {
    return (
      `transform: translateX(calc(-50% + ${state.x}px)) translateY(calc(-50% + ${state.y}px))` +
      ` rotate(${state.rotation}deg) scale(${state.scale});` +
      ` opacity: ${state.opacity}; z-index: ${state.zIndex}; will-change: transform`
    )
  }

  function _cardSizeStyleStr(width: number, height: number): { width: string; height: string } {
    return {
      width: `${width}px`,
      height: `${height}px`,
    }
  }

  function _innerStyleStr(state: InnerState): string {
    return `transform: rotateY(${state.rotationY}deg)`
  }

  const refreshBg = () => { bgStyle.value = `opacity: ${_bg.opacity}` }
  const refreshStage = () => { stageStyle.value = `transform: translateY(${_stage.y}px)` }
  const refreshHeader = () => { headerStyle.value = `transform: translateY(${_header.y}px); opacity: ${_header.opacity}` }
  const refreshFooter = () => { footerStyle.value = `transform: translateY(${_footer.y}px); opacity: ${_footer.opacity}` }
  const refreshDeckCtn = () => { deckCtnStyle.value = `transform: translateX(${_deckCtn.x}px)` }
  const refreshInitials = () => { initialsStyle.value = _initials.map(_cardStyleStr) }
  const refreshLefts = () => { leftsStyle.value = _lefts.map(_cardStyleStr) }
  const refreshRights = () => { rightsStyle.value = _rights.map(_cardStyleStr) }
  const refreshCutTop = () => { cutTopStyle.value = _centerStyleStr(_cutTop) }
  const refreshCutMid = () => { cutMidStyle.value = _centerStyleStr(_cutMid) }
  const refreshCutBot = () => { cutBotStyle.value = _centerStyleStr(_cutBot) }
  const refreshCuts = () => { refreshCutTop(); refreshCutMid(); refreshCutBot() }
  const refreshDraws = () => { drawsStyle.value = _draws.map(_centerStyleStr) }
  const refreshInners = () => { innersStyle.value = _inners.map(_innerStyleStr) }

  function getMenuButtonRect(): OverlayMenuButtonRect | null {
    // #ifdef MP-WEIXIN
    try {
      const { top, height } = uni.getMenuButtonBoundingClientRect()
      return { top, height }
    } catch {
      return { top: 44, height: 32 }
    }
    // #endif
    return null
  }

  function getViewportMetrics(nextShowResults: boolean = showResults.value): OverlayViewportMetrics {
    const { windowWidth, windowHeight } = uni.getWindowInfo()
    return resolveOverlayViewport({
      windowWidth,
      windowHeight,
      isWide: deps.isWide.value,
      showResults: nextShowResults,
      menuButtonRect: getMenuButtonRect(),
    })
  }

  function getSceneLayout(scene: 'draw_stage' | 'result_stage'): OverlaySceneLayout {
    return resolveOverlaySceneLayout({
      spreadKind: deps.tarotStore.spreadKind,
      scene,
      viewport: getViewportMetrics(scene === 'result_stage'),
      isWide: deps.isWide.value,
      cardAspectRatio: 1.6,
    })
  }

  function getCardDimensions(): { width: number; height: number } {
    const layout = getSceneLayout(showResults.value ? 'result_stage' : 'draw_stage')
    return {
      width: layout.cardWidth,
      height: layout.cardHeight,
    }
  }

  function setDrawCardSizes(layout: OverlaySceneLayout) {
    drawsSizeStyle.value = Array.from({ length: MAX_CARD_COUNT }, (_, index) => {
      const card = layout.cards[index]
      return _cardSizeStyleStr(card?.width ?? layout.cardWidth, card?.height ?? layout.cardHeight)
    })
    layoutCardWidth.value = layout.cardWidth
    layoutCardHeight.value = layout.cardHeight
  }

  function getOverlayLayouts() {
    const drawViewport = getViewportMetrics(false)
    const drawLayout = resolveOverlaySceneLayout({
      spreadKind: deps.tarotStore.spreadKind,
      scene: 'draw_stage',
      viewport: drawViewport,
      isWide: deps.isWide.value,
      cardAspectRatio: 1.6,
    })
    const resultLayout = resolveOverlaySceneLayout({
      spreadKind: deps.tarotStore.spreadKind,
      scene: 'result_stage',
      viewport: getViewportMetrics(true),
      isWide: deps.isWide.value,
      cardAspectRatio: 1.6,
    })
    const revealMotion = resolveOverlayRevealMotion({
      drawCardWidth: drawLayout.cardWidth,
      resultCardWidth: resultLayout.cardWidth,
    })

    return {
      drawViewport,
      drawLayout,
      resultLayout,
      revealMotion,
    }
  }

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate
    masterTimeline.timeScale(rate)
  }

  function pauseAnimations() {
    isPaused.value = true
    masterTimeline.pause()
  }

  function resumeAnimations() {
    isPaused.value = false
    masterTimeline.resume()
  }

  function stepForward() {
    const currentTime = masterTimeline.time()
    masterTimeline.time(currentTime + 1 / 60)
  }

  function stepBackward() {
    const currentTime = masterTimeline.time()
    masterTimeline.time(Math.max(0, currentTime - 1 / 60))
  }

  function seek(position: number | string) {
    masterTimeline.seek(position)
  }

  function resetShuffleVisualState() {
    leftsVisible.value = false
    rightsVisible.value = false
    _lefts.forEach((state) => {
      state.x = 0
      state.y = 0
      state.rotation = 0
      state.scale = 1
      state.scaleY = 1
      state.opacity = 0
    })
    _rights.forEach((state) => {
      state.x = 0
      state.y = 0
      state.rotation = 0
      state.scale = 1
      state.scaleY = 1
      state.opacity = 0
    })
    refreshLefts()
    refreshRights()
  }

  function resetCutVisualState() {
    cutTopVisible.value = false
    cutMidVisible.value = false
    cutBotVisible.value = false
    Object.assign(_cutTop, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 })
    Object.assign(_cutMid, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 })
    Object.assign(_cutBot, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 })
    refreshCuts()
  }

  function resetDrawVisualState() {
    drawsVisible.value = Array(MAX_CARD_COUNT).fill(false)
    _draws.forEach((state, index) => {
      state.x = 0
      state.y = 0
      state.rotation = 0
      state.scale = 1
      state.opacity = 0
      state.zIndex = 20 - index
    })
    _inners.forEach((state) => {
      state.rotationY = 0
    })
    refreshDraws()
    refreshInners()
  }

  function resetInitialDeckState() {
    _initials.forEach((state, index) => {
      state.x = 0
      state.y = -(index * 0.8)
      state.rotation = 0
      state.scale = 1
      state.scaleY = 1
      state.opacity = 1
    })
    refreshInitials()
  }

  function resetOverlayScene() {
    const { windowHeight } = uni.getWindowInfo()

    showResults.value = false
    stageContainerHeightPx.value = windowHeight
    readingFlow.reset()

    _bg.opacity = 1
    _stage.y = 0
    _header.y = 0
    _header.opacity = 1
    _footer.y = 0
    _footer.opacity = 1
    _deckCtn.x = 0

    refreshBg()
    refreshStage()
    refreshHeader()
    refreshFooter()
    refreshDeckCtn()

    resetInitialDeckState()
    resetShuffleVisualState()
    resetCutVisualState()
    resetDrawVisualState()

    const drawLayout = getSceneLayout('draw_stage')
    setDrawCardSizes(drawLayout)
  }

  function interruptCurrentAnimation() {
    readingFlow.clearScheduledRequest()
    resumeAnimations()
    masterTimeline.clear()
    masterTimeline.time(0)

    gsap.killTweensOf([
      _bg,
      _stage,
      _header,
      _footer,
      _deckCtn,
      ..._initials,
      ..._lefts,
      ..._rights,
      _cutTop,
      _cutMid,
      _cutBot,
      ..._draws,
      ..._inners,
    ])
  }

  function settleEntryAnimation() {
    _bg.opacity = 1
    refreshBg()

    _initials.forEach((state, index) => {
      state.x = 0
      state.y = -(index * 0.8)
      state.rotation = 0
      state.scale = 1
      state.scaleY = 1
      state.opacity = 1
    })
    refreshInitials()

    _header.y = 0
    _header.opacity = 1
    _footer.y = 0
    _footer.opacity = 1
    refreshHeader()
    refreshFooter()

    entryAnimationComplete.value = true
  }

  let resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

  function checkWidth(windowWidth: number) {
    const wasWide = deps.isWide.value
    deps.isWide.value = windowWidth >= 768
    if (wasWide !== deps.isWide.value && (showResults.value || phase.value === 'drawing' || phase.value === 'revealing')) {
      nextTick(() => { updateLayout() })
    }
  }

  function playShuffle() {
    settleEntryAnimation()

    const spreadX = layoutCardWidth.value * 0.85
    const timeline = gsap.timeline({
      onComplete: () => { playCut() },
      onUpdate: () => {
        refreshInitials()
        refreshLefts()
        refreshRights()
      },
    })

    timeline.add(() => {
      _initials.forEach(state => { state.opacity = 0 })
      refreshInitials()

      _lefts.forEach((state, index) => {
        state.opacity = 1
        state.x = 0
        state.y = -(index * 0.8)
        state.rotation = 0
        state.scale = 1
        state.scaleY = 1
      })
      _rights.forEach((state, index) => {
        state.opacity = 1
        state.x = 0
        state.y = -4.8 - index * 0.8
        state.rotation = 0
        state.scale = 1
        state.scaleY = 1
      })
      leftsVisible.value = true
      rightsVisible.value = true
      refreshLefts()
      refreshRights()
    }, 0)

    timeline
      .to(_lefts, { x: -spreadX, y: (index: number) => -30 - index * 0.8, rotation: -16, duration: 0.5, ease: 'power2.out' }, 0)
      .to(_rights, { x: spreadX, y: (index: number) => 30 - index * 0.8, rotation: 16, duration: 0.5, ease: 'power2.out' }, '<')
      .to(_lefts, { x: 0, y: (index: number) => -(index * 1.6), rotation: -2, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '+=0.2')
      .to(_rights, { x: 0, y: (index: number) => -0.8 - index * 1.6, rotation: 2, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '<0.03')
      .add(() => {
        _lefts.forEach(state => { state.opacity = 0 })
        _rights.forEach(state => { state.opacity = 0 })
        leftsVisible.value = false
        rightsVisible.value = false
        refreshLefts()
        refreshRights()

        _initials.forEach(state => { state.opacity = 1; state.scaleY = 0.9 })
        refreshInitials()
      })
      .to(_initials, { scaleY: 1, duration: 0.2, ease: 'power1.out' })

    masterTimeline.add(timeline)
  }

  function playCut() {
    phase.value = 'cutting'
    deps.tarotStore.setPhase('cutting')

    const viewport = getViewportMetrics(false)
    const cutLayout = resolveOverlayCutLayout({
      viewport,
      isWide: deps.isWide.value,
      cardWidth: layoutCardWidth.value,
      cardHeight: layoutCardHeight.value,
    })

    const timeline = gsap.timeline({
      onComplete: () => { playDraw() },
      onUpdate: () => {
        refreshInitials()
        refreshCuts()
      },
    })

    timeline.add(() => {
      Object.assign(_cutTop, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 })
      Object.assign(_cutMid, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 })
      Object.assign(_cutBot, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 })
      cutTopVisible.value = true
      cutMidVisible.value = true
      cutBotVisible.value = true
      refreshCuts()

      _initials.forEach(state => { state.opacity = 0 })
      refreshInitials()
    })

    timeline
      .to(_cutTop, {
        x: cutLayout.leadingOffsetX,
        y: cutLayout.leadingOffsetY,
        duration: 0.7,
        ease: 'power3.out',
      })
      .to(_cutBot, {
        x: cutLayout.trailingOffsetX,
        y: cutLayout.trailingOffsetY,
        duration: 0.7,
        ease: 'power3.out',
      }, '<')
      .to(_cutTop, {
        x: cutLayout.trailingOffsetX,
        y: cutLayout.trailingOffsetY,
        zIndex: 11,
        duration: 0.7,
        ease: 'power2.inOut',
      }, '+=0.15')
      .to(_cutMid, { x: 0, y: 0, zIndex: 12, duration: 0.7, ease: 'power2.inOut' }, '<')
      .to(_cutBot, {
        x: cutLayout.leadingOffsetX,
        y: cutLayout.leadingOffsetY,
        zIndex: 13,
        duration: 0.7,
        ease: 'power2.inOut',
      }, '<')
      .to(_cutTop, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.45, ease: 'power2.out' }, '+=0.2')
      .to(_cutMid, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.45, delay: 0.15, ease: 'power2.out' }, '<')
      .to(_cutBot, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.45, delay: 0.3, ease: 'power2.out' }, '<')
      .add(() => {
        cutTopVisible.value = false
        cutMidVisible.value = false
        cutBotVisible.value = false
        refreshCuts()

        _initials.forEach(state => { state.opacity = 1 })
        refreshInitials()
      })

    masterTimeline.add(timeline)
  }

  function playDraw() {
    phase.value = 'drawing'
    deps.tarotStore.setPhase('drawing')
    deps.tarotStore.drawCards()

    const { drawViewport, drawLayout, resultLayout, revealMotion } = getOverlayLayouts()
    setDrawCardSizes(drawLayout)

    const targetX = drawLayout.cards.map(card => card.x)
    const targetY = drawLayout.cards.map(card => card.y)
    const cardHeight = drawLayout.cardHeight
    const stageHeight = drawViewport.stageHeight
    const liftY = drawLayout.stageShiftY

    const preRotations = Array.from({ length: deps.cardCount.value }, () => (Math.random() - 0.5) * 15)
    const drawStartTime = 0.88
    const perCardDelay = 0.34
    const pullDuration = 0.18
    const fallDuration = 0.78
    const reboundDuration = 0.34
    const settleDuration = 0.82
    const stageFollowStart = drawStartTime + pullDuration - 0.02
    const deckExitStart = stageFollowStart + 0.06
    const lastCardLandingTime = drawStartTime
      + (deps.cardCount.value - 1) * perCardDelay
      + pullDuration
      + fallDuration
      + reboundDuration
      + settleDuration
    const alignTime = lastCardLandingTime + 0.28

    const timeline = gsap.timeline({
      onUpdate: () => {
        refreshDeckCtn()
        refreshStage()
        refreshInitials()
        refreshDraws()
        refreshInners()
      },
    })

    timeline
      .to(_stage, { y: -liftY * 0.84, duration: 0.92, ease: 'power2.inOut' }, stageFollowStart)
      .to(_stage, { y: -liftY, duration: 0.58, ease: 'power3.out' }, '>')
      .to(
        _initials,
        {
          opacity: 0,
          y: (index: number) => -cardHeight * 1.12 - index * 1.6,
          scale: 0.74,
          rotation: (index: number) => (index - 5.5) * 0.7,
          duration: 1.08,
          stagger: 0.018,
          ease: 'power2.in',
        },
        deckExitStart,
      )

    Array.from({ length: deps.cardCount.value }, (_, index) => index).forEach((index) => {
      timeline.add(() => {
        Object.assign(_draws[index], {
          x: 0,
          y: index === 0 ? 0 : -stageHeight,
          rotation: 0,
          scale: 0.98,
          opacity: 1,
          zIndex: 20 - index,
        })
        drawsVisible.value = drawsVisible.value.map((isVisible, currentIndex) => (
          currentIndex === index ? true : isVisible
        ))
        refreshDraws()
      }, drawStartTime + index * perCardDelay)

      timeline
        .to(_draws[index], {
          x: targetX[index] * 0.08,
          y: -cardHeight * 0.18,
          rotation: preRotations[index],
          scale: 1.03,
          duration: pullDuration,
          ease: 'power2.out',
        }, '>')
        .to(_draws[index], {
          x: targetX[index],
          y: targetY[index] + cardHeight * 0.86,
          duration: fallDuration,
          ease: 'power2.in',
        }, '>')
        .to(_draws[index], {
          y: targetY[index] + cardHeight * 0.18,
          rotation: preRotations[index] * 0.3,
          scale: 0.98,
          duration: reboundDuration,
          ease: 'power2.out',
        }, '>')
        .to(_draws[index], {
          y: targetY[index],
          rotation: 0,
          scale: 1,
          duration: settleDuration,
          ease: 'power3.out',
        }, '>')
    })

    const flipDuration = 1 + (deps.cardCount.value - 1) * 0.4
    const revealDelay = AUTO_REVEAL_DELAY_MS / 1000
    const revealingStart = alignTime + 1.2 + flipDuration + 0.1 + revealDelay
    const finishTime = revealingStart + 0.3

    timeline
      .to(_draws, {
        x: (index: number) => targetX[index],
        y: (index: number) => targetY[index],
        rotation: 0,
        duration: 0.8,
        ease: 'power3.inOut',
      }, alignTime + 0.1)
      .to(_draws, {
        scale: revealMotion.focusScale,
        duration: 0.5,
        ease: 'power1.out',
      }, alignTime + 0.9)
      .to(_inners, {
        rotationY: 180,
        duration: 1,
        stagger: 0.4,
        ease: 'back.out(1.1)',
      }, alignTime + 1.2)
      .add(() => {
        phase.value = 'revealing'
        deps.tarotStore.setPhase('revealing')
      }, revealingStart)
      .add(() => { void finish(revealMotion.dockScale, resultLayout) }, finishTime)

    readingFlow.scheduleRequest(0)
    masterTimeline.add(timeline)
  }

  function playRevealOnly() {
    phase.value = 'revealing'
    deps.tarotStore.setPhase('revealing')

    if (deps.tarotStore.drawnCards.length === 0) {
      deps.tarotStore.drawCards()
    }

    const { drawLayout, resultLayout, revealMotion } = getOverlayLayouts()
    setDrawCardSizes(drawLayout)

    _stage.y = -drawLayout.stageShiftY
    refreshStage()

    _initials.forEach((state) => { state.opacity = 0 })
    refreshInitials()

    resetShuffleVisualState()
    resetCutVisualState()

    drawsVisible.value = Array.from({ length: MAX_CARD_COUNT }, (_, index) => index < deps.cardCount.value)
    _draws.forEach((state, index) => {
      if (index < deps.cardCount.value) {
        Object.assign(state, {
          x: drawLayout.cards[index].x,
          y: drawLayout.cards[index].y,
          rotation: 0,
          scale: revealMotion.focusScale,
          opacity: 1,
          zIndex: 20 - index,
        })
        _inners[index].rotationY = 0
        return
      }

      Object.assign(state, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 0,
        zIndex: 20 - index,
      })
      _inners[index].rotationY = 0
    })
    refreshDraws()
    refreshInners()

    const flipDuration = 1 + (deps.cardCount.value - 1) * 0.4
    const finishTime = 0.4 + flipDuration + 0.4

    const timeline = gsap.timeline({
      onUpdate: () => {
        refreshStage()
        refreshDraws()
        refreshInners()
      },
    })

    timeline
      .to(_inners, {
        rotationY: 180,
        duration: 1,
        stagger: 0.4,
        ease: 'back.out(1.1)',
      }, 0.4)
      .add(() => { void finish(revealMotion.dockScale, resultLayout) }, finishTime)

    readingFlow.scheduleRequest(0)
    masterTimeline.add(timeline)
  }

  function replayFromPhase(targetPhase: OverlayPhase) {
    interruptCurrentAnimation()
    entryAnimationComplete.value = true
    resetOverlayScene()
    phase.value = targetPhase
    deps.tarotStore.setPhase(targetPhase)

    if (targetPhase === 'shuffling') {
      playShuffle()
      return
    }

    if (targetPhase === 'cutting') {
      playCut()
      return
    }

    if (targetPhase === 'drawing') {
      playDraw()
      return
    }

    playRevealOnly()
  }

  function updateLayout() {
    if (phase.value !== 'revealing' && phase.value !== 'drawing') {
      return
    }

    const layout = getSceneLayout(showResults.value ? 'result_stage' : 'draw_stage')
    setDrawCardSizes(layout)

    const targetX = layout.cards.map(card => card.x)
    const targetY = layout.cards.map(card => card.y)

    if (showResults.value) {
      masterTimeline.to(_stage, {
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: refreshStage,
      }, 0)
    }

    _draws.forEach((draw, index) => {
      if (index >= layout.cards.length) {
        return
      }

      masterTimeline.to(draw, {
        x: targetX[index],
        y: targetY[index],
        scale: 1,
        duration: 0.6,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: refreshDraws,
      }, 0)
    })
  }

  function openResultPanel() {
    if (showResults.value) {
      return
    }

    const targetViewport = getViewportMetrics(true)
    showResults.value = true

    if (!deps.isWide.value) {
      const heightObj = { value: stageContainerHeightPx.value }
      masterTimeline.to(heightObj, {
        value: targetViewport.stageContainerHeight,
        duration: 0.6,
        ease: 'power2.inOut',
        onUpdate: () => { stageContainerHeightPx.value = heightObj.value },
      }, 0)
    }

    nextTick(() => { updateLayout() })
  }

  async function finish(dockScale: number, _resultLayout: OverlaySceneLayout) {
    openResultPanel()
    _draws.forEach((draw, index) => {
      if (index < deps.cardCount.value) {
        draw.scale = dockScale
      }
    })
    refreshDraws()

    const outcome = await readingFlow.awaitOutcome()
    if (outcome.status === 'ready' && outcome.result) {
      deps.tarotStore.revealResult()
      deps.emit('complete')
      return
    }

    readingFlow.markFailed(outcome.errorMessage)
  }

  async function retryReading() {
    if (readingFlow.isLoading.value) {
      return
    }

    readingFlow.scheduleRequest(0)
    openResultPanel()

    const outcome = await readingFlow.awaitOutcome()
    if (outcome.status === 'ready' && outcome.result) {
      deps.tarotStore.revealResult()
      return
    }

    readingFlow.markFailed(outcome.errorMessage)
  }

  function start() {
    nextTick(() => {
      const entryDrop = layoutCardHeight.value * 4
      entryAnimationComplete.value = false

      const entryTimeline = gsap.timeline({
        onComplete: () => {
          entryAnimationComplete.value = true
        },
      })

      entryTimeline.fromTo(_bg, { opacity: 0 }, {
        opacity: 1,
        duration: 0.7,
        onUpdate: refreshBg,
      }, 0)

      entryTimeline.fromTo(_initials, {
        y: -entryDrop,
        rotation: 180,
        scale: 0.5,
        opacity: 1,
        scaleY: 1,
        x: 0,
      }, {
        y: (index: number) => -(index * 0.8),
        rotation: 0,
        scale: 1,
        scaleY: 1,
        duration: 1.05,
        ease: 'power3.out',
        stagger: 0.02,
        onUpdate: refreshInitials,
      }, 0)

      entryTimeline.fromTo(_header, { y: 100, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        onUpdate: refreshHeader,
      }, 0.4)

      entryTimeline.fromTo(_footer, { y: 100, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
        onUpdate: refreshFooter,
      }, 0.6)

      entryTimeline.call(() => { playShuffle() }, [], `+=${ENTRY_TO_SHUFFLE_DELAY_MS / 1000}`)
      masterTimeline.add(entryTimeline)
    })
  }

  function restart() {
    resumeAnimations()
    setPlaybackRate(1)
    readingFlow.reset()
    masterTimeline.clear()
    masterTimeline.time(0)
    showResults.value = false
    stageContainerHeightPx.value = uni.getWindowInfo().windowHeight
  }

  onMounted(() => {
    resumeAnimations()
    setPlaybackRate(1)

    const { windowWidth } = uni.getWindowInfo()
    checkWidth(windowWidth)

    const drawLayout = getSceneLayout('draw_stage')
    setDrawCardSizes(drawLayout)

    resizeHandler = (res) => { checkWidth(res.size.windowWidth) }
    uni.onWindowResize(resizeHandler)

    start()
  })

  onUnmounted(() => {
    readingFlow.reset()
    resumeAnimations()
    setPlaybackRate(1)
    if (resizeHandler) {
      uni.offWindowResize(resizeHandler)
    }

    masterTimeline.clear()
    masterTimeline.kill()
    gsap.killTweensOf([
      _bg,
      _stage,
      _header,
      _footer,
      _deckCtn,
      ..._initials,
      ..._lefts,
      ..._rights,
      _cutTop,
      _cutMid,
      _cutBot,
      ..._draws,
      ..._inners,
    ])
  })

  return {
    stageContainerStyle,
    resultZoneStyle,
    bgStyle,
    stageStyle,
    headerStyle,
    footerStyle,
    deckCtnStyle,
    initialsStyle,
    leftsStyle,
    rightsStyle,
    leftsVisible,
    rightsVisible,
    cutTopStyle,
    cutMidStyle,
    cutBotStyle,
    cutTopVisible,
    cutMidVisible,
    cutBotVisible,
    drawsStyle,
    drawsSizeStyle,
    innersStyle,
    drawsVisible,
    showResults,
    phase,
    entryAnimationComplete,
    layoutCardWidth,
    layoutCardHeight,
    overlayVarsStyle,
    getCardImg,
    cardBack,
    playbackRate,
    isPaused,
    setPlaybackRate,
    pauseAnimations,
    resumeAnimations,
    stepForward,
    stepBackward,
    seek,
    replayFromPhase,
    restart,
    readingPanelState,
    readingErrorMessage,
    isReadingFailed,
    isReadingLoading,
    retryReading,
  }
}
