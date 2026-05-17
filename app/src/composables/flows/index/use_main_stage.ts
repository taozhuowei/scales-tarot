/**
 * Name: use_main_stage
 * Purpose: aggregate the main-page orchestration so pages/main/index.vue
 *          stays a pure entry. Owns stores, app phase, responsive width +
 *          resize lifecycle, the CSS-var bridge, the animation + reading
 *          controllers (and their callback wiring), the view picker,
 *          two-phase result-card sizing, reading passthrough, the main
 *          event handlers, and dev tools.
 * Data flow: constructs the controller graph and lifecycle → returns refs /
 *          computeds / handlers the page binds; provide() stays in the page
 *          so the inject contract is visible at the route root.
 */
import { computed, ref, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue'
import { useAppPhase } from '../../../core/composables/use_app_phase'
import { useTarotStore } from '../../../core/store/tarot'
import { useThemeStore } from '../../../core/store/theme'
import { useAnimationController } from '../divination/use_animation_controller'
import { useReadingController } from '../reading/use_reading_controller'
import { useActiveView } from './use_active_view'
import { useDevTools } from './use_dev_tools'
import { useCssVarBridge } from '../../../core/sizing/use_css_var_bridge'
import { useMainHandlers } from './use_main_handlers'
import { useResultCardShrink } from '../reading/use_result_card_shrink'
import { MAX_CANVAS_WIDTH } from '../../../core/sizing/scale'
import type { OverlayPhase } from '../../shared/animations/contracts'
import type { UseAnimationControllerReturn } from '../divination/use_animation_controller'
import type { useReadingController as UseReadingControllerFn } from '../reading/use_reading_controller'
import type { useDevTools as UseDevToolsFn } from './use_dev_tools'
import type { DivinationPhase } from '../../../core/store/flow'

export interface MainStage {
  phase: Ref<DivinationPhase>
  isWide: Ref<boolean>
  cssVarStyle: ReturnType<typeof useCssVarBridge>
  animationController: UseAnimationControllerReturn
  readingController: ReturnType<typeof UseReadingControllerFn>
  devTools: ReturnType<typeof UseDevToolsFn>
  showReadingView: ComputedRef<boolean>
  resultDrawerGeometry: ReturnType<typeof useActiveView>['resultDrawerGeometry']
  readingPanelState: ComputedRef<ReturnType<typeof UseReadingControllerFn>['readingPanelState']['value']>
  readingResult: ComputedRef<ReturnType<typeof UseReadingControllerFn>['readingResult']['value']>
  readingErrorMessage: ComputedRef<ReturnType<typeof UseReadingControllerFn>['readingErrorMessage']['value']>
  currentQuestion: ComputedRef<string>
  handleRestart: () => void
  handleBackHome: () => void
  handleRetry: () => void
  handleTypewriterComplete: () => void
}

export function useMainStage(): MainStage {
  /* Stores + phase */
  const tarotStore = useTarotStore()
  const themeStore = useThemeStore()
  const { phase, startDivination, enterDecision, resetToIdle } = useAppPhase()

  /* Responsive width — capped at MAX_CANVAS_WIDTH (440px); wider viewports
     get the side reading panel (split), narrower the bottom drawer. */
  const isWide = ref(false)
  function recomputeIsWide() {
    const { windowWidth } = uni.getWindowInfo()
    isWide.value = windowWidth > MAX_CANVAS_WIDTH
  }

  /* CSS variable bridge: ResponsiveSizes → custom properties on root */
  const cssVarStyle = useCssVarBridge()

  /* Controllers (single_card spread → cardCount = 1) */
  const cardCount = computed(() => 1)
  const readingController = useReadingController({ tarotStore })
  let currentReadingPromise: Promise<unknown> | null = null
  const animationController = useAnimationController({
    tarotStore,
    themeStore,
    isWide,
    cardCount,
    callbacks: {
      onDrawingStart: () => { currentReadingPromise = readingController.startReading({}) },
      onPipelineComplete: () => { void settlePipeline() },
      onPhaseChange: (_p: OverlayPhase) => { tarotStore.setPhase('divination') },
      onResetReading: () => { readingController.resetReading() },
      onDestroyReading: () => { readingController.destroyReading() },
    },
  })

  /* View picker + two-phase result-card sizing */
  const { showReadingView, resultDrawerGeometry } = useActiveView({ phase })
  useResultCardShrink({
    showReadingView,
    isWide,
    draws: animationController.draws,
    getSceneLayout: animationController.getSceneLayout,
    cardCount,
  })

  const readingPanelState = computed(() => readingController.readingPanelState.value)
  const readingResult = computed(() => readingController.readingResult.value)
  const readingErrorMessage = computed(() => readingController.readingErrorMessage.value)
  const currentQuestion = computed(() => tarotStore.currentQuestion)

  /* Event handlers */
  const { settlePipeline, handleRestart } = useMainHandlers({
    tarotStore,
    animationController,
    readingController,
    getReadingPromise: () => currentReadingPromise,
    setReadingPromise: (next) => { currentReadingPromise = next },
    startDivination,
  })

  function handleTypewriterComplete() { enterDecision() }
  function handleBackHome() { resetToIdle() }
  function handleRetry() {
    // Fire-and-forget: the click handler must return synchronously, but
    // retryReading is async. Surface failures via console.error rather than
    // letting them silently disappear (the previous `void` pattern hid them).
    readingController.retryReading({}).catch((err) => {
      console.error('[main] retryReading failed', err)
    })
  }

  /* Dev tools (compiled out of production) */
  const devTools = useDevTools({
    animationController,
    readingController,
    setReadingPromise: (promise) => { currentReadingPromise = promise },
  })

  /* Lifecycle */
  onMounted(() => {
    recomputeIsWide()
    uni.onWindowResize(recomputeIsWide)
  })
  onUnmounted(() => { uni.offWindowResize(recomputeIsWide) })

  return {
    phase,
    isWide,
    cssVarStyle,
    animationController,
    readingController,
    devTools,
    showReadingView,
    resultDrawerGeometry,
    readingPanelState,
    readingResult,
    readingErrorMessage,
    currentQuestion,
    handleRestart,
    handleBackHome,
    handleRetry,
    handleTypewriterComplete,
  }
}
