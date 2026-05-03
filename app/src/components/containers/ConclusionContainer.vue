<template>
  <!--
    ConclusionContainer — phase-2.2.b implementation.
    Renders the result-tendency conclusion (positive / negative / neutral)
    per PRD §2.4 #5 and §7.3 #4. Gated by v-if so the parent can pass null
    safely during transitions.
  -->
  <view
    v-if="readingResult"
    class="conclusion-container"
    role="region"
    aria-label="占卜结论"
    :class="viewModel.toneClass"
  >
    <TypewriterText
      class="eyebrow font-display text-sm"
      text="占卜结果"
      :start-delay="viewModel.eyebrowTiming.startDelay"
      :char-interval="viewModel.eyebrowTiming.charInterval"
    />
    <TypewriterText
      class="hero-title font-display text-3xl"
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
</template>

<script setup lang="ts">
/**
 * Name: ConclusionContainer
 * Purpose: child of ReadingPanel; shows the result-tendency conclusion text
 *          for the current divination (PRD §2.4 #5).
 * Reason: splitting the hero into its own container matches the PRD's three-
 *         child contract (conclusion / card meaning / reading text) and keeps
 *         the tone-class and typewriter timing local.
 * Data flow: ReadingPanel passes the resolved `readingResult`; this container
 *           calls useReadingPanelController to derive toneClass + hero text +
 *           timing. Null guard is internal — parent may pass null briefly.
 */
import { useReadingPanelController } from '../../composables/use_reading_panel_controller'
import TypewriterText from '../TypewriterText.vue'
import {
  HERO_TITLE_START_DELAY,
  HERO_TITLE_CHAR_INTERVAL,
  HERO_QUESTION_START_DELAY,
  HERO_QUESTION_CHAR_INTERVAL,
} from '../../core/config/layout_constants'
import type { ReadingResult } from '../../api/types'

const props = defineProps<{
  readingResult: ReadingResult | null
  question?: string
}>()

// Non-null assertion: parent (ReadingPanel) gates this component's render
// with v-else-if="readingResult !== null", so readingResult is guaranteed
// non-null when this component is mounted.
const viewModel = useReadingPanelController({
  get readingResult() { return props.readingResult! },
  get question() { return props.question },
})

const heroTitleTiming = {
  startDelay: HERO_TITLE_START_DELAY,
  charInterval: HERO_TITLE_CHAR_INTERVAL,
}

const heroQuestionTiming = {
  startDelay: HERO_QUESTION_START_DELAY,
  charInterval: HERO_QUESTION_CHAR_INTERVAL,
}
</script>

<style scoped>
.conclusion-container {
  --result-tone: var(--color-accent);
  --result-tone-bg: rgba(122, 92, 20, 0.08);

  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  animation: rise-in 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

.conclusion-container.is-positive {
  --result-tone: var(--color-yes);
  --result-tone-bg: var(--color-yes-bg);
}

.conclusion-container.is-negative {
  --result-tone: var(--color-no);
  --result-tone-bg: var(--color-no-bg);
}

.eyebrow {
  color: var(--result-tone, #b8943e);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: var(--text-sm);
}

.hero-title {
  color: var(--result-tone, #b8943e);
  line-height: 1.1;
  text-shadow: 0 2rpx 10rpx rgba(74, 52, 40, 0.1);
  margin: var(--space-2) 0;
}

.question {
  padding-top: var(--space-2);
  font-style: italic;
  color: var(--color-text-tertiary);
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
  .conclusion-container {
    animation: none !important;
  }
}
</style>
