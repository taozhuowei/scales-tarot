<template>
  <!--
    Stage — phase-2.1 placeholder.
    A position-only slot container; per docs/prd/glossary.md（容器 #3） the stage exists purely
    to host an animation. It does not own animation state — the parent view
    or the animation controller drives whatever is rendered through the
    default slot. The `scene` prop only annotates the DOM with a CSS class
    so per-scene styling hooks stay simple.
  -->
  <view
    class="stage"
    :class="`stage--${scene}`"
    role="presentation"
  >
    <slot>
      <text class="stage__placeholder">Stage / scene: {{ scene }}</text>
    </slot>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: Stage container
 * Purpose: pure slot wrapper for the three stage scenes (idle / divination
 *          / fallback) per docs/prd/glossary.md（容器 #3） and docs/prd/view.md（5 个视图与所属容器）.
 * Reason: idle, divination, and fallback views all need a centred animation
 *         box. Centralising the geometry here keeps the per-view templates
 *         minimal. Animation logic is *not* hosted here — it lives in the
 *         existing controllers and is wired into the slot content.
 * Data flow: parent view passes `scene`; child content (a stage-content
 *           component) is provided via the default slot.
 */
type StageScene = 'idle' | 'divination' | 'fallback'

withDefaults(
  defineProps<{
    scene?: StageScene
  }>(),
  { scene: 'idle' },
)
</script>

<style scoped>
.stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
  pointer-events: none;
}

.stage > :slotted(*) {
  pointer-events: auto;
}

.stage__placeholder {
  font-size: 22rpx;
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
  pointer-events: auto;
}
</style>
