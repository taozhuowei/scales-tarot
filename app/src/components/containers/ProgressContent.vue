<template>
  <!--
    ProgressContent — header slot payload for the divination view.
    Renders the 4-phase progress icon row driven by animationController's
    progressHeaderPresentation computed ref.

    Layout responsibility split (task 8.3.1):
      - Outer geometry (margin-top, height, safe-area, z-index) lives on
        HeaderArea. The parent view also applies the GSAP slide-in
        animation via `:style="animCtrl.headerStyle.value"` on the
        HeaderArea element so the entire header band animates together.
      - This component renders ONLY the icon bar.
  -->
  <view class="progress-content__bar">
    <view
      v-for="item in animCtrl.progressHeaderPresentation.value.items"
      :key="item.phase"
      class="progress-content__step"
    >
      <image
        class="progress-content__step-icon"
        :class="{ 'progress-content__step-icon--compensated': item.isCompensated }"
        :src="item.iconSrc"
        mode="aspectFit"
        :alt="`${item.label} 阶段`"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: ProgressContent component
 * Purpose: render the divination view's 4-phase progress icon row inside
 *          the shared HeaderArea shell.
 * Reason: split out from the legacy ProgressArea (task 8.3.1) so the
 *         outer shell can be unified with TitleContent. This component
 *         holds no outer-box geometry — only the icon bar layout.
 * Data flow: animationController (injected from main page) →
 *            progressHeaderPresentation → icon list. The slide-in
 *            entrance animation (animCtrl.headerStyle) is applied by the
 *            parent view to the HeaderArea wrapper, not here.
 */
import { inject } from 'vue'
import type { UseAnimationControllerReturn } from '../../composables/use_animation_controller'

const animCtrl = inject<UseAnimationControllerReturn>('animationController')!
</script>

<style scoped>
.progress-content__bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--gap);

  /* Anchor the icon row's top at the same y as TitleContent's first
     text line. Both content types deliberately use the same offset
     (`(var(--header-height) - 44px) / 2`) so the idle ↔ divination
     header swap is baseline-aligned. The shared anchor lives on the
     content components (not HeaderArea) because each content type
     measures its own visible payload differently — HeaderArea stays
     variant-agnostic. */
  margin-top: calc((var(--header-height) - 44px) / 2);
}

.progress-content__step {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 2px;
}

.progress-content__step-icon {
  width: 40px;
  height: 40px;
  transition: opacity 0.2s ease;
}

.progress-content__step-icon--compensated {
  width: 44px;
  height: 44px;
}
</style>
