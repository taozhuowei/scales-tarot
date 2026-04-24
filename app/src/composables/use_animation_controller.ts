/**
 * Name: use_animation_controller
 * Purpose: orchestrate all overlay animations — entry, pipeline, phase runners, timeline control.
 * Reason: isolates GSAP-dependent code so reading controller never touches animation internals.
 * Constraint: does NOT import any module under `reading/`.
 */

import { computed, nextTick, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
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
} from '../animation/orchestration'
import {
  createProgressModel,
  calculatePhaseProgress,
  presentProgressHeader,
  presentFooter,
} from '../utils/overlay_progress'
import { buildOverlaySafeFrame } from '../utils/overlay_layout/index'
import type { PhaseContext, PhaseRunner, OverlayPhase } from '../core/flow/types'
import { buildShufflePhaseRunner } from '../animation/phases/shuffle/builder'
import { buildCutPhaseRunner } from '../animation/phases/cut/builder'
import { buildDrawPhaseRunner } from '../animation/phases/draw/builder'
import { buildRevealPhaseRunner } from '../animation/phases/reveal/builder'
import { resolveDeckGeometry } from '../core/deck/deck_calculator'
import { prefersReducedMotion } from '../utils/accessibility'
import {
  ENTRY_BG_FADE_DURATION,
  ENTRY_CARDS_DROP_DURATION,
  ENTRY_HEADER_SLIDE_DURATION,
  ENTRY_FOOTER_SLIDE_DURATION,
  MAX_CARD_COUNT,
  MAX_CUT_PILES,
  AUTO_REVEAL_DELAY_MS,
  ENTRY_TO_SHUFFLE_DELAY_MS,
} from '../core/config/layout_constants'

const DECK_COUNT: number = (overlayConfig as { deckCount?: number }).deckCount ?? 12
const CUT_PILE_COUNT: number = Math.min(
  MAX_CUT_PILES,
  Math.max(1, (overlayConfig as { cutPileCount?: number }).cutPileCount ?? 3),
)
const CARDS_PER_PILE: number = Math.max(1, Math.floor(DECK_COUNT / CUT_PILE_COUNT))
const SHUFFLE_HALF_COUNT: number = Math.max(1, Math.floor(DECK_COUNT / 2))

export interface UseAnimationControllerCallbacks {
  onDrawingComplete: () => void
  onPipelineComplete: () => void
  onPhaseChange: (phase: OverlayPhase) => void
  onResetReading: () => void
  onDestroyReading: () => void
}

export interface UseAnimationControllerDeps {
  tarotStore: ReturnType<typeof useTarotStore>
  themeStore: ReturnType<typeof useThemeStore>
  isWide: Ref<boolean>
  cardCount: Ref<number>
  callbacks: UseAnimationControllerCallbacks
}

export interface UseAnimationControllerReturn {
  phase: Ref<OverlayPhase>
  showResults: Ref<boolean>
  entryAnimationComplete: Ref<boolean>
  isPaused: Ref<boolean>
  playbackRate: Ref<number>
  cardsLanded: Ref<boolean>

  bgStyle: Ref<Record<string, string>>
  stageStyle: Ref<Record<string, string>>
  headerStyle: Ref<Record<string, string>>
  footerStyle: Ref<Record<string, string>>
  deckCtnStyle: Ref<Record<string, string>>
  initialsStyle: Ref<Record<string, string>[]>
  leftsStyle: Ref<Record<string, string>[]>
  rightsStyle: Ref<Record<string, string>[]>
  pilesStyle: Ref<Record<string, string>[]>
  drawsStyle: Ref<Record<string, string>[]>
  drawsSizeStyle: Ref<{ width: string; height: string }[]>
  innersStyle: Ref<Record<string, string>[]>
  leftsVisible: Ref<boolean>
  rightsVisible: Ref<boolean>
  pilesVisible: Ref<boolean[]>
  drawsVisible: Ref<boolean[]>
  overlayVarsStyle: ComputedRef<string>
  layoutCardWidth: Ref<number>
  layoutCardHeight: Ref<number>

  progressHeaderPresentation: ComputedRef<ReturnType<typeof presentProgressHeader>>
  footerPresentation: ComputedRef<ReturnType<typeof presentFooter>>
  phaseSteps: ComputedRef<ReturnType<typeof calculatePhaseProgress>>
  activePhaseIndex: ComputedRef<number>

  getSceneLayout: ReturnType<typeof useOverlayLayout>['getSceneLayout']
  checkWidth: ReturnType<typeof useOverlayLayout>['checkWidth']

  deckCount: number
  shuffleHalfCount: number
  cutPileCount: number
  cardsPerPile: number

  _draws: { x: number; y: number; rotation: number; scale: number; opacity: number; zIndex: number }[]
  refreshDraws: () => void

  setPlaybackRate: (rate: number) => void
  pauseAnimations: () => void
  resumeAnimations: () => void
  stepForward: () => void
  stepBackward: () => void
  seek: (position: number | string) => void
  replayFromPhase: (targetPhase: OverlayPhase) => void
  skipToReading: () => void
  resetOverlayScene: () => void
  start: () => void
  updateLayout: () => void
  openResultPanel: () => void
  setDrawCardSizes: ReturnType<typeof useAnimationState>['setDrawCardSizes']
  setDrawScales: (scale: number) => void
  clearTimeline: () => void
  killTimeline: () => void
  killAnimationTargets: () => void
  resetProgressModel: () => void
}

export function useAnimationController(deps: UseAnimationControllerDeps): UseAnimationControllerReturn {
  const phase = ref<OverlayPhase>('shuffling')
  const showResults = ref(false)
  const entryAnimationComplete = ref(false)
  const isPaused = ref(false)
  const playbackRate = ref(1)
  const cardsLanded = ref(false)

  const progressModel = createProgressModel('shuffling')

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
    overlayVarsStyle,
    refreshBg, refreshStage, refreshHeader, refreshFooter, refreshDeckCtn,
    refreshInitials, refreshDraws,
    resetShuffleVisualState, resetCutVisualState, resetDrawVisualState, resetInitialDeckState,
    setDrawCardSizes,
    getAllTargets,
  } = animState

  const progressHeaderPresentation = computed(() =>
    presentProgressHeader(phase.value, (name) => deps.themeStore.getUiAsset(name)),
  )

  const footerPresentation = computed(() =>
    presentFooter(phase.value, showResults.value),
  )

  const phaseSteps = computed(() => calculatePhaseProgress(phase.value))
  const activePhaseIndex = computed(() => phaseSteps.value.findIndex((s) => s.isActive))

  const { getSceneLayout, checkWidth } = layoutApi

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
    deps.callbacks.onResetReading()

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
    deps.callbacks.onDestroyReading()
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
    deps.callbacks.onPhaseChange(nextPhase)
  }

  function createPhaseContext(): PhaseContext {
    const drawViewport = layoutApi.getViewportMetrics(false)
    const safeFrame = buildOverlaySafeFrame(
      'draw_stage',
      drawViewport,
      layoutApi.RESULT_SHEET_FRACTION,
    )

    return {
      deckGeometry: resolveDeckGeometry(safeFrame, DECK_COUNT),
      spreadSlots: [],
      getCurrentLayouts: () => {
        const { drawLayout } = layoutApi.getOverlayLayouts()
        return { drawLayout }
      },
      getTargetLayouts: () => {
        const { drawLayout } = layoutApi.getOverlayLayouts()
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
        transitionPhase(p)
      },
    }
  }

  function createPhaseRunners(): PhaseRunner[] {
    const metrics = layoutApi.getMotionMetrics('draw_stage')

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
          const { drawLayout, drawViewport } = layoutApi.getOverlayLayouts()
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
          const { drawLayout } = layoutApi.getOverlayLayouts()
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
        return tl as gsap.core.Timeline | null
      },
    }
  }

  function runPipeline(startIndex: number = 0) {
    const phaseContext = createPhaseContext()
    const phaseRunners = createPhaseRunners()
    const ordered = phaseRunners.map((runner) => adaptPhaseRunner(runner, phaseContext))

    const pipeline = createPhasePipeline(timelineOrchestrator, ordered, {
      onPhaseStart: (startedPhase: OverlayPhase) => {
        transitionPhase(startedPhase)
        if (startedPhase === 'shuffling') {
          settleEntryAnimation()
        }
        if (startedPhase === 'revealing') {
          openResultPanel()
        }
      },
      onPhaseComplete: (completedPhase: OverlayPhase) => {
        if (completedPhase === 'drawing') {
          deps.callbacks.onDrawingComplete()
        }
      },
      onPipelineComplete: () => {
        deps.callbacks.onPipelineComplete()
      },
    })

    pipeline.run(startIndex)
  }

  function skipToReading() {
    interruptCurrentAnimation()
    entryAnimationComplete.value = true
    resetOverlayScene()
    
    // Force draw cards if not done
    if (deps.tarotStore.drawnCards.length === 0) {
      deps.tarotStore.drawCards()
    }
    
    // Jump to revealing phase
    transitionPhase('revealing')
    openResultPanel()
    
    // Position cards at their final slots for the revealing phase
    const layout = getSceneLayout('draw_stage')
    setDrawCardSizes(layout)
    _draws.forEach((draw, index) => {
      if (index >= layout.cards.length) return
      draw.x = layout.cards[index].x
      draw.y = layout.cards[index].y
      draw.scale = 1
      draw.opacity = 1
    })
    refreshDraws()
    
    // Trigger callbacks
    deps.callbacks.onDrawingComplete()
    deps.callbacks.onPipelineComplete()
  }

  function replayFromPhase(targetPhase: OverlayPhase) {
    interruptCurrentAnimation()
    entryAnimationComplete.value = true
    resetOverlayScene()
    phase.value = targetPhase
    progressModel.transitionTo(targetPhase)
    deps.callbacks.onPhaseChange(targetPhase)

    if (targetPhase === 'revealing') {
      if (deps.tarotStore.drawnCards.length === 0) {
        deps.tarotStore.drawCards()
      }
    }

    const startIndex = getPhaseIndex(targetPhase)
    runPipeline(startIndex)
  }

  function updateLayout() {
    const layout = getSceneLayout('draw_stage')
    setDrawCardSizes(layout)

    gsap.killTweensOf(_draws)

    _draws.forEach((draw, index) => {
      if (index >= layout.cards.length) return
      draw.x = layout.cards[index].x
      draw.y = layout.cards[index].y
    })
    refreshDraws()
  }

  function setDrawScales(scale: number): void {
    _draws.forEach((draw, index) => {
      if (index < deps.cardCount.value) draw.scale = scale
    })
    refreshDraws()
  }

  function openResultPanel() {
    if (showResults.value) return
    showResults.value = true
  }

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
        duration: ENTRY_BG_FADE_DURATION,
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
        duration: ENTRY_CARDS_DROP_DURATION,
        ease: 'power3.out',
        stagger: 0.02,
        onUpdate: refreshInitials,
      }, 0)

      entryTimeline.fromTo(_header, { y: 100, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: ENTRY_HEADER_SLIDE_DURATION,
        ease: 'power2.out',
        onUpdate: refreshHeader,
      }, 0.4)

      entryTimeline.fromTo(_footer, { y: 100, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: ENTRY_FOOTER_SLIDE_DURATION,
        ease: 'power2.out',
        onUpdate: refreshFooter,
      }, 0.6)

      entryTimeline.call(() => runPipeline(0), [], `+=${ENTRY_TO_SHUFFLE_DELAY_MS / 1000}`)
      timelineOrchestrator.add(entryTimeline)
    })
  }

  return {
    phase,
    showResults,
    entryAnimationComplete,
    isPaused,
    playbackRate,
    cardsLanded,
    bgStyle,
    stageStyle,
    headerStyle,
    footerStyle,
    deckCtnStyle,
    initialsStyle,
    leftsStyle,
    rightsStyle,
    pilesStyle,
    drawsStyle,
    drawsSizeStyle,
    innersStyle,
    leftsVisible,
    rightsVisible,
    pilesVisible,
    drawsVisible,
    overlayVarsStyle,
    layoutCardWidth,
    layoutCardHeight,
    progressHeaderPresentation,
    footerPresentation,
    phaseSteps,
    activePhaseIndex,
    getSceneLayout,
    checkWidth,
    deckCount: DECK_COUNT,
    shuffleHalfCount: SHUFFLE_HALF_COUNT,
    cutPileCount: CUT_PILE_COUNT,
    cardsPerPile: CARDS_PER_PILE,
    _draws,
    refreshDraws,
    setPlaybackRate,
    pauseAnimations,
    resumeAnimations,
    stepForward,
    stepBackward,
    seek,
    replayFromPhase,
    skipToReading,
    resetOverlayScene,
    start,
    updateLayout,
    openResultPanel,
    setDrawCardSizes,
    setDrawScales,
    clearTimeline: () => timelineOrchestrator.clear(),
    killTimeline: () => timelineOrchestrator.kill(),
    killAnimationTargets: () => killAnimationTargets(getAllTargets()),
    resetProgressModel: () => progressModel.reset(),
  }
}
