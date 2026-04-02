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
  padding: var(--space-5) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-8));
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.result-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background:
    radial-gradient(circle at top left, rgba(212, 184, 114, 0.18), transparent 40%),
    var(--color-card-bg);
  animation: rise-in 420ms ease;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.eyebrow {
  color: var(--color-accent);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-title {
  color: var(--color-text-primary);
  line-height: 1.05;
}

.hero-subtitle,
.question {
  color: var(--color-text-secondary);
}

.question {
  padding-top: var(--space-1);
  font-style: italic;
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
  padding: var(--space-5);
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.section-title {
  color: var(--color-text-primary);
  letter-spacing: 0.12em;
}

.divider-line {
  width: 72rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
}

.meaning-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.meaning-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: rgba(245, 230, 200, 0.24);
  border-left: 3rpx solid var(--color-accent);
}

.meaning-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.meaning-number {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(145deg, var(--color-accent), var(--color-accent-dark));
  flex-shrink: 0;
}

.meaning-title {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.meaning-card-name {
  color: var(--color-text-primary);
  font-weight: 600;
}

.meaning-position {
  color: var(--color-text-tertiary);
}

.meaning-text {
  color: var(--color-text-secondary);
  line-height: 1.75;
}

.action-section {
  display: flex;
  justify-content: center;
  padding-bottom: var(--space-4);
}

.restart-btn {
  min-width: 280rpx;
  height: 96rpx;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(24rpx);
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
