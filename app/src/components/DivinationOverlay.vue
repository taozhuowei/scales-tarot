<template>
  <view
    class="divination-overlay"
    :class="{
      'show-results': controller.showResults.value,
      'is-wide': isWide,
    }"
    :style="controller.overlayVarsStyle.value"
    :ref="setOverlayRef"
    @keydown="handleOverlayKeydown"
    role="dialog"
    aria-modal="true"
    aria-label="占卜 overlay"
    tabindex="-1"
  >
    <view class="overlay-bg" :style="controller.bgStyle.value" />

    <!-- Screen-reader announcement for phase changes -->
    <view
      class="sr-only"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {{ phaseAnnouncement }}
    </view>

    <!-- Main flex column: stage on top (or left on wide) + result panel below (or right on wide) -->
    <view class="overlay-main">
      <view class="stage-container">
        <ProgressHeader
          :header-style="controller.headerStyle.value"
          :phase-steps="controller.phaseSteps.value"
          :get-phase-step-icon-src="getPhaseStepIconSrc"
        />

        <view class="stage" :style="controller.stageStyle.value">
          <view class="deck-layer stage-pointer" :style="controller.deckCtnStyle.value">
            <image
              v-for="i in controller.deckCount"
              :key="`m${i}`"
              class="tarot-card stack-card initial-deck"
              :src="controller.cardBack.value"
              :style="controller.initialsStyle.value[i-1]"
              alt="塔罗牌背面"
              lazy-load
            />
            <image
              v-for="i in controller.shuffleHalfCount"
              :key="`l${i}`"
              v-show="controller.leftsVisible.value"
              class="tarot-card stack-card"
              :src="controller.cardBack.value"
              :style="controller.leftsStyle.value[i-1]"
              alt="塔罗牌背面"
              lazy-load
            />
            <image
              v-for="i in controller.shuffleHalfCount"
              :key="`r${i}`"
              v-show="controller.rightsVisible.value"
              class="tarot-card stack-card"
              :src="controller.cardBack.value"
              :style="controller.rightsStyle.value[i-1]"
              alt="塔罗牌背面"
              lazy-load
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
              :style="`top: ${-(cIdx - 1) * 2.5}px; left: ${(cIdx - 1) * 0.8}px; z-index: ${cIdx};`"
              alt="切牌堆"
              lazy-load
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
                  <image class="tarot-card face-back" :src="controller.cardBack.value" alt="塔罗牌背面" />
                  <view class="tarot-card face-front">
                    <image class="front-img" :src="controller.getCardImg(idx)" :alt="controller.getCardImgName(idx) ?? '塔罗牌'" lazy-load />
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
    </view>

    <ResultZone
      class="overlay-result-zone"
      :show-results="controller.showResults.value"
      :is-wide="isWide"
      :is-reading-loading="controller.isReadingLoading.value"
      :is-reading-failed="controller.isReadingFailed.value"
      :reading-error-message="controller.readingErrorMessage.value"
      :overlay-text="controller.overlayText"
      :reading-result="tarotStore.readingResult"
      :current-question="tarotStore.currentQuestion"
      @retry="handleRetry"
      @restart="handleRestart"
    />

    <ActionBar
      :show-results="controller.showResults.value"
      :phase="controller.phase.value"
      :is-reading-failed="controller.isReadingFailed.value"
      :overlay-text="controller.overlayText"
      @back-home="handleBackHome"
      @restart="handleRestart"
      @retry="handleRetry"
    />

    <!-- Dev Tools -->
    <view v-if="isDev" class="dev-tools">
      <view class="dev-tools-header" @click="isDevExpanded = !isDevExpanded">
        <text class="dev-tools-title">Dev Tools</text>
        <text class="dev-tools-toggle">{{ isDevExpanded ? '▲' : '▼' }}</text>
      </view>

      <view v-show="isDevExpanded">
        <view class="dev-tools-row">
          <view
            v-for="step in phaseStepsForDev"
            :key="`replay-${step.phase}`"
            class="dev-tools-chip"
            role="button"
            tabindex="0"
            :aria-label="`重播 ${step.label}`"
            @click="handleReplay(step.phase)"
            @keydown.enter="handleReplay(step.phase)"
            @keydown.space.prevent="handleReplay(step.phase)"
          >
            {{ step.label }}
          </view>
        </view>

        <view class="dev-tools-row">
          <view
            class="dev-tools-chip"
            role="button"
            tabindex="0"
            aria-label="跳到解读"
            @click="controller.skipToReading()"
            @keydown.enter="controller.skipToReading()"
            @keydown.space.prevent="controller.skipToReading()"
          >
            直接解读
          </view>
          <view
            v-for="speed in playbackRates"
            :key="`speed-${speed}`"
            class="dev-tools-chip"
            :class="{ active: controller.playbackRate.value === speed }"
            role="button"
            tabindex="0"
            :aria-label="`播放速度 ${speed}x`"
            @click="handlePlaybackRate(speed)"
            @keydown.enter="handlePlaybackRate(speed)"
            @keydown.space.prevent="handlePlaybackRate(speed)"
          >
            {{ speed }}x
          </view>
        </view>

        <view class="dev-tools-row">
          <view
            class="dev-tools-chip"
            role="button"
            tabindex="0"
            aria-label="暂停"
            @click="handlePause"
            @keydown.enter="handlePause"
            @keydown.space.prevent="handlePause"
          >
            暂停
          </view>
          <view
            class="dev-tools-chip"
            role="button"
            tabindex="0"
            aria-label="继续"
            @click="handleResume"
            @keydown.enter="handleResume"
            @keydown.space.prevent="handleResume"
          >
            继续
          </view>
          <view
            class="dev-tools-chip"
            :class="{ disabled: !controller.isPaused.value }"
            role="button"
            tabindex="0"
            aria-label="后退一步"
            @click="controller.isPaused.value && handleStepBackward()"
            @keydown.enter="controller.isPaused.value && handleStepBackward()"
            @keydown.space.prevent="controller.isPaused.value && handleStepBackward()"
          >
            ←
          </view>
          <view
            class="dev-tools-chip"
            :class="{ disabled: !controller.isPaused.value }"
            role="button"
            tabindex="0"
            aria-label="前进一步"
            @click="controller.isPaused.value && handleStepForward()"
            @keydown.enter="controller.isPaused.value && handleStepForward()"
            @keydown.space.prevent="controller.isPaused.value && handleStepForward()"
          >
            →
          </view>
          <text class="dev-tools-status">
            {{ controller.isPaused.value ? 'Paused' : `Running ${controller.playbackRate.value}x` }}
          </text>
        </view>

        <view class="dev-tools-row">
          <view
            class="dev-tools-chip"
            :class="{ active: showSafeFrame }"
            role="button"
            tabindex="0"
            aria-label="显示安全区"
            @click="showSafeFrame = !showSafeFrame"
            @keydown.enter="showSafeFrame = !showSafeFrame"
            @keydown.space.prevent="showSafeFrame = !showSafeFrame"
          >
            安全区
          </view>
        </view>
      </view>
    </view>

    <!-- Safe Frame Debug Overlay -->
    <view v-if="showSafeFrame" class="safe-frame-debug" :style="safeFrameStyle" />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useTarotStore } from '../stores/tarot'
import { useThemeStore } from '../stores/theme'
import ProgressHeader from './overlay/ProgressHeader.vue'
import ResultZone from './overlay/ResultZone.vue'
import ActionBar from './overlay/ActionBar.vue'
import { getSpreadCardCount } from '../core/layout/spread_registry'
import { trapFocus, getFocusableElements } from '../utils/accessibility'
import { useOverlayController } from '../composables/use_overlay_controller'
import { getPhaseStep, PHASE_STEPS } from '../animation/orchestration/phase_registry'
import type { OverlayPhase } from '../core/flow/types'

const emit = defineEmits<{
  (event: 'complete'): void
  (event: 'restart'): void
  (event: 'backHome'): void
}>()

const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const isDev = import.meta.env.DEV
const isDevExpanded = ref(true)
const showSafeFrame = ref(false)
const playbackRates = [0.25, 0.5, 1, 2] as const

const isWide = ref(false)
const cardCount = computed(() => getSpreadCardCount(tarotStore.spreadKind))

function updateIsWide() {
  const { windowWidth } = uni.getWindowInfo()
  isWide.value = windowWidth >= 768
}

updateIsWide()
uni.onWindowResize(updateIsWide)

interface PhaseStepPresentation {
  phase: OverlayPhase
  isActive: boolean
  isCompleted: boolean
}

function getPhaseStepIconSrc(step: PhaseStepPresentation): string {
  const phaseStep = getPhaseStep(step.phase)
  if (!phaseStep) return ''
  const preferActive = step.isActive || step.isCompleted
  const primary = preferActive ? phaseStep.activeIcon : phaseStep.inactiveIcon
  const fallback = preferActive ? phaseStep.inactiveIcon : phaseStep.activeIcon
  return themeStore.getUiAsset(primary) || themeStore.getUiAsset(fallback)
}

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

const PHASE_LABELS: Record<string, string> = {
  shuffling: '正在洗牌',
  cutting: '正在切牌',
  drawing: '正在抽牌',
  revealing: '神谕显现中',
}

const safeFrameStyle = computed(() => {
  if (!showSafeFrame.value) return {}
  const layout = controller.getSceneLayout?.('draw_stage')
  if (!layout) return {}
  return {
    position: 'absolute',
    left: `${layout.safeSideInset}px`,
    top: `${layout.safeTopInset}px`,
    width: `calc(100% - ${layout.safeSideInset * 2}px)`,
    height: `calc(100% - ${layout.safeTopInset + layout.safeBottomInset}px)`,
    border: '2px dashed red',
    pointerEvents: 'none',
    zIndex: '9999',
    boxSizing: 'border-box',
  } as Record<string, string>
})

const phaseAnnouncement = computed(() => {
  const label = PHASE_LABELS[controller.phase.value]
  return label ? `当前阶段：${label}` : ''
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

/* eslint-disable no-undef -- reason: HTMLElement type in H5 runtime */
const overlayRef = ref<HTMLElement | null>(null)
let previousFocusEl: Element | null = null

function setOverlayRef(el: unknown) {
  overlayRef.value = el as HTMLElement | null
}

function handleOverlayKeydown(e: KeyboardEvent) {
  /* eslint-enable no-undef */
  if (!overlayRef.value) return
  trapFocus(overlayRef.value, e)
}

onMounted(() => {
  /* eslint-disable no-restricted-globals, no-undef -- reason: H5 DOM API (document.activeElement) */
  previousFocusEl = document.activeElement
  /* eslint-enable no-restricted-globals, no-undef */
  nextTick(() => {
    if (overlayRef.value) {
      const focusable = getFocusableElements(overlayRef.value)
      if (focusable.length > 0) focusable[0].focus()
    }
  })
})

onUnmounted(() => {
  /* eslint-disable no-restricted-globals, no-undef -- reason: H5 DOM API (HTMLElement.focus) */
  if (previousFocusEl instanceof HTMLElement) previousFocusEl.focus()
  /* eslint-enable no-restricted-globals, no-undef */
})

</script>

<style scoped>
.divination-overlay {
  --card-focus-scale: 1;
  --color-overlay-bg: rgba(242, 232, 208, 0.97);
  --color-overlay-bg-fade: rgba(242, 232, 208, 0.96);
  --color-overlay-bg-transparent: rgba(242, 232, 208, 0);
  --color-btn-primary-from: #2b302a;
  --color-btn-primary-to: #1a1e19;
  --color-btn-primary-text: #cca957;
  --color-badge-reversed-from: #8b6f5e;
  --color-badge-reversed-to: #5c3d2e;

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

.overlay-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: -1;
  background: var(--color-overlay-bg);
}

/* Main flex region — stage always fills the full height; result sheet is overlaid. */
.overlay-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.stage-container {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  transition: width 0.52s cubic-bezier(0.32, 0.72, 0, 1);
}

.is-wide.show-results .stage-container {
  width: 54%;
}

.overlay-result-zone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000; /* Extremely high to beat any 3D layers */
  pointer-events: none;
}

.progress-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 20;
}

/* #ifdef H5 */
.progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 60rpx);
}
/* #endif */

/* #ifdef MP-WEIXIN */
.progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 140rpx);
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
  transform: translateY(0);
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}

.show-results .draw-container {
  transform: translateY(calc(-1 * var(--result-card-lift-y, 0px)));
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
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
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
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.25);
  z-index: 30;
  animation: badge-pop-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.position-badge.upright {
  background: linear-gradient(145deg, var(--color-accent-light, #f0d080), var(--color-accent, #b8943e));
}

.position-badge.reversed {
  background: linear-gradient(145deg, var(--color-badge-reversed-from), var(--color-badge-reversed-to));
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

/* Action bar — floats above both the stage and the result sheet. */
.action-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 24rpx;
  align-items: center;
  justify-content: center;
  padding: 24rpx 24rpx calc(env(safe-area-inset-bottom, 0px) + 24rpx);
  background: linear-gradient(to top, var(--color-overlay-bg-fade), var(--color-overlay-bg-transparent));
  z-index: 70;
  min-height: 96rpx;
  pointer-events: none;
}

.action-bar > * {
  pointer-events: auto;
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
  background: rgba(247, 240, 224, 1);
  border: 1rpx solid var(--color-border-strong);
  box-shadow: 0 12rpx 36rpx rgba(30, 15, 6, 0.16);
}

.dev-tools-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.dev-tools-title {
  font-size: 22rpx;
  letter-spacing: 0.16em;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.dev-tools-toggle {
  font-size: 18rpx;
  color: var(--color-text-secondary);
  line-height: 1;
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
  background: var(--color-overlay-bg-fade);
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
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: linear-gradient(to bottom, var(--color-btn-primary-from), var(--color-btn-primary-to));
  border-radius: 40rpx;
  border: none;
  color: var(--color-btn-primary-text);
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

.loading-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.loading-spinner {
  width: 24rpx;
  height: 24rpx;
  border: 2rpx solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-no-bg);
  border-radius: 12rpx;
  padding: var(--space-4);
}

.error-icon {
  font-size: 40rpx;
  line-height: 1;
}

.error-text {
  color: var(--color-no);
  font-weight: 500;
}

.safe-frame-debug {
  position: absolute;
  border: 2px dashed red;
  pointer-events: none;
  z-index: 9999;
}

@media (prefers-reduced-motion: reduce) {
  .card-focus-frame,
  .result-zone,
  .result-hero,
  .meaning-list,
  .position-badge {
    transition: none !important;
    animation: none !important;
  }
}
</style>
