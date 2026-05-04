<template>
  <!--
    Main page route root (PRD §2.2 #1). Renders IdleView at phase 'idle'
    and DivinationView for every other phase, with ReadingSplit/Drawer
    overlaid in 'reading'/'decision'. NotificationHost lives on the route
    root for cross-view alerts. The .canvas wrapper holds the divination
    canvas (capped at MAX_CANVAS_WIDTH per PRD §8.2.1) and slides
    flush-left when reading mode opens on a wide viewport.
    Explicit v-if branches (rather than <component :is>) keep each view's
    emit contract intact for vue-tsc.
  -->
  <view
    class="main-page"
    :class="{ 'is-reading-wide': isWide && showReadingView }"
    :style="cssVarStyle"
  >
    <view class="canvas">
      <transition name="view-switch">
        <IdleView
          v-if="phase === 'idle'"
          :cards-load-error="tarotStore.cardsLoadError"
          :is-cards-loading="tarotStore.isCardsLoading"
          @trigger-divination="handleTriggerDivination"
          @retry-load-cards="handleRetryLoadCards"
        />
        <DivinationView v-else :key="'divination'" />
      </transition>
    </view>

    <!-- Wide → split, narrow → drawer (PRD §2.3). Mounted only in 'reading'/'decision'. -->
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
import IdleView from '../../views/IdleView.vue'
import DivinationView from '../../views/DivinationView.vue'
import ReadingSplitView from '../../views/ReadingSplitView.vue'
import ReadingDrawerView from '../../views/ReadingDrawerView.vue'
import NotificationHost from '../../components/containers/NotificationHost.vue'
import DevToolsPanel from '../../components/overlay/DevToolsPanel.vue'
import { useAppPhase } from '../../composables/use_app_phase'
import { useTarotStore } from '../../stores/tarot'
import { useThemeStore } from '../../stores/theme'
import { useAnimationController } from '../../composables/use_animation_controller'
import { useReadingController } from '../../composables/use_reading_controller'
import { useActiveView } from '../../composables/use_active_view'
import { useDevTools } from '../../composables/use_dev_tools'
import { useCssVarBridge } from '../../composables/use_css_var_bridge'
import { MAX_CANVAS_WIDTH } from '../../core/sizing/scale'
import type { OverlayPhase } from '../../core/flow/types'

/* ── Stores + phase ─────────────────────────────────────────────────── */

const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const { phase, startDivination, enterDecision, resetToIdle } = useAppPhase()

provide('appPhase', phase)

/* ── Responsive width ──────────────────────────────────────────────── */

/**
 * Wide-screen branch threshold (PRD §8.2.1). The divination canvas is
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

const readingPanelState = computed(() => readingController.readingPanelState.value)
const readingResult = computed(() => readingController.readingResult.value)
const readingErrorMessage = computed(() => readingController.readingErrorMessage.value)
const currentQuestion = computed(() => tarotStore.currentQuestion)

/* ── Event handlers ─────────────────────────────────────────────────── */

function handleTriggerDivination() {
  startDivination(tarotStore.currentQuestion)
}

function handleRetryLoadCards() {
  tarotStore.loadCards()
}

async function settlePipeline(): Promise<void> {
  try {
    await (currentReadingPromise ?? Promise.resolve(null))
  } catch (err) {
    console.error('[main] settlePipeline failed', err)
  }
  currentReadingPromise = null
  // Promote the application stage to `reading` once the pipeline has
  // settled — both for success AND for error. The reading drawer / split
  // view is gated by phase ∈ {reading, decision} (see useActiveView), so
  // without this branch a failed /api/v1/divinations response leaves the
  // user stuck on the reveal animation with no error UI mounted (PRD §9.5
  // anomaly recovery; verified by network_error.spec.ts). On error the
  // ReadingPanel renders its `.error-box` + ActionArea swaps the primary
  // CTA to "重试读取" so the user can recover.
  const status = readingController.readingPanelState.value
  const hasResolvedSuccess =
    status === 'success' && readingController.readingResult.value !== null
  if (hasResolvedSuccess || status === 'error') {
    tarotStore.revealResult()
  }
}

function handleTypewriterComplete() {
  enterDecision()
}

function handleRestart(): void {
  animationController.resumeAnimations()
  animationController.setPlaybackRate(1)
  readingController.resetReading()
  animationController.clearTimeline()
  animationController.seek(0)
  animationController.showResults.value = false
  animationController.resetOverlayScene()
  startDivination(tarotStore.currentQuestion)
  animationController.resetProgressModel()
  animationController.phase.value = 'shuffling'
  animationController.start()
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

/* PRD §8.2.1 — canvas capped at MAX_CANVAS_WIDTH (440 px). Centered on
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

/* PRD §8.1.2 — idle ↔ divination view swap (~450ms; keep in sync with
   DUR_IDLE_TO_DIV_MS in animation/easings.ts). Both views absolute so
   they overlap cleanly during the transition. */
.view-switch-enter-active,
.view-switch-leave-active {
  transition: opacity 450ms cubic-bezier(0.16, 1, 0.3, 1);
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.view-switch-enter-from,
.view-switch-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .view-switch-enter-active,
  .view-switch-leave-active {
    transition: none;
  }
}
</style>
