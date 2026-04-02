<template>
  <view class="index-page parchment-bg">
    <!-- 空白占位页面，占卜流程完整由 DivinationOverlay 接管 -->
    <view v-if="isIdle" class="idle-view">
      <view class="header">
        <text class="title font-display text-4xl">AI Tarot</text>
        <text class="subtitle font-display text-xl">Yes or No</text>
        <text class="hint text-base">轻触圆环开始占卜</text>
      </view>

      <view class="start-area" @click="startDivination">
        <view class="start-stage">
          <view class="mystic-circle">
            <view class="orbit orbit-outer"></view>
            <view class="orbit orbit-middle"></view>
            <view class="orbit orbit-inner"></view>

            <view class="circle-core">
              <text class="core-symbol">✦</text>
            </view>

            <view class="orbital-particle particle-1"></view>
            <view class="orbital-particle particle-2"></view>
            <view class="orbital-particle particle-3"></view>
          </view>
        </view>
      </view>
    </view>

    <view class="corner-decoration corner-tl"></view>
    <view class="corner-decoration corner-tr"></view>
    <view class="corner-decoration corner-bl"></view>
    <view class="corner-decoration corner-br"></view>
    <view class="mystic-orb orb-tl"></view>
    <view class="mystic-orb orb-br"></view>

    <!-- DivinationOverlay 全程接管：洗牌 -> 切牌 -> 抽牌 -> 翻转 -> 结果展示 -->
    <DivinationOverlay
      v-if="tarotStore.isAnimating || tarotStore.isResultVisible"
      @restart="restartDivination"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import DivinationOverlay from '../../components/DivinationOverlay.vue'
import { useTarotStore } from '../../stores/tarot'

const tarotStore = useTarotStore()

const isIdle = computed(() => tarotStore.isIdle)

function startDivination() {
  tarotStore.startDivination('')
}

function restartDivination() {
  tarotStore.reset()

  nextTick(() => {
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0
    })
  })
}
</script>

<style scoped>
.index-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.index-page.is-result-view {
  overflow: hidden;
}

.idle-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
}

.header {
  padding-top: calc(env(safe-area-inset-top, 0px) + 120rpx);
  padding-left: var(--space-5);
  padding-right: var(--space-5);
  padding-bottom: var(--space-6);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.title {
  color: var(--color-text-primary);
  text-shadow: 0 4rpx 16rpx rgba(74, 52, 40, 0.15);
  letter-spacing: 0.15em;
}

.subtitle {
  color: var(--color-text-secondary);
  letter-spacing: 0.25em;
  margin-top: var(--space-1);
}

.hint {
  color: var(--color-text-tertiary);
  margin-top: var(--space-4);
  animation: breathe 2.5s ease-in-out infinite;
}

.start-area {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + 14vh);
}

.start-stage {
  width: min(100%, 960rpx);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mystic-circle {
  width: min(72vw, 420rpx);
  aspect-ratio: 1;
  position: relative;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.orbit {
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 50%;
  border: 1rpx solid var(--color-border);
}

.orbit-outer {
  width: 100%;
  height: 100%;
  border-color: rgba(184, 148, 62, 0.25);
  animation: spin 20s linear infinite;
}

.orbit-middle {
  width: 75%;
  height: 75%;
  border-color: rgba(184, 148, 62, 0.35);
  border-style: dashed;
  animation: spin 15s linear infinite reverse;
}

.orbit-inner {
  width: 50%;
  height: 50%;
  border-color: rgba(184, 148, 62, 0.45);
  animation: spin 10s linear infinite;
}

.circle-core {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(145deg,
    rgba(212, 184, 114, 0.25) 0%,
    rgba(184, 148, 62, 0.15) 50%,
    rgba(139, 111, 46, 0.1) 100%);
  border: 2rpx solid rgba(184, 148, 62, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  backdrop-filter: blur(10rpx);
  box-shadow:
    0 8rpx 32rpx rgba(184, 148, 62, 0.2),
    inset 0 1rpx 2rpx rgba(255, 255, 255, 0.3);
  transition: transform var(--transition-base), box-shadow var(--transition-base), background var(--transition-base);
}

.mystic-circle:active .circle-core {
  transform: scale(0.95);
  background: linear-gradient(145deg,
    rgba(212, 184, 114, 0.35) 0%,
    rgba(184, 148, 62, 0.25) 50%,
    rgba(139, 111, 46, 0.15) 100%);
}

.core-symbol {
  font-size: 48rpx;
  color: var(--color-accent);
  animation: pulse 2s ease-in-out infinite;
  filter: drop-shadow(0 0 8rpx rgba(184, 148, 62, 0.5));
}

.orbital-particle {
  position: absolute;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 12rpx var(--color-accent-glow);
}

.particle-1 {
  width: 12rpx;
  height: 12rpx;
  top: 50%;
  left: 50%;
  animation: orbit-outer 20s linear infinite;
}

.particle-2 {
  width: 8rpx;
  height: 8rpx;
  top: 50%;
  left: 50%;
  opacity: 0.7;
  animation: orbit-middle 15s linear infinite reverse;
}

.particle-3 {
  width: 10rpx;
  height: 10rpx;
  top: 50%;
  left: 50%;
  opacity: 0.6;
  animation: orbit-inner 10s linear infinite;
}

.orb-tl {
  width: 400rpx;
  height: 400rpx;
  top: -150rpx;
  left: -150rpx;
}

.orb-br {
  width: 500rpx;
  height: 500rpx;
  bottom: -200rpx;
  right: -200rpx;
}

@media (min-width: 768px) {
  .header {
    padding-top: calc(env(safe-area-inset-top, 0px) + 160rpx);
  }

  .start-area {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 10vh);
  }

  .mystic-circle {
    width: min(32vw, 440rpx);
  }

  .circle-core {
    width: 150rpx;
    height: 150rpx;
  }

  .core-symbol {
    font-size: 60rpx;
  }
}

@keyframes orbit-outer {
  from {
    transform: translate(-50%, -50%) rotate(0deg) translateY(calc(min(72vw, 420rpx) * -0.5)) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg) translateY(calc(min(72vw, 420rpx) * -0.5)) rotate(-360deg);
  }
}

@keyframes orbit-middle {
  from {
    transform: translate(-50%, -50%) rotate(0deg) translateY(calc(min(72vw, 420rpx) * -0.375)) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg) translateY(calc(min(72vw, 420rpx) * -0.375)) rotate(-360deg);
  }
}

@keyframes orbit-inner {
  from {
    transform: translate(-50%, -50%) rotate(0deg) translateY(calc(min(72vw, 420rpx) * -0.25)) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg) translateY(calc(min(72vw, 420rpx) * -0.25)) rotate(-360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.9;
  }

  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

@keyframes breathe {
  0%, 100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
