/**
 * Name: use_overlay_controller
 * Purpose: facade that delegates to useAnimationController and useReadingController.
 * Reason: keeps the template-facing API unchanged while internals are split into focused modules.
 */

import { computed, nextTick, onMounted, onUnmounted, type Ref } from 'vue'
import { useTarotStore } from '../stores/tarot'
import { useThemeStore } from '../stores/theme'
import { RESULT_LIFT_MARGIN_PX, RESULT_LIFT_MAX_FRACTION } from '../core/config/layout_constants'
import { DEFAULT_OVERLAY_TEXT } from '../utils/overlay_progress'
import type { OverlayPhase } from '../core/flow/types'

import { useAnimationController } from './use_animation_controller'
import { useReadingController } from './use_reading_controller'

export interface UseOverlayControllerDeps {
  tarotStore: ReturnType<typeof useTarotStore>
  themeStore: ReturnType<typeof useThemeStore>
  isWide: Ref<boolean>
  cardCount: Ref<number>
  emit: ((event: 'complete') => void) & ((event: 'restart') => void) & ((event: 'backHome') => void)
}

export function useOverlayController(deps: UseOverlayControllerDeps) {
  let currentReadingPromise: Promise<unknown> | null = null

  const readingController = useReadingController({ tarotStore: deps.tarotStore })

  const animController = useAnimationController({
    tarotStore: deps.tarotStore,
    themeStore: deps.themeStore,
    isWide: deps.isWide,
    cardCount: deps.cardCount,
    callbacks: {
      onDrawingComplete: () => {
        currentReadingPromise = readingController.startReading({
          cards: deps.tarotStore.drawnCards,
          question: deps.tarotStore.currentQuestion,
          spreadKind: deps.tarotStore.spreadKind,
        })
      },
      onPipelineComplete: () => { void finish() },
      onPhaseChange: (p: OverlayPhase) => { deps.tarotStore.setPhase(p) },
      onResetReading: () => { readingController.resetReading() },
      onDestroyReading: () => { readingController.destroyReading() },
    },
  })

  const cardsFocused = computed(() =>
    !animController.showResults.value ? animController.cardsLanded.value : readingController.readingPanelState.value !== 'success',
  )
  const cardsDocked = computed(() =>
    animController.showResults.value && readingController.readingPanelState.value === 'success',
  )
  const resultCardLiftY = computed(() => {
    if (!animController.showResults.value || deps.isWide.value) return 0
    try {
      const drawLayout = animController.getSceneLayout('draw_stage')
      const resultLayout = animController.getSceneLayout('result_stage')
      const drawBottom = Math.max(...drawLayout.cards.map(c => c.y + c.height / 2))
      const resultBottom = Math.max(...resultLayout.cards.map(c => c.y + c.height / 2))
      const lift = drawBottom - resultBottom + RESULT_LIFT_MARGIN_PX
      const { windowHeight } = uni.getWindowInfo()
      const maxLift = Math.max(0, windowHeight * RESULT_LIFT_MAX_FRACTION)
      return Math.max(0, Math.min(lift, maxLift))
    } catch { return 0 }
  })
  const overlayVarsStyle = computed(() => {
    const base = animController.overlayVarsStyle.value
    const extra = `--result-card-lift-y: ${resultCardLiftY.value}px`
    return base ? `${base}; ${extra}` : extra
  })

  async function finish() {
    try {
      await (currentReadingPromise ?? Promise.resolve(null))
    } catch (err) {
      console.error('[overlay] finish: reading promise rejected', err)
    }
    currentReadingPromise = null
    animController.setDrawScales(1)
    if (readingController.readingPanelState.value === 'success' && readingController.readingResult.value) {
      deps.tarotStore.revealResult()
      deps.emit('complete')
    }
  }

  async function retryReading() {
    if (readingController.isReadingLoading.value) return null
    animController.openResultPanel()
    animController.setDrawScales(1)
    try {
      const result = await readingController.retryReading({
        cards: deps.tarotStore.drawnCards,
        question: deps.tarotStore.currentQuestion,
        spreadKind: deps.tarotStore.spreadKind,
      })
      if (result) deps.tarotStore.revealResult()
      return result
    } catch (err) {
      console.error('[overlay] retryReading failed', err)
      return null
    }
  }

  function skipToReading() {
    readingController.resetReading()
    animController.skipToReading()
  }

  function restart() {
    animController.resumeAnimations()
    animController.setPlaybackRate(1)
    readingController.resetReading()
    animController.clearTimeline()
    animController.seek(0)
    animController.showResults.value = false
    animController.resetOverlayScene()
    deps.tarotStore.startDivination(deps.tarotStore.currentQuestion)
    animController.resetProgressModel()
    animController.phase.value = 'shuffling'
    animController.start()
  }

  let resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

  onMounted(() => {
    animController.resumeAnimations()
    animController.setPlaybackRate(1)
    const { windowWidth } = uni.getWindowInfo()
    animController.checkWidth(windowWidth)
    const drawLayout = animController.getSceneLayout('draw_stage')
    animController.setDrawCardSizes(drawLayout)
    resizeHandler = (res) => {
      animController.checkWidth(res.size.windowWidth)
      const layout = animController.getSceneLayout('draw_stage')
      animController.setDrawCardSizes(layout)
      if (animController.showResults.value
          || animController.phase.value === 'drawing'
          || animController.phase.value === 'revealing') {
        nextTick(() => animController.updateLayout())
      }
    }
    uni.onWindowResize(resizeHandler)
    animController.start()
  })

  onUnmounted(() => {
    readingController.destroyReading()
    animController.resumeAnimations()
    animController.setPlaybackRate(1)
    if (resizeHandler) uni.offWindowResize(resizeHandler)
    animController.clearTimeline()
    animController.killTimeline()
    animController.killAnimationTargets()
  })

  return {
    bgStyle: animController.bgStyle, stageStyle: animController.stageStyle,
    headerStyle: animController.headerStyle, footerStyle: animController.footerStyle,
    deckCtnStyle: animController.deckCtnStyle, initialsStyle: animController.initialsStyle,
    leftsStyle: animController.leftsStyle, rightsStyle: animController.rightsStyle,
    leftsVisible: animController.leftsVisible, rightsVisible: animController.rightsVisible,
    pilesStyle: animController.pilesStyle, pilesVisible: animController.pilesVisible,
    drawsStyle: animController.drawsStyle, drawsSizeStyle: animController.drawsSizeStyle,
    innersStyle: animController.innersStyle, drawsVisible: animController.drawsVisible,
    overlayVarsStyle,

    deckCount: animController.deckCount, shuffleHalfCount: animController.shuffleHalfCount,
    cutPileCount: animController.cutPileCount, cardsPerPile: animController.cardsPerPile,

    showResults: animController.showResults, phase: animController.phase,
    entryAnimationComplete: animController.entryAnimationComplete,
    layoutCardWidth: animController.layoutCardWidth, layoutCardHeight: animController.layoutCardHeight,
    playbackRate: animController.playbackRate, isPaused: animController.isPaused,

    readingPanelState: readingController.readingPanelState,
    readingErrorMessage: readingController.readingErrorMessage,
    isReadingFailed: readingController.isReadingFailed,
    isReadingLoading: readingController.isReadingLoading,
    cardsFocused, cardsDocked,

    progressHeaderPresentation: animController.progressHeaderPresentation,
    footerPresentation: animController.footerPresentation,
    phaseSteps: animController.phaseSteps, activePhaseIndex: animController.activePhaseIndex,

    cardBack: computed(() => deps.themeStore.cardBackImage),
    getCardImg: (index: number) => deps.tarotStore.drawnCards[index]?.card.image || deps.themeStore.cardBackImage,
    getCardImgName: (index: number) => deps.tarotStore.drawnCards[index]?.card.name,
    overlayText: DEFAULT_OVERLAY_TEXT,
    getSceneLayout: animController.getSceneLayout,

    setPlaybackRate: animController.setPlaybackRate, pauseAnimations: animController.pauseAnimations,
    resumeAnimations: animController.resumeAnimations, stepForward: animController.stepForward,
    stepBackward: animController.stepBackward, seek: animController.seek,
    replayFromPhase: animController.replayFromPhase, 
    skipToReading,
    restart, retryReading,
  }
}
