<template>
  <view class="index-page parchment-bg">
    <!-- 将所有内容包裹在一层，方便做整体的镜头推移 -->
    <view class="scene-container" :style="sceneStyle">
      <view v-if="isIdle" class="idle-view">
        <!-- 头部 -->
        <view class="header" :style="{ paddingTop: headerPaddingTop + 'px' }">
          <text class="title font-display">Scales Tarot</text>
          <text class="subtitle">命运之轨 · 星辰之语</text>
          <text class="guidance-text">轻触牌堆，聆听高维指引</text>
        </view>

        <!-- 手拨牌堆空闲区域 -->
        <view class="idle-deck-container" @click="handleDeckClick">
          <!-- 魔法阵底纹（保持微弱氛围） -->
          <view class="magic-runes-ring"></view>
          
          <!-- 空闲牌堆 -->
          <view class="idle-deck">
            <image
              v-for="i in 12"
              :key="i"
              class="tarot-card idle-card"
              :src="cardBack"
              :style="cardsStyle[i-1]"
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

    <!-- 原封不动的 DivinationOverlay -->
    <DivinationOverlay
      v-if="tarotStore.isAnimating || tarotStore.isResultVisible"
      @restart="restartDivination"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'
import DivinationOverlay from '../../components/DivinationOverlay.vue'
import { useTarotStore } from '../../stores/tarot'
import { CARD_BACK_IMAGE as cardBack } from '../../constants'

const tarotStore = useTarotStore()
const isIdle = computed(() => tarotStore.isIdle)

const headerPaddingTop = ref(20)
const hintOpacity = ref(0)
const sceneStyle = ref('')

// 牌组状态
const cardsStyle = ref<string[]>(Array(12).fill(''))
const _cards = Array(12).fill(0).map(() => ({ x: 0, y: 0, rotation: 0, scale: 1 }))
let idleTimeline: gsap.core.Timeline | null = null

let winWidth = 375
let winHeight = 667

function updateCardsStyle() {
  cardsStyle.value = _cards.map(c => `transform: translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.rotation}deg) scale(${c.scale});`)
}

function calculateLayout() {
  try {
    const winInfo = uni.getWindowInfo()
    winWidth = winInfo.windowWidth
    winHeight = winInfo.windowHeight
    // #ifdef MP-WEIXIN
    const menuButtonRect = uni.getMenuButtonBoundingClientRect()
    headerPaddingTop.value = menuButtonRect.bottom + 8
    // #endif
  } catch (e) {
    headerPaddingTop.value = 20
  }
}

function initEntranceAnimation() {
  gsap.fromTo('.header text', 
    { y: 20, opacity: 0 }, 
    { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'back.out(1.2)' }
  )
  
  const _hint = { opacity: 0 }
  gsap.to(_hint, {
    opacity: 0.6,
    duration: 0.8,
    delay: 0.6,
    onUpdate: () => { hintOpacity.value = _hint.opacity }
  })
  
  sceneStyle.value = '' // Reset camera shift
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

  idleTimeline = gsap.timeline({ repeat: -1 })

  // 动画：类似扇形散开
  idleTimeline.to(_cards, {
    duration: 1.0,
    ease: 'power2.inOut',
    x: (i) => {
      // 计算：假设中心牌 (索引 5 或 6) x 为 0，向左向右散开
      const offset = i - 5.5
      return offset * 15 // 每张牌横向间隔 15px
    },
    y: (i) => {
      // 形成一个略微的拱形
      const offset = i - 5.5
      return Math.abs(offset) * 4 // 两侧的牌略微下沉
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

function handleDeckClick() {
  if (idleTimeline) {
    idleTimeline.kill()
    idleTimeline = null
  }

  // 1. 快速把散开的牌收拢，同时放大背景模拟镜头推进
  gsap.to(_cards, {
    duration: 0.3,
    ease: 'power2.out',
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    onUpdate: updateCardsStyle,
    onComplete: () => {
      // 2. 镜头向空白区域推移放大（模拟牌堆下落前的准备）
      const _scene = { scale: 1, y: 0, opacity: 1 }
      gsap.to(_scene, {
        scale: 1.5,
        y: winHeight * 0.2, // 镜头向空白区域平移
        opacity: 0,         // 顺势淡出首页元素
        duration: 0.8,
        ease: 'power2.in',
        onUpdate: () => {
          sceneStyle.value = `transform: scale(${_scene.scale}) translateY(${_scene.y}px); opacity: ${_scene.opacity};`
        },
        onComplete: () => {
          // 3. 衔接下一段动画：启动占卜，原版的卡牌落下动画将顺理成章地出现
          tarotStore.startDivination('')
        }
      })
    }
  })
}

function restartDivination() {
  tarotStore.reset()
  nextTick(() => {
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
    sceneStyle.value = ''
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
  if (idleTimeline) {
    idleTimeline.kill()
  }
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
  will-change: transform, opacity;
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
  will-change: transform;
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

/* 魔法阵底纹（保持极其微弱的质感） */
.magic-runes-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 580rpx;
  height: 580rpx;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2rpx solid var(--color-border);
  box-shadow: inset 0 0 60rpx var(--color-bg-sunken), 0 0 60rpx var(--color-bg-sunken);
  pointer-events: none;
  opacity: 0.3;
}

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
</style>
