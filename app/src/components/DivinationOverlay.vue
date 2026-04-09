<template>
  <view class="divination-overlay" :class="{ 'show-results': showResults, 'is-wide': isWide }">
    <view class="overlay-bg" :style="bgStyle" />

    <!-- 动画区：始终存在，结果展示后收缩到上方/左侧 -->
    <view class="stage-container">
      <view class="progress-header" :style="headerStyle">
        <MoonPhase :phase="moonPhaseIndex" />
      </view>

      <!-- 动画舞台：:style 驱动 GSAP 动画的 y-lift 效果 -->
      <view class="stage" :style="stageStyle">
        <!-- 牌组容器：:style 驱动洗牌摇晃动画 -->
        <view class="deck-layer" :style="deckCtnStyle">
          <!-- 初始牌组（12张叠放）：style 由 GSAP 状态对象驱动 -->
          <image
            v-for="i in 12"
            :key="`m${i}`"
            class="tarot-card stack-card initial-deck"
            :src="cardBack"
            :style="initialsStyle[i-1]"
          />

          <!-- 洗牌左半牌组：v-show + style 由 GSAP 状态对象驱动 -->
          <image
            v-for="i in 6"
            :key="`l${i}`"
            v-show="leftsVisible"
            class="tarot-card stack-card"
            :src="cardBack"
            :style="leftsStyle[i-1]"
          />
          <!-- 洗牌右半牌组：v-show + style 由 GSAP 状态对象驱动 -->
          <image
            v-for="i in 6"
            :key="`r${i}`"
            v-show="rightsVisible"
            class="tarot-card stack-card"
            :src="cardBack"
            :style="rightsStyle[i-1]"
          />
        </view>

        <!-- 切牌三张：v-show + style 由 GSAP 状态对象驱动；centerStyle 含 calc(-50%+Xpx) 居中偏移 -->
        <image v-show="cutTopVisible" class="tarot-card stage-center cut-t" :src="cardBack" :style="cutTopStyle" />
        <image v-show="cutMidVisible" class="tarot-card stage-center cut-m" :src="cardBack" :style="cutMidStyle" />
        <image v-show="cutBotVisible" class="tarot-card stage-center cut-b" :src="cardBack" :style="cutBotStyle" />

        <view class="draw-container">
          <!-- 抽出的3张牌：v-show + style 由 GSAP 状态对象驱动；centerStyle 含居中偏移 -->
          <view
            v-for="idx in [0, 1, 2]"
            :key="idx"
            v-show="drawsVisible[idx]"
            class="draw-wrapper stage-center"
            :style="drawsStyle[idx]"
          >
            <!-- 3D 翻转内层：style 由 GSAP 驱动 rotationY -->
            <view class="card-3d-inner" :style="innersStyle[idx]">
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
                {{ tarotStore.drawnCards[idx]?.position === 'reversed' ? overlay_text.position_reversed : overlay_text.position_upright }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部操作区：:style 驱动入场动画 -->
      <view class="action-footer" :style="footerStyle">
        <view class="actions">
          <!-- 结果展示后显示再占一次，与洗牌/切牌的"再来一次"按钮逻辑一致 -->
          <template v-if="showResults">
            <view class="btn btn-primary" @click="handleRestart">{{ overlay_text.restart }}</view>
          </template>

          <template v-else-if="phase === 'shuffling'">
            <view v-if="!actionDone" class="btn btn-primary" @click="playShuffle">{{ overlay_text.start_shuffle }}</view>
            <template v-else>
              <view class="btn" @click="playShuffle">{{ overlay_text.shuffle_again }}</view>
              <view class="btn btn-primary" @click="playCut">{{ overlay_text.start_cut }}</view>
            </template>
          </template>

          <template v-else-if="phase === 'cutting'">
            <template v-if="actionDone">
              <view class="btn" @click="playCut">{{ overlay_text.cut_again }}</view>
              <view class="btn btn-primary" @click="playDraw">{{ overlay_text.start_draw }}</view>
            </template>
          </template>

          <template v-else-if="phase === 'revealing'">
            <!-- 纯文字提示 + 点点点进度动画，替代原来的按钮样式 -->
            <view class="revealing-hint font-display">
              {{ overlay_text.revealing }}<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </view>
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
        v-if="tarotStore.readingResult"
        :reading-result="tarotStore.readingResult"
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

  跨端兼容说明（H5 & 微信小程序）：
  - 禁止使用 window.innerWidth/innerHeight，改用 uni.getWindowInfo()
  - 禁止使用 window.addEventListener/removeEventListener，改用 uni.onWindowResize/offWindowResize
  - 禁止使用 getBoundingClientRect/offsetWidth/offsetHeight，改用窗口尺寸推算
  - GSAP 不可直接操作 DOM 元素，改用"plain JS 状态对象 + onUpdate → Vue ref<string> :style 绑定"模式：
      1. 定义 plain JS 状态对象（如 _bg, _initials[], _draws[]）
      2. GSAP tween 作用在状态对象上，onUpdate 中调用刷新函数
      3. 刷新函数将状态对象序列化为 CSS style 字符串，写入 Vue ref
      4. 模板用 :style="xxxStyle" 绑定，Vue 负责最终 DOM 更新
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'
import { useTarotStore } from '../stores/tarot'
import ResultPanel from './ResultPanel.vue'
import MoonPhase from './MoonPhase.vue'
import { CARD_BACK_IMAGE } from '../constants'

// Emits 定义
// complete - 占卜流程完成时触发（抽牌动画结束、结果即将展示）
// restart  - 用户点击重新开始时触发
const emit = defineEmits<{
  (event: 'complete'): void
  (event: 'restart'): void
}>()

const tarotStore = useTarotStore()

// Card back image
const cardBack = computed(() => CARD_BACK_IMAGE)

// Map phase to moon phase index (0-3)
const moonPhaseIndex = computed(() => {
  const map: Record<string, number> = { shuffling: 0, cutting: 1, drawing: 2, revealing: 3 }
  return map[phase.value] ?? 0
})

// User-facing copy strings.
const overlay_text = {
  position_reversed: '逆',
  position_upright: '正',
  restart: '再占一次',
  start_shuffle: '开始洗牌',
  shuffle_again: '再洗一次',
  start_cut: '开始切牌',
  cut_again: '再切一次',
  start_draw: '抽取牌阵',
  revealing: '神谕显现中',
  prompt_shuffle: '流程：请洗牌',
  prompt_shuffling: '流程：洗牌中',
  prompt_cutting: '流程：切牌中',
  prompt_cut: '流程：请切牌',
  prompt_draw: '流程：请抽取牌阵',
  prompt_drawing: '流程：牌阵凝聚中',
  revealed: '神谕已经显现',
  result: '解读结果',
}

// ---- 响应式状态 ----
const phase = ref<'shuffling' | 'cutting' | 'drawing' | 'revealing'>('shuffling')
const actionDone = ref(false)
const phasePrompt = ref(overlay_text.prompt_shuffle)
const showResults = ref(false)
const isWide = ref(false)

function getCardImg(index: number) {
  return tarotStore.drawnCards[index]?.card.image || cardBack.value
}

// ---- 窗口尺寸（跨端兼容：替代 window.innerWidth/innerHeight）----
// Get the height occupied by the progress-header in mini program
function getTopBarHeight(): number {
  // #ifdef MP-WEIXIN
  try {
    const { top, height } = uni.getMenuButtonBoundingClientRect()
    return top + height + 8  // capsule button bottom + padding
  } catch {
    return 88  // fallback: status bar(44) + nav bar(44)
  }
  // #endif
  // eslint-disable-next-line no-unreachable -- reachable on non-MP platforms via conditional compilation
  return 0
}

function getCardWidth(): number {
  const { windowWidth } = uni.getWindowInfo()
  if (isWide.value) return Math.min(188, Math.max(120, windowWidth * 0.13))
  const topBar = getTopBarHeight()
  if (topBar > 0) {
    // Mini program: smaller cards to fit reduced vertical space
    return Math.min(120, Math.max(88, windowWidth * 0.22))
  }
  return Math.min(172, Math.max(108, windowWidth * 0.26))
}

function getCardHeight(): number {
  return getCardWidth() * 1.6
}

// 根据当前布局状态推算舞台尺寸（替代 getBoundingClientRect）
// stage 是 position:absolute; inset:0 填满 stage-container
// stage-container 的尺寸由 CSS 布局决定，可从窗口尺寸推算
function getStageDimensions(): { width: number; height: number } {
  const { windowWidth, windowHeight } = uni.getWindowInfo()
  const topBar = getTopBarHeight()
  if (showResults.value) {
    if (isWide.value) return { width: windowWidth * 0.44, height: windowHeight }
    return { width: windowWidth, height: windowHeight * 0.42 }
  }
  return { width: windowWidth, height: windowHeight - topBar }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// 根据宽屏/窄屏计算3张抽牌的目标坐标（相对于舞台中心）
function getDrawLayout(
  stage_width: number,
  stage_height: number,
  card_width: number,
  card_height: number,
  is_wide: boolean,
) {
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
      targetY: [centered_row_y, centered_row_y, centered_row_y],
    }
  }

  const available_mobile_span = Math.max(0, max_center_y - min_center_y)
  const mobile_spread = Math.min(card_height * 1.12, available_mobile_span / 2)
  const mobile_center_y = clamp(lift_y, min_center_y + mobile_spread, max_center_y - mobile_spread)

  return {
    liftY: lift_y,
    targetX: [0, 0, 0],
    targetY: [mobile_center_y + mobile_spread, mobile_center_y, mobile_center_y - mobile_spread],
  }
}

// ---- GSAP 动画状态对象（plain JS，GSAP 直接操作这些对象）----
// 不使用 Vue 响应式，避免在微信小程序中直接操作 DOM

interface CardState {
  x: number
  y: number
  rotation: number
  scale: number
  scaleY: number  // 仅用于洗牌结束的弹性效果
  opacity: number
}

interface CenterCardState {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
  zIndex: number
}

interface InnerState {
  rotationY: number
}

// 背景遮罩
const _bg = { opacity: 0 }
// 舞台整体（抽牌时上移）
const _stage = { y: 0 }
// 进度头部 / 底部操作区（入场动画）
const _header = { y: 60, opacity: 0 }
const _footer = { y: 60, opacity: 0 }
// 牌组容器（洗牌摇晃效果）
const _deckCtn = { x: 0 }
// 初始牌组 12 张（叠放）
const _initials: CardState[] = Array.from({ length: 12 }, (_, i) => ({
  x: 0, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
}))
// 洗牌左/右各 6 张
const _lefts: CardState[] = Array.from({ length: 6 }, () => ({
  x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
}))
const _rights: CardState[] = Array.from({ length: 6 }, () => ({
  x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
}))
// 切牌三张（绝对定位居中）
const _cutTop: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
const _cutMid: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
const _cutBot: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
// 抽出的3张牌（绝对定位居中）
const _draws: CenterCardState[] = Array.from({ length: 3 }, (_, i) => ({
  x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 20 - i,
}))
// 3D 翻转内层
const _inners: InnerState[] = Array.from({ length: 3 }, () => ({ rotationY: 0 }))

// ---- Vue 样式 ref（绑定到模板 :style，由刷新函数更新）----

const bgStyle = ref('opacity: 0')
const stageStyle = ref('')
const headerStyle = ref('transform: translateY(60px); opacity: 0')
const footerStyle = ref('transform: translateY(60px); opacity: 0')
const deckCtnStyle = ref('')

// 初始值与 _initials 状态一致
const initialsStyle = ref<string[]>(
  _initials.map((s, i) => `transform: translateY(${-i * 0.8}px)`),
)

const leftsVisible = ref(false)
const leftsStyle = ref<string[]>(Array.from({ length: 6 }, () => ''))
const rightsVisible = ref(false)
const rightsStyle = ref<string[]>(Array.from({ length: 6 }, () => ''))

const cutTopVisible = ref(false)
const cutMidVisible = ref(false)
const cutBotVisible = ref(false)
const cutTopStyle = ref('')
const cutMidStyle = ref('')
const cutBotStyle = ref('')

const drawsVisible = ref<boolean[]>([false, false, false])
const drawsStyle = ref<string[]>(['', '', ''])
const innersStyle = ref<string[]>(['', '', ''])

// ---- CSS style 字符串构造函数 ----

// 普通卡牌（stack-card）：简单位移 + 旋转 + 缩放
function _cardStyleStr(s: CardState): string {
  const sy = s.scaleY !== 1 ? ` scaleY(${s.scaleY})` : ''
  return (
    `transform: translateX(${s.x}px) translateY(${s.y}px) rotate(${s.rotation}deg) scale(${s.scale})${sy};` +
    ` opacity: ${s.opacity}; will-change: transform`
  )
}

// 居中卡牌（stage-center）：transform 内含 calc(-50% + Xpx) 偏移，替代 GSAP 的 xPercent/yPercent:-50
function _centerStyleStr(s: CenterCardState): string {
  return (
    `transform: translateX(calc(-50% + ${s.x}px)) translateY(calc(-50% + ${s.y}px))` +
    ` rotate(${s.rotation}deg) scale(${s.scale});` +
    ` opacity: ${s.opacity}; z-index: ${s.zIndex}; will-change: transform`
  )
}

// 3D 翻转内层
function _innerStyleStr(s: InnerState): string {
  return `transform: rotateY(${s.rotationY}deg)`
}

// ---- 刷新函数（在 GSAP onUpdate 中调用，将状态对象同步到 Vue ref）----

const refreshBg = () => { bgStyle.value = `opacity: ${_bg.opacity}` }
const refreshStage = () => { stageStyle.value = `transform: translateY(${_stage.y}px)` }
const refreshHeader = () => { headerStyle.value = `transform: translateY(${_header.y}px); opacity: ${_header.opacity}` }
const refreshFooter = () => { footerStyle.value = `transform: translateY(${_footer.y}px); opacity: ${_footer.opacity}` }
const refreshDeckCtn = () => { deckCtnStyle.value = `transform: translateX(${_deckCtn.x}px)` }
const refreshInitials = () => { initialsStyle.value = _initials.map(s => _cardStyleStr(s)) }
const refreshLefts = () => { leftsStyle.value = _lefts.map(s => _cardStyleStr(s)) }
const refreshRights = () => { rightsStyle.value = _rights.map(s => _cardStyleStr(s)) }
const refreshCutTop = () => { cutTopStyle.value = _centerStyleStr(_cutTop) }
const refreshCutMid = () => { cutMidStyle.value = _centerStyleStr(_cutMid) }
const refreshCutBot = () => { cutBotStyle.value = _centerStyleStr(_cutBot) }
const refreshCuts = () => { refreshCutTop(); refreshCutMid(); refreshCutBot() }
const refreshDraws = () => { drawsStyle.value = _draws.map(s => _centerStyleStr(s)) }
const refreshInners = () => { innersStyle.value = _inners.map(s => _innerStyleStr(s)) }

// ---- 窗口 resize（跨端兼容：替代 window.addEventListener('resize')）----
// UniApp 规范：uni.onWindowResize / uni.offWindowResize
let _resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

function _checkWidth(windowWidth: number) {
  const wasWide = isWide.value
  isWide.value = windowWidth >= 768
  if (wasWide !== isWide.value && showResults.value) {
    nextTick(() => updateLayout())
  }
}

// ---- 生命周期 ----

onMounted(() => {
  const { windowWidth } = uni.getWindowInfo()
  _checkWidth(windowWidth)

  // 监听窗口尺寸变化（小程序 / H5 统一 API）
  _resizeHandler = (res) => { _checkWidth(res.size.windowWidth) }
  uni.onWindowResize(_resizeHandler)

  nextTick(() => {
    const cardHeight = getCardHeight()
    const entryDrop = cardHeight * 4

    // 背景淡入
    gsap.fromTo(_bg, { opacity: 0 }, {
      opacity: 1,
      duration: 1,
      onUpdate: refreshBg,
    })

    // 牌组从上方坠入并回弹（stagger：每张牌依次落下）
    gsap.fromTo(
      _initials,
      { y: -entryDrop, rotation: 180, scale: 0.5, opacity: 1, scaleY: 1, x: 0 },
      {
        y: (index: number) => -(index * 0.8),
        rotation: 0,
        scale: 1,
        scaleY: 1,
        duration: 1.2,
        ease: 'back.out(1.4)',
        stagger: 0.02,
        onUpdate: refreshInitials,
      },
    )

    // header / footer 从下方入场
    gsap.fromTo(
      [_header, _footer],
      { y: 100, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        delay: 0.8,
        ease: 'power2.out',
        onUpdate: () => { refreshHeader(); refreshFooter() },
      },
    )
  })
})

onUnmounted(() => {
  if (_resizeHandler) uni.offWindowResize(_resizeHandler)
  gsap.killTweensOf([
    _bg,
    _stage,
    _header,
    _footer,
    _deckCtn,
    ..._initials,
    ..._lefts,
    ..._rights,
    _cutTop,
    _cutMid,
    _cutBot,
    ..._draws,
    ..._inners,
  ])
})

// ---- 洗牌动画 ----
// 牌组拆分左右 → 交叉合并 → 弹性归位；完成后显示「下一步」按钮
function playShuffle() {
  actionDone.value = false
  phasePrompt.value = overlay_text.prompt_shuffling
  const cardWidth = getCardWidth()
  const spreadX = cardWidth * 0.85

  const timeline = gsap.timeline({
    onComplete: () => {
      actionDone.value = true
      phasePrompt.value = overlay_text.prompt_cut
    },
  })

  // 初始化：隐藏初始牌，显示左右牌（等价于原 .set + autoAlpha）
  timeline.add(() => {
    _initials.forEach(s => { s.opacity = 0 })
    refreshInitials()

    _lefts.forEach((s, i) => { s.opacity = 1; s.x = 0; s.y = -(i * 0.8); s.rotation = 0; s.scale = 1; s.scaleY = 1 })
    _rights.forEach((s, i) => { s.opacity = 1; s.x = 0; s.y = -4.8 - i * 0.8; s.rotation = 0; s.scale = 1; s.scaleY = 1 })
    leftsVisible.value = true
    rightsVisible.value = true
    refreshLefts()
    refreshRights()
  })

  // 左右分开
  timeline
    .to(_lefts, { x: -spreadX, y: (i: number) => -30 - i * 0.8, rotation: -16, duration: 0.5, ease: 'power2.out', onUpdate: refreshLefts })
    .to(_rights, { x: spreadX, y: (i: number) => 30 - i * 0.8, rotation: 16, duration: 0.5, ease: 'power2.out', onUpdate: refreshRights }, '<')

    // 交叉穿插
    .to(_lefts, { x: 0, y: (i: number) => -(i * 1.6), rotation: -2, duration: 0.4, stagger: 0.06, ease: 'power2.out', onUpdate: refreshLefts }, '+=0.2')
    .to(_rights, { x: 0, y: (i: number) => -0.8 - i * 1.6, rotation: 2, duration: 0.4, stagger: 0.06, ease: 'power2.out', onUpdate: refreshRights }, '<0.03')

    // 归位
    .to(
      [..._lefts, ..._rights],
      { x: 0, rotation: 0, duration: 0.3, ease: 'back.out(1.5)', onUpdate: () => { refreshLefts(); refreshRights() } },
      '+=0.1',
    )

    // 隐藏左右牌，恢复初始牌并弹性效果
    .add(() => {
      _lefts.forEach(s => { s.opacity = 0 })
      _rights.forEach(s => { s.opacity = 0 })
      leftsVisible.value = false
      rightsVisible.value = false
      refreshLefts()
      refreshRights()

      _initials.forEach(s => { s.opacity = 1; s.scaleY = 0.9 })
      refreshInitials()
    })
    .to(_initials, { scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)', onUpdate: refreshInitials })
}

// ---- 切牌动画 ----
// 三张牌展开 → 互换位置 → 归位合并；完成后显示「抽取牌阵」按钮
function playCut() {
  phase.value = 'cutting'
  tarotStore.setPhase('cutting')
  actionDone.value = false
  phasePrompt.value = overlay_text.prompt_cutting

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
      phasePrompt.value = overlay_text.prompt_draw
    },
  })

  // 初始化切牌状态
  timeline.add(() => {
    Object.assign(_cutTop, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 })
    Object.assign(_cutMid, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 })
    Object.assign(_cutBot, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 })
    cutTopVisible.value = true
    cutMidVisible.value = true
    cutBotVisible.value = true
    refreshCuts()

    _initials.forEach(s => { s.opacity = 0 })
    refreshInitials()
  })

  timeline
    // 分离：上/下对调，中间保持
    .to(_cutTop, { x: leftX, y: leftY, duration: 0.7, ease: 'power3.out', onUpdate: refreshCutTop })
    .to(_cutBot, { x: rightX, y: rightY, duration: 0.7, ease: 'power3.out', onUpdate: refreshCutBot }, '<')

    // 整体放大（悬浮感）
    .to([_cutTop, _cutMid, _cutBot], { scale: 1.1, duration: 0.4, ease: 'power1.out', onUpdate: refreshCuts })

    // 互换：上→右、中→0、下→左
    .to(_cutTop, { x: rightX, y: rightY, zIndex: 11, duration: 0.7, ease: 'power2.inOut', onUpdate: refreshCutTop }, '+=0.15')
    .to(_cutMid, { x: 0, y: 0, zIndex: 12, duration: 0.7, ease: 'power2.inOut', onUpdate: refreshCutMid }, '<')
    .to(_cutBot, { x: leftX, y: leftY, zIndex: 13, duration: 0.7, ease: 'power2.inOut', onUpdate: refreshCutBot }, '<')

    // 归位合并（stagger 模拟原逻辑）
    .to(_cutTop, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)', onUpdate: refreshCutTop }, '+=0.2')
    .to(_cutMid, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.6, delay: 0.15, ease: 'back.out(1.5)', onUpdate: refreshCutMid }, '<')
    .to(_cutBot, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.6, delay: 0.3, ease: 'back.out(1.5)', onUpdate: refreshCutBot }, '<')

    // 隐藏切牌，恢复初始牌
    .add(() => {
      cutTopVisible.value = false
      cutMidVisible.value = false
      cutBotVisible.value = false
      refreshCuts()

      _initials.forEach(s => { s.opacity = 1 })
      refreshInitials()
    })
}

// ---- 抽牌动画 ----
// 牌组颤动 → 舞台上移 → 三张牌错落落下 → 翻牌 → 触发结果展示
function playDraw() {
  phase.value = 'drawing'
  tarotStore.setPhase('drawing')
  tarotStore.drawThreeCards()
  actionDone.value = false
  phasePrompt.value = overlay_text.prompt_drawing

  const { width: stage_width, height: stage_height } = getStageDimensions()
  const card_width = getCardWidth()
  const card_height = getCardHeight()
  const draw_layout = getDrawLayout(stage_width, stage_height, card_width, card_height, isWide.value)
  const { targetX, targetY, liftY } = draw_layout

  // 随机初始旋转角度（提前生成，避免每帧重新随机）
  const preRotations = [0, 1, 2].map(() => (Math.random() - 0.5) * 15)

  const timeline = gsap.timeline()

  // 牌组颤动（摇晃效果）
  timeline
    .to(_deckCtn, { x: '+=4', yoyo: true, repeat: 10, duration: 0.05, onUpdate: refreshDeckCtn })
    .to(_deckCtn, { x: 0, duration: 0.1, onUpdate: refreshDeckCtn })

  // 舞台上移 + 初始牌淡出
  timeline
    .to(_stage, { y: -liftY, duration: 1.8, ease: 'power2.inOut', onUpdate: refreshStage }, '+=0.2')
    .to(_initials, { opacity: 0, y: (i: number) => -card_height * 0.4 - i * 0.8, scale: 0.8, duration: 0.6, ease: 'power1.in', onUpdate: refreshInitials }, '<0.2')

  // 三张牌逐一从上方落下到目标位
  ;[0, 1, 2].forEach((index) => {
    timeline.add(() => {
      Object.assign(_draws[index], {
        x: 0,
        y: index === 0 ? -card_height * 0.3 : -stage_height,
        rotation: preRotations[index],
        scale: 1,
        opacity: 1,
        zIndex: 20 - index,
      })
      const newVisible = drawsVisible.value.map((v, i) => (i === index ? true : v))
      drawsVisible.value = newVisible
      refreshDraws()
    }, 1 + index * 0.3)

    timeline
      .to(_draws[index], { x: targetX[index], y: targetY[index] + card_height * 0.4, duration: 0.7, ease: 'power2.in', onUpdate: refreshDraws }, '>')
      .to(_draws[index], { y: targetY[index] + card_height * 0.56, duration: 0.4, ease: 'power1.out', onUpdate: refreshDraws }, '>')
      .to(_draws[index], { y: targetY[index], duration: 1.5, ease: 'power3.out', onUpdate: refreshDraws }, '>')
  })

  // 三张牌均落定后：对齐最终位置 → 压缩 → 翻牌
  const alignTime = 1 + 2 * 0.3 + 0.7 + 0.4 + 1.5 + 0.5

  timeline
    .to(
      _draws,
      {
        x: (index: number) => targetX[index],
        y: (index: number) => targetY[index],
        rotation: 0,
        duration: 0.8,
        ease: 'power3.inOut',
        onUpdate: refreshDraws,
      },
      alignTime + 0.1,
    )
    .to(_draws, { scale: 0.92, duration: 0.5, ease: 'power1.out', onUpdate: refreshDraws }, alignTime + 0.9)
    // 翻牌（3D rotationY: 180deg，stagger 依次翻转）
    .to(
      _inners,
      { rotationY: 180, duration: 1, stagger: 0.4, ease: 'back.out(1.1)', onUpdate: refreshInners },
      alignTime + 1.2,
    )
    .add(() => {
      phase.value = 'revealing'
      tarotStore.setPhase('revealing')
      phasePrompt.value = overlay_text.revealed
    }, alignTime + 2.7)
    .add(() => { finish() }, alignTime + 4.3)
}

// ---- 结果布局更新（resize 或进入结果展示时调用）----
// 重新计算3张牌的目标坐标并动画至新位置
function updateLayout() {
  if (phase.value !== 'revealing' && phase.value !== 'drawing') return

  const { width: stage_width, height: stage_height } = getStageDimensions()
  const card_width = getCardWidth()
  const card_height = getCardHeight()

  let targetX = [0, 0, 0]
  let targetY = [0, 0, 0]

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
        const row_cols = Math.min(3 - i, cols)
        const row_width = row_cols * card_width + (row_cols - 1) * gap_x
        const start_x = -row_width / 2 + card_width / 2
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

    gsap.to(_stage, { y: 0, duration: 0.6, ease: 'power2.out', onUpdate: refreshStage })
  } else {
    const layout = getDrawLayout(stage_width, stage_height, card_width, card_height, isWide.value)
    targetX = layout.targetX
    targetY = layout.targetY
  }

  _draws.forEach((draw, i) => {
    gsap.to(draw, {
      x: targetX[i],
      y: targetY[i],
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto',
      onUpdate: refreshDraws,
    })
  })
}

function finish() {
  tarotStore.revealResult()
  showResults.value = true
  phasePrompt.value = overlay_text.result
  nextTick(() => { updateLayout() })
}

function handleRestart() {
  showResults.value = false
  emit('restart')
}
</script>

<style scoped>
.divination-overlay {
  --card-width: 172px;
  --card-height: calc(var(--card-width) * 1.6);

  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 布局切换的过渡 */
  transition: flex-direction 0.4s ease;
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
  /* 深色神秘背景；opacity 由 GSAP 驱动淡入 */
  background: rgba(242, 232, 208, 0.97);
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
  background: rgba(242, 232, 208, 0.92);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.is-wide .result-zone {
  border-top: none;
  border-left: 1px solid var(--color-border);
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

/* 进度条头部位置 */
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

.show-results .progress-header {
  margin-top: calc(env(safe-area-inset-top, 0px) + 20rpx);
}
/* #endif */

/* #ifdef MP-WEIXIN */
.progress-header {
  /* 小程序需要更大的顶部间距，避开刘海(44px) + 胶囊按钮(32px) + 额外间距 */
  margin-top: calc(env(safe-area-inset-top, 44px) + 140rpx);
}

.show-results .progress-header {
  margin-top: calc(env(safe-area-inset-top, 44px) + 80rpx);
}
/* #endif */

.phase-prompt {
  font-size: 28rpx;
  color: var(--color-text-primary);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.05em;
}

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

.stage > view,
.stage > image {
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

/* #ifdef H5 */
.stack-card:first-child {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
}
/* #endif */

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

.draw-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
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
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
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
  background: linear-gradient(to bottom, #2b302a, #1a1e19);
  border-radius: 40rpx;
  border: none;
  color: #cca957;
  font-weight: bold;
}

.revealing-hint {
  color: var(--color-accent);
  letter-spacing: 0.1em;
  font-size: 28rpx;
  opacity: 0.9;
}

.thinking-dots span {
  display: inline-block;
  animation: dot-pulse 1.4s infinite;
}

/* #ifdef H5 */
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
/* #endif */

/* #ifdef MP-WEIXIN */
/* 小程序使用类名替代nth-child */
.thinking-dots .dot-2 { animation-delay: 0.2s; }
.thinking-dots .dot-3 { animation-delay: 0.4s; }
/* #endif */

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-4rpx); }
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
