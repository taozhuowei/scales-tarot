/**
 * Name: use_overlay
 * Purpose: facade that delegates to useAnimationController and useReadingController.
 * Reason: renamed from use_overlay_controller for naming consistency; keeps the
 *         template-facing API unchanged while internals are split into focused modules.
 * Data flow: animationController + readingController → merged return object for the template.
 */

import { computed, nextTick, onMounted, onUnmounted, type Ref } from 'vue'
import { useTarotStore } from '../store/tarot'
import { useThemeStore } from '../store/theme'
import { DEFAULT_OVERLAY_TEXT } from '../core/utils/overlay_progress'
import type { OverlayPhase } from '../core/flow/types'

import { useAnimationController } from './use_animation_controller'
import { useReadingController } from './use_reading_controller'

/** Vertical margin added to the result-card lift transform so the bottom
 *  of the card never touches the drawer's top edge during the reveal. */
export const RESULT_LIFT_MARGIN_PX = 16

export interface UseOverlayDeps {
  tarotStore: ReturnType<typeof useTarotStore>
  themeStore: ReturnType<typeof useThemeStore>
  isWide: Ref<boolean>
  cardCount: Ref<number>
  emit: ((event: 'complete') => void) & ((event: 'restart') => void) & ((event: 'backHome') => void)
}

export function useOverlay(deps: UseOverlayDeps) {
  let currentReadingPromise: Promise<unknown> | null = null

  const readingController = useReadingController({ tarotStore: deps.tarotStore })

  const animController = useAnimationController({
    tarotStore: deps.tarotStore,
    themeStore: deps.themeStore,
    isWide: deps.isWide,
    cardCount: deps.cardCount,
    callbacks: {
      // Fire the merged divination request the moment drawing begins.
      // The reading orchestrator writes drawn cards into the store and
      // resolves with the reading by the time `revealing` opens the panel,
      // so the network round-trip is hidden behind the drawing animation.
      onDrawingStart: () => {
        currentReadingPromise = readingController.startReading({})
      },
      onPipelineComplete: () => { void finish() },
      onPhaseChange: (_p: OverlayPhase) => {
        // OverlayPhase (shuffling/cutting/drawing/revealing) and DivinationPhase
        // (idle/divination/reading/decision) are two layers of the same flow
        // (docs/prd/state.md（流程阶段）). All four overlay phases run inside the application-level
        // `divination` stage, so a phase advance never changes the app stage —
        // we just keep the store pinned to `divination` for the duration of
        // the animation pipeline.
        deps.tarotStore.setPhase('divination')
      },
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
      const resultLayout = animController.getSceneLayout('reading_stage')
      const drawBottom = Math.max(...drawLayout.cards.map(c => c.y + c.height / 2))
      const resultBottom = Math.max(...resultLayout.cards.map(c => c.y + c.height / 2))
      // The solver places both stages deterministically, so the lift is just
      // the geometric difference plus a small visual margin. The previous
      // 0.28 × viewport cap is no longer needed — both positions are bounded
      // by the same `availableH` budget, so the difference cannot blow up.
      const lift = drawBottom - resultBottom + RESULT_LIFT_MARGIN_PX
      return Math.max(0, lift)
    } catch { return 0 }
  })
  // Wide-mode stage / drawer split: previously hard-coded as `54% / 46%` in
  // CSS, which silently disagreed with the solver's pixel-based stage and
  // drawer widths whenever viewport.width × 0.46 ≠ DEFAULT_DRAWER_WIDE_WIDTH.
  // Exposing both as CSS variables keeps the DOM container widths and the
  // solver-computed card positions in lock-step.
  const stageWidthPx = computed(() => {
    try { return animController.getSceneLayout('reading_stage').stage.width }
    catch { return 0 }
  })
  const drawerWidthPx = computed(() => {
    try { return animController.getSceneLayout('reading_stage').drawer.width }
    catch { return 0 }
  })
  const overlayVarsStyle = computed(() => {
    const base = animController.overlayVarsStyle.value
    const extras = [
      `--result-card-lift-y: ${resultCardLiftY.value}px`,
      `--stage-width: ${stageWidthPx.value}px`,
      `--drawer-width: ${drawerWidthPx.value}px`,
    ].join('; ')
    return base ? `${base}; ${extras}` : extras
  })

  async function finish() {
    try {
      await (currentReadingPromise ?? Promise.resolve(null))
    } catch (err) {
      console.error('[overlay] finish: reading promise rejected', err)
    }
    currentReadingPromise = null
    if (readingController.readingPanelState.value === 'success' && readingController.readingResult.value) {
      deps.tarotStore.revealResult()
      deps.emit('complete')
    }
  }

  async function retryReading() {
    if (readingController.isReadingLoading.value) return null
    animController.openReadingPanel()
    try {
      const result = await readingController.retryReading({})
      if (result) deps.tarotStore.revealResult()
      return result
    } catch (err) {
      console.error('[overlay] retryReading failed', err)
      return null
    }
  }

  function skipToReading() {
    readingController.resetReading()
    // Without the drawing animation we have no `onDrawingStart` hook, so
    // the dev tool must manually fire the divination request before the
    // pipeline-complete handler tries to settle into the result state.
    currentReadingPromise = readingController.startReading({})
    animController.skipToReading()
  }

  function replayFromPhase(targetPhase: OverlayPhase) {
    // Replays that re-enter at or before drawing pass through the
    // `onDrawingStart` hook (which seeds the reading), but a replay that
    // jumps straight to `revealing` skips the drawing builder entirely —
    // the hook never fires and the panel opens with an empty body. Mirror
    // the skipToReading flow: synchronously fire startReading for that one
    // boundary case before delegating to the animation controller. Any
    // earlier target (shuffling/cutting/drawing) still goes through the
    // pipeline's drawing phase and triggers onDrawingStart naturally.
    if (targetPhase === 'revealing') {
      readingController.resetReading()
      currentReadingPromise = readingController.startReading({})
    }
    animController.replayFromPhase(targetPhase)
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
    ...animController,
    // Overlays add their own computed/methods
    overlayVarsStyle,
    readingPanelState: readingController.readingPanelState,
    readingErrorMessage: readingController.readingErrorMessage,
    isReadingFailed: readingController.isReadingFailed,
    isReadingLoading: readingController.isReadingLoading,
    cardsFocused, cardsDocked,
    cardBack: computed(() => deps.themeStore.cardBackImage),
    getCardImg: (index: number) => deps.tarotStore.drawnCards[index]?.card.image || deps.themeStore.cardBackImage,
    getCardImgName: (index: number) => deps.tarotStore.drawnCards[index]?.card.name,
    overlayText: DEFAULT_OVERLAY_TEXT,
    skipToReading,
    // Override the spread's animation-only replayFromPhase with the wrapper
    // that also seeds the reading request when the target is `revealing`.
    replayFromPhase,
    restart,
    retryReading,
  }
}
