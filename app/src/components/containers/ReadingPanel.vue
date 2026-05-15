<template>
  <!--
    ReadingPanel — phase-2.2.b implementation.
    Composes the three sub-containers per PRD §2.4 #4. Handles loading /
    error / success states with a fade-slide transition.
  -->
  <view
    class="reading-panel"
    role="region"
    aria-label="占卜结果"
    aria-live="polite"
  >
    <transition name="fade-slide" mode="out-in">
      <!-- Loading -->
      <view
        v-if="panelState === 'loading'"
        key="loading"
        class="reading-panel__loading"
      >
        <view class="loading-spinner"></view>
        <text class="loading-text">正在解读...</text>
        <view class="thinking-dots">
          <text class="dot">.</text>
          <text class="dot">.</text>
          <text class="dot">.</text>
        </view>
      </view>

      <!-- Error: retry button is provided by ActionArea to avoid duplication -->
      <view
        v-else-if="panelState === 'error'"
        key="error"
        class="reading-panel__error"
      >
        <view class="error-box">
          <text class="error-icon">⚠️</text>
          <text class="error-text">{{ errorMessage }}</text>
        </view>
      </view>

      <!-- Success -->
      <view
        v-else-if="panelState === 'success' && readingResult !== null"
        key="success"
        class="reading-panel__success"
      >
        <ConclusionContainer
          :reading-result="readingResult"
          :question="question"
        />
        <CardMeaningContainer :reading-result="readingResult" />
        <ReadingTextContainer
          :reading-result="readingResult"
          @typewriter-complete="$emit('typewriterComplete')"
        />
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: ReadingPanel container
 * Purpose: parent slot for the three reading sub-containers; lives inside
 *          ReadingSplitView (wide) or ReadingDrawerView (narrow) per
 *          PRD §2.3 #3-#4 and §2.4 #4. Handles loading / error / success
 *          states with fade-slide transitions.
 * Reason: pulling the three children together at the panel level lets both
 *         viewports reuse the same composition without duplicating state
 *         branching. Loading / error states are owned here so sub-containers
 *         always receive a non-null readingResult.
 * Data flow: parent view passes `panelState`, `readingResult`, `question`,
 *           and `errorMessage`. Typewriter completion and retry are bubbled
 *           up to the page.
 */
import ConclusionContainer from './ConclusionContainer.vue'
import CardMeaningContainer from './CardMeaningContainer.vue'
import ReadingTextContainer from './ReadingTextContainer.vue'
import type { ReadingResult } from '../../core/api/types'
import type { ReadingStatus } from '../../utils/reading/reading_orchestrator'

defineProps<{
  panelState: ReadingStatus
  readingResult: ReadingResult | null
  question?: string
  errorMessage?: string
}>()

defineEmits<{
  (event: 'typewriterComplete'): void
  (event: 'retry'): void
}>()
</script>

<style scoped>
.reading-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.reading-panel__loading {
  height: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: var(--color-text-tertiary);
  font-size: 28rpx;
}

.thinking-dots {
  display: flex;
  gap: 8rpx;
}

.dot {
  font-size: 40rpx;
  color: var(--color-accent);
  animation: bounce 1.4s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

.reading-panel__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6) 0;
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: rgba(220, 38, 38, 0.06);
  border: 1rpx solid rgba(220, 38, 38, 0.2);
  border-radius: 16rpx;
  width: 100%;
  box-sizing: border-box;
}

.error-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.error-text {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 1.6;
}

.reading-panel__success {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) 0;
}

/* fade-slide transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.15s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
