<template>
  <!--
    CardsLoadError — idle-only card-resource load error band (message +
    retry). The idle && cardsLoadError mount gate lives in
    MainSurface.vue (`<CardsLoadError v-if/> <Deck v-else/>` under
    Stage), so Deck is not mounted while erroring at idle.
  -->
  <view class="cards-load-error">
    <text class="cards-load-error__text">{{ cardsLoadError }}</text>
    <view
      class="cards-load-error__retry"
      role="button"
      tabindex="0"
      :aria-disabled="isCardsLoading ? 'true' : 'false'"
      @click="retry"
      @keydown.enter="retry"
      @keydown.space.prevent="retry"
    >{{ isCardsLoading ? '感应中...' : '重新感应' }}</view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: CardsLoadError component
 * Purpose: render the idle card-resource load failure band (message +
 *          retry affordance). Self-serves the error/loading state and the
 *          retry action from the tarot store via useCardsLoadError, so it
 *          carries no props/emit chain.
 * Data flow: useCardsLoadError() ──▶ cardsLoadError / isCardsLoading /
 *          retry; the mount gate lives in the parent template.
 */
import { useCardsLoadError } from '../../../core/composables/use_cards_load_error'

const { cardsLoadError, isCardsLoading, retry } = useCardsLoadError()
</script>

<style scoped>
.cards-load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

.cards-load-error__text {
  font-size: 24rpx;
  color: var(--color-no);
  text-align: center;
  max-width: 80%;
  word-break: break-word;
}

.cards-load-error__retry {
  padding: 18rpx 40rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  background: linear-gradient(to bottom, var(--color-btn-primary-from), var(--color-btn-primary-to));
  color: var(--color-btn-primary-text);
}
</style>
