<template>
  <!--
    ActionArea — phase-2.2.b implementation.
    Per PRD §2.4 #8 and §10.3 #3 the action area only renders during the
    `decision` phase or when the reading request failed. Real buttons
    migrated from ActionBar.vue with 350ms fade-in animation.
  -->
  <view
    v-if="visible"
    class="action-area"
    role="toolbar"
    aria-label="占卜操作"
  >
    <template v-if="phase === 'decision'">
      <view
        class="btn btn-secondary"
        role="button"
        tabindex="0"
        aria-label="回到首页"
        @click="$emit('backHome')"
        @keydown.enter="$emit('backHome')"
        @keydown.space.prevent="$emit('backHome')"
      >回到首页</view>
      <view
        class="btn btn-primary"
        role="button"
        tabindex="0"
        aria-label="再占一次"
        @click="$emit('restart')"
        @keydown.enter="$emit('restart')"
        @keydown.space.prevent="$emit('restart')"
      >再占一次</view>
    </template>

    <template v-else-if="isReadingFailed">
      <view
        class="btn btn-primary"
        role="button"
        tabindex="0"
        aria-label="重试读取"
        @click="$emit('retry')"
        @keydown.enter="$emit('retry')"
        @keydown.space.prevent="$emit('retry')"
      >重试读取</view>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: ActionArea container
 * Purpose: hosts the restart / back-home / retry buttons; only mounted in
 *          the `decision` phase or while the reading request is in error
 *          state (per PRD §2.6.3). Migrated from ActionBar.vue.
 * Reason: keeping the visibility rule colocated with the container removes
 *         one source of phase coupling from views and makes the rule
 *         auditable in a single file.
 * Data flow: parent view passes the current `DivinationPhase` and reading
 *           state; this container emits semantic actions that the page
 *           translates into store transitions.
 */
import { computed } from 'vue'
import type { DivinationPhase } from '../../store/flow'

const props = defineProps<{
  phase: DivinationPhase
  isReadingFailed?: boolean
}>()

defineEmits<{
  (event: 'restart'): void
  (event: 'backHome'): void
  (event: 'retry'): void
}>()

/**
 * Visibility rule (PRD §2.4 #8): show only during `decision`, OR when the
 * reading itself failed (the retry affordance must be reachable mid-reading
 * if the request errored). All other phases hide the area entirely.
 */
const visible = computed(() =>
  props.phase === 'decision' || props.isReadingFailed === true,
)
</script>

<style scoped>
.action-area {
  display: flex;
  gap: 24rpx;
  align-items: center;
  justify-content: center;
  padding: 24rpx 24rpx calc(env(safe-area-inset-bottom, 0px) + 24rpx);
  /* 350ms fade-in per PRD §10.3 #3 */
  animation: action-fade-in 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes action-fade-in {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-area {
    animation: none !important;
  }
}
</style>
