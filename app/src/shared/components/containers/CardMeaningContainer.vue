<template>
  <!--
    CardMeaningContainer — phase-2.2.b implementation.
    Lists per-card name / nameEn / position / arcana / keywords per
    PRD §2.4 #6. Gated by v-if for safe null pass.
  -->
  <view
    v-if="readingResult"
    class="card-meaning-container"
    role="region"
    aria-label="卡牌信息"
  >
    <view
      v-for="(detail, index) in viewModel.cardDetails"
      :key="`${detail.card.name}-${detail.position}-${index}`"
      class="meaning-item"
      role="article"
      :aria-label="detail.card.name + ' - ' + detail.positionLabel"
    >
      <TypewriterText
        class="meaning-card-name font-body"
        :text="detail.card.name"
        :start-delay="detail.nameTiming.startDelay"
        :char-interval="detail.nameTiming.charInterval"
      />
      <TypewriterText
        class="meaning-card-name-en font-display"
        :text="detail.card.nameEn"
        :start-delay="detail.nameEnTiming.startDelay"
        :char-interval="detail.nameEnTiming.charInterval"
      />

      <view class="meaning-meta-row">
        <TypewriterText
          class="meaning-position text-sm"
          :text="detail.positionLabel"
          :start-delay="detail.positionTiming.startDelay"
          :char-interval="detail.positionTiming.charInterval"
        />
        <TypewriterText
          class="meaning-arcana text-sm"
          :text="detail.arcanaLabel"
          :start-delay="detail.arcanaTiming.startDelay"
          :char-interval="detail.arcanaTiming.charInterval"
        />
      </view>

      <view class="keywords-row">
        <view
          v-for="keywordItem in detail.keywordsWithTiming"
          :key="`${detail.card.id}-${detail.position}-${keywordItem.text}`"
          class="keyword-chip text-sm"
        >
          <TypewriterText
            class="keyword-chip-text"
            :text="keywordItem.text"
            :start-delay="keywordItem.timing.startDelay"
            :char-interval="keywordItem.timing.charInterval"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: CardMeaningContainer
 * Purpose: child of ReadingPanel; shows each drawn card's name, nameEn,
 *          position (upright / reversed), arcana, and keywords without a
 *          face image (PRD §2.4 #6).
 * Reason: separating card metadata from the long-form interpretation matches
 *         the PRD's three-child contract; per-field typewriter timing stays
 *         local to this container.
 * Data flow: ReadingPanel passes `readingResult`; this container calls
 *           useReadingPanelController for the view model including per-field
 *           timing. Null guard is internal — parent may pass null briefly.
 */
import { useReadingPanelController } from '../../../composables/use_reading_panel_controller'
import TypewriterText from '../TypewriterText.vue'
import type { ReadingResult } from '../../../core/api/types'

const props = defineProps<{
  readingResult: ReadingResult | null
}>()

// Non-null assertion: parent (ReadingPanel) gates this component's render
// with v-else-if="readingResult !== null", so readingResult is guaranteed
// non-null when this component is mounted.
const viewModel = useReadingPanelController({
  get readingResult() { return props.readingResult! },
})
</script>

<style scoped>
.card-meaning-container {
  --result-tone: var(--color-accent);
  --result-tone-bg: rgba(122, 92, 20, 0.08);

  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: rise-in 600ms cubic-bezier(0.4, 0, 0.2, 1) 150ms both;
}

.meaning-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-5) 0;
  border-bottom: 1rpx solid var(--color-border-rule);
}

.meaning-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.meaning-card-name {
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: var(--text-lg);
}

.meaning-card-name-en {
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
  margin-left: var(--space-2);
}

.meaning-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.meaning-position {
  color: var(--color-accent);
  font-size: var(--text-sm);
  letter-spacing: 0.05em;
}

.meaning-arcana {
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

/* #ifdef H5 */
.meaning-arcana::before {
  content: '·';
  margin-right: var(--space-2);
  opacity: 0.4;
}
/* #endif */

.keywords-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.keyword-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 16rpx;
  border-radius: 20rpx;
  background: var(--result-tone-bg);
  border: 1rpx solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0.03em;
}

.keyword-chip-text {
  color: var(--color-text-secondary);
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(32rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-meaning-container {
    animation: none !important;
  }
}
</style>
