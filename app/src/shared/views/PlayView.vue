<template>
  <!--
    PlayView — task 8.2.3 unified view replacing the legacy
    IdleView ↔ DivinationView v-if/v-else pair. Stays mounted across
    every divination phase ('idle', 'divination', 'reading', 'decision')
    so the underlying Deck never unmounts. Removing the v-if split
    removes the need for the scale-1→1.5 push-fade exit tween that
    previously masked the unmount/mount visual gap.

    Header behaviour:
      - In 'idle' phase the slot renders TitleContent (docs/prd/view.md（容器与内容对应 #1）
        copy). HeaderArea has no inline transform — the title runs its
        own GSAP staggered entrance internally.
      - In every non-idle phase the slot renders ProgressContent (the
        4-step progress icons). animCtrl.headerStyle is bound only in
        non-idle so the slide-in entrance fires once per divination.
        Binding it in idle would force the header off-screen between
        the two render passes — unwanted because the title slot
        animates its own entrance.

    Stage:
      - Always-mounted Deck (single instance) covers idle + divination.
        The Deck internally swaps between fan-loop (idle) and the full
        shuffle/cut/draw/reveal rig (non-idle) based on the injected
        appPhase, with no DOM remount.

    Cards-load error:
      - Idle-only error band shown above the deck when card resources
        fail to load. The retry button calls back to the parent so the
        store can drive the reload (mirrors legacy IdleView behaviour).
  -->
  <view class="play-view" :class="{ 'play-view--error': isIdle && cardsLoadError }">
    <HeaderArea
      :role="isIdle ? 'banner' : 'progressbar'"
      :aria-valuetext="isIdle ? undefined : progressLabel"
      :style="isIdle ? undefined : animCtrl.headerStyle.value"
    >
      <TitleContent v-if="isIdle" variant="idle" />
      <ProgressContent v-else />
    </HeaderArea>
    <Stage :scene="isIdle ? 'idle' : 'divination'">
      <view
        v-if="isIdle && cardsLoadError"
        class="play-view__error"
      >
        <text class="play-view__error-text">{{ cardsLoadError }}</text>
        <view
          class="play-view__retry"
          role="button"
          tabindex="0"
          :aria-disabled="isCardsLoading ? 'true' : 'false'"
          @click="handleRetry"
          @keydown.enter="handleRetry"
          @keydown.space.prevent="handleRetry"
        >{{ isCardsLoading ? '感应中...' : '重新感应' }}</view>
      </view>
      <Deck v-else />
    </Stage>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: PlayView
 * Purpose: top-level view that hosts the entire single-stage divination
 *          flow. Replaces the legacy IdleView ↔ DivinationView v-if pair
 *          per task 8.2.3.
 * Reason: keeping a single view mounted across every phase means the
 *         underlying Deck (and its GSAP rig) never unmounts mid-flow —
 *         eliminating the 450 ms cross-fade transition + the scale
 *         1→1.5 push-fade exit tween the legacy pair needed to mask
 *         their unmount/mount gap.
 * Data flow:
 *   - injected appPhase decides which header content + ARIA semantics
 *     to render and whether the deck is in fan-loop or divination mode
 *     (the Deck does the latter switch internally).
 *   - injected animationController surfaces headerStyle (slide-in tween)
 *     and progressHeaderPresentation (active-step label for aria-valuetext).
 *   - cards-load error is passed through from the parent (mirrors
 *     legacy IdleView contract); retry click bubbles via emit so the
 *     parent can dispatch the store action.
 */
import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import HeaderArea from '../../components/HeaderArea.vue'
import TitleContent from '../../components/TitleContent.vue'
import ProgressContent from '../../components/ProgressContent.vue'
import Stage from '../../components/Stage.vue'
import Deck from '../../components/Deck.vue'
import type { UseAnimationControllerReturn } from '../../state/use_animation_controller'
import type { DivinationPhase } from '../store/flow'

const props = defineProps<{
  cardsLoadError: string | null
  isCardsLoading: boolean
}>()

const emit = defineEmits<{
  (event: 'retryLoadCards'): void
}>()

const phase = inject<Ref<DivinationPhase>>('appPhase')!
const animCtrl = inject<UseAnimationControllerReturn>('animationController')!

/** Idle gate — drives the header variant + the cards-load error band. */
const isIdle = computed(() => phase.value === 'idle')

/** Active progress phase label (e.g. "审视" / "命定") surfaced as
 *  aria-valuetext on the header in non-idle phases. */
const progressLabel = computed(
  () => animCtrl.progressHeaderPresentation.value.items.find((i) => i.isActive)?.label ?? '',
)

function handleRetry() {
  if (props.isCardsLoading) return
  emit('retryLoadCards')
}
</script>

<style scoped>
.play-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  min-height: 0;
  /* Uniform safe-area + margin handling shared by every previous
     view (IdleView / DivinationView / FallbackView). The CSS
     variable `--margin` is set on the main-page root via the scale
     bridge (pages/main/index.vue), so the same value scales across
     iPhone 8 → 17 Pro Max without per-view subscription. */
  padding-top: calc(env(safe-area-inset-top, 0px) + var(--margin));
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--margin));
  padding-left: var(--margin);
  padding-right: var(--margin);
  box-sizing: border-box;
}

.play-view__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

.play-view__error-text {
  font-size: 24rpx;
  color: var(--color-no);
  text-align: center;
  max-width: 80%;
  word-break: break-word;
}

.play-view__retry {
  padding: 18rpx 40rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  background: linear-gradient(to bottom, var(--color-btn-primary-from), var(--color-btn-primary-to));
  color: var(--color-btn-primary-text);
}
</style>
