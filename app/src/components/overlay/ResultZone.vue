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
import { ref, computed, watch } from 'vue'
import ResultPanel from '../ResultPanel.vue'
import type { ReadingResult } from '../../utils/tarotReading'
import { RESULT_SHEET_FRACTION } from '../../core/config/layout_constants'

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

// Max height limit (85% of window height)
const getMaxHeight = () => {
  const { windowHeight } = uni.getWindowInfo()
  return windowHeight * 0.85
}

// Initial height aligned with the stage-reserved bottom-sheet space (RESULT_SHEET_FRACTION)
// so the revealed cards remain fully visible above the drawer. Manual drag may enlarge.
const getInitialHeight = () => {
  const { windowHeight } = uni.getWindowInfo()
  // Use full reserved space minus 8px breathing room to keep cards fully visible.
  return Math.max(getMinHeight(), Math.round(windowHeight * RESULT_SHEET_FRACTION) - 8)
}

// Min height limit — enough for drag handle + loading text
const getMinHeight = () => {
  return 120
}

// Reset drawer state when results toggle
watch(() => props.showResults, (newVal) => {
  if (newVal) {
    isAutoHeight.value = false
    drawerHeightPx.value = getInitialHeight()
  } else {
    isAutoHeight.value = true
    drawerHeightPx.value = 0
  }
})


const sheetStyle = computed(() => {
  if (props.isWide) return ''
  
  const maxHeight = getMaxHeight()
  const minHeight = getMinHeight()
  const height = isAutoHeight.value
    ? getInitialHeight()
    : Math.max(minHeight, Math.min(drawerHeightPx.value, maxHeight))

  return `height: ${height}px; max-height: ${maxHeight}px`
})

const resultKey = computed(() => {
  if (!props.readingResult) return 'none'
  return `${props.readingResult.cardDetails[0]?.card.id || 'id'}-${props.readingResult.result}`
})

function onDrawerTouchStart(e: TouchEvent) {
  drawerStartY = e.touches[0].clientY
  // Read current height synchronously from the ref (avoid async jank)
  drawerStartHeight = drawerHeightPx.value || getInitialHeight()
  isDragging = true
  isAutoHeight.value = false
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
  const minHeight = getMinHeight()
  if (drawerHeightPx.value > maxHeight - 30) {
    drawerHeightPx.value = maxHeight
  }
  if (drawerHeightPx.value < minHeight + 30) {
    drawerHeightPx.value = minHeight
  }
}

function onDrawerKeydown(e: KeyboardEvent) {
  const step = 40
  const maxHeight = getMaxHeight()
  const minHeight = getMinHeight()
  
  if (isAutoHeight.value) {
    isAutoHeight.value = false
    drawerHeightPx.value = getInitialHeight()
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
  transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border: 1rpx solid var(--color-border);
  margin: 0 auto;
  /* Establish a named container so descendants can size text against the
     drawer's actual inline width (cqi) instead of the viewport. On wide
     layouts the drawer is only 46% of the viewport, so viewport-based
     clamps misjudged the readable column. */
  container: result-drawer / inline-size;
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
  transition: none;
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
  overflow: hidden;
}

.result-inner {
  padding: 0 var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
}

.result-loading {
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
