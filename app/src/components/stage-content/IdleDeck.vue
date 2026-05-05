<template>
  <!--
    IdleDeck — phase-2.2.a migration target.
    Stage-content for the idle stage; renders the looping fan-out / fan-in
    animation described in PRD §7.5.1 ("fan animation"). The 12-card stack
    is sized by the layout solver (matching the divination draw card so the
    visual continuity from idle → divination feels stable). Tapping the
    deck region emits `triggerDivination` and runs the legacy "scene push
    + fade" exit animation.
  -->
  <view
    class="idle-deck-content"
    role="button"
    tabindex="0"
    aria-label="开始占卜"
    :style="sceneStyle"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <view class="idle-deck-content__deck" :style="deckContainerStyle">
      <image
        v-for="i in deckSize"
        :key="i"
        class="idle-deck-content__card"
        :src="cardBack"
        :style="cardsStyle[i - 1]"
        role="img"
        aria-label="塔罗牌背面"
        lazy-load
      />
    </view>

    <view class="idle-deck-content__hint" :style="{ opacity: hintOpacity }">
      <view class="idle-deck-content__hint-line" />
      <text class="idle-deck-content__hint-text font-display">TOUCH TO DIVINE</text>
      <view class="idle-deck-content__hint-line" />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: IdleDeck (stage content)
 * Purpose: stage-content for the idle stage; renders the looping fan
 *          animation that invites the user to tap the deck (PRD §7.5.1).
 *          The animation logic (GSAP timeline, card-size derivation,
 *          click-triggered exit tween) lives in `use_idle_deck_animation`
 *          so the SFC stays declarative — template + minimal setup glue.
 *          Emits `triggerDivination` *immediately* on tap so the parent
 *          view + main page can promote the application phase without
 *          waiting for the exit animation.
 * Reason: separating stage content from the Stage container lets us swap
 *         scenes without touching layout. The animation composable
 *         encapsulates the imperative GSAP plumbing so the SFC body can
 *         shrink to a manageable size and the animation logic stays
 *         self-contained for unit tests.
 * Data flow: theme store provides the card-back image; the animation
 *           composable provides every other reactive surface (deck size,
 *           card styles, scene style, hint opacity, click handler).
 */
import { computed } from 'vue'
import { useThemeStore } from '../../stores/theme'
import { useIdleDeckAnimation } from '../../composables/use_idle_deck_animation'

const emit = defineEmits<{
  (event: 'triggerDivination'): void
}>()

const themeStore = useThemeStore()

const cardBack = computed(() => themeStore.cardBackImage)

const {
  deckSize,
  deckContainerStyle,
  cardsStyle,
  sceneStyle,
  hintOpacity,
  handleClick,
} = useIdleDeckAnimation({
  onTriggerDivination: () => { emit('triggerDivination') },
})
</script>

<style scoped>
.idle-deck-content {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
  transform-origin: center center;
}

.idle-deck-content__deck {
  position: relative;
  z-index: 10;
}

.idle-deck-content__card {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 10rpx ≈ 5 px at the 750-rpx design baseline — unified across every
     card surface (DivinationDeck.tarot-card, cut-pile.pile-card,
     CardMeaningContainer) so the deck reads as the same physical object
     from idle through reveal. */
  border-radius: 10rpx;
  border: 1px solid var(--color-border);
  box-shadow: 0 2rpx 8rpx rgba(30, 15, 6, 0.3);
}

/* Deepest shadow on the bottom card — H5 only because mini-program parser
   doesn't reliably support `:first-child` on uni-app `<image>` tags. */
/* #ifdef H5 */
.idle-deck-content__card:first-child {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}
/* #endif */

.idle-deck-content__hint {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 80rpx);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  pointer-events: none;
}

.idle-deck-content__hint-line {
  width: 50rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, var(--color-border-strong), transparent);
}

.idle-deck-content__hint-text {
  font-size: 20rpx;
  color: var(--color-text-muted);
  letter-spacing: 0.25em;
}

@media (prefers-reduced-motion: reduce) {
  .idle-deck-content__card,
  .idle-deck-content__hint {
    transition: none !important;
    animation: none !important;
  }
}
</style>
