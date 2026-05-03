<template>
  <!--
    Main page — phase-2.2.a wired.
    Hosts the main route's view tree (PRD §2.2 #1):
      - IdleView when phase === 'idle'
      - DivinationView when phase ∈ {'divination', 'reading', 'decision'}
        (ProgressArea + DivinationDeck are self-driven via injected animationController)
      - ReadingSplitView (wide) or ReadingDrawerView (narrow) overlaid on
        the divination view when phase ∈ {'reading', 'decision'}
      - NotificationHost mounted on the route root for cross-view alerts
  -->
  <view
    class="main-page"
    :class="{ 'is-reading-wide': isWide && showReadingView }"
    :style="cssVarStyle"
  >
    <!--
      View picker: phase === 'idle' renders IdleView, every other phase
      renders DivinationView. We use explicit v-if branches rather than
      <component :is> because the two views' prop shapes are disjoint —
      the dynamic-component intersection type erases each view's emit
      contract on the other branch and breaks vue-tsc.

      The <transition> provides the PRD §8.1.2 idle → divination visual swap:
      IdleView fades out while DivinationView fades in simultaneously.
      Both views are position: absolute during the overlap so neither
      pushes the other in the normal flow.

      The .canvas wrapper holds the divination canvas (width capped at
      MAX_CANVAS_WIDTH). It's centered when the viewport has spare room
      (PRD §8.2.1) and slides flush-left when reading mode opens on a
      wide viewport, so the right-side ReadingSplitView fills the
      remainder.
    -->
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

    <!--
      Reading viewport: chosen by viewport width per PRD §2.3 (wide → split,
      narrow → drawer). Mounted only while the application is in the
      reading or decision phase.
    -->
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
      :is-dev-expanded="isDevExpanded"
      :show-container-borders="showContainerBorders"
      @replay="handleDevReplay"
      @skip-to-reading="handleDevSkipToReading"
      @playback-rate="handleDevPlaybackRate"
      @pause="animationController.pauseAnimations"
      @resume="animationController.resumeAnimations"
      @step-forward="animationController.stepForward"
      @step-backward="animationController.stepBackward"
      @toggle-dev-expanded="isDevExpanded = !isDevExpanded"
      @toggle-container-borders="toggleContainerBorders"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * Name: pages/main/index
 * Purpose: route root for the main divination flow. Owns the application-
 *          level phase state (via useAppPhase), the responsive `isWide`
 *          ref, and the animation / reading controller instances. Provides
 *          all of these to descendant views via Vue's provide / inject.
 * Reason: the legacy entry (pages/index/index.vue + DivinationOverlay) put
 *         layout decisions, animation lifecycle, and store transitions in
 *         the same component. This page becomes the orchestration seam:
 *         it picks the active view by phase, supplies it props, and lets
 *         each view stay declarative.
 * Data flow:
 *   - tarotStore.phase ──▶ useAppPhase ──▶ provide('appPhase') ──▶ views
 *   - uni.getWindowInfo + uni.onWindowResize ──▶ isWide ref ──▶ provide
 *     ('isWide') + reading-view branch picker
 *   - useAnimationController + useReadingController instances are created
 *     here, wired via callbacks (onDrawingStart / onPipelineComplete), and
 *     provided so any descendant can inject them.
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
import { solveLayout } from '../../core/sizing/layout_solver'
import {
  deriveSizes,
  MAX_CANVAS_WIDTH,
  pickCanvasWidth,
  readViewport,
  useResponsiveScale,
} from '../../core/sizing/scale'
import type { OverlayPhase } from '../../core/flow/types'
// #ifdef H5
import { toggleContainerBorders as toggleContainerBordersH5 } from '../../utils/dev/container_borders'
// #endif

/* ── Stores + phase ─────────────────────────────────────────────────── */

const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const { phase, startDivination, enterDecision, resetToIdle } = useAppPhase()

provide('appPhase', phase)

/* ── Responsive width ──────────────────────────────────────────────── */

/**
 * Wide-screen branch threshold. The divination canvas is capped at
 * MAX_CANVAS_WIDTH (440 px), so any viewport wider than that has spare
 * horizontal room for the side reading panel — that's the entire
 * eligibility condition for split mode (PRD §8.2.1). Below or equal,
 * the drawer overlay is used instead.
 */
const isWide = ref(false)

function recomputeIsWide() {
  const { windowWidth } = uni.getWindowInfo()
  isWide.value = windowWidth > MAX_CANVAS_WIDTH
}

provide('isWide', isWide)

/* ── CSS variable bridge ───────────────────────────────────────────── */

/**
 * Single subscription point for the proportional scale system: bind every
 * derived size as a CSS custom property on the root view so any descendant
 * scoped CSS can reference them via `var(--margin)` / `var(--header-height)`
 * etc. without re-subscribing to the composable. `useResponsiveScale` is
 * a module-level singleton, so this is the only place in the tree that
 * needs to call it for the bridge to work — descendants stay declarative.
 *
 * Mini-program menu button avoidance is tracked separately in the
 * project task list (phase 8 follow-up); this code path is H5-only today.
 */
const { sizes } = useResponsiveScale()
const cssVarStyle = computed(() => ({
  '--margin': `${sizes.value.margin}px`,
  '--gap': `${sizes.value.gap}px`,
  '--header-height': `${sizes.value.headerHeight}px`,
  '--drawer-min-height': `${sizes.value.drawerMinHeight}px`,
  '--action-area-height': `${sizes.value.actionAreaHeight}px`,
  '--font-xxl': `${sizes.value.fontXXL}px`,
  '--font-xl': `${sizes.value.fontXL}px`,
  '--font-l': `${sizes.value.fontL}px`,
  '--font-m': `${sizes.value.fontM}px`,
  '--font-s': `${sizes.value.fontS}px`,
  '--font-xs': `${sizes.value.fontXS}px`,
}))

/* ── Card count (always 1 for single_card today) ───────────────────── */

const cardCount = computed(() => 1)

/* ── Controller instances ──────────────────────────────────────────── */

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
// Both controllers are exposed so descendant views can inject them without
// re-instantiating.
provide('animationController', animationController)
provide('readingController', readingController)

/* ── View picker ───────────────────────────────────────────────────── */

/**
 * Reading-view gate (PRD §7.4): the reading split / drawer view overlays
 * the divination view only while the application is in `reading` or
 * `decision`. Idle and divination phases never show it.
 */
const showReadingView = computed(() =>
  phase.value === 'reading' || phase.value === 'decision',
)

/* ── Reading panel props passthrough ───────────────────────────────── */

const readingPanelState = computed(() => readingController.readingPanelState.value)
const readingResult = computed(() => readingController.readingResult.value)
const readingErrorMessage = computed(() => readingController.readingErrorMessage.value)
const currentQuestion = computed(() => tarotStore.currentQuestion)

/**
 * Drawer geometry used by the narrow-screen reading view. Falls back to
 * a zero-sized geometry while the layout solver can't run (e.g. very
 * early in the lifecycle before a window-info call succeeds). 2.2 wires
 * this into the live solver pipeline.
 */
const resultDrawerGeometry = computed(() => {
  try {
    const winInfo = uni.getWindowInfo()
    const rawViewport = readViewport({
      windowWidth: winInfo.windowWidth,
      windowHeight: winInfo.windowHeight,
      safeAreaInsets: winInfo.safeAreaInsets,
    })
    const viewport = { ...rawViewport, width: pickCanvasWidth(rawViewport.width) }
    const layout = solveLayout({
      viewport,
      sizes: deriveSizes(viewport.width),
      scene: 'reading_stage',
    })
    return layout.drawer
  } catch {
    return {
      initialTop: 0,
      initialHeight: 0,
      maxHeight: 0,
      width: 0,
      rightAligned: false,
    }
  }
})

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
  if (
    readingController.readingPanelState.value === 'success' &&
    readingController.readingResult.value
  ) {
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

const isDevExpanded = ref(true)
const showContainerBorders = ref(false)

function handleDevReplay(targetPhase: OverlayPhase): void {
  // Reading is normally seeded by the animation pipeline's `onDrawingStart`
  // hook (line 214). Replays that resume *at or before* drawing still cross
  // that hook on their way through. But replays that jump straight to
  // `revealing` skip the drawing builder entirely, so the hook never fires
  // and the panel opens with no reading in flight (empty body). Mirror the
  // skipToReading flow: fire the request synchronously before delegating to
  // the animation controller. Any in-flight reading is reset first to avoid
  // resolving against the previous run.
  if (targetPhase === 'revealing') {
    readingController.resetReading()
    currentReadingPromise = readingController.startReading({})
  }
  animationController.replayFromPhase(targetPhase)
}

function handleDevSkipToReading(): void {
  animationController.skipToReading()
}

function handleDevPlaybackRate(rate: number): void {
  animationController.setPlaybackRate(rate)
}

function toggleContainerBorders(): void {
  showContainerBorders.value = !showContainerBorders.value
  // #ifdef H5
  toggleContainerBordersH5(showContainerBorders.value)
  // #endif
}

/* ── Lifecycle ─────────────────────────────────────────────────────── */

onMounted(() => {
  recomputeIsWide()
  uni.onWindowResize(recomputeIsWide)
})

onUnmounted(() => {
  uni.offWindowResize(recomputeIsWide)
})
</script>

<style scoped>
.main-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-page);
}

/* PRD §8.2.1 — canvas wrapper. Width is capped at MAX_CANVAS_WIDTH
   (440 px); on a wider viewport the canvas is horizontally centered
   via translateX(max(0, (100vw - 440)/2)), so the surrounding background
   is exposed on both sides. When reading mode opens on a wide viewport
   (.is-reading-wide), the canvas slides flush-left and the
   ReadingSplitView takes the remaining space on the right. The
   max() clamp keeps the calc at 0 on viewports ≤ 440 so the canvas
   sits naturally at the left edge there. */
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

/* PRD §8.1.2 — idle ↔ divination view swap, ~450ms.
   Keep duration in sync with DUR_IDLE_TO_DIV_MS in animation/easings.ts.
   Both views are absolute so they overlap cleanly during the transition.
   The position: absolute fills the .canvas wrapper (which is itself
   absolutely positioned, acting as the positioning ancestor). */
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
