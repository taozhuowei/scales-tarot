<template>
  <view class="reading-panel" role="region" aria-label="占卜结果" aria-live="polite" :class="viewModel.toneClass" data-testid="result-shell">
    <view class="result-hero" data-testid="result-hero">
      <TypewriterText
        class="eyebrow font-display text-sm"
        text="占卜结果"
        :start-delay="viewModel.eyebrowTiming.startDelay"
        :char-interval="viewModel.eyebrowTiming.charInterval"
      />
      <TypewriterText
        class="hero-title font-display text-3xl"
        :class="viewModel.toneClass"
        :text="viewModel.hero.title"
        :start-delay="heroTitleTiming.startDelay"
        :char-interval="heroTitleTiming.charInterval"
        data-testid="result-statement"
      />
      <TypewriterText
        v-if="viewModel.hero.question"
        class="question text-base"
        :text="viewModel.hero.question"
        :start-delay="heroQuestionTiming.startDelay"
        :char-interval="heroQuestionTiming.charInterval"
        data-testid="result-question"
      />
    </view>

    <view class="meaning-list">
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
            v-for="(keywordItem) in detail.keywordsWithTiming"
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

        <TypewriterText
          class="meaning-text text-base"
          :text="detail.meaning"
          :start-delay="detail.meaningTiming.startDelay"
          :char-interval="detail.meaningTiming.charInterval"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import TypewriterText from './TypewriterText.vue'
import { useResultPanelController } from '../composables/use_result_panel_controller'
import type { ReadingResult } from '../utils/tarotReading'

const props = defineProps<{
  readingResult: ReadingResult
  question?: string
}>()

defineEmits<{
  (event: 'restart'): void
}>()

// Get view model from controller
const viewModel = useResultPanelController({
  readingResult: props.readingResult,
  question: props.question,
})

// Hero section timing (these are fixed UI timing constants)
const heroTitleTiming = {
  startDelay: 180,
  charInterval: 38,
}

const heroQuestionTiming = {
  startDelay: 420,
  charInterval: 26,
}
</script>

<style scoped>
.reading-panel {
  --result-tone: var(--color-accent);
  --result-tone-bg: rgba(122, 92, 20, 0.08);

  padding: var(--space-6) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-width: 720px;
  width: 100%;
  box-sizing: border-box;
}

.reading-panel.is-positive {
  --result-tone: var(--color-yes);
  --result-tone-bg: var(--color-yes-bg);
}

.reading-panel.is-negative {
  --result-tone: var(--color-no);
  --result-tone-bg: var(--color-no-bg);
}

.result-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
  text-align: center;
  animation: rise-in 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

.eyebrow {
  color: var(--result-tone);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: var(--text-sm);
}

.hero-title {
  color: var(--result-tone);
  line-height: 1.1;
  text-shadow: 0 2rpx 10rpx rgba(74, 52, 40, 0.1);
  margin: var(--space-2) 0;
}

.question {
  padding-top: var(--space-2);
  font-style: italic;
  color: var(--color-text-tertiary);
}

.meaning-list {
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

.meaning-text {
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-top: var(--space-2);
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
  .result-hero,
  .meaning-list {
    animation: none !important;
  }
}
</style>
