/**
 * Name: use_overlay_controller
 * Purpose: orchestrate overlay animations, progress, and reading state as a single controller.
 * Reason: provides a clean interface for DivinationOverlay.vue while delegating to specialized modules.
 * Data flow: store state flows in; view-ready styles, states, and handlers flow out.
 */

import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import gsap from 'gsap'
import { useTarotStore } from '../stores/tarot'
import { useThemeStore } from '../stores/theme'
import overlayConfig from '../config.json'
import { useAnimationState } from './use_animation_state'
import { useOverlayLayout } from './useOverlayLayout'
import {
  createTimelineOrchestrator,
  killAnimationTargets,
  createPhasePipeline,

  getPhaseIndex,
} from '../utils/overlay_animation'
import {
  createProgressModel,
  calculatePhaseProgress,
  presentProgressHeader,
  presentFooter,
  DEFAULT_OVERLAY_TEXT,
} from '../utils/overlay_progress'
import { buildOverlaySafeFrame, getFocusScale } from '../utils/overlay_layout/index'
import { OfflineReadingProvider } from '../utils/reading/offline_reading_provider'
import { createReadingOrchestrator } from '../utils/reading/reading_orchestrator'
import type { ReadingRequest } from '../utils/reading/reading_provider'
import type { PhaseContext, PhaseRunner, OverlayPhase } from '../core/flow/types'
import { buildShufflePhaseRunner } from '../core/flow/phases/shuffle_phase'
import { buildCutPhaseRunner } from '../core/flow/phases/cut_phase'
import { buildDrawPhaseRunner } from '../core/flow/phases/draw_phase'
import { buildRevealPhaseRunner } from '../core/flow/phases/reveal_phase'
import { resolveDeckGeometry } from '../core/deck/deck_calculator'
import type { CardLayout } from '../core/layout/types'
import { prefersReducedMotion } from '../utils/accessibility'


const MAX_CARD_COUNT = 10
const MAX_CUT_PILES = 8
const AUTO_REVEAL_DELAY_MS = 800
const ENTRY_TO_SHUFFLE_DELAY_MS = 300

const RESULT_LIFT_MARGIN_PX = 16
const RESULT_LIFT_MAX_FRACTION = 0.28
const DECK_COUNT: number = (overlayConfig as { deckCount?: number }).deckCount ?? 12
const CUT_PILE_COUNT: number = Math.min(
  MAX_CUT_PILES,
  Math.max(1, (overlayConfig as { cutPileCount?: number }).cutPileCount ?? 3),
)
const CARDS_PER_PILE: number = Math.max(1, Math.floor(DECK_COUNT / CUT_PILE_COUNT))
const SHUFFLE_HALF_COUNT: number = Math.max(1, Math.floor(DECK_COUNT / 2))

export interface UseOverlayControllerDeps {
  tarotStore: ReturnType<typeof useTarotStore>
  themeStore: ReturnType<typeof useThemeStore>
  isWide: Ref<boolean>
  cardCount: Ref<number>
  emit: ((event: 'complete') => void) &
    ((event: 'restart') => void) &
    ((event: 'backHome') => void)
}

export function useOverlayController(deps: UseOverlayControllerDeps) {
  // State refs
  const phase = ref<OverlayPhase>('shuffling')
  const showResults = ref(false)
  const entryAnimationComplete = ref(false)
  const isPaused = ref(false)
  const playbackRate = ref(1)
  const cardsLanded = ref(false)

  // Progress model
  const progressModel = createProgressModel('shuffling')

  // Reading orchestrator
  const readingStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const { readingResult: storeReadingResult, readingError: storeReadingError } = storeToRefs(deps.tarotStore)

  const readingOrchestrator = createReadingOrchestrator({
    provider: new OfflineReadingProvider(),
    statusRef: readingStatus,
    resultRef: storeReadingResult,
    errorRef: storeReadingError,
    errorMessage: '解读暂时不可用，请稍后重试',
  })

  let _readingPromise: ReturnType<typeof readingOrchestrator.start> | null = null

  // Timeline orchestrator
  const timelineOrchestrator = createTimelineOrchestrator(false)

  const layoutApi = useOverlayLayout({
    isWide: deps.isWide,
    spreadKind: deps.tarotStore.spreadKind,
    cutPileCount: CUT_PILE_COUNT,
    deckCount: DECK_COUNT,
  })

  const animState = useAnimationState({
    deckCount: DECK_COUNT,
    shuffleHalfCount: SHUFFLE_HALF_COUNT,
    maxCutPiles: MAX_CUT_PILES,
    maxCardCount: MAX_CARD_COUNT,
  })
  const {
    _bg, _stage, _header, _footer, _deckCtn,
    _initials, _lefts, _rights, _piles, _draws, _inners,
    leftsVisible, rightsVisible, pilesVisible, drawsVisible,
    layoutCardWidth, layoutCardHeight,
    bgStyle, stageStyle, headerStyle, footerStyle, deckCtnStyle,
    initialsStyle, leftsStyle, rightsStyle, pilesStyle,
    drawsStyle, drawsSizeStyle, innersStyle,
    overlayVarsStyle: _rawOverlayVarsStyle,
    refreshBg, refreshStage, refreshHeader, refreshFooter, refreshDeckCtn,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  refreshInitials, refreshLefts, refreshRights, refreshPiles, refreshDraws, refreshInners,
    resetShuffleVisualState, resetCutVisualState, resetDrawVisualState, resetInitialDeckState,
    setDrawCardSizes,
    getAllTargets,
  } = animState

  const cardBack = computed(() => deps.themeStore.cardBackImage)
  const readingPanelState = computed(() => readingOrchestrator.state.status)
  const readingErrorMessage = computed(() => readingOrchestrator.state.error || '')
  const isReadingFailed = computed(() => readingOrchestrator.state.status === 'error')
  const isReadingLoading = computed(() => readingOrchestrator.state.status === 'loading')

  const cardsFocused = computed(() => {
    if (!showResults.value) {
      return cardsLanded.value
    }
    return readingOrchestrator.state.status !== 'success'
  })
  const cardsDocked = computed(() => showResults.value && readingOrchestrator.state.status === 'success')
  const focusScale = computed(() => getFocusScale(deps.isWide.value))

  // CSS --card-focus-scale value: once the last card lands (cardsLanded),
  // scale cards up immediately; return to 1 when results become visible.
  // The CSS spring transition on .card-focus-frame animates the change.
  const cardFocusScaleValue = computed(() => {
    if (showResults.value) return 1
    if (cardsLanded.value) return getFocusScale(deps.isWide.value)
    return 1
  })

  // Compute how far to lift the drawn cards when the result panel opens,
  // so the bottom card isn't occluded by the result sheet.
  const resultCardLiftY = computed(() => {
    if (!showResults.value || deps.isWide.value) return 0
    try {
      const drawLayout = getSceneLayout('draw_stage')
      const resultLayout = getSceneLayout('result_stage')
      const drawBottom = Math.max(...drawLayout.cards.map(c => c.y + c.height / 2))
      const resultBottom = Math.max(...resultLayout.cards.map(c => c.y + c.height / 2))
      const lift = drawBottom - resultBottom + RESULT_LIFT_MARGIN_PX
      // Cap the lift so we never shove cards up past the progress header.
      const { windowHeight } = uni.getWindowInfo()
      const maxLift = Math.max(0, windowHeight * RESULT_LIFT_MAX_FRACTION)
      return Math.max(0, Math.min(lift, maxLift))
    } catch {
      return 0
    }
  })

  // Enhanced overlay vars style: includes --card-focus-scale and --result-card-lift-y
  // so the template's single :style binding on .divination-overlay propagates them into CSS.
  const overlayVarsStyle = computed(() =>
    `${_rawOverlayVarsStyle.value}; --card-focus-scale: ${cardFocusScaleValue.value}; --result-card-lift-y: ${resultCardLiftY.value}px`,
  )

  const progressHeaderPresentation = computed(() =>
    presentProgressHeader(phase.value, (name) => deps.themeStore.getUiAsset(name)),
  )

  const footerPresentation = computed(() =>
    presentFooter(phase.value, showResults.value),
  )

  const phaseSteps = computed(() => calculatePhaseProgress(phase.value))
  const activePhaseIndex = computed(() => phaseSteps.value.findIndex((s) => s.isActive))

  // Layout helpers delegated to useOverlayLayout
  const {
    getSceneLayout,
    getMotionMetrics,
    getOverlayLayouts,
    getViewportMetrics,
    RESULT_SHEET_FRACTION,
    checkWidth,
  } = layoutApi

  function getCardImg(index: number): string {
    return deps.tarotStore.drawnCards[index]?.card.image || cardBack.value
  }

  function getCardImgName(index: number): string | undefined {
    return deps.tarotStore.drawnCards[index]?.card.name
  }

  // Animation control
  function setPlaybackRate(rate: number) {
    playbackRate.value = rate
    timelineOrchestrator.setPlaybackRate(rate)
  }

  function pauseAnimations() {
    isPaused.value = true
    timelineOrchestrator.pause()
  }

  function resumeAnimations() {
    isPaused.value = false
    timelineOrchestrator.resume()
  }

  function stepForward() {
    timelineOrchestrator.stepForward()
  }

  function stepBackward() {
    timelineOrchestrator.stepBackward()
  }

  function seek(position: number | string) {
    timelineOrchestrator.seek(position)
  }

  function resetOverlayScene() {
    showResults.value = false
    cardsLanded.value = false
    readingOrchestrator.reset()

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
    readingOrchestrator.destroy()
    resumeAnimations()
    timelineOrchestrator.clear()

    killAnimationTargets(getAllTargets())
  }

  function settleEntryAnimation() {
    _bg.opacity = 1
    refreshBg()

    _initials.forEach((state, index) => {
      Object.assign(state, { x: 0, y: -(index * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1 })
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

  function transitionPhase(nextPhase: OverlayPhase) {
    phase.value = nextPhase
    progressModel.transitionTo(nextPhase)
    deps.tarotStore.setPhase(nextPhase)
  }

  function createPhaseContext(): PhaseContext {
    const drawViewport = getViewportMetrics(false)
    const safeFrame = buildOverlaySafeFrame(
      'draw_stage',
      drawViewport,
      RESULT_SHEET_FRACTION,
    )

    return {
      deckGeometry: resolveDeckGeometry(safeFrame, DECK_COUNT),
      spreadSlots: [] as unknown as CardLayout[],
      getCurrentLayouts: () => {
        const { drawLayout } = getOverlayLayouts()
        return { drawLayout }
      },
      getTargetLayouts: () => {
        const { drawLayout } = getOverlayLayouts()
        return { drawLayout }
      },
      cardElements: {
        initials: _initials,
        lefts: _lefts,
        rights: _rights,
        piles: _piles,
        draws: _draws,
        inners: _inners,
        stage: _stage,
        deckCtn: _deckCtn,
        bg: _bg,
        header: _header,
        footer: _footer,
      },
      visible: {
        lefts: leftsVisible,
        rights: rightsVisible,
        piles: pilesVisible,
        draws: drawsVisible,
      },
      onPhaseChange: (p: OverlayPhase) => {
        phase.value = p
        progressModel.transitionTo(p)
        deps.tarotStore.setPhase(p)
      },
    }
  }

  function createPhaseRunners(): PhaseRunner[] {
    const metrics = getMotionMetrics('draw_stage')

    return [
      buildShufflePhaseRunner({ spreadX: metrics.shuffleSpreadX }),
      buildCutPhaseRunner({
        pileCount: CUT_PILE_COUNT,
        pileSpacing: metrics.cutPileSpacing,
        axis: metrics.cutAxis,
        cutLeadingOffset: metrics.cutLeadingOffset,
        cutTrailingOffset: metrics.cutTrailingOffset,
      }),
      {
        name: 'drawing',
        run(context: PhaseContext, onComplete: () => void) {
          deps.tarotStore.drawCards()
          const { drawLayout, drawViewport } = getOverlayLayouts()
          setDrawCardSizes(drawLayout)
          const runner = buildDrawPhaseRunner({
            cardCount: deps.cardCount.value,
            cardHeight: drawLayout.cardHeight,
            stageHeight: drawViewport.stageHeight,
            liftY: drawLayout.stageShiftY,
            targetX: drawLayout.cards.map((c) => c.x),
            targetY: drawLayout.cards.map((c) => c.y),
            autoRevealDelayMs: AUTO_REVEAL_DELAY_MS,
            onCardsLanded: () => { cardsLanded.value = true },
          })
          return runner.run(context, onComplete)
        },
      },
      {
        name: 'revealing',
        run(context: PhaseContext, onComplete: () => void) {
          const { drawLayout } = getOverlayLayouts()
          setDrawCardSizes(drawLayout)
          const runner = buildRevealPhaseRunner({
            cardCount: deps.cardCount.value,
            drawLayout: {
              stageShiftY: drawLayout.stageShiftY,
              cards: drawLayout.cards.map((c) => ({ x: c.x, y: c.y })),
            },
          })
          return runner.run(context, onComplete)
        },
      },
    ]
  }

  function adaptPhaseRunner(
    phaseRunner: PhaseRunner,
    context: PhaseContext,
  ): { phase: OverlayPhase; build: (onComplete: () => void) => gsap.core.Timeline | null } {
    return {
      phase: phaseRunner.name,
      build: (onComplete) => {
        const tl = phaseRunner.run(context, onComplete)
        return tl as unknown as gsap.core.Timeline | null
      },
    }
  }

  function runPipeline(startIndex: number = 0) {
    const phaseContext = createPhaseContext()
    const phaseRunners = createPhaseRunners()
    const ordered = phaseRunners.map((runner) => adaptPhaseRunner(runner, phaseContext))

    const pipeline = createPhasePipeline(timelineOrchestrator, ordered, {
      onPhaseStart: (startedPhase) => {
        transitionPhase(startedPhase)
        if (startedPhase === 'shuffling') {
          settleEntryAnimation()
        }
        if (startedPhase === 'revealing') {
          openResultPanel()
        }
      },
      onPhaseComplete: (completedPhase) => {
        // Pipeline step complete — if we just finished drawing, schedule reading.
        if (completedPhase === 'drawing') {
          const request: ReadingRequest = {
            cards: deps.tarotStore.drawnCards,
            question: deps.tarotStore.currentQuestion,
            spreadKind: deps.tarotStore.spreadKind,
          }
          _readingPromise = readingOrchestrator.start(request)
        }
      },
      onPipelineComplete: () => {
        void finish()
      },
    })

    pipeline.run(startIndex)
  }

  function replayFromPhase(targetPhase: OverlayPhase) {
    interruptCurrentAnimation()
    entryAnimationComplete.value = true
    resetOverlayScene()
    phase.value = targetPhase
    progressModel.transitionTo(targetPhase)
    deps.tarotStore.setPhase(targetPhase)

    if (targetPhase === 'revealing') {
      if (deps.tarotStore.drawnCards.length === 0) {
        deps.tarotStore.drawCards()
      }
    }

    const startIndex = getPhaseIndex(targetPhase)
    runPipeline(startIndex)
  }

  /**
   * Sync card sizes (and positions) to the current scene without a GSAP tween.
   * Called on viewport resize; CSS transitions on .draw-wrapper/.card-3d-inner
   * handle any visual size change smoothly.
   * Cards always use draw_stage layout — the result sheet overlays without affecting the stage.
   */
  function updateLayout() {
    if (phase.value !== 'revealing' && phase.value !== 'drawing') return

    const layout = getSceneLayout('draw_stage')
    setDrawCardSizes(layout)

    // Prevent running tweens from fighting manual position updates during resize.
    gsap.killTweensOf(_draws)

    // Snap card positions to match the new layout (important for multi-card spreads
    // where slot pitches depend on card size).
    _draws.forEach((draw, index) => {
      if (index >= layout.cards.length) return
      draw.x = layout.cards[index].x
      draw.y = layout.cards[index].y
    })
    refreshDraws()
  }

  /**
   * Open the result sheet.
   * showResults → result-zone bottom sheet slides in via CSS animation.
   * Cards stay at draw_stage size; no repositioning needed.
   */
  function openResultPanel() {
    if (showResults.value) return
    showResults.value = true
  }

  async function finish() {
    openResultPanel()
    _draws.forEach((draw, index) => {
      if (index < deps.cardCount.value) {
        draw.scale = 1
      }
    })
    refreshDraws()

    await (_readingPromise ?? Promise.resolve(null))
    _readingPromise = null

    if (readingOrchestrator.state.status === 'success' && readingOrchestrator.state.result) {
      deps.tarotStore.revealResult()
      deps.emit('complete')
    }
  }

  async function retryReading() {
    if (readingOrchestrator.state.isLoading) return null

    openResultPanel()

    const request: ReadingRequest = {
      cards: deps.tarotStore.drawnCards,
      question: deps.tarotStore.currentQuestion,
      spreadKind: deps.tarotStore.spreadKind,
    }
    const result = await readingOrchestrator.retry(request)
    if (result) {
      deps.tarotStore.revealResult()
    }
    return result
  }

  // Entry animation
  function start() {
    nextTick(() => {
      entryAnimationComplete.value = false

      if (prefersReducedMotion()) {
        _bg.opacity = 1
        _initials.forEach((state, index) => {
          Object.assign(state, { x: 0, y: -(index * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1 })
        })
        _header.y = 0
        _header.opacity = 1
        _footer.y = 0
        _footer.opacity = 1
        refreshBg()
        refreshInitials()
        refreshHeader()
        refreshFooter()
        entryAnimationComplete.value = true
        runPipeline(0)
        return
      }

      const entryDrop = layoutCardHeight.value * 4

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
      }, {
        y: (index: number) => -(index * 0.8),
        rotation: 0,
        scale: 1,
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

      entryTimeline.call(() => runPipeline(0), [], `+=${ENTRY_TO_SHUFFLE_DELAY_MS / 1000}`)
      timelineOrchestrator.add(entryTimeline)
    })
  }

  function restart() {
    resumeAnimations()
    setPlaybackRate(1)
    readingOrchestrator.reset()
    timelineOrchestrator.clear()
    timelineOrchestrator.seek(0)
    showResults.value = false
    resetOverlayScene()
    deps.tarotStore.startDivination(deps.tarotStore.currentQuestion)
    progressModel.reset()
    phase.value = 'shuffling'
    start()
  }

  // Resize handling
  let resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

  function checkHeight(_windowHeight: number) {
    if (showResults.value || phase.value === 'drawing' || phase.value === 'revealing') {
      nextTick(() => updateLayout())
    }
  }

  // Lifecycle
  onMounted(() => {
    resumeAnimations()
    setPlaybackRate(1)

    const { windowWidth } = uni.getWindowInfo()
    checkWidth(windowWidth)

    const drawLayout = getSceneLayout('draw_stage')
    setDrawCardSizes(drawLayout)

    resizeHandler = (res) => {
      const widthChanged = checkWidth(res.size.windowWidth)
      if (widthChanged && (showResults.value || phase.value === 'drawing' || phase.value === 'revealing')) {
        nextTick(() => updateLayout())
      }
      checkHeight(res.size.windowHeight)
    }
    uni.onWindowResize(resizeHandler)

    start()
  })

  onUnmounted(() => {
    readingOrchestrator.destroy()
    resumeAnimations()
    setPlaybackRate(1)
    if (resizeHandler) {
      uni.offWindowResize(resizeHandler)
    }
    timelineOrchestrator.clear()
    timelineOrchestrator.kill()
    killAnimationTargets(getAllTargets())
  })

  return {
    // Styles
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
    pilesStyle,
    pilesVisible,
    drawsStyle,
    drawsSizeStyle,
    innersStyle,
    drawsVisible,
    overlayVarsStyle,

    // Configuration exposed to the template
    deckCount: DECK_COUNT,
    shuffleHalfCount: SHUFFLE_HALF_COUNT,
    cutPileCount: CUT_PILE_COUNT,
    cardsPerPile: CARDS_PER_PILE,

    // State
    showResults,
    phase,
    entryAnimationComplete,
    layoutCardWidth,
    layoutCardHeight,
    playbackRate,
    isPaused,

    // Reading state
    readingPanelState,
    readingErrorMessage,
    isReadingFailed,
    isReadingLoading,
    cardsFocused,
    cardsDocked,
    focusScale,

    // Progress
    progressHeaderPresentation,
    footerPresentation,
    phaseSteps,
    activePhaseIndex,

    // Content
    cardBack,
    getCardImg,
    getCardImgName,
    overlayText: DEFAULT_OVERLAY_TEXT,
    getSceneLayout,

    // Controls
    setPlaybackRate,
    pauseAnimations,
    resumeAnimations,
    stepForward,
    stepBackward,
    seek,
    replayFromPhase,
    restart,
    retryReading,
  }
}
