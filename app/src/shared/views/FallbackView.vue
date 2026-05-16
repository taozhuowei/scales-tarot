<template>
  <!--
    FallbackView — phase-2.1 skeleton.
    Composition per docs/prd/view.md（5 个视图与所属容器 #5）: HeaderArea(TitleContent variant='fallback')
    + Stage(FallbackOrbits). The PRD-mandated copy "宇宙信号微弱，暂无法接通"
    (docs/prd/view.md（容器与内容对应 #1）/ docs/prd/animation.md（动效规范 #4）) is owned by TitleContent's copy table; this
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
 * Purpose: the only view inside the fallback route (docs/prd/glossary.md（视图 #5）). Conveys
 *          the "no signal" state through the title slot's mystery copy +
 *          the orbiting stage animation.
 * Reason: keeping the fallback view minimal — title + stage — matches
 *         docs/prd/animation.md（动效规范 #4）: no toasts, no notifications, the title line is the
 *         entire user-facing message.
 * Data flow: optional `errorMessage` is for diagnostic visibility only;
 *           it never replaces the canonical PRD-mandated title copy.
 */
import HeaderArea from '../../components/HeaderArea.vue'
import TitleContent from '../../components/TitleContent.vue'
import Stage from '../../components/Stage.vue'
import FallbackOrbits from '../../components/FallbackOrbits.vue'

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
