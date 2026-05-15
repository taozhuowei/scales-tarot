<template>
  <view
    v-if="isDev"
    class="dev-tools"
    :class="{ 'dev-tools--collapsed': !isDevExpanded, 'dev-tools--dragging': isDragging }"
    :style="containerStyle"
  >
    <!-- Drag handle / collapsed-state toggle. The same surface acts as
         both a drag handle and an expand/collapse button: pressing then
         moving is a drag (controller swallows the trailing click);
         pressing then releasing in place toggles the panel. -->
    <view
      class="dev-tools-handle"
      role="button"
      tabindex="0"
      :aria-label="isDevExpanded ? '收起开发工具' : '展开开发工具'"
      :aria-expanded="isDevExpanded"
      @mousedown="onMouseDown"
      @touchstart.passive="onTouchStart"
      @click="onHandleClick"
      @keydown.enter="$emit('toggle-dev-expanded')"
      @keydown.space.prevent="$emit('toggle-dev-expanded')"
    >
      <DevToolsCollapsedHandle v-if="!isDevExpanded" />
      <template v-else>
        <text class="dev-tools-title">Dev Tools</text>
        <text class="dev-tools-toggle" aria-hidden="true">▲</text>
      </template>
    </view>

    <view v-show="isDevExpanded" class="dev-tools-body">
      <DevToolsPhaseRow :phase-steps="phaseSteps" @replay="(p) => $emit('replay', p)" />
      <DevToolsPlaybackRow
        :playback-rate="playbackRate"
        @skip-to-reading="$emit('skip-to-reading')"
        @playback-rate="(r) => $emit('playback-rate', r)"
      />
      <DevToolsControlRow
        :is-paused="isPaused"
        :playback-rate="playbackRate"
        :show-container-borders="showContainerBorders"
        @pause="$emit('pause')"
        @resume="$emit('resume')"
        @step-forward="$emit('step-forward')"
        @step-backward="$emit('step-backward')"
        @toggle-container-borders="$emit('toggle-container-borders')"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: DevToolsPanel
 * Purpose: dev-only floating panel for phase replay, playback control, and
 *          safe-frame overlay toggle. Hosts the draggable shell + folded /
 *          expanded states; delegates the actual control rows to row-level
 *          sub-components.
 * Reason: extracted from DivinationOverlay to reduce component complexity.
 *   Per requirement N1 the collapsed state is a 40 px circular handle the
 *   developer can drag to any corner of the screen — handy when the panel
 *   obscures whatever they're currently inspecting. Position is intentionally
 *   NOT persisted: refresh resets to the bottom-right default so a stuck
 *   off-screen panel always recovers naturally.
 *   P3 nit fix: the four template rows (phase replay, playback chips,
 *   control chips, container-borders toggle) were extracted into row-level
 *   sub-components so this shell stays under the 300-line file cap. The
 *   public props/emits are unchanged so callers (DivinationOverlay) need
 *   no changes.
 * Data flow: receives state via props, sends user actions via emits for the
 *   parent to forward to the overlay controller. Drag gestures are owned by
 *   `utils/dev/draggable_panel.ts` (H5-only), keeping browser globals out of
 *   this component. Each row sub-component receives only the slice of state
 *   it needs and re-emits its row-local events; this shell forwards them up
 *   one-to-one.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { OverlayPhase } from '../../core/flow/types'
import {
  createDraggablePanel,
  type Position,
} from '../../core/utils/dev/draggable_panel'
import DevToolsCollapsedHandle from './DevToolsCollapsedHandle.vue'
import DevToolsPhaseRow from './DevToolsPhaseRow.vue'
import DevToolsPlaybackRow from './DevToolsPlaybackRow.vue'
import DevToolsControlRow from './DevToolsControlRow.vue'

const isDev = import.meta.env.DEV

defineProps<{
  phaseSteps: { phase: OverlayPhase; label: string }[]
  playbackRate: number
  isPaused: boolean
  isDevExpanded: boolean
  showContainerBorders: boolean
}>()

const emit = defineEmits<{
  (e: 'replay', phase: OverlayPhase): void
  (e: 'skip-to-reading'): void
  (e: 'playback-rate', rate: number): void
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'step-forward'): void
  (e: 'step-backward'): void
  (e: 'toggle-dev-expanded'): void
  (e: 'toggle-container-borders'): void
}>()

// ---- Drag state ----------------------------------------------------------

/**
 * Anchor point in viewport pixels (top-left of the panel). Starts null
 * until first mount; resolved to the default bottom-right corner using
 * actual viewport metrics inside the H5-only controller.
 */
const position = ref<Position | null>(null)
const isDragging = ref(false)

/** When true, the next click is the synthetic tail of a drag and must
 *  be swallowed so the gesture doesn't toggle the panel. */
let suppressNextClick = false

/**
 * Convert the stored top-left anchor into CSS positioning. When the
 * collapsed handle sits in the right or bottom half of the viewport,
 * pin the panel by its right / bottom edge so expansion grows back
 * toward the centre instead of overflowing the viewport. The default
 * mount position lands at bottom-right, so the expanded body opens
 * up-and-left and stays inside the screen even on phone-shell widths.
 *
 * The viewport is sourced via `uni.getWindowInfo()` so this works on H5
 * and mp-weixin alike — the same call the rest of the codebase uses for
 * window metrics. We re-read on every recompute (cheap, ~µs) so a
 * resize doesn't strand the panel against the wrong edge.
 */
const containerStyle = computed(() => {
  if (!position.value) return ''
  const { x, y } = position.value
  const win = uni.getWindowInfo()
  const w = win.windowWidth ?? 0
  const h = win.windowHeight ?? 0
  const HANDLE_PX = 40
  const horizontal = w > 0 && x + HANDLE_PX / 2 > w / 2
    ? `right: ${Math.max(0, w - x - HANDLE_PX)}px`
    : `left: ${x}px`
  const vertical = h > 0 && y + HANDLE_PX / 2 > h / 2
    ? `bottom: ${Math.max(0, h - y - HANDLE_PX)}px`
    : `top: ${y}px`
  return `${horizontal}; ${vertical};`
})

const dragger = createDraggablePanel({
  setPosition(next) {
    position.value = next
  },
  getPosition() {
    return position.value ?? { x: 0, y: 0 }
  },
  onDragStart() {
    isDragging.value = true
  },
  onDragEnd({ wasDrag }) {
    isDragging.value = false
    if (wasDrag) suppressNextClick = true
  },
})

function onMouseDown(e: MouseEvent) {
  // First press also resolves the initial position so the controller has
  // a real anchor to mutate from (mount may run before any layout
  // measurement is meaningful).
  if (!position.value) position.value = dragger.defaultPosition()
  dragger.startMouseDrag(e)
}

function onTouchStart(e: TouchEvent) {
  if (!position.value) position.value = dragger.defaultPosition()
  dragger.startTouchDrag(e)
}

function onHandleClick() {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  emit('toggle-dev-expanded')
}

onMounted(() => {
  // Resolve initial position once the H5 controller can read window metrics.
  position.value = dragger.defaultPosition()
})

onBeforeUnmount(() => {
  dragger.dispose()
})
</script>

<style scoped>
.dev-tools {
  position: fixed;
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  border-radius: 20rpx;
  background: rgba(247, 240, 224, 1);
  border: 1rpx solid var(--color-border-strong);
  box-shadow: 0 12rpx 36rpx rgba(30, 15, 6, 0.16);
  /* `touch-action: none` lets us own all pointer gestures and prevents the
     browser from stealing the drag for native scrolling. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* Expanded state: the historical 420rpx panel. */
.dev-tools:not(.dev-tools--collapsed) {
  width: 420rpx;
  max-width: calc(100vw - 48rpx);
  padding: 18rpx;
}

/* Collapsed state: 40 px circular handle. Width/height in physical px so
   the hit-target stays at the 40 px touch minimum across DPR — rpx would
   shrink the handle on narrow phones below the recommended floor. */
.dev-tools--collapsed {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}

.dev-tools--dragging {
  cursor: grabbing;
  /* Slight shadow lift to telegraph the active drag. */
  box-shadow: 0 16rpx 48rpx rgba(30, 15, 6, 0.32);
}

.dev-tools-handle {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  cursor: inherit;
}

.dev-tools--collapsed .dev-tools-handle {
  justify-content: center;
}

.dev-tools-title {
  font-size: 22rpx;
  letter-spacing: 0.16em;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.dev-tools-toggle {
  font-size: 18rpx;
  color: var(--color-text-secondary);
  line-height: 1;
}

.dev-tools-body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 12rpx;
}
</style>
