<template>
  <!--
    Main page route root (docs/prd/glossary.md（路由 #1）). Composes the
    divination surface — HeaderArea (TitleContent ↔ ProgressContent by
    phase) + Stage (CardsLoadError | Deck) — with ReadingSplit/Drawer
    overlaid in 'reading'/'decision'. NotificationHost sits on the route
    root for cross-view alerts. The .canvas wrapper caps the divination
    canvas at MAX_CANVAS_WIDTH (docs/prd/animation.md（视图过渡动画）) and
    slides it flush-left when reading opens on a wide viewport. The single
    Deck instance stays mounted across idle ↔ divination, so the swap is a
    header-content change only.
  -->
  <view
    class="main-page"
    :class="{ 'is-reading-wide': isWide && showReadingView }"
    :style="cssVarStyle"
  >
    <view class="canvas">
      <!--
        Header presentation comes from useHeaderPresentation. The idle
        card-load error band is its own component, gated by v-if/v-else
        against Deck so Deck is not mounted while erroring at idle.
      -->
      <view class="play-view" :class="{ 'play-view--error': isIdle && cardsLoadError }">
        <HeaderArea
          :role="headerRole"
          :aria-valuetext="headerAriaValuetext"
          :style="headerStyle"
        >
          <TitleContent v-if="isIdle" variant="idle" />
          <ProgressContent v-else />
        </HeaderArea>
        <Stage :scene="isIdle ? 'idle' : 'divination'">
          <CardsLoadError v-if="isIdle && cardsLoadError" />
          <Deck v-else />
        </Stage>
      </view>
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
 * Purpose: route root for the main divination flow. Instantiates the
 *          orchestration graph via useMainStage, provides phase / isWide /
 *          the two controllers to descendant components, derives header
 *          presentation + the idle card-load error, and composes the
 *          divination surface (HeaderArea + Stage(Deck)) with the reading
 *          split/drawer overlay, notifications and dev tools.
 */
import { provide } from 'vue'
import HeaderArea from '../../components/HeaderArea.vue'
import TitleContent from '../../components/TitleContent.vue'
import ProgressContent from '../../components/ProgressContent.vue'
import Stage from '../../components/Stage.vue'
import Deck from '../../components/Deck.vue'
import CardsLoadError from '../../components/CardsLoadError.vue'
import ReadingSplitView from '../../components/ReadingSplitView.vue'
import ReadingDrawerView from '../../components/ReadingDrawerView.vue'
import NotificationHost from '../../components/NotificationHost.vue'
import DevToolsPanel from '../../components/DevToolsPanel.vue'
import { useMainStage } from '../../composables/flows/index/use_main_stage'
import { useHeaderPresentation } from '../../composables/flows/index/use_header_presentation'
import { useCardsLoadError } from '../../core/composables/use_cards_load_error'

const {
  phase, isWide, cssVarStyle, animationController, readingController, devTools,
  showReadingView, resultDrawerGeometry, readingPanelState, readingResult,
  readingErrorMessage, currentQuestion, handleRestart, handleBackHome,
  handleRetry, handleTypewriterComplete,
} = useMainStage()

provide('appPhase', phase)
provide('isWide', isWide)
provide('animationController', animationController)
provide('readingController', readingController)

const { isIdle, headerRole, headerAriaValuetext, headerStyle } =
  useHeaderPresentation(phase, animationController)
const { cardsLoadError } = useCardsLoadError()
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

/* Divination surface root: flex column with uniform safe-area + margin
   padding. `--margin` is set on the main-page root via the scale bridge,
   so the same value scales across iPhone 8 → 17 Pro Max. */
.play-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  min-height: 0;
  padding-top: calc(env(safe-area-inset-top, 0px) + var(--margin));
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--margin));
  padding-left: var(--margin);
  padding-right: var(--margin);
  box-sizing: border-box;
}

@media (prefers-reduced-motion: reduce) {
  .canvas {
    transition: none;
  }
}
</style>
