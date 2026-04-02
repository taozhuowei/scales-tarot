<template>
  <view class="divination-overlay" :class="{ 'show-results': showResults, 'is-wide': isWide }" ref="overlayRef">
    <view class="overlay-bg" ref="overlayBgRef" />

    <!-- 动画区：始终存在，结果展示后收缩到上方/左侧 -->
    <view class="stage-container">
      <view class="progress-header" ref="headerRef">
        <view class="stars">
          <image
            class="star"
            :class="{ active: isS1Active, blink: isS1Blink }"
            :src="isS1Active ? '/static/themes/golden_dawn/ui/star_active.svg' : '/static/themes/golden_dawn/ui/star_inactive.svg'"
          />
          <view class="star-line" />
          <image
            class="star"
            :class="{ active: isS2Active, blink: isS2Blink }"
            :src="isS2Active ? '/static/themes/golden_dawn/ui/star_active.svg' : '/static/themes/golden_dawn/ui/star_inactive.svg'"
          />
          <view class="star-line" />
          <image
            class="star"
            :class="{ active: isS3Active, blink: isS3Blink }"
            :src="isS3Active ? '/static/themes/golden_dawn/ui/star_active.svg' : '/static/themes/golden_dawn/ui/star_inactive.svg'"
          />
        </view>
        <text class="phase-prompt font-display">{{ phasePrompt }}</text>
      </view>

      <view class="stage" ref="stageRef">
        <view class="deck-layer">
          <image
            v-for="i in 6"
            :key="`m${i}`"
            class="tarot-card stack-card initial-deck"
            :ref="(el) => setRef(el, initialDeckRefs, i - 1)"
            :src="cardBack"
            :style="{ transform: `translateY(${-i * 1.2}px)` }"
          />

          <image
            v-for="i in 2"
            :key="`l${i}`"
            class="tarot-card stack-card hidden-element"
            :ref="(el) => setRef(el, leftDeckRefs, i - 1)"
            :src="cardBack"
          />
          <image
            v-for="i in 2"
            :key="`r${i}`"
            class="tarot-card stack-card hidden-element"
            :ref="(el) => setRef(el, rightDeckRefs, i - 1)"
            :src="cardBack"
          />
        </view>

        <image class="tarot-card hidden-element stage-center cut-t" ref="cutTopRef" :src="cardBack" />
        <image class="tarot-card hidden-element stage-center cut-m" ref="cutMidRef" :src="cardBack" />
        <image class="tarot-card hidden-element stage-center cut-b" ref="cutBotRef" :src="cardBack" />

        <view class="draw-container" ref="drawStageRef">
          <view
            v-for="idx in [0, 1, 2]"
            :key="idx"
            class="draw-wrapper hidden-element stage-center"
            :ref="(el) => setRef(el, drawRefs, idx)"
          >
            <view class="card-3d-inner" :ref="(el) => setRef(el, innerRefs, idx)">
              <image class="tarot-card face-back" :src="cardBack" />
              <view class="tarot-card face-front">
                <image class="front-img" :src="getCardImg(idx)" />
              </view>
            </view>

            <!-- 正位/逆位徽章，翻牌后淡入 -->
            <view
              v-if="showResults"
              class="position-badge"
              :class="tarotStore.drawnCards[idx]?.position ?? 'upright'"
            >
              <text class="badge-label font-display">
                {{ tarotStore.drawnCards[idx]?.position === 'reversed' ? '逆' : '正' }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <view class="action-footer" ref="footerRef" v-show="!showResults">
        <view class="actions">
          <template v-if="phase === 'shuffling'">
            <view v-if="!actionDone" class="btn btn-primary" @click="playShuffle">开始洗牌</view>
            <template v-else>
              <view class="btn" @click="playShuffle">再洗一次</view>
              <view class="btn btn-primary" @click="playCut">开始切牌</view>
            </template>
          </template>

          <template v-else-if="phase === 'cutting'">
            <template v-if="actionDone">
              <view class="btn" @click="playCut">再切一次</view>
              <view class="btn btn-primary" @click="playDraw">抽取牌阵</view>
            </template>
          </template>

          <template v-else-if="phase === 'revealing'">
            <view class="reveal-status font-display">神谕显现中</view>
          </template>
        </view>
      </view>
    </view>

    <!-- 结果区：结果显示后从底部/右侧滑入 -->
    <scroll-view
      v-if="showResults"
      class="result-zone"
      scroll-y
      enable-flex
    >
      <ResultPanel
        :reading-result="tarotStore.readingResult!"
        :question="tarotStore.currentQuestion"
        @restart="handleRestart"
      />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'
import { useTarotStore } from '../stores/tarot'
import { useUserStore } from '../stores/user'
import ResultPanel from './ResultPanel.vue'

const emit = defineEmits<{
  (event: 'complete'): void
  (event: 'restart'): void
}>()

const tarotStore = useTarotStore()
const userStore = useUserStore()

const cardBack = computed(() => userStore.cardBackImage || '/static/themes/golden_dawn/tarot/card_back.jpeg')

const phase = ref<'shuffling' | 'cutting' | 'drawing' | 'revealing'>('shuffling')
const actionDone = ref(false)
const phasePrompt = ref('流程：请洗牌')
const showResults = ref(false)

const isS1Active = computed(() => ['shuffling', 'cutting', 'drawing', 'revealing'].includes(phase.value))
const isS2Active = computed(() => ['cutting', 'drawing', 'revealing'].includes(phase.value))
const isS3Active = computed(() => ['drawing', 'revealing'].includes(phase.value))

const isS1Blink = computed(() => phase.value === 'shuffling')
const isS2Blink = computed(() => phase.value === 'cutting')
const isS3Blink = computed(() => phase.value === 'drawing')

const isWide = ref(false)

function checkWidth() {
  isWide.value = window.innerWidth >= 768
}

const overlayRef = ref<any>(null)
const overlayBgRef = ref<any>(null)
const stageRef = ref<any>(null)
const headerRef = ref<any>(null)
const footerRef = ref<any>(null)

const initialDeckRefs = ref<any[]>([])
const leftDeckRefs = ref<any[]>([])
const rightDeckRefs = ref<any[]>([])
const cutTopRef = ref<any>(null)
const cutMidRef = ref<any>(null)
const cutBotRef = ref<any>(null)

const drawStageRef = ref<any>(null)
const drawRefs = ref<any[]>([])
const innerRefs = ref<any[]>([])

function setRef(el: any, arr: any[], index: number) {
  if (el) {
    arr[index] = el
  }
}

function getElement(target: any) {
  return target?.$el ?? target
}

function getElementArray(targets: any[]) {
  return targets.map((item) => getElement(item))
}

function getCardImg(index: number) {
  return tarotStore.drawnCards[index]?.card.image || cardBack.value
}

function getCardWidth() {
  const card = getElementArray(initialDeckRefs.value)[0]
  return card ? card.offsetWidth : 100
}

function getCardHeight() {
  const card = getElementArray(initialDeckRefs.value)[0]
  return card ? card.offsetHeight : 160
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDrawLayout(stage_width: number, stage_height: number, card_width: number, card_height: number, is_wide: boolean) {
  const horizontal_margin = Math.max(card_width * 0.2, 24)
  const vertical_margin = Math.max(card_height * 0.12, 24)
  const max_center_x = Math.max(0, stage_width / 2 - card_width / 2 - horizontal_margin)
  const side_offset = Math.min(card_width * 1.28, max_center_x)
  const min_center_y = -stage_height / 2 + card_height / 2 + vertical_margin
  const max_center_y = stage_height / 2 - card_height / 2 - vertical_margin
  const lift_y = is_wide
    ? Math.min(stage_height * 0.32, card_height * 1.26)
    : Math.min(stage_height * 0.16, card_height * 0.56)

  if (is_wide) {
    const centered_row_y = clamp(lift_y, min_center_y, max_center_y)

    return {
      liftY: lift_y,
      targetX: [-side_offset, 0, side_offset],
      targetY: [centered_row_y, centered_row_y, centered_row_y]
    }
  }

  const available_mobile_span = Math.max(0, max_center_y - min_center_y)
  const mobile_spread = Math.min(card_height * 1.12, available_mobile_span / 2)
  const mobile_center_y = clamp(lift_y, min_center_y + mobile_spread, max_center_y - mobile_spread)

  return {
    liftY: lift_y,
    targetX: [0, 0, 0],
    targetY: [mobile_center_y + mobile_spread, mobile_center_y, mobile_center_y - mobile_spread]
  }
}

onMounted(() => {
  checkWidth()
  window.addEventListener('resize', checkWidth)

  nextTick(() => {
    const firstCard = getElementArray(initialDeckRefs.value)[0]
    const entryDrop = firstCard ? firstCard.offsetHeight * 4 : 600

    gsap.set('.stage-center', { xPercent: -50, yPercent: -50 })

    gsap.fromTo(
      getElement(overlayBgRef.value),
      { backgroundColor: 'rgba(245, 230, 200, 0)', opacity: 0 },
      { backgroundColor: 'rgba(245, 230, 200, 0.65)', opacity: 1, duration: 1 }
    )

    gsap.fromTo(
      getElementArray(initialDeckRefs.value),
      { y: -entryDrop, rotation: 180, scale: 0.5 },
      {
        y: (index: number) => -index * 1.2,
        rotation: 0,
        scale: 1,
        duration: 1.2,
        ease: 'back.out(1.4)',
        stagger: 0.02
      }
    )

    gsap.fromTo(
      [getElement(headerRef.value), getElement(footerRef.value)],
      { y: 100, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, delay: 0.8, ease: 'power2.out' }
    )
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', checkWidth)
})

function playShuffle() {
  actionDone.value = false
  phasePrompt.value = '流程：洗牌中'

  const initialCards = getElementArray(initialDeckRefs.value)
  const leftCards = getElementArray(leftDeckRefs.value)
  const rightCards = getElementArray(rightDeckRefs.value)
  const cardWidth = getCardWidth()

  const timeline = gsap.timeline({
    onComplete: () => {
      actionDone.value = true
      phasePrompt.value = '流程：请切牌'
    }
  })

  timeline
    .set(initialCards, { autoAlpha: 0 })
    .set(leftCards, { display: 'block', autoAlpha: 1, x: 0, y: (index: number) => -index * 2.4, rotation: 0 })
    .set(rightCards, { display: 'block', autoAlpha: 1, x: 0, y: (index: number) => -index * 2.4, rotation: 0 })

  const spreadX = cardWidth * 0.7

  timeline
    .to(leftCards, { x: -spreadX, y: -20, rotation: -12, duration: 0.4, ease: 'power2.out' })
    .to(rightCards, { x: spreadX, y: 20, rotation: 12, duration: 0.4, ease: 'power2.out' }, '<')
    .to(leftCards, { x: 0, y: (index: number) => -index * 2.4, rotation: -2, duration: 0.3, stagger: 0.05, ease: 'power1.in' }, '+=0.1')
    .to(rightCards, { x: 0, y: (index: number) => -index * 2.4 - 1.2, rotation: 2, duration: 0.3, stagger: 0.05, ease: 'power1.in' }, '<0.02')
    .to([...leftCards, ...rightCards], { x: 0, rotation: 0, duration: 0.2, ease: 'back.out(2)' })
    .set([...leftCards, ...rightCards], { autoAlpha: 0 })
    .set(initialCards, { autoAlpha: 1 })
    .fromTo(initialCards, { scaleY: 0.9 }, { scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
}

function playCut() {
  phase.value = 'cutting'
  tarotStore.setPhase('cutting')
  actionDone.value = false
  phasePrompt.value = '流程：切牌中'

  const initialCards = getElementArray(initialDeckRefs.value)
  const cutTop = getElement(cutTopRef.value)
  const cutMid = getElement(cutMidRef.value)
  const cutBot = getElement(cutBotRef.value)

  const cardWidth = getCardWidth()
  const cardHeight = getCardHeight()
  const spread = isWide.value ? cardWidth * 1.16 : cardHeight * 0.92
  const leftX = isWide.value ? -spread : 0
  const leftY = isWide.value ? 0 : -spread
  const rightX = isWide.value ? spread : 0
  const rightY = isWide.value ? 0 : spread

  const timeline = gsap.timeline({
    onComplete: () => {
      actionDone.value = true
      phasePrompt.value = '流程：请抽取牌阵'
    }
  })

  timeline
    .set([cutTop, cutMid, cutBot], { display: 'block', autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, zIndex: 10 })
    .to(initialCards, { autoAlpha: 0, duration: 0.1 })
    .to(cutTop, { x: leftX, y: leftY, rotation: -4, duration: 0.6, ease: 'power3.out' }, '<')
    .to(cutMid, { x: 0, y: 0, rotation: 0, duration: 0.6, ease: 'power3.out' }, '<')
    .to(cutBot, { x: rightX, y: rightY, rotation: 4, duration: 0.6, ease: 'power3.out' }, '<')
    .to([cutTop, cutMid, cutBot], { scale: 1.08, duration: 0.4, ease: 'power1.out' })
    .to(cutBot, { boxShadow: '0 20px 30px rgba(0,0,0,0.4)', duration: 0.4, ease: 'power1.out' }, '<')
    .to(cutTop, { x: rightX, y: rightY, rotation: 2, duration: 0.8, ease: 'back.inOut(1.2)', zIndex: 12 }, '+=0.1')
    .to(cutBot, { x: leftX, y: leftY, rotation: -2, duration: 0.8, ease: 'back.inOut(1.2)' }, '<')
    .to([cutTop, cutMid, cutBot], {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power3.out'
    })
    .to(cutBot, { boxShadow: 'none', duration: 0.5, ease: 'power3.out' }, '<')
    .set([cutTop, cutMid, cutBot], { autoAlpha: 0 })
    .to(initialCards, { autoAlpha: 1, duration: 0.1 })
}

function playDraw() {
  phase.value = 'drawing'
  tarotStore.setPhase('drawing')
  tarotStore.drawThreeCards()

  actionDone.value = false
  phasePrompt.value = '流程：牌阵凝聚中'

  const initialCards = getElementArray(initialDeckRefs.value)
  const stage = getElement(stageRef.value)
  const wrappers = getElementArray(drawRefs.value)
  const deckContainer = initialCards[0]?.parentElement

  const stageRect = stage.getBoundingClientRect()
  const stage_width = stageRect.width
  const stage_height = stageRect.height
  const card_width = getCardWidth()
  const card_height = getCardHeight()
  const draw_layout = getDrawLayout(stage_width, stage_height, card_width, card_height, isWide.value)
  const { targetX, targetY, liftY } = draw_layout

  const timeline = gsap.timeline()

  timeline
    .to(deckContainer, { x: '+=4', yoyo: true, repeat: 10, duration: 0.05 })
    .to(deckContainer, { x: 0, duration: 0.1 })

  timeline
    .to(stage, { y: -liftY, duration: 1.8, ease: 'power2.inOut' }, '+=0.2')
    .to(initialCards, { autoAlpha: 0, y: -card_height * 0.4, scale: 0.8, duration: 0.6, ease: 'power1.in' }, '<0.2')

  wrappers.forEach((card, index) => {
    timeline
      .set(card, {
        display: 'block',
        autoAlpha: 1,
        x: 0,
        y: index === 0 ? -card_height * 0.3 : -stage_height,
        rotation: (Math.random() - 0.5) * 15,
        scale: 1,
        zIndex: 10 + index
      }, 1 + index * 0.3)
      .to(card, { x: targetX[index], y: targetY[index] + card_height * 0.4, duration: 0.7, ease: 'power2.in' }, '>')
      .to(card, { y: targetY[index] + card_height * 0.56, duration: 0.4, ease: 'power1.out' }, '>')
      .to(card, { y: targetY[index], duration: 1.5, ease: 'power3.out' }, '>')
  })

  // 三张牌均落定后，对齐到最终位置，再翻牌
  const alignTime = 1 + 2 * 0.3 + 0.7 + 0.4 + 1.5 + 0.5

  timeline
    .to(wrappers, {
      x: (index: number) => targetX[index],
      y: (index: number) => targetY[index],
      rotation: 0,
      duration: 0.8,
      ease: 'power3.inOut'
    }, alignTime + 0.1)
    .to(wrappers, {
      scale: 0.92,
      duration: 0.5,
      ease: 'power1.out'
    }, alignTime + 0.9)
    .to(wrappers[0], {
      boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
      duration: 0.5,
      ease: 'power1.out'
    }, alignTime + 0.9)
    .to(getElementArray(innerRefs.value), {
      rotationY: 180,
      duration: 1,
      stagger: 0.4,
      ease: 'back.out(1.1)'
    }, alignTime + 1.2)
    .add(() => {
      phase.value = 'revealing'
      tarotStore.setPhase('revealing')
      phasePrompt.value = '神谕已经显现'
    }, alignTime + 2.7)
    .add(() => {
      finish()
    }, alignTime + 4.3)
}

function finish() {
  // 不渐隐整个浮层，改为触发结果展示状态
  tarotStore.revealResult()
  showResults.value = true
  phasePrompt.value = '解读结果'
}

function handleRestart() {
  showResults.value = false
  emit('restart')
}
</script>

<style scoped>
.divination-overlay {
  --card-width: clamp(108px, 26vw, 172px);
  --card-height: calc(var(--card-width) * 1.6);

  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 布局切换的过渡 */
  transition: flex-direction 0.4s ease;
}

.overlay-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}

/* 结果展示后的容器变形 */
.stage-container {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: flex 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  /* 默认占满全部纵向空间 */
  flex: 1 0 100%;
  height: 100vh;
}

/* 窄屏：结果展示后，动画区缩至上半 */
.show-results .stage-container {
  flex: 0 0 42vh;
  height: 42vh;
  min-height: 260px;
}

/* 宽屏：结果展示后，动画区变为左侧列 */
.is-wide.show-results {
  flex-direction: row;
}

.is-wide.show-results .stage-container {
  flex: 0 0 44%;
  height: 100vh;
  width: 44%;
}

.result-zone {
  flex: 1;
  overflow-y: auto;
  animation: result-slide-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
  background: rgba(254, 250, 243, 0.6);
  border-top: 1px solid rgba(184, 148, 62, 0.2);
}

.is-wide .result-zone {
  border-top: none;
  border-left: 1px solid rgba(184, 148, 62, 0.2);
}

@keyframes result-slide-in {
  from {
    opacity: 0;
    transform: translateY(32px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.is-wide .result-zone {
  animation-name: result-slide-in-right;
}

@keyframes result-slide-in-right {
  from {
    opacity: 0;
    transform: translateX(32px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 60rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 20;
}

.show-results .progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 20rpx);
}

.stars {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.star {
  width: 48rpx;
  height: 48rpx;
  transition: all 0.5s ease;
}

.star.active {
  transform: scale(1.2);
  filter: drop-shadow(0 0 4px rgba(212, 184, 114, 0.4));
}

.star.blink {
  animation: star-blink 1s infinite alternate;
}

.star-line {
  width: 60rpx;
  height: 2px;
  background: var(--color-border-strong);
}

.phase-prompt {
  font-size: 28rpx;
  color: var(--color-text-primary);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.05em;
}

.stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6vh 0;
  isolation: isolate;
  overflow: hidden;
  min-height: 0;
}

.tarot-card,
.deck-layer,
.card-3d-inner {
  width: var(--card-width);
  height: var(--card-height);
}

.tarot-card {
  border-radius: 12rpx;
  border: 1px solid var(--color-border);
  will-change: transform;
}

.deck-layer {
  position: relative;
}

.stack-card {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: none;
}

.stack-card:first-child {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
}

.cut-t,
.cut-m,
.cut-b,
.draw-wrapper {
  box-shadow: 0 8px 24rpx rgba(0, 0, 0, 0.3);
}

.stage-center {
  position: absolute;
  top: 50%;
  left: 50%;
}

.hidden-element {
  display: none;
  opacity: 0;
}

.draw-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.draw-wrapper {
  perspective: 1200px;
  position: absolute;
}

.card-3d-inner {
  transform-style: preserve-3d;
  position: relative;
}

.face-back,
.face-front {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  margin: 0 !important;
}

.face-front {
  transform: rotateY(180deg);
  background: var(--color-card-bg);
}

.front-img {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
  object-fit: cover;
}

/* 正位/逆位徽章 */
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
  from {
    opacity: 0;
    transform: scale(0.4);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.action-footer {
  padding: 40rpx 20rpx calc(env(safe-area-inset-bottom, 0px) + 60rpx);
  display: flex;
  justify-content: center;
  z-index: 20;
}

.actions {
  display: flex;
  gap: 30rpx;
  align-items: center;
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
  background-image: url('/static/themes/golden_dawn/ui/btn_primary.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  color: #cca957;
  border: none;
  font-weight: bold;
}

.reveal-status {
  padding: 18rpx 46rpx;
  border-radius: 40rpx;
  color: var(--color-accent);
  background: rgba(254, 250, 243, 0.86);
  border: 1px solid rgba(184, 148, 62, 0.35);
  letter-spacing: 0.08em;
  animation: oracle-breathe 1.8s ease-in-out infinite;
}

@media (min-width: 768px) {
  .divination-overlay {
    --card-width: clamp(120px, 13vw, 188px);
  }
}

@keyframes star-blink {
  0% {
    opacity: 0.6;
    filter: drop-shadow(0 0 2px rgba(212, 184, 114, 0.2));
    transform: scale(1.1);
  }

  100% {
    opacity: 1;
    filter: drop-shadow(0 0 12px rgba(212, 184, 114, 1));
    transform: scale(1.3);
  }
}

@keyframes oracle-breathe {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(184, 148, 62, 0.16);
  }

  50% {
    transform: scale(1.03);
    box-shadow: 0 0 18rpx rgba(184, 148, 62, 0.2);
  }
}
</style>
