<template>
  <view class="index-page parchment-bg">
    <!-- 将所有内容包裹在一层，方便做整体的镜头推移 -->
    <view class="scene-container" :style="sceneStyle">
      <view v-if="cardsLoadError" class="idle-view error-view">
        <view class="header" :style="{ paddingTop: headerPaddingTop + 'px' }">
          <text class="title font-display">Scales Tarot</text>
          <text class="subtitle">星盘感应受阻</text>
          <text class="guidance-text">请检查网络连接</text>
          <text v-if="cardsLoadError" class="error-detail">{{ cardsLoadError }}</text>
        </view>
        <view class="error-body">
          <view
            class="btn btn-primary"
            :class="{ disabled: isCardsLoading }"
            @click="retryLoadCards"
          >
            {{ isCardsLoading ? '感应中...' : '重新感应' }}
          </view>
        </view>
      </view>
      <view v-if="isIdle && !cardsLoadError" class="idle-view">
        <!-- Header -->
        <view class="header" :style="{ paddingTop: headerPaddingTop + 'px' }">
          <text class="title font-display" :style="titleStyle">Scales Tarot</text>
          <text class="subtitle" :style="subtitleStyle">命运之轨 · 星辰之语</text>
          <text class="guidance-text" :style="guidanceStyle">轻触牌堆，聆听高维指引</text>
        </view>

        <!-- 手拨牌堆空闲区域 -->
        <view
          class="idle-deck-container"
          role="button"
          tabindex="0"
          aria-label="开始占卜"
          @click="handleDeckClick"
          @keydown.enter="handleDeckClick"
          @keydown.space.prevent="handleDeckClick"
        >
          <!-- 空闲牌堆 -->
          <view class="idle-deck">
            <image
              v-for="i in 12"
              :key="i"
              class="tarot-card idle-card"
              :src="cardBack"
              :style="cardsStyle[i-1]"
              role="img"
              aria-label="塔罗牌背面"
              lazy-load
            />
          </view>
        </view>

        <!-- 底部提示 -->
        <view class="touch-hint" :style="{ opacity: hintOpacity }">
          <view class="hint-line"></view>
          <text class="hint-text font-display">TOUCH TO DIVINE</text>
          <view class="hint-line"></view>
        </view>
      </view>

      <!-- 角落装饰 -->
      <view class="corner-decoration corner-tl"></view>
      <view class="corner-decoration corner-tr"></view>
      <view class="corner-decoration corner-bl"></view>
      <view class="corner-decoration corner-br"></view>
    </view>

    <DivinationOverlay
      v-if="tarotStore.isAnimating || tarotStore.isResultVisible"
      @restart="restartDivination"
      @back-home="restartDivination"
    />

    <view class="landscape-hint">
      <text class="landscape-hint-text">请将设备旋转至竖屏</text>
      <text class="landscape-hint-text">以获得最佳体验</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted } from 'vue'
// Tree-shaking note: this resolves to gsap-core.js via Vite alias, which is
// already the minimal build without CSSPlugin/DOM-only APIs. Individual
// function exports (to, timeline, killTweensOf) are not available from
// gsap-core. Issue mitigated by gsap-core alias.
import { gsap } from 'gsap'
import DivinationOverlay from '../../components/DivinationOverlay.vue'
import { useTarotStore } from '../../stores/tarot'
import { useThemeStore } from '../../stores/theme'
import { prefersReducedMotion } from '../../utils/accessibility'

const DECK_CLICK_SAFETY_MS = 2000
const DECK_CLICK_RELEASE_MS = 300

const tarotStore = useTarotStore()
const themeStore = useThemeStore()

// All assets are served by the API; while the theme is still loading these
// resolve to empty strings and the tags just don't render an image.
const cardBack = computed(() => themeStore.cardBackImage)
const isIdle = computed(() => tarotStore.isIdle)
const cardsLoadError = computed(() => tarotStore.cardsLoadError)
const isCardsLoading = computed(() => tarotStore.isCardsLoading)
function retryLoadCards() { tarotStore.loadCards() }

const headerPaddingTop = ref(20)
const hintOpacity = ref(0)
const sceneStyle = ref<Record<string, string>>({})

// Header text animation styles - reactive refs bound to :style
const titleStyle = ref<Record<string, string>>({})
const subtitleStyle = ref<Record<string, string>>({})
const guidanceStyle = ref<Record<string, string>>({})

// Plain JS state objects for GSAP animation (DOM-free for WeChat Mini Program compatibility)
const _title = { y: 20, opacity: 0 }
const _subtitle = { y: 20, opacity: 0 }
const _guidance = { y: 20, opacity: 0 }

// Serialize animation state to CSS transform strings
function updateHeaderStyles() {
  titleStyle.value = { transform: `translateY(${_title.y}px)`, opacity: String(_title.opacity) }
  subtitleStyle.value = { transform: `translateY(${_subtitle.y}px)`, opacity: String(_subtitle.opacity) }
  guidanceStyle.value = { transform: `translateY(${_guidance.y}px)`, opacity: String(_guidance.opacity) }
}

// 牌组状态
const cardsStyle = ref<Record<string, string>[]>(Array(12).fill({}))
const _cards = Array(12).fill(0).map(() => ({ x: 0, y: 0, rotation: 0, scale: 1 }))
let _cardsAnimating = false
let idleTimeline: gsap.core.Timeline | null = null
const _scene = { scale: 1, y: 0, opacity: 1 }
const _hint = { opacity: 0 }

let winHeight = 667

function updateCardsStyle() {
  cardsStyle.value = _cards.map(c => ({ transform: `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.rotation}deg) scale(${c.scale})`, willChange: _cardsAnimating ? "transform" : "auto" }))
}

function calculateLayout() {
  try {
    const winInfo = uni.getWindowInfo()
    winHeight = winInfo.windowHeight
    // #ifdef H5
    headerPaddingTop.value = Math.max(20, winInfo.safeArea?.top || 20)
    // #endif
    // #ifdef MP-WEIXIN
    const menuButtonRect = uni.getMenuButtonBoundingClientRect()
    headerPaddingTop.value = menuButtonRect.bottom + 8
    // #endif
  } catch {
    headerPaddingTop.value = 20
  }
}

function initEntranceAnimation() {
  // Reset header text state
  _title.y = 20; _title.opacity = 0
  _subtitle.y = 20; _subtitle.opacity = 0
  _guidance.y = 20; _guidance.opacity = 0
  updateHeaderStyles()

  if (prefersReducedMotion()) {
    _title.y = 0; _title.opacity = 1
    _subtitle.y = 0; _subtitle.opacity = 1
    _guidance.y = 0; _guidance.opacity = 1
    updateHeaderStyles()
    hintOpacity.value = 0.6
    sceneStyle.value = {}
    startDeckAnimation()
    return
  }

  // Animate header text elements using DOM-free pattern (WeChat Mini Program compatible)
  const headerTimeline = gsap.timeline()
  headerTimeline
    .to(_title, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', onUpdate: updateHeaderStyles })
    .to(_subtitle, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', onUpdate: updateHeaderStyles }, 0.08)
    .to(_guidance, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', onUpdate: updateHeaderStyles }, 0.16)

  // Animate touch hint - already uses correct DOM-free pattern
  _hint.opacity = 0
  gsap.to(_hint, {
    opacity: 0.6,
    duration: 0.8,
    delay: 0.6,
    onUpdate: () => { hintOpacity.value = _hint.opacity }
  })

  sceneStyle.value = {} // Reset camera shift
  startDeckAnimation()
}

function startDeckAnimation() {
  if (idleTimeline) idleTimeline.kill()

  // 初始状态，所有牌居中成一叠
  _cards.forEach(c => {
    c.x = 0;
    c.y = 0;
    c.rotation = 0;
    c.scale = 1
  })
  updateCardsStyle()

  if (prefersReducedMotion()) {
    return
  }

  _cardsAnimating = true
  idleTimeline = gsap.timeline({ repeat: -1 })

  // 动画：类似扇形散开
  idleTimeline.to(_cards, {
    duration: 1.0,
    ease: 'power2.inOut',
    x: (i) => {
      // 计算：假设中心牌 (索引 5 或 6) x 为 0，向左向右散开
      const offset = i - 5.5
      return offset * 10 // 每张牌横向间隔保持固定，不再随屏幕宽度缩放
    },
    y: (i) => {
      // 形成一个略微的拱形
      const offset = i - 5.5
      return Math.abs(offset) * 2.5 // 两侧的牌略微下沉，保持固定
    },
    rotation: (i) => {
      // 扇形旋转，中心牌 0 度，两侧对称旋转
      const offset = i - 5.5
      return offset * 8 // 每张牌相差 8 度
    },
    onUpdate: updateCardsStyle
  })

  // 展现扇形停顿
  idleTimeline.to({}, { duration: 1.5 })

  // 收拢回牌堆
  idleTimeline.to(_cards, {
    duration: 1.0,
    ease: 'power2.inOut',
    x: 0,
    y: 0,
    rotation: 0,
    onUpdate: updateCardsStyle
  })

  // 收拢后停顿
  idleTimeline.to({}, { duration: 1.0 })
}

const isStartingDivination = ref(false)

function handleDeckClick() {
  // Prevent double-trigger during transition with a reactive lock + debounce
  if (isStartingDivination.value || tarotStore.isAnimating) return
  isStartingDivination.value = true

  // Safety release: ensure the lock is always cleared even if animations are interrupted.
  const safetyTimer = setTimeout(() => {
    isStartingDivination.value = false
  }, DECK_CLICK_SAFETY_MS)

  // Auto-release lock after animations settle to prevent stale state
  const releaseLock = () => {
    clearTimeout(safetyTimer)
    setTimeout(() => {
      isStartingDivination.value = false
    }, DECK_CLICK_RELEASE_MS)
  }

  // Start divination immediately - don't wait for animations
  tarotStore.startDivination('')

  if (idleTimeline) {
    idleTimeline.kill()
    idleTimeline = null
  }
  _cardsAnimating = false
  updateCardsStyle()

  // Animations run in parallel without blocking startDivination
  if (prefersReducedMotion()) {
    sceneStyle.value = { opacity: '0' }
    releaseLock()
    return
  }

  gsap.to(_cards, {
    duration: 0.3,
    ease: 'power2.out',
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    onUpdate: updateCardsStyle,
    onComplete: () => {
      _scene.scale = 1; _scene.y = 0; _scene.opacity = 1
      gsap.to(_scene, {
        scale: 1.5,
        y: winHeight * 0.2,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.in',
        onUpdate: () => {
          sceneStyle.value = { transform: `scale(${_scene.scale}) translateY(${_scene.y}px)`, opacity: String(_scene.opacity), willChange: "transform, opacity" }
        },
        onComplete: () => { sceneStyle.value = { ...sceneStyle.value, willChange: "auto" }; releaseLock() },
      })
    },
  })
}

function restartDivination() {
  isStartingDivination.value = false
  tarotStore.reset()
  nextTick(() => {
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
    sceneStyle.value = {}
    hintOpacity.value = 0
    setTimeout(initEntranceAnimation, 50)
  })
}

onMounted(() => {
  calculateLayout()
  uni.onWindowResize(calculateLayout)
  nextTick(() => {
    setTimeout(initEntranceAnimation, 100)
  })
})

onUnmounted(() => {
  uni.offWindowResize(calculateLayout)
  gsap.killTweensOf(_cards)
  gsap.killTweensOf(_scene)
  gsap.killTweensOf(_hint)
  if (idleTimeline) {
    idleTimeline.kill()
    idleTimeline = null
  }
  _cardsAnimating = false
  updateCardsStyle()
})
</script>

<style scoped>
.index-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.scene-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  z-index: 10;
  transform-origin: center center;
}

.idle-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 头部排版 */
.header {
  padding: 0 40rpx 20rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}

.title {
  font-size: 64rpx;
  color: var(--color-text-primary);
  letter-spacing: 0.18em;
  text-shadow: 0 4rpx 12rpx rgba(74, 37, 16, 0.1);
}

.subtitle {
  font-size: 24rpx;
  color: var(--color-text-secondary);
  letter-spacing: 0.35em;
  text-transform: uppercase;
}

.guidance-text {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
}

.error-detail {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: var(--color-no);
  letter-spacing: 0.04em;
  max-width: 80%;
  text-align: center;
  word-break: break-word;
}

.btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* =========================================
   自适应的牌堆容器
   ========================================= */
.idle-deck-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.idle-deck {
  position: relative;
  /* 使用自适应的尺寸，确保不会太大遮挡标题 */
  width: clamp(80px, 18vw, 120px);
  height: calc(clamp(80px, 18vw, 120px) * 1.6);
  z-index: 10;
}

.tarot-card {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
  border: 1px solid var(--color-border);
}

.idle-card {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: 0 2rpx 8rpx rgba(30, 15, 6, 0.3);
}

/* 为最底下的牌增加更深的阴影 */
/* #ifdef H5 */
.idle-card:first-child {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}
/* #endif */

/* =========================================
   UI 装饰与交互提示
   ========================================= */
.touch-hint {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 80rpx);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  pointer-events: none;
}

.hint-line {
  width: 50rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, var(--color-border-strong), transparent);
}

.hint-text {
  font-size: 20rpx;
  color: var(--color-text-muted);
  letter-spacing: 0.25em;
}

/* 四角神秘点缀 */
.corner-decoration {
  position: absolute;
  width: 60rpx;
  height: 60rpx;
  border: 2rpx solid var(--color-border-strong);
  pointer-events: none;
  z-index: 1;
}

.corner-tl { top: 30rpx; left: 30rpx; border-right: none; border-bottom: none; }
.corner-tr { top: 30rpx; right: 30rpx; border-left: none; border-bottom: none; }
.corner-bl { bottom: 30rpx; left: 30rpx; border-right: none; border-top: none; }
.corner-br { bottom: 30rpx; right: 30rpx; border-left: none; border-top: none; }

.error-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .idle-card,
  .corner-decoration,
  .touch-hint {
    transition: none !important;
    animation: none !important;
  }
}

.landscape-hint {
  display: none;
}

@media (orientation: landscape) and (max-width: 1023px) {
  .landscape-hint {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(242, 232, 208, 0.98);
    z-index: 9999;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 24rpx;
  }
  .landscape-hint-text {
    font-size: 32rpx;
    color: var(--color-text-primary);
    text-align: center;
  }
}

</style>
