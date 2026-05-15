<template>
  <!--
    Pause / resume / step controls + status label. Step controls are
    only enabled while the timeline is paused (single-stepping a running
    timeline does not match GSAP semantics).

    Container-borders toggle lives in its own visual row so the dev can
    flip it without scanning past the playback chips.
  -->
  <view class="dev-tools-row">
    <view
      class="dev-tools-chip"
      role="button"
      tabindex="0"
      aria-label="暂停"
      @click="$emit('pause')"
      @keydown.enter="$emit('pause')"
      @keydown.space.prevent="$emit('pause')"
    >
      暂停
    </view>
    <view
      class="dev-tools-chip"
      role="button"
      tabindex="0"
      aria-label="继续"
      @click="$emit('resume')"
      @keydown.enter="$emit('resume')"
      @keydown.space.prevent="$emit('resume')"
    >
      继续
    </view>
    <view
      class="dev-tools-chip"
      :class="{ disabled: !isPaused }"
      role="button"
      tabindex="0"
      aria-label="后退一步"
      @click="onStepBackward"
      @keydown.enter="onStepBackward"
      @keydown.space.prevent="onStepBackward"
    >
      ←
    </view>
    <view
      class="dev-tools-chip"
      :class="{ disabled: !isPaused }"
      role="button"
      tabindex="0"
      aria-label="前进一步"
      @click="onStepForward"
      @keydown.enter="onStepForward"
      @keydown.space.prevent="onStepForward"
    >
      →
    </view>
    <text class="dev-tools-status">
      {{ isPaused ? 'Paused' : `Running ${playbackRate}x` }}
    </text>
  </view>

  <view class="dev-tools-row">
    <view
      class="dev-tools-chip"
      :class="{ active: showContainerBorders }"
      role="button"
      tabindex="0"
      aria-label="显示容器边框"
      @click="$emit('toggle-container-borders')"
      @keydown.enter="$emit('toggle-container-borders')"
      @keydown.space.prevent="$emit('toggle-container-borders')"
    >
      容器边框
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: DevToolsControlRow
 * Purpose: render pause/resume/step controls + status label and the
 *          container-borders toggle inside DevToolsPanel.
 * Reason: extracted from DevToolsPanel.vue (P3 nit fix — file was 382
 *          lines, capped at 300). Controlling step gating (`isPaused`)
 *          lives here so the parent does not have to inline the
 *          `isPaused && emit(...)` ceremony for each step button.
 * Data flow: parent passes `isPaused`, `playbackRate`, and
 *          `showContainerBorders`; this row emits `pause`, `resume`,
 *          `step-forward`, `step-backward`, and `toggle-container-borders`.
 */
const props = defineProps<{
  isPaused: boolean
  playbackRate: number
  showContainerBorders: boolean
}>()

const emit = defineEmits<{
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'step-forward'): void
  (e: 'step-backward'): void
  (e: 'toggle-container-borders'): void
}>()

// Stepping requires a paused timeline; gating here keeps the chip
// inert (and the visual `.disabled` cue accurate) instead of pushing
// the guard into the parent.
function onStepBackward() {
  if (props.isPaused) emit('step-backward')
}
function onStepForward() {
  if (props.isPaused) emit('step-forward')
}
</script>

<style scoped>
.dev-tools-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  align-items: center;
}

.dev-tools-chip {
  min-width: 68rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: var(--color-overlay-bg-fade);
  border: 1rpx solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 22rpx;
  line-height: 1.2;
  text-align: center;
}

.dev-tools-chip.active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: rgba(184, 148, 62, 0.1);
}

.dev-tools-chip.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.dev-tools-status {
  font-size: 20rpx;
  color: var(--color-text-tertiary);
  margin-left: auto;
}
</style>
