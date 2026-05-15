<template>
  <!--
    ReadingSplitView — phase-2.2.b wired (wide-screen branch).
    Composition per PRD §7.2 #3: ReadingPanel + ActionArea, occupying the
    right half of the viewport, overlaid on the divination view's left
    half. The wide / narrow choice is owned by the main page.
  -->
  <view
    class="reading-split-view"
    role="dialog"
    aria-modal="false"
    aria-label="占卜结果分栏"
  >
    <ReadingPanel
      :panel-state="panelState"
      :reading-result="readingResult"
      :question="question"
      :error-message="errorMessage"
      @typewriter-complete="$emit('typewriterComplete')"
      @retry="$emit('retry')"
    />
    <ActionArea
      :phase="phase"
      :is-reading-failed="panelState === 'error'"
      @restart="$emit('restart')"
      @back-home="$emit('backHome')"
      @retry="$emit('retry')"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * Name: ReadingSplitView
 * Purpose: wide-screen reading view (PRD §2.3 #3). Renders the reading
 *          panel + action area in a right-half-screen pane, overlaid on
 *          the divination view's left half.
 * Reason: splitting wide/narrow reading templates into two sibling views
 *         matches the PRD's explicit "two viewports" model and lets each
 *         branch own its own transition rig.
 * Data flow: parent passes `panelState`, `readingResult`, `phase`,
 *           `question`, and an optional `errorMessage`. Emits map directly
 *           onto store transitions in 2.2.
 */
import ReadingPanel from '../components/containers/ReadingPanel.vue'
import ActionArea from '../components/containers/ActionArea.vue'
import type { ReadingResult } from '../core/api/types'
import type { ReadingStatus } from '../core/utils/reading/reading_orchestrator'
import type { DivinationPhase } from '../stores/flow'

defineProps<{
  panelState: ReadingStatus
  readingResult: ReadingResult | null
  phase: DivinationPhase
  question?: string
  errorMessage?: string
}>()

defineEmits<{
  (event: 'restart'): void
  (event: 'backHome'): void
  (event: 'retry'): void
  (event: 'typewriterComplete'): void
}>()
</script>

<style scoped>
.reading-split-view {
  position: absolute;
  top: 0;
  /* The divination canvas is anchored flush-left at MAX_CANVAS_WIDTH
     (440 px) in wide+reading mode (see pages/main/index.vue .canvas).
     The split view fills everything to the right of that. Width is
     therefore implicit (= viewport.width - 440) — no explicit width
     so the layout adapts to any wide viewport. */
  left: 440px;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-page);
  border-left: 1px solid var(--color-border);
  box-sizing: border-box;
  z-index: 1500;
  overflow: hidden;
  container: result-drawer / inline-size;
  /* PRD §8.2.1: slide in from right on mount.
     450ms = DUR_DIV_TO_READING_WIDE_MS in animation/easings.ts.
     translateX(100%) is relative to this element's own width
     (viewport.width - 440), so the slide-in still appears to come from
     off-screen right regardless of the actual width. */
  animation: split-view-enter 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes split-view-enter {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* The reading panel must stretch to fill the available column height so
   long-form readings scroll inside it instead of pushing the action
   area off-screen on short PC viewports (≤ 600 px tall). Without `flex:
   1` + `min-height: 0` the panel sized to its content and the action
   area landed below the viewport edge — the buttons "回到首页" / "再占
   一次" then got clipped by `.reading-split-view`'s `overflow: hidden`. */
.reading-split-view :deep(.reading-panel) {
  flex: 1;
  min-height: 0;
}

.reading-split-view :deep(.reading-panel__success),
.reading-split-view :deep(.reading-panel__loading),
.reading-split-view :deep(.reading-panel__error) {
  padding: 0 var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* PC / wide branch nudge: bump the action area's padding-bottom by 10 px
   so the buttons sit a hairline above the viewport edge on desktop —
   the safe-area inset is 0 on PC so without the extra buffer the row's
   bottom edge could land flush against the screen. The narrow drawer's
   action area already has the drawer sheet stack above it acting as
   natural breathing room and doesn't need the same nudge. */
.reading-split-view :deep(.action-area) {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24rpx + 10px);
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .reading-split-view {
    animation: none;
  }
}
</style>
