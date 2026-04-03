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
            v-for="i in 12"
            :key="`m${i}`"
            class="tarot-card stack-card initial-deck"
            :ref="(el) => setRef(el, initialDeckRefs, i - 1)"
            :src="cardBack"
            :style="{ transform: `translateY(${-(i - 1) * 0.8}px)` }"
          />

          <image
            v-for="i in 6"
            :key="`l${i}`"
            class="tarot-card stack-card hidden-element"
            :ref="(el) => setRef(el, leftDeckRefs, i - 1)"
            :src="cardBack"
          />
          <image
            v-for="i in 6"
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

<!--
  文件用途：全屏占卜遮罩组件
  - 包含洗牌 / 切牌 / 抽牌三阶段动画
  - 三阶段完成后展示塔罗解读结果（ResultPanel）
  - 支持宽屏（≥768px）与窄屏自适应布局
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, type ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
import { useTarotStore } from '../stores/tarot'
import ResultPanel from './ResultPanel.vue'
import { CARD_BACK_IMAGE as cardBack } from '../constants'

// Emits 定义
// complete - 占卜流程完成时触发（抽牌动画结束、结果即将展示）
// restart  - 用户点击重新开始时触发
const emit = defineEmits<{
  (event: 'complete'): void
  (event: 'restart'): void
}>()

const tarotStore = useTarotStore()

// 响应式状态
let resizeTimer: ReturnType<typeof setTimeout> | null = null   // 窗口 resize 防抖定时器 ID
const phase = ref<'shuffling' | 'cutting' | 'drawing' | 'revealing'>('shuffling') // 组件内部阶段（与 store 同步，但单独维护便于驱动动画）
const actionDone = ref(false)            // 控制当前阶段是否已结束，用于显示「下一步」按钮
const phasePrompt = ref('流程：请洗牌')   // 顶部提示文案，随阶段变化而更新
const showResults = ref(false)           // 控制结果区（ResultPanel）是否显示

// 进度星星的点亮范围
const PHASES_S1 = ['shuffling', 'cutting', 'drawing', 'revealing']
const PHASES_S2 = ['cutting', 'drawing', 'revealing']
const PHASES_S3 = ['drawing', 'revealing']

// 进度星星的显示状态：active 表示是否点亮，blink 表示当前阶段是否闪烁
const isS1Active = computed(() => PHASES_S1.includes(phase.value))
const isS2Active = computed(() => PHASES_S2.includes(phase.value))
const isS3Active = computed(() => PHASES_S3.includes(phase.value))

const isS1Blink = computed(() => phase.value === 'shuffling')
const isS2Blink = computed(() => phase.value === 'cutting')
const isS3Blink = computed(() => phase.value === 'drawing')

const isWide = ref(false)                // 宽屏/窄屏布局切换阈值：768px

// 检测视口宽度并触发布局重算（结果展示后 resize 需要重新定位牌阵）
function checkWidth() {
  isWide.value = window.innerWidth >= 768
  if (showResults.value) {
    nextTick(() => {
      updateLayout()
    })
  }
}

// DOM ref 定义
const overlayRef = ref<ComponentPublicInstance | HTMLElement | null>(null)   // 根容器
const overlayBgRef = ref<ComponentPublicInstance | HTMLElement | null>(null) // 背景层
const stageRef = ref<ComponentPublicInstance | HTMLElement | null>(null)       // 动画舞台
const headerRef = ref<ComponentPublicInstance | HTMLElement | null>(null)      // 顶部进度区
const footerRef = ref<ComponentPublicInstance | HTMLElement | null>(null)      // 底部按钮区

const initialDeckRefs = ref<(ComponentPublicInstance | Element)[]>([]) // 初始牌组（12张叠放）
const leftDeckRefs = ref<(ComponentPublicInstance | Element)[]>([])    // 洗牌动画：左半牌组
const rightDeckRefs = ref<(ComponentPublicInstance | Element)[]>([])   // 洗牌动画：右半牌组
const cutTopRef = ref<ComponentPublicInstance | HTMLElement | null>(null)    // 切牌动画：顶部牌
const cutMidRef = ref<ComponentPublicInstance | HTMLElement | null>(null)    // 切牌动画：中部牌
const cutBotRef = ref<ComponentPublicInstance | HTMLElement | null>(null)    // 切牌动画：底部牌

const drawStageRef = ref<ComponentPublicInstance | HTMLElement | null>(null) // 抽牌舞台容器
const drawRefs = ref<(ComponentPublicInstance | Element)[]>([])          // 抽出的3张牌（外层 wrapper）
const innerRefs = ref<(ComponentPublicInstance | Element)[]>([])         // 抽出的3张牌（3D翻转内层）

function setRef(el: Element | ComponentPublicInstance | null, arr: (ComponentPublicInstance | Element)[], index: number) {
  if (el) {
    arr[index] = el
  }
}

function getElement(target: ComponentPublicInstance | Element | null): HTMLElement | null {
  return ((target as ComponentPublicInstance)?.$el ?? target) as HTMLElement | null
}

function getElementArray(targets: (ComponentPublicInstance | Element | null)[]): (HTMLElement | null)[] {
  return targets.map((item) => getElement(item))
}

function getCardImg(index: number) {
  return tarotStore.drawnCards[index]?.card.image || cardBack
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

// 根据宽屏/窄屏计算3张抽牌的目标坐标（扇形/竖列布局）
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

// 在 reveal/drawing 阶段以及结果显示后调用，重新计算3张牌的最终位置（网格/扇形）
function updateLayout() {
  if (phase.value !== 'revealing' && phase.value !== 'drawing') return

  const stage = getElement(stageRef.value)
  if (!stage) return
  
  const stageRect = stage.getBoundingClientRect()
  const stage_width = stageRect.width
  const stage_height = stageRect.height
  const card_width = getCardWidth()
  const card_height = getCardHeight()
  
  let targetX = [0,0,0]
  let targetY = [0,0,0]
  
  if (showResults.value) {
    if (isWide.value) {
      const gap_x = 20
      const gap_y = 20
      
      let cols = 3
      if (card_width * 3 + gap_x * 2 > stage_width * 0.9) cols = 2
      if (card_width * 2 + gap_x > stage_width * 0.9) cols = 1
      
      const rows = Math.ceil(3 / cols)
      const grid_height = rows * card_height + (rows - 1) * gap_y
      let current_y = -grid_height / 2 + card_height / 2
      
      let i = 0
      for (let r = 0; r < rows; r++) {
        let row_cols = Math.min(3 - i, cols)
        let row_width = row_cols * card_width + (row_cols - 1) * gap_x
        let start_x = -row_width / 2 + card_width / 2
        
        for (let c = 0; c < row_cols; c++) {
          if (i < 3) {
            targetX[i] = start_x + c * (card_width + gap_x)
            targetY[i] = current_y
          }
          i++
        }
        current_y += card_height + gap_y
      }
    } else {
      const available_width = Math.max(stage_width * 0.95, card_width)
      let spreadX = card_width * 0.9
      if (spreadX * 2 + card_width > available_width) {
        spreadX = (available_width - card_width) / 2
      }
      targetX = [-spreadX, 0, spreadX]
      targetY = [0, 0, 0]
    }
    
    gsap.to(stage, { y: 0, duration: 0.6, ease: 'power2.out' })
  } else {
    const layout = getDrawLayout(stage_width, stage_height, card_width, card_height, isWide.value)
    targetX = layout.targetX
    targetY = layout.targetY
  }
  
  const wrappers = getElementArray(drawRefs.value)
  wrappers.forEach((card, i) => {
    gsap.to(card, {
      x: targetX[i],
      y: targetY[i],
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto'
    })
  })
}

// 组件挂载：触发入场动画序列
// 1. 背景淡入 → 2. 牌组从上方坠落并回弹 → 3. header/footer 上移入场
onMounted(() => {
  checkWidth()
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(checkWidth, 200)
  })

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
        y: (index: number) => -index * 0.8,
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
  if (resizeTimer !== null) clearTimeout(resizeTimer)
})

// 洗牌动画：牌组拆分左右 → 交叉合并 → 弹性归位；完成后自动切换到切牌阶段
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
    .set(leftCards, { display: 'block', autoAlpha: 1, x: 0, y: (index: number) => -index * 0.8, rotation: 0 })
    .set(rightCards, { display: 'block', autoAlpha: 1, x: 0, y: (index: number) => -4.8 - index * 0.8, rotation: 0 })

  const spreadX = cardWidth * 0.85

  timeline
    .to(leftCards, { x: -spreadX, y: (index: number) => -30 - index * 0.8, rotation: -16, duration: 0.5, ease: 'power2.out' })
    .to(rightCards, { x: spreadX, y: (index: number) => 30 - index * 0.8, rotation: 16, duration: 0.5, ease: 'power2.out' }, '<')
    .to(leftCards, { x: 0, y: (index: number) => -index * 1.6, rotation: -2, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '+=0.2')
    .to(rightCards, { x: 0, y: (index: number) => -0.8 - index * 1.6, rotation: 2, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '<0.03')
    .to([...leftCards, ...rightCards], { x: 0, rotation: 0, duration: 0.3, ease: 'back.out(1.5)' }, '+=0.1')
    .set([...leftCards, ...rightCards], { autoAlpha: 0 })
    .set(initialCards, { autoAlpha: 1 })
    .fromTo(initialCards, { scaleY: 0.9 }, { scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
}

// 切牌动画：用固定3张牌模拟切牌
// 阶段：三张牌展开 → 多轮轮换打乱 → 归位合并；完成后自动切换到抽牌阶段
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
  const spread = isWide.value ? cardWidth * 1.5 : cardHeight * 1.3
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
    // 分离切牌（保持竖直，不倾斜）
    .to(cutTop, { x: leftX, y: leftY, duration: 0.7, ease: 'power3.out' }, '<')
    .to(cutMid, { x: 0, y: 0, duration: 0.7, ease: 'power3.out' }, '<')
    .to(cutBot, { x: rightX, y: rightY, duration: 0.7, ease: 'power3.out' }, '<')
    // 放大并加深阴影悬浮感
    .to([cutTop, cutMid, cutBot], { scale: 1.1, duration: 0.4, ease: 'power1.out' })
    .to([cutTop, cutMid, cutBot], { boxShadow: '0 24px 40px rgba(0,0,0,0.5)', duration: 0.4, ease: 'power1.out' }, '<')

    // 第一波打乱：逆时针轮换
    .to(cutTop, { x: 0, y: 0, zIndex: 12, duration: 0.6, ease: 'power2.inOut' }, '+=0.1')
    .to(cutMid, { x: rightX, y: rightY, zIndex: 11, duration: 0.6, ease: 'power2.inOut' }, '<')
    .to(cutBot, { x: leftX, y: leftY, zIndex: 13, duration: 0.6, ease: 'power2.inOut' }, '<')

    // 第二波打乱：交叉对换
    .to(cutTop, { x: rightX, y: rightY, zIndex: 11, duration: 0.6, ease: 'power2.inOut' })
    .to(cutMid, { x: leftX, y: leftY, zIndex: 13, duration: 0.6, ease: 'power2.inOut' }, '<')
    .to(cutBot, { x: 0, y: 0, zIndex: 12, duration: 0.6, ease: 'power2.inOut' }, '<')

    // 第三波打乱：再次错位
    .to(cutTop, { x: leftX, y: leftY, zIndex: 10, duration: 0.6, ease: 'power2.inOut' })
    .to(cutMid, { x: rightX, y: rightY, zIndex: 12, duration: 0.6, ease: 'power2.inOut' }, '<')
    .to(cutBot, { x: 0, y: 0, zIndex: 14, duration: 0.6, ease: 'power2.inOut' }, '<')

    // 最终合并还原
    .to([cutTop, cutMid, cutBot], {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      duration: 0.6,
      stagger: 0.15,
      ease: 'back.out(1.5)'
    }, '+=0.2')
    .to([cutTop, cutMid, cutBot], { boxShadow: '0 8px 24px rgba(0,0,0,0.3)', duration: 0.6, ease: 'power3.out' }, '<')
    .set([cutTop, cutMid, cutBot], { autoAlpha: 0 })
    .to(initialCards, { autoAlpha: 1, duration: 0.1 })
}

// 抽牌动画：
// 1. 牌组颤动 → 2. 舞台上移 → 3. 三张牌错落落下到达目标位 → 4. 翻牌
// 完成后触发结果显示
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

  if (!stage) return
  const stageRect = stage.getBoundingClientRect()
  const stage_width = stageRect.width
  const stage_height = stageRect.height
  const card_width = getCardWidth()
  const card_height = getCardHeight()
  const draw_layout = getDrawLayout(stage_width, stage_height, card_width, card_height, isWide.value)
  const { targetX, targetY, liftY } = draw_layout

  const timeline = gsap.timeline()

  timeline
    .to(deckContainer ?? null, { x: '+=4', yoyo: true, repeat: 10, duration: 0.05 })
    .to(deckContainer ?? null, { x: 0, duration: 0.1 })

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
        zIndex: 20 - index
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
  
  nextTick(() => {
    updateLayout()
  })
}

// 重置逻辑：关闭结果区并通知父组件重新开始
// 父组件负责 GSAP killAll、store reset、状态恢复与重新入场动画
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
  position: relative;
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
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
  pointer-events: none;
}

.stage > * {
  pointer-events: auto;
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
  margin-top: auto;
  padding: 40rpx 20rpx calc(env(safe-area-inset-bottom, 0px) + 60rpx);
  display: flex;
  justify-content: center;
  position: relative;
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
