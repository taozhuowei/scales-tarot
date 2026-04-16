<template>
  <view
    class="divination-overlay"
    :class="{
      'show-results': controller.showResults.value,
      'is-wide': isWide,
    }"
    :style="controller.overlayVarsStyle.value"
  >
    <view class="overlay-bg" :style="controller.bgStyle.value" />

    <!-- Main flex column: stage on top (or left on wide) + result panel below (or right on wide) -->
    <view class="overlay-main">
      <view class="stage-container">
        <view class="progress-header" :style="controller.headerStyle.value">
          <view class="phase-progress-bar">
            <view
              v-for="(step, idx) in controller.phaseSteps.value"
              :key="step.phase"
              class="phase-step"
            >
              <image
                class="phase-step-icon"
                :class="{ 'phase-step-icon-compensated': idx < 2 }"
                :src="step.isActive || step.isCompleted ? themeStore.getUiAsset(getPhaseStep(step.phase)?.activeIcon || '') || themeStore.getUiAsset(getPhaseStep(step.phase)?.inactiveIcon || '') : themeStore.getUiAsset(getPhaseStep(step.phase)?.inactiveIcon || '') || themeStore.getUiAsset(getPhaseStep(step.phase)?.activeIcon || '')"
                mode="aspectFit"
              />
            </view>
          </view>
        </view>

        <view class="stage" :style="controller.stageStyle.value">
          <view class="deck-layer stage-pointer" :style="controller.deckCtnStyle.value">
            <image
              v-for="i in controller.deckCount"
              :key="`m${i}`"
              class="tarot-card stack-card initial-deck"
              :src="controller.cardBack.value"
              :style="controller.initialsStyle.value[i-1]"
            />
            <image
              v-for="i in controller.shuffleHalfCount"
              :key="`l${i}`"
              v-show="controller.leftsVisible.value"
              class="tarot-card stack-card"
              :src="controller.cardBack.value"
              :style="controller.leftsStyle.value[i-1]"
            />
            <image
              v-for="i in controller.shuffleHalfCount"
              :key="`r${i}`"
              v-show="controller.rightsVisible.value"
              class="tarot-card stack-card"
              :src="controller.cardBack.value"
              :style="controller.rightsStyle.value[i-1]"
            />
          </view>

          <!-- Cut piles: rendered as real multi-card stacks, count driven by config -->
          <view
            v-for="pIdx in controller.cutPileCount"
            :key="`pile${pIdx}`"
            v-show="controller.pilesVisible.value[pIdx - 1]"
            class="cut-pile stage-center stage-pointer"
            :style="controller.pilesStyle.value[pIdx - 1]"
          >
            <image
              v-for="cIdx in controller.cardsPerPile"
              :key="`pile${pIdx}-${cIdx}`"
              class="tarot-card pile-card"
              :src="controller.cardBack.value"
              :style="`top: ${-(cIdx - 1) * 1.2}px; left: ${(cIdx - 1) * 0.4}px; z-index: ${cIdx};`"
            />
          </view>

          <view class="draw-container">
            <view
              v-for="(_, idx) in controller.drawsVisible.value"
              :key="idx"
              v-show="controller.drawsVisible.value[idx]"
              class="draw-wrapper stage-center stage-pointer"
              :style="[controller.drawsStyle.value[idx], controller.drawsSizeStyle.value[idx]]"
            >
              <view class="card-focus-frame">
                <view class="card-3d-inner stage-pointer" :style="[controller.innersStyle.value[idx], controller.drawsSizeStyle.value[idx]]">
                  <image class="tarot-card face-back" :src="controller.cardBack.value" />
                  <view class="tarot-card face-front">
                    <image class="front-img" :src="controller.getCardImg(idx)" />
                  </view>
                </view>

                <view
                  v-if="controller.showResults.value"
                  class="position-badge"
                  :class="tarotStore.drawnCards[idx]?.position ?? 'upright'"
                >
                  <text class="badge-label font-display">
                    {{ tarotStore.drawnCards[idx]?.position === 'reversed' ? controller.overlayText.positionReversed : controller.overlayText.positionUpright }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- Result area: scrolls only when content overflows; sized to fit naturally otherwise. -->
      <scroll-view
        v-if="controller.showResults.value"
        class="result-zone"
        scroll-y
        enable-flex
      >
        <view class="result-zone-inner">
          <view v-if="controller.isReadingLoading.value" class="result-loading">
            <text class="loading-text">{{ controller.overlayText.revealing }}</text>
            <view class="thinking-dots">
              <text class="dot dot-1">.</text>
              <text class="dot dot-2">.</text>
              <text class="dot dot-3">.</text>
            </view>
          </view>

          <view v-else-if="controller.isReadingFailed.value" class="result-error">
            <text class="error-text">{{ controller.readingErrorMessage.value }}</text>
            <view class="btn btn-primary" @click="handleRetry">{{ '重试' }}</view>
          </view>

          <ResultPanel
            v-else-if="tarotStore.readingResult"
            :reading-result="tarotStore.readingResult"
            :question="tarotStore.currentQuestion"
            @restart="handleRestart"
          />
        </view>
      </scroll-view>
    </view>

    <!-- Action bar: floats at the bottom of the screen, never scrolls with content -->
    <view class="action-bar">
      <template v-if="controller.showResults.value">
        <view class="btn btn-secondary" @click="handleBackHome">{{ controller.overlayText.backHome }}</view>
        <view class="btn btn-primary" @click="handleRestart">{{ controller.overlayText.restart }}</view>
      </template>

      <template v-else-if="controller.phase.value === 'revealing'">
        <view class="revealing-hint font-display">
          {{ controller.overlayText.revealing }}
          <view class="thinking-dots">
            <text class="dot dot-1">.</text>
            <text class="dot dot-2">.</text>
            <text class="dot dot-3">.</text>
          </view>
        </view>
      </template>

      <template v-else-if="controller.isReadingFailed.value">
        <view class="btn btn-primary" @click="handleRetry">{{ '重试' }}</view>
      </template>
    </view>

    <!-- Dev Tools -->
    <view v-if="isDev" class="dev-tools">
      <text class="dev-tools-title">Dev Tools</text>

      <view class="dev-tools-row">
        <view
          v-for="step in phaseStepsForDev"
          :key="`replay-${step.phase}`"
          class="dev-tools-chip"
          @click="handleReplay(step.phase)"
        >
          {{ step.label }}
        </view>
      </view>

      <view class="dev-tools-row">
        <view
          v-for="speed in playbackRates"
          :key="`speed-${speed}`"
          class="dev-tools-chip"
          :class="{ active: controller.playbackRate.value === speed }"
          @click="handlePlaybackRate(speed)"
        >
          {{ speed }}x
        </view>
      </view>

      <view class="dev-tools-row">
        <view class="dev-tools-chip" @click="handlePause">
          暂停
        </view>
        <view class="dev-tools-chip" @click="handleResume">
          继续
        </view>
        <view
          class="dev-tools-chip"
          :class="{ disabled: !controller.isPaused.value }"
          @click="controller.isPaused.value && handleStepBackward()"
        >
          ←
        </view>
        <view
          class="dev-tools-chip"
          :class="{ disabled: !controller.isPaused.value }"
          @click="controller.isPaused.value && handleStepForward()"
        >
          →
        </view>
        <text class="dev-tools-status">
          {{ controller.isPaused.value ? 'Paused' : `Running ${controller.playbackRate.value}x` }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTarotStore } from '../stores/tarot'
import { useThemeStore } from '../stores/theme'
import ResultPanel from './ResultPanel.vue'
import { getSpreadCardCount } from '../utils/spread_layout'
import { useOverlayController } from '../composables/use_overlay_controller'
import { getPhaseStep, PHASE_STEPS } from '../utils/overlay_phase_registry'
import type { OverlayPhase } from '../utils/overlay_animations/types'

const emit = defineEmits<{
  (event: 'complete'): void
  (event: 'restart'): void
  (event: 'backHome'): void
}>()

const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const isDev = import.meta.env.DEV
const playbackRates = [0.25, 0.5, 1, 2] as const

const isWide = ref(false)
const cardCount = computed(() => getSpreadCardCount(tarotStore.spreadKind))

const phaseStepsForDev = PHASE_STEPS.map(s => ({
  phase: s.phase,
  label: s.label,
}))

const controller = useOverlayController({
  tarotStore,
  themeStore,
  isWide,
  cardCount,
  emit,
})

function handlePlaybackRate(rate: number) { controller.setPlaybackRate(rate) }
function handlePause() { controller.pauseAnimations() }
function handleResume() { controller.resumeAnimations() }
function handleStepBackward() { controller.stepBackward() }
function handleStepForward() { controller.stepForward() }
function handleReplay(targetPhase: OverlayPhase) { controller.replayFromPhase(targetPhase) }

// "再占一次" — restart the divination flow without unmounting the overlay.
// Stays in the divination view; does not return to the home page.
function handleRestart() {
  controller.restart()
}

// "回到首页" — clear store state so the parent page returns to its idle state.
function handleBackHome() {
  emit('backHome')
}

function handleRetry() {
  void controller.retryReading()
}
</script>

<style scoped>
.divination-overlay {
  --card-width: 172px;
  --card-height: calc(var(--card-width) * 1.6);
  --card-focus-scale: 1;

  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* #ifdef H5 */
.divination-overlay {
  --card-width: clamp(108px, 26vw, 172px);
}
/* #endif */

/* #ifdef MP-WEIXIN */
.divination-overlay {
  --card-width: clamp(88px, 22vw, 120px);
}
/* #endif */

.overlay-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: -1;
  background: rgba(242, 232, 208, 0.97);
}

/* Main flex region — flows column on narrow / row on wide once results show. */
.overlay-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.is-wide.show-results .overlay-main {
  flex-direction: row;
}

.stage-container {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  transition: flex 0.4s ease, height 0.4s ease;
}

/* Narrow + results: stage shrinks to make room for the reading; CSS-driven, no JS height calc. */
.show-results .stage-container {
  flex: 0 0 36vh;
  height: 36vh;
}

.is-wide.show-results .stage-container {
  flex: 0 0 44%;
  width: 44%;
  height: 100%;
}

.result-zone {
  flex: 1;
  min-height: 0;
  background: rgba(242, 232, 208, 0.92);
  border-top: 1px solid var(--color-border);
  animation: result-slide-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.is-wide .result-zone {
  border-top: none;
  border-left: 1px solid var(--color-border);
  animation-name: result-slide-in-right;
}

/* Inner wrapper lets ResultPanel flow at its natural height; scroll-view only scrolls
   when this content exceeds the result-zone height. */
.result-zone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding-bottom: 24rpx;
}

@keyframes result-slide-in {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes result-slide-in-right {
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
}

.progress-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 20;
}

.phase-progress-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.phase-step {
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-step-icon {
  width: 40px;
  height: 40px;
  transition: opacity 0.2s ease;
}

.phase-step-icon-compensated {
  width: 44px;
  height: 44px;
}

/* #ifdef H5 */
.progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 60rpx);
}

.show-results .progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 20rpx);
}
/* #endif */

/* #ifdef MP-WEIXIN */
.progress-header {
  margin-top: calc(env(safe-area-inset-top, 44px) + 140rpx);
}

.show-results .progress-header {
  margin-top: calc(env(safe-area-inset-top, 44px) + 60rpx);
}
/* #endif */

.stage {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
  pointer-events: none;
}

.stage-pointer {
  pointer-events: auto;
}

.tarot-card,
.deck-layer,
.card-3d-inner {
  width: var(--card-width);
  height: var(--card-height);
}

.tarot-card {
  will-change: transform;
}

.deck-layer {
  position: relative;
}

.stack-card {
  position: absolute;
  top: 0;
  left: 0;
}

.stage-center {
  position: absolute;
  top: 50%;
  left: 50%;
}

.draw-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

/* Cut pile: a stage-positioned wrapper that holds cardsPerPile stacked cards. */
.cut-pile {
  width: var(--card-width);
  height: var(--card-height);
}

.cut-pile .pile-card {
  position: absolute;
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 8rpx;
  border: 1px solid var(--color-border);
  box-shadow: 0 2rpx 8rpx rgba(30, 15, 6, 0.3);
}

.draw-wrapper {
  perspective: 1200px;
  position: absolute;
}

/* Focus frame: pure CSS scale that enlarges drawn cards after deal+flip and shrinks
   them once the reading text arrives. No JS scale tweens. */
.card-focus-frame {
  width: 100%;
  height: 100%;
  position: relative;
  transform: scale(var(--card-focus-scale, 1));
  transform-origin: center center;
  transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}



.card-3d-inner {
  transform-style: preserve-3d;
  position: relative;
}

.face-back,
.face-front {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  backface-visibility: hidden;
  margin: 0 !important;
}

.face-front {
  transform: rotateY(180deg);
}

.front-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.position-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 30;
  animation: badge-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.position-badge.upright {
  background: linear-gradient(145deg, var(--color-accent-light, #f0d080), var(--color-accent, #b8943e));
}

.position-badge.reversed {
  background: linear-gradient(145deg, #8b6f5e, #5c3d2e);
}

.badge-label {
  font-size: 22rpx;
  color: #fff;
  font-weight: 600;
}

@keyframes badge-pop-in {
  from { opacity: 0; transform: scale(0.4); }
  to   { opacity: 1; transform: scale(1); }
}

/* Action bar — fixed at the bottom of the overlay, never scrolls with the result panel */
.action-bar {
  flex-shrink: 0;
  display: flex;
  gap: 24rpx;
  align-items: center;
  justify-content: center;
  padding: 24rpx 24rpx calc(env(safe-area-inset-bottom, 0px) + 24rpx);
  background: linear-gradient(to top, rgba(242, 232, 208, 0.96), rgba(242, 232, 208, 0));
  z-index: 60;
  position: relative;
  min-height: 96rpx;
}

.dev-tools {
  position: absolute;
  right: 24rpx;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 160rpx);
  z-index: 80;
  width: 420rpx;
  max-width: calc(100vw - 48rpx);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(247, 240, 224, 0.9);
  border: 1rpx solid var(--color-border-strong);
  box-shadow: 0 12rpx 36rpx rgba(30, 15, 6, 0.16);
  backdrop-filter: blur(12px);
}

.dev-tools-title {
  font-size: 22rpx;
  letter-spacing: 0.16em;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.dev-tools-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  align-items: center;
}

.dev-tools-chip {
  min-width: 68rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(242, 232, 208, 0.96);
  border: 1rpx solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 22rpx;
  line-height: 1.2;
  text-align: center;
}

.dev-tools-chip.active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: rgba(184, 148, 62, 0.1);
}

.dev-tools-chip.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.dev-tools-status {
  font-size: 20rpx;
  color: var(--color-text-tertiary);
  margin-left: auto;
}

.btn {
  padding: 18rpx 40rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: linear-gradient(to bottom, #2b302a, #1a1e19);
  border-radius: 40rpx;
  border: none;
  color: #cca957;
  font-weight: bold;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--color-border-strong, #b8943e);
  color: var(--color-text-primary);
}

.revealing-hint {
  color: var(--color-accent);
  letter-spacing: 0.1em;
  font-size: 28rpx;
  opacity: 0.9;
}

.thinking-dots {
  display: inline-flex;
  gap: 2rpx;
}

.thinking-dots .dot {
  display: inline-block;
  animation: dot-pulse 1.4s infinite;
}

.thinking-dots .dot-2 { animation-delay: 0.2s; }
.thinking-dots .dot-3 { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-4rpx); }
}

.result-loading,
.result-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  gap: var(--space-4);
}

.loading-text,
.error-text {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  text-align: center;
}

/* #ifdef H5 */
@media (min-width: 768px) {
  .divination-overlay {
    --card-width: clamp(120px, 13vw, 188px);
  }
}
/* #endif */

/* #ifdef MP-WEIXIN */
@media (min-width: 768px) {
  .divination-overlay {
    --card-width: 188px;
  }
}
/* #endif */
</style>
