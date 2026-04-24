<template>
  <view
    v-if="showResults"
    class="drawer-container"
    :class="{ 'is-wide': isWide, 'is-loading': isReadingLoading }"
  >
    <view
      class="drawer-sheet"
      :style="sheetStyle"
      role="dialog"
      aria-modal="true"
      aria-label="占卜结果解读"
    >
      <!-- Drag Handle for Mobile -->
      <view
        v-if="!isWide"
        class="drag-handle-zone"
        tabindex="0"
        role="slider"
        aria-label="调整结果面板高度"
        @touchstart.stop="onDrawerTouchStart"
        @touchmove.stop.prevent="onDrawerTouchMove"
        @touchend.stop="onDrawerTouchEnd"
        @keydown="onDrawerKeydown"
      >
        <view class="drag-handle-bar"></view>
      </view>

      <!-- Content Area -->
      <scroll-view
        class="drawer-content"
        scroll-y
        enable-flex
      >
        <view class="result-inner">
          <transition name="fade-slide" mode="out-in">
            <!-- Loading State -->
            <view v-if="isReadingLoading" key="loading" class="result-loading">
              <view class="loading-spinner"></view>
              <text class="loading-text">{{ overlayText.revealing }}</text>
              <view class="thinking-dots">
                <text class="dot">.</text>
                <text class="dot">.</text>
                <text class="dot">.</text>
              </view>
            </view>

            <!-- Error State -->
            <view v-else-if="isReadingFailed" key="error" class="result-error">
              <view class="error-box">
                <text class="error-icon">⚠️</text>
                <text class="error-text">{{ readingErrorMessage }}</text>
              </view>
              <view class="btn btn-primary" @click="emit('retry')">重试读取</view>
            </view>

            <!-- Success State -->
            <ResultPanel
              v-else-if="readingResult"
              :key="resultKey"
              :reading-result="readingResult"
              :question="currentQuestion"
              @restart="emit('restart')"
            />
          </transition>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultPanel from '../ResultPanel.vue'
import type { ReadingResult } from '../../utils/tarotReading'

const props = defineProps<{
  showResults: boolean
  isWide: boolean
  isReadingLoading: boolean
  isReadingFailed: boolean
  readingErrorMessage: string
  overlayText: { revealing: string }
  readingResult: ReadingResult | null
  currentQuestion: string
}>()

const emit = defineEmits<{
  (event: 'retry'): void
  (event: 'restart'): void
}>()

// Use pixels for precise control during dragging
const drawerHeightPx = ref(0)
const isAutoHeight = ref(true)
let drawerStartY = 0
let drawerStartHeight = 0
let isDragging = false

// Max height limit (e.g., 85% of window height)
const getMaxHeight = () => {
  const { windowHeight } = uni.getWindowInfo()
  return windowHeight * 0.85
}

// Min height limit — compact initial peek so it doesn't cover drawn cards
const getMinHeight = () => {
  const { windowHeight } = uni.getWindowInfo()
  // Cap at ~20% of screen or 180px (whichever is smaller) for initial peek
  return Math.min(Math.round(windowHeight * 0.20), 180)
}

const sheetStyle = computed(() => {
  if (props.isWide) return ''
  
  const maxHeight = getMaxHeight()
  const style: Record<string, string> = {
    'max-height': `${maxHeight}px`,
  }
  
  if (isAutoHeight.value) {
    style['height'] = 'auto'
    style['min-height'] = `${getMinHeight()}px`
  } else {
    style['height'] = `${drawerHeightPx.value}px`
  }
  
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join(';')
})

const resultKey = computed(() => {
  if (!props.readingResult) return 'none'
  return `${props.readingResult.cardDetails[0]?.card.id || 'id'}-${props.readingResult.result}`
})

function onDrawerTouchStart(e: TouchEvent) {
  const query = uni.createSelectorQuery()
  query.select('.drawer-sheet').boundingClientRect(data => {
    if (Array.isArray(data)) return
    drawerStartHeight = (data as { height: number }).height
    drawerStartY = e.touches[0].clientY
    isDragging = true
    isAutoHeight.value = false
    drawerHeightPx.value = drawerStartHeight
  }).exec()
}

function onDrawerTouchMove(e: TouchEvent) {
  if (!isDragging) return
  const deltaY = e.touches[0].clientY - drawerStartY
  let newHeight = drawerStartHeight - deltaY
  
  const maxHeight = getMaxHeight()
  const minHeight = getMinHeight()
  
  if (newHeight < minHeight) newHeight = minHeight
  if (newHeight > maxHeight) newHeight = maxHeight
  
  drawerHeightPx.value = newHeight
}

function onDrawerTouchEnd() {
  isDragging = false
  // Snap to limits if close
  const maxHeight = getMaxHeight()
  if (drawerHeightPx.value > maxHeight - 30) {
    drawerHeightPx.value = maxHeight
  }
}

function onDrawerKeydown(e: KeyboardEvent) {
  const step = 40
  const maxHeight = getMaxHeight()
  const minHeight = getMinHeight()
  
  if (isAutoHeight.value) {
    isAutoHeight.value = false
    drawerHeightPx.value = getMinHeight()
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    drawerHeightPx.value = Math.min(maxHeight, drawerHeightPx.value + step)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    drawerHeightPx.value = Math.max(minHeight, drawerHeightPx.value - step)
  }
}
</script>

<style scoped>
.drawer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
}

.drawer-sheet {
  width: 100%;
  max-width: 800px;
  background: var(--color-bg-page);
  border-top-left-radius: 40rpx;
  border-top-right-radius: 40rpx;
  box-shadow: 0 -10rpx 40rpx rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transition: height 0.1s ease-out;
  overflow: hidden;
  border: 1rpx solid var(--color-border);
  margin: 0 auto;
}

.is-wide .drawer-container {
  justify-content: flex-end;
  align-items: flex-end;
}

.is-wide .drawer-sheet {
  height: 100% !important;
  max-height: 100% !important;
  width: 46%;
  max-width: none;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-left: 1rpx solid var(--color-border);
  border-top: none;
  margin: 0;
}

.drag-handle-zone {
  height: 64rpx;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  flex-shrink: 0;
}

.drag-handle-bar {
  width: 80rpx;
  height: 8rpx;
  background: var(--color-border-focus);
  border-radius: 4rpx;
  opacity: 0.5;
}

.drawer-content {
  flex: 1;
  width: 100%;
  min-height: 0;
}

.result-inner {
  padding: 0 var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
}

.result-loading {
  height: 400rpx;
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

/* Transitions */
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
