<template>
  <!--
    Phase replay chips. Each chip jumps the overlay back to the entry
    state of a specific phase. Phase order is owned by the parent (it
    receives the canonical list from the registry); this row just renders.
  -->
  <view class="dev-tools-row">
    <view
      v-for="step in phaseSteps"
      :key="`replay-${step.phase}`"
      class="dev-tools-chip"
      role="button"
      tabindex="0"
      :aria-label="`重播 ${step.label}`"
      @click="$emit('replay', step.phase)"
      @keydown.enter="$emit('replay', step.phase)"
      @keydown.space.prevent="$emit('replay', step.phase)"
    >
      {{ step.label }}
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: DevToolsPhaseRow
 * Purpose: render the row of phase-replay chips inside DevToolsPanel.
 * Reason: extracted from DevToolsPanel.vue (P3 nit fix — file was 382
 *          lines, capped at 300). Each row is now its own SFC so the
 *          parent template stays under cap and individual rows can evolve
 *          independently (a new phase added to the registry only touches
 *          this file).
 * Data flow: parent passes the manifest; this component emits `replay`
 *          with the chosen phase, which the parent forwards to the
 *          overlay controller.
 */
import type { OverlayPhase } from '../../../core/flow/types'

defineProps<{
  phaseSteps: { phase: OverlayPhase; label: string }[]
}>()

defineEmits<{
  (e: 'replay', phase: OverlayPhase): void
}>()
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
</style>
