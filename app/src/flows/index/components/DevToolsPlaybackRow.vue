<template>
  <!--
    Skip + playback-rate chips. The skip chip jumps directly to the
    reading phase; the rate chips set the global playback rate (active
    state shows the currently-applied multiplier).
  -->
  <view class="dev-tools-row">
    <view
      class="dev-tools-chip"
      role="button"
      tabindex="0"
      aria-label="跳到解读"
      @click="$emit('skip-to-reading')"
      @keydown.enter="$emit('skip-to-reading')"
      @keydown.space.prevent="$emit('skip-to-reading')"
    >
      直接解读
    </view>
    <view
      v-for="speed in playbackRates"
      :key="`speed-${speed}`"
      class="dev-tools-chip"
      :class="{ active: playbackRate === speed }"
      role="button"
      tabindex="0"
      :aria-label="`播放速度 ${speed}x`"
      @click="$emit('playback-rate', speed)"
      @keydown.enter="$emit('playback-rate', speed)"
      @keydown.space.prevent="$emit('playback-rate', speed)"
    >
      {{ speed }}x
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: DevToolsPlaybackRow
 * Purpose: render the skip-to-reading + playback-rate chips inside
 *          DevToolsPanel.
 * Reason: extracted from DevToolsPanel.vue (P3 nit fix — file was 382
 *          lines, capped at 300). The list of supported rates lives here
 *          since it is private to this row's UI affordance — adding a new
 *          rate is a one-file change.
 * Data flow: parent owns the current `playbackRate`; this row emits
 *          `playback-rate` and `skip-to-reading`.
 */
defineProps<{
  playbackRate: number
}>()

defineEmits<{
  (e: 'skip-to-reading'): void
  (e: 'playback-rate', rate: number): void
}>()

// Locally-owned: which rates the panel offers as one-tap presets.
// Keep aligned with the parent's outbound emit signature (number).
const playbackRates = [0.25, 0.5, 1, 2] as const
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
</style>
