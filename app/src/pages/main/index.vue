<template>
  <!--
    Main page route root (docs/prd/glossary.md（路由 #1）). Renders the unified PlayView
    across every divination phase, with ReadingSplit/Drawer overlaid in
    'reading'/'decision'. NotificationHost lives on the route root for
    cross-view alerts. The .canvas wrapper holds the divination canvas
    (capped at MAX_CANVAS_WIDTH per docs/prd/animation.md（视图过渡动画）) and slides flush-left
    when reading mode opens on a wide viewport.

    Single PlayView instance — task 8.2.3 collapsed the legacy
    IdleView ↔ DivinationView v-if/v-else split into one always-mounted
    view, so the underlying Deck never unmounts. That removed the need
    for the .view-switch cross-fade transition and the scale-1→1.5
    push-fade exit tween that previously masked the unmount/mount gap.
  -->
  <view
    class="main-page"
    :class="{ 'is-reading-wide': isWide && showReadingView }"
    :style="cssVarStyle"
  >
    <view class="canvas">
      <PlayView
        :cards-load-error="tarotStore.cardsLoadError"
        :is-cards-loading="tarotStore.isCardsLoading"
        @retry-load-cards="handleRetryLoadCards"
      />
    </view>

    <!-- Wide → split, narrow → drawer (docs/prd/glossary.md（视图）). Mounted only in 'reading'/'decision'. -->
    <ReadingSplitView
      v-if="showReadingView && isWide"
      :panel-state="readingPanelState"
      :reading-result="readingResult"
      :phase="phase"
      :question="currentQuestion"
      :error-message="readingErrorMessage"
      @restart="handleRestart"
      @back-home="handleBackHome"
      @retry="handleRetry"
      @typewriter-complete="handleTypewriterComplete"
    />
    <ReadingDrawerView
      v-else-if="showReadingView && !isWide"
      :panel-state="readingPanelState"
      :reading-result="readingResult"
      :phase="phase"
      :drawer-geometry="resultDrawerGeometry"
      :question="currentQuestion"
      :error-message="readingErrorMessage"
      @restart="handleRestart"
      @back-home="handleBackHome"
      @retry="handleRetry"
      @typewriter-complete="handleTypewriterComplete"
    />

    <NotificationHost />
    <DevToolsPanel
      :phase-steps="animationController.phaseSteps.value"
      :playback-rate="animationController.playbackRate.value"
      :is-paused="animationController.isPaused.value"
      :is-dev-expanded="devTools.isDevExpanded.value"
      :show-container-borders="devTools.showContainerBorders.value"
      @replay="devTools.handleDevReplay"
      @skip-to-reading="devTools.handleDevSkipToReading"
      @playback-rate="devTools.handleDevPlaybackRate"
      @pause="animationController.pauseAnimations"
      @resume="animationController.resumeAnimations"
      @step-forward="animationController.stepForward"
      @step-backward="animationController.stepBackward"
      @toggle-dev-expanded="devTools.isDevExpanded.value = !devTools.isDevExpanded.value"
      @toggle-container-borders="devTools.toggleContainerBorders"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * Name: pages/main/index
 * Purpose: route root for the main divination flow. Owns app-level phase
 *          (via `useAppPhase`), the `isWide` ref, and the animation +
 *          reading controllers. Provides all of these to descendant views
 *          via Vue provide/inject. View-picker derivation, dev tools, and
 *          the CSS-variable bridge live in dedicated composables so the
 *          SFC body stays focused on orchestration.
 * Data flow:
 *   - tarotStore.phase ──▶ useAppPhase ──▶ provide('appPhase') ──▶ views
 *   - uni.getWindowInfo + onWindowResize ──▶ isWide ──▶ provide('isWide')
 *   - useAnimationController + useReadingController are wired here via
 *     callbacks (onDrawingStart / onPipelineComplete) and provided so
 *     any descendant can inject them.
 */
import { computed, provide, ref, onMounted, onUnmounted } from 'vue'
import PlayView from '../../shared/views/PlayView.vue'
import ReadingSplitView from '../../shared/views/ReadingSplitView.vue'
import ReadingDrawerView from '../../shared/views/ReadingDrawerView.vue'
import NotificationHost from '../../components/NotificationHost.vue'
import DevToolsPanel from '../../components/DevToolsPanel.vue'
import { useAppPhase } from '../../state/use_app_phase'
import { useTarotStore } from '../../shared/store/tarot'
import { useThemeStore } from '../../shared/store/theme'
import { useAnimationController } from '../../state/use_animation_controller'
import { useReadingController } from '../../state/use_reading_controller'
import { useActiveView } from '../../state/use_active_view'
import { useDevTools } from '../../tools/use_dev_tools'
import { useCssVarBridge } from '../../core/sizing/use_css_var_bridge'
import { useMainHandlers } from '../../state/use_main_handlers'
import { useResultCardShrink } from '../../state/use_result_card_shrink'
import { MAX_CANVAS_WIDTH } from '../../core/sizing/scale'
import type { OverlayPhase } from '../../core/flow/types'

/* ── Stores + phase ─────────────────────────────────────────────────── */

const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const { phase, startDivination, enterDecision, resetToIdle } = useAppPhase()

provide('appPhase', phase)

/* ── Responsive width ──────────────────────────────────────────────── */

/**
 * Wide-screen branch threshold (docs/prd/animation.md（视图过渡动画）). The divination canvas is
 * capped at MAX_CANVAS_WIDTH (440 px); any viewport wider than that has
 * room for the side reading panel — split mode wins. Below/equal, the
 * drawer overlay wins.
 */
const isWide = ref(false)
function recomputeIsWide() {
  const { windowWidth } = uni.getWindowInfo()
  isWide.value = windowWidth > MAX_CANVAS_WIDTH
}
provide('isWide', isWide)

/* ── CSS variable bridge: ResponsiveSizes → custom properties on root ─ */
const cssVarStyle = useCssVarBridge()

/* ── Controller instances (single_card spread → cardCount = 1) ─────── */
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
// Provided so descendant views can inject without re-instantiating.
provide('animationController', animationController)
provide('readingController', readingController)

/* ── View picker + reading panel passthrough ───────────────────────── */

const { showReadingView, resultDrawerGeometry } = useActiveView({ phase })

/* ── Two-phase result-card sizing ──────────────────────────────────── */
/**
 * The reveal pipeline grows cards to their *full* safe-area size (the
 * 240×384 phone-shell maximum on every supported canvas). When the
 * drawer mounts (showReadingView false→true on narrow viewports) we
 * animate the card down to the drawer-reserved size so the bottom
 * sheet doesn't crop it. The tween lives in a focused composable so
 * the shrink rules + GSAP cleanup stay auditable in one place.
 */
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

/* ── Event handlers ─────────────────────────────────────────────────── */

function handleRetryLoadCards() {
  tarotStore.loadCards()
}

const { settlePipeline, handleRestart } = useMainHandlers({
  tarotStore,
  animationController,
  readingController,
  getReadingPromise: () => currentReadingPromise,
  setReadingPromise: (next) => { currentReadingPromise = next },
  startDivination,
})

function handleTypewriterComplete() {
  enterDecision()
}

function handleBackHome() {
  resetToIdle()
}

function handleRetry() {
  // Fire-and-forget: the click handler must return synchronously, but
  // retryReading is async. Surface failures via console.error rather than
  // letting them silently disappear (the previous `void` pattern hid them).
  readingController.retryReading({}).catch((err) => {
    console.error('[main] retryReading failed', err)
  })
}

/* ── Dev tools (compiled out of production) ─────────────────────────── */
const devTools = useDevTools({
  animationController,
  readingController,
  setReadingPromise: (promise) => { currentReadingPromise = promise },
})

/* ── Lifecycle ─────────────────────────────────────────────────────── */
onMounted(() => {
  recomputeIsWide()
  uni.onWindowResize(recomputeIsWide)
})
onUnmounted(() => { uni.offWindowResize(recomputeIsWide) })
</script>

<style scoped>
.main-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-page);
}

/* docs/prd/animation.md（视图过渡动画） — canvas capped at MAX_CANVAS_WIDTH (440 px). Centered on
   wider viewports via translateX max-clamp; slides flush-left in
   .is-reading-wide so ReadingSplitView fills the right remainder. */
.canvas {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  max-width: 440px;
  transform: translateX(max(0px, calc((100vw - 440px) / 2)));
  transition: transform 450ms cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-page.is-reading-wide .canvas {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .canvas {
    transition: none;
  }
}

/*
 * The legacy `.view-switch-*` 450 ms cross-fade transition was deleted
 * in task 8.2.3 — the view is now a single always-mounted PlayView, so
 * there is no swap to fade between. Keep DUR_IDLE_TO_DIV_MS in
 * animation/easings.ts only as the divination-rig entrance budget; no
 * CSS rule here references it any more.
 */
</style>
