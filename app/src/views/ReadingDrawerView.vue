<template>
  <!--
    ReadingDrawerView — phase-2.2.b wired (narrow-screen branch).
    Composition per PRD §2.3 #4 / §7.2 #4: ReadingPanel + ActionArea inside
    a bottom drawer whose geometry is supplied by the layout solver.
  -->
  <view
    class="reading-drawer-view"
    role="dialog"
    aria-modal="false"
    aria-label="占卜结果抽屉"
  >
    <view
      class="reading-drawer-view__sheet"
      :class="{ 'is-dragging': isDragging }"
      :style="sheetStyle"
      @touchstart.stop="onDrawerTouchStart"
      @touchmove.stop.prevent="onDrawerTouchMove"
      @touchend.stop="onDrawerTouchEnd"
    >
      <!-- Drag handle: role="slider" requires min/max/now per WCAG 4.1.2 -->
      <view
        class="drag-handle-zone"
        tabindex="0"
        role="slider"
        aria-label="调整结果面板高度"
        :aria-valuemin="MIN_DRAWER_HEIGHT_PX"
        :aria-valuemax="maxHeight"
        :aria-valuenow="drawerHeightPx"
        :aria-valuetext="`${drawerHeightPx}px`"
        @keydown="onDrawerKeydown"
      >
        <view class="drag-handle-bar"></view>
      </view>

      <view class="drawer-content">
        <ReadingPanel
          :panel-state="panelState"
          :reading-result="readingResult"
          :question="question"
          :error-message="errorMessage"
          @typewriter-complete="$emit('typewriterComplete')"
          @retry="$emit('retry')"
        />
      </view>
    </view>

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
 * Name: ReadingDrawerView
 * Purpose: narrow-screen reading view (PRD §2.3 #4). Renders the reading
 *          panel inside a draggable bottom drawer plus the (always
 *          screen-bottom) action area. The drawer is bounded by the
 *          solver-supplied DrawerGeometry — this view doesn't re-derive
 *          height limits from the viewport.
 * Reason: keeping wide and narrow as two sibling views matches the PRD's
 *         "two reading viewports" model and lets the drag rig stay narrow-
 *         only.
 * Data flow: parent passes `panelState`, `readingResult`, `phase`,
 *           `drawerGeometry` (from layout solver), `question`, and
 *           `errorMessage`. The drawer emits `drag(height: number)` so the
 *           page can persist the user's chosen height across re-renders.
 */
import { ref, computed, watch, onMounted } from 'vue'
import ReadingPanel from '../shared/components/containers/ReadingPanel.vue'
import ActionArea from '../shared/components/containers/ActionArea.vue'
import type { ReadingResult } from '../core/api/types'
import type { ReadingStatus } from '../core/utils/reading/reading_orchestrator'
import type { DivinationPhase } from '../shared/store/flow'
import type { DrawerGeometry } from '../core/sizing/layout_solver'

const props = defineProps<{
  panelState: ReadingStatus
  readingResult: ReadingResult | null
  phase: DivinationPhase
  drawerGeometry: DrawerGeometry
  question?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'restart'): void
  (event: 'backHome'): void
  (event: 'retry'): void
  (event: 'typewriterComplete'): void
  (event: 'drag', height: number): void
}>()

// Safety floor for very short viewports — keeps the drag handle plus at
// least one short line of text legible.
const MIN_DRAWER_HEIGHT_PX = 120

const drawerHeightPx = ref(0)
const isAutoHeight = ref(true)
// Reactive so the template can toggle is-dragging class to suppress CSS transition.
const isDragging = ref(false)
let drawerStartY = 0
let drawerStartHeight = 0

const initialHeight = computed(() =>
  Math.max(MIN_DRAWER_HEIGHT_PX, Math.round(props.drawerGeometry.initialHeight)),
)
const maxHeight = computed(() =>
  Math.max(initialHeight.value, Math.round(props.drawerGeometry.maxHeight)),
)

// Initialise height when the view mounts (no showResults watch needed —
// the parent's showReadingView computed gates mounting).
onMounted(() => {
  isAutoHeight.value = false
  drawerHeightPx.value = initialHeight.value
})

// If the solver-computed initial height changes (e.g. orientation change
// before the user has touched the drawer), reflow.
watch(initialHeight, (newH) => {
  if (!isDragging.value && newH > 0) {
    drawerHeightPx.value = newH
  }
})

const sheetStyle = computed(() => {
  const height = isAutoHeight.value
    ? initialHeight.value
    : Math.max(MIN_DRAWER_HEIGHT_PX, Math.min(drawerHeightPx.value, maxHeight.value))
  return `height: ${height}px; max-height: ${maxHeight.value}px`
})

function onDrawerTouchStart(e: TouchEvent) {
  drawerStartY = e.touches[0].clientY
  drawerStartHeight = drawerHeightPx.value || initialHeight.value
  isDragging.value = true
  isAutoHeight.value = false
}

function onDrawerTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - drawerStartY
  let newHeight = drawerStartHeight - deltaY
  if (newHeight < MIN_DRAWER_HEIGHT_PX) newHeight = MIN_DRAWER_HEIGHT_PX
  if (newHeight > maxHeight.value) newHeight = maxHeight.value
  drawerHeightPx.value = newHeight
}

function onDrawerTouchEnd() {
  isDragging.value = false
  if (drawerHeightPx.value > maxHeight.value - 30) drawerHeightPx.value = maxHeight.value
  if (drawerHeightPx.value < MIN_DRAWER_HEIGHT_PX + 30) drawerHeightPx.value = MIN_DRAWER_HEIGHT_PX
  emit('drag', drawerHeightPx.value)
}

function onDrawerKeydown(e: KeyboardEvent) {
  const step = 40
  if (isAutoHeight.value) {
    isAutoHeight.value = false
    drawerHeightPx.value = initialHeight.value
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    drawerHeightPx.value = Math.min(maxHeight.value, drawerHeightPx.value + step)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    drawerHeightPx.value = Math.max(MIN_DRAWER_HEIGHT_PX, drawerHeightPx.value - step)
  }
}
</script>

<style scoped>
.reading-drawer-view {
  /* The drawer spans the full viewport width on tablets. Earlier we capped
     it to MAX_CANVAS_WIDTH (440 px) so it sat under the centred phone-
     shell, but on iPad portrait (768 / 820 px) that left two empty bands
     either side of the sheet. The drawer is conceptually a screen-bottom
     surface — not part of the phone-shell canvas — so it now owns the full
     viewport. The result card above it stays inside the phone-shell cap
     (`.canvas` in pages/main/index.vue handles that), so this only changes
     the sheet itself. */
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  z-index: 1500;
  pointer-events: none;
  justify-content: flex-end;
}

.reading-drawer-view__sheet {
  width: 100%;
  background: var(--color-bg-page);
  border-top-left-radius: 40rpx;
  border-top-right-radius: 40rpx;
  border: 1rpx solid var(--color-border);
  box-shadow: 0 -10rpx 40rpx rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  /* Named container so ReadingPanel text can size against drawer width */
  container: result-drawer / inline-size;
  /* Prevents browser pull-to-refresh competing with drag handlers */
  touch-action: none;
  /* PRD §8.2.2: drawer slides up from screen bottom on mount.
     350ms = DUR_DIV_TO_READING_NARROW_MS in animation/easings.ts */
  animation: drawer-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes drawer-enter {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

/* Suppress transition during pointer drag so the sheet tracks the finger
   without the 250ms lag that easing would introduce. */
.reading-drawer-view__sheet.is-dragging {
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .reading-drawer-view__sheet {
    animation: none;
  }
}

.drag-handle-zone {
  height: 64rpx;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  flex-shrink: 0;
}

.drag-handle-bar {
  width: 80rpx;
  height: 8rpx;
  background: var(--color-border-focus);
  border-radius: 4rpx;
  opacity: 0.5;
}

.drawer-content {
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
  box-sizing: border-box;
}
</style>
