<template>
  <!--
    FallbackView — phase-2.1 skeleton.
    Composition per PRD §7.2 #5: HeaderArea(TitleContent variant='fallback')
    + Stage(FallbackOrbits). The PRD-mandated copy "宇宙信号微弱，暂无法接通"
    (§7.3 #1 / §10.3 #4) is owned by TitleContent's copy table; this
    view's job is just to wire the variant. The header is wrapped in the
    shared HeaderArea (task 8.3.1) so the fallback title sits at the same
    y as idle / divination headers.
  -->
  <view class="fallback-view" role="region" aria-label="兜底视图">
    <HeaderArea role="banner">
      <TitleContent variant="fallback" />
    </HeaderArea>
    <Stage scene="fallback">
      <FallbackOrbits />
    </Stage>
    <text v-if="errorMessage" class="fallback-view__error">{{ errorMessage }}</text>
    <text class="fallback-view__placeholder">FallbackView (placeholder)</text>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: FallbackView
 * Purpose: the only view inside the fallback route (PRD §2.3 #5). Conveys
 *          the "no signal" state through the title slot's mystery copy +
 *          the orbiting stage animation.
 * Reason: keeping the fallback view minimal — title + stage — matches PRD
 *         §10.3 #4: no toasts, no notifications, the title line is the
 *         entire user-facing message.
 * Data flow: optional `errorMessage` is for diagnostic visibility only;
 *           it never replaces the canonical PRD-mandated title copy.
 */
import HeaderArea from '../shared/components/containers/HeaderArea.vue'
import TitleContent from '../shared/components/containers/TitleContent.vue'
import Stage from '../shared/components/containers/Stage.vue'
import FallbackOrbits from '../shared/components/stage-content/FallbackOrbits.vue'

defineProps<{
  errorMessage?: string
}>()
</script>

<style scoped>
.fallback-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.fallback-view__error {
  font-size: 22rpx;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 16rpx;
  word-break: break-word;
}

.fallback-view__placeholder {
  font-size: 22rpx;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 16rpx 0;
}
</style>
