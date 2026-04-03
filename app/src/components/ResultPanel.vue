<template>
  <!-- 纯解读内容面板，不再包含牌阵展示（由 DivinationOverlay 负责） -->
  <view class="reading-panel" data-testid="result-shell">
    <view class="result-hero card border-brass" data-testid="result-hero">
      <view class="hero-copy">
        <text class="eyebrow font-display text-sm">占卜结果</text>
        <text class="hero-title font-display text-3xl" data-testid="result-statement">
          {{ resultStatement }}
        </text>

        <text class="hero-subtitle text-base" data-testid="result-summary">
          {{ typedSummary }}<text class="typing-caret" :class="{ hidden: !isTyping }">|</text>
        </text>

        <text v-if="question" class="question text-base" data-testid="result-question">"{{ question }}"</text>
      </view>
    </view>

    <!-- 牌义解读列表 -->
    <view class="interpretation-section card">
      <view class="section-header">
        <text class="section-title font-display text-lg">牌义解读</text>
        <view class="divider-line"></view>
      </view>

      <view class="meaning-list">
        <view
          v-for="(detail, index) in readingResult.cardDetails"
          :key="`${detail.card.name}-${detail.position}-${index}`"
          class="meaning-item"
        >
          <view class="meaning-header">
            <view class="meaning-number font-display">{{ index + 1 }}</view>
            <view class="meaning-title">
              <text class="meaning-card-name font-body text-base">{{ detail.card.name }}</text>
              <text class="meaning-position text-sm">
                {{ detail.position === 'upright' ? '正位启示' : '逆位启示' }}
              </text>
            </view>
          </view>
          <text class="meaning-text text-base">{{ detail.meaning }}</text>
        </view>
      </view>
    </view>

    <view class="action-section">
      <view class="restart-btn btn btn-primary" data-testid="restart-button" @click="$emit('restart')">
        <text class="btn-text">再占一次</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ReadingResult } from '../utils/tarotReading'
import { getResultStatement, getSummaryText } from '../utils/result_panel'

const props = defineProps<{
  readingResult: ReadingResult
  question?: string
}>()

defineEmits<{
  (event: 'restart'): void
}>()

const resultStatement = computed(() => getResultStatement(props.readingResult.result))
const summaryText = computed(() => getSummaryText(props.readingResult))

const typedSummary = ref('')
const isTyping = ref(false)
let typingTimer: ReturnType<typeof setInterval> | null = null

function stopTyping() {
  if (typingTimer) {
    clearInterval(typingTimer)
    typingTimer = null
  }
}

function startTyping(text: string) {
  stopTyping()
  typedSummary.value = ''
  isTyping.value = true

  let index = 0
  typingTimer = setInterval(() => {
    index += 1
    typedSummary.value = text.slice(0, index)

    if (index >= text.length) {
      stopTyping()
      isTyping.value = false
    }
  }, 30)
}

watch(summaryText, (text) => {
  startTyping(text)
}, { immediate: true })

onBeforeUnmount(() => {
  stopTyping()
})
</script>

<style scoped>
.reading-panel {
  padding: var(--space-6) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.result-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  background:
    radial-gradient(ellipse at top right, rgba(212, 184, 114, 0.15), transparent 60%),
    rgba(254, 250, 243, 0.7);
  border: 1rpx solid rgba(184, 148, 62, 0.3);
  animation: rise-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
  text-align: center;
}

.eyebrow {
  color: var(--color-accent);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-title {
  color: var(--color-text-primary);
  line-height: 1.1;
  text-shadow: 0 2rpx 10rpx rgba(74, 52, 40, 0.1);
  margin: var(--space-2) 0;
}

.hero-subtitle {
  color: var(--color-text-secondary);
  line-height: 1.8;
  max-width: 600px;
}

.question {
  padding-top: var(--space-2);
  font-style: italic;
  color: var(--color-text-tertiary);
}

.typing-caret {
  display: inline-block;
  margin-left: 4rpx;
  animation: caret-blink 0.9s steps(1) infinite;
}

.typing-caret.hidden {
  opacity: 0;
}

.interpretation-section {
  padding: var(--space-6) var(--space-5);
  border-radius: var(--radius-xl);
  background: rgba(254, 250, 243, 0.6);
  box-shadow: var(--shadow-md);
  border: 1rpx solid rgba(184, 148, 62, 0.2);
  backdrop-filter: blur(12rpx);
  -webkit-backdrop-filter: blur(12rpx);
  animation: rise-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms both;
}

.section-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.section-title {
  color: var(--color-text-primary);
  letter-spacing: 0.12em;
  font-size: var(--text-xl);
}

.divider-line {
  width: 120rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
}

.meaning-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.meaning-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.5);
  border-left: 6rpx solid var(--color-accent);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-base), box-shadow var(--transition-base), background var(--transition-base);
}

@media (hover: hover) {
  .meaning-item:hover {
    transform: translateY(-4rpx);
    box-shadow: var(--shadow-md);
    background: rgba(255, 255, 255, 0.8);
  }
}

.meaning-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.meaning-number {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(145deg, var(--color-accent), var(--color-accent-dark));
  box-shadow: 0 4rpx 12rpx rgba(184, 148, 62, 0.3);
  flex-shrink: 0;
  font-size: var(--text-sm);
}

.meaning-title {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.meaning-card-name {
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: var(--text-lg);
}

.meaning-position {
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  letter-spacing: 0.05em;
}

.meaning-text {
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-top: var(--space-1);
}

.action-section {
  display: flex;
  justify-content: center;
  padding: var(--space-4) 0 var(--space-8);
  animation: rise-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both;
}

.restart-btn {
  min-width: 320rpx;
  height: 104rpx;
  font-size: var(--text-base);
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

@keyframes caret-blink {
  0%,
  49% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0;
  }
}
</style>
