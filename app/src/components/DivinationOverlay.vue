<template>
  <view class="divination-overlay" :class="{ 'show-results': showResults, 'is-wide': isWide }" :style="overlayVarsStyle">
    <view class="overlay-bg" :style="bgStyle" />

    <!-- Animation area: always present, shrinks to top/left after results shown -->
    <view class="stage-container">
      <view class="progress-header" :style="headerStyle">
        <view class="phase-progress-bar">
          <view
            v-for="(step, idx) in phaseSteps"
            :key="step.phase"
            class="phase-step"
          >
            <image
              class="phase-step-icon"
              :src="idx <= activePhaseIndex ? themeStore.getUiAsset(step.activeIcon) || themeStore.getUiAsset(step.inactiveIcon) : themeStore.getUiAsset(step.inactiveIcon) || themeStore.getUiAsset(step.activeIcon)"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>

      <!-- Animation stage: :style drives GSAP y-lift animation -->
      <view class="stage" :style="stageStyle">
        <!-- Deck container: :style drives shuffle shake animation -->
        <view class="deck-layer" :style="deckCtnStyle">
          <!-- Initial deck (12 stacked cards): style driven by GSAP state object -->
          <image
            v-for="i in 12"
            :key="`m${i}`"
            class="tarot-card stack-card initial-deck"
            :src="cardBack"
            :style="initialsStyle[i-1]"
          />

          <!-- Shuffle left half: v-show + style driven by GSAP state object -->
          <image
            v-for="i in 6"
            :key="`l${i}`"
            v-show="leftsVisible"
            class="tarot-card stack-card"
            :src="cardBack"
            :style="leftsStyle[i-1]"
          />
          <!-- Shuffle right half: v-show + style driven by GSAP state object -->
          <image
            v-for="i in 6"
            :key="`r${i}`"
            v-show="rightsVisible"
            class="tarot-card stack-card"
            :src="cardBack"
            :style="rightsStyle[i-1]"
          />
        </view>

        <!-- Cut cards: v-show + style driven by GSAP state object; centerStyle uses calc(-50%+Xpx) for centering -->
        <image v-show="cutTopVisible" class="tarot-card stage-center cut-t" :src="cardBack" :style="cutTopStyle" />
        <image v-show="cutMidVisible" class="tarot-card stage-center cut-m" :src="cardBack" :style="cutMidStyle" />
        <image v-show="cutBotVisible" class="tarot-card stage-center cut-b" :src="cardBack" :style="cutBotStyle" />

        <view class="draw-container">
          <!-- Drawn cards: v-show + style driven by GSAP state object; centerStyle uses calc(-50%+Xpx) for centering -->
          <view
            v-for="(_, idx) in drawsVisible"
            :key="idx"
            v-show="drawsVisible[idx]"
            class="draw-wrapper stage-center"
            :style="[drawsStyle[idx], drawsSizeStyle[idx]]"
          >
            <!-- 3D flip inner: style driven by GSAP rotationY -->
            <view class="card-3d-inner" :style="[innersStyle[idx], drawsSizeStyle[idx]]">
              <image class="tarot-card face-back" :src="cardBack" />
              <view class="tarot-card face-front">
                <image class="front-img" :src="getCardImg(idx)" />
              </view>
            </view>

            <!-- Upright/Reversed badge, fades in after flip -->
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

      <!-- Bottom action area: :style drives entry animation -->
      <view class="action-footer" :style="footerStyle">
        <view class="actions">
          <!-- Show restart button after results are displayed -->
          <template v-if="showResults">
            <view class="btn btn-primary" @click="handleRestart">{{ overlay_text.restart }}</view>
          </template>



          <template v-else-if="phase === 'revealing'">
            <!-- Text hint + animated dots, shown while waiting for reading result -->
            <view class="revealing-hint font-display">
              {{ overlay_text.revealing }}<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </view>
          </template>
        </view>
      </view>
    </view>

    <!-- Result area: slides in from bottom/right after results shown -->
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
  File purpose: Full-screen divination overlay component
  - Includes shuffle / cut / draw three-phase animation
  - Displays tarot interpretation result (ResultPanel) after three phases
  - Supports responsive layout for wide (≥768px) and narrow screens

  Cross-platform compatibility (H5 & WeChat Mini Program):
  - Avoid window.innerWidth/innerHeight, use uni.getWindowInfo() instead
  - Avoid window.addEventListener/removeEventListener, use uni.onWindowResize/offWindowResize
  - Avoid getBoundingClientRect/offsetWidth/offsetHeight, calculate from window dimensions
  - GSAP cannot directly manipulate DOM elements, use "plain JS state object + onUpdate → Vue ref<string> :style binding" pattern:
      1. Define plain JS state objects (e.g., _bg, _initials[], _draws[])
      2. GSAP tweens operate on state objects, refresh functions called in onUpdate
      3. Refresh functions serialize state objects to CSS style strings, written to Vue refs
      4. Template binds with :style="xxxStyle", Vue handles final DOM updates
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import gsap from 'gsap'
import { useTarotStore } from '../stores/tarot'
import { useThemeStore } from '../stores/theme'
import ResultPanel from './ResultPanel.vue'
import { CARD_BACK_IMAGE } from '../constants'
import { resolveSpreadLayout, type SpreadScene, getSpreadCardCount } from '../utils/spread_layout'

// Emits definition
// complete - triggered when divination flow completes (draw animation ends, result about to show)
// restart  - triggered when user clicks restart
const emit = defineEmits<{
  (event: 'complete'): void
  (event: 'restart'): void
}>()

const tarotStore = useTarotStore()
const themeStore = useThemeStore()

// Card back image
const cardBack = computed(() => themeStore.cardBackImage || CARD_BACK_IMAGE)

// Runtime card count from store spread kind
const cardCount = computed(() => getSpreadCardCount(tarotStore.spreadKind))

// Max cards for array initialization (cross_spread has 5)
const MAX_CARD_COUNT = 5

/**
 * Current phase icon mapping
 * Wands=shuffle, Swords=cut, Cups=draw, Pentacles=interpret.
 */
const phaseSteps = [
  {
    phase: 'shuffling',
    activeIcon: 'icon_wands',
    inactiveIcon: 'icon_wands_inactive',
  },
  {
    phase: 'cutting',
    activeIcon: 'icon_swords',
    inactiveIcon: 'icon_swords_inactive',
  },
  {
    phase: 'drawing',
    activeIcon: 'icon_cups',
    inactiveIcon: 'icon_cups_inactive',
  },
  {
    phase: 'revealing',
    activeIcon: 'icon_pentacles',
    inactiveIcon: 'icon_pentacles_inactive',
  },
] as const

// Index of the current phase in phaseSteps (0=shuffling, 1=cutting, 2=drawing, 3=revealing)
const activePhaseIndex = computed(() =>
  phaseSteps.findIndex(s => s.phase === phase.value)
)

// User-facing copy strings.
const overlay_text = {
  position_reversed: '逆',
  position_upright: '正',
  restart: '再占一次',
  revealing: '神谕显现中',
}

// ---- Reactive state ----
const phase = ref<'shuffling' | 'cutting' | 'drawing' | 'revealing'>('shuffling')
const showResults = ref(false)
const isWide = ref(false)

// Card dimensions from layout solver (consumed by draw/result cards)
const layoutCardWidth = ref(172)
const layoutCardHeight = ref(275)

// CSS variables driven by solver output — cross-platform alternative to document.querySelector
const overlayVarsStyle = computed(() =>
  `--card-width: ${layoutCardWidth.value}px; --card-height: ${layoutCardHeight.value}px`
)

// Track entry animation completion to prevent shuffle CTA competition
const entryAnimationComplete = ref(false)
let entryTimeline: gsap.core.Timeline | null = null
let readingRequestTimer: ReturnType<typeof setTimeout> | null = null

function getCardImg(index: number) {
  return tarotStore.drawnCards[index]?.card.image || cardBack.value
}

// ---- Window dimensions (cross-platform: replaces window.innerWidth/innerHeight) ----
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

/**
 * Get current card dimensions from the spread layout solver
 * This ensures consistency with resolveSpreadLayout calculations
 */
function getCardDimensions(): { width: number; height: number } {
  const { width: stage_width, height: stage_height } = getStageDimensions()
  const scene: SpreadScene = showResults.value ? 'result_stage' : 'draw_stage'
  const layout = resolveSpreadLayout({
    spreadKind: tarotStore.spreadKind,
    scene,
    containerWidth: stage_width,
    containerHeight: stage_height,
    isWide: isWide.value,
    cardAspectRatio: 1.6,
  })
  return { width: layout.cardWidth, height: layout.cardHeight }
}

// Backward compatibility: use layout solver dimensions
function getCardWidth(): number {
  return getCardDimensions().width
}

function getCardHeight(): number {
  return getCardDimensions().height
}

// Calculate stage dimensions from layout state (replaces getBoundingClientRect)
// stage is position:absolute; inset:0 filling stage-container
// stage-container dimensions determined by CSS layout, calculable from window dimensions
function getStageDimensions(): { width: number; height: number } {
  const { windowWidth, windowHeight } = uni.getWindowInfo()
  const topBar = getTopBarHeight()
  if (showResults.value) {
    if (isWide.value) return { width: windowWidth * 0.44, height: windowHeight }
    return { width: windowWidth, height: windowHeight * 0.42 }
  }
  return { width: windowWidth, height: windowHeight - topBar }
}

// ---- GSAP animation state objects (plain JS, GSAP manipulates these directly) ----
// Avoid Vue reactivity to prevent direct DOM manipulation in WeChat Mini Program

interface CardState {
  x: number
  y: number
  rotation: number
  scale: number
  scaleY: number  // only for shuffle end bounce effect
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

// Background overlay
const _bg = { opacity: 0 }
// Stage overall (moves up during draw)
const _stage = { y: 0 }
// Progress header / footer actions (entry animation)
const _header = { y: 60, opacity: 0 }
const _footer = { y: 60, opacity: 0 }
// Deck container (shuffle shake effect)
const _deckCtn = { x: 0 }
// Initial deck 12 cards (stacked)
const _initials: CardState[] = Array.from({ length: 12 }, (_, i) => ({
  x: 0, y: -(i * 0.8), rotation: 0, scale: 1, scaleY: 1, opacity: 1,
}))
// Shuffle left/right 6 cards each
const _lefts: CardState[] = Array.from({ length: 6 }, () => ({
  x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
}))
const _rights: CardState[] = Array.from({ length: 6 }, () => ({
  x: 0, y: 0, rotation: 0, scale: 1, scaleY: 1, opacity: 0,
}))
// Cut cards 3 (absolute positioned centered)
const _cutTop: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
const _cutMid: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
const _cutBot: CenterCardState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 10 }
// Drawn cards (absolute positioned centered)
const _draws: CenterCardState[] = Array.from({ length: MAX_CARD_COUNT }, (_, i) => ({
  x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, zIndex: 20 - i,
}))
// 3D flip inner
const _inners: InnerState[] = Array.from({ length: MAX_CARD_COUNT }, () => ({ rotationY: 0 }))

// ---- Vue style refs (bound to template :style, updated by refresh functions) ----

const bgStyle = ref('opacity: 0')
const stageStyle = ref('')
const headerStyle = ref('transform: translateY(60px); opacity: 0')
const footerStyle = ref('transform: translateY(60px); opacity: 0')
const deckCtnStyle = ref('')


// Initial values consistent with _initials state
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

const drawsVisible = ref<boolean[]>(Array(MAX_CARD_COUNT).fill(false))
const drawsStyle = ref<string[]>(Array(MAX_CARD_COUNT).fill(''))
const drawsSizeStyle = ref<{ width: string; height: string }[]>(Array(MAX_CARD_COUNT).fill({ width: '', height: '' }))
const innersStyle = ref<string[]>(Array(MAX_CARD_COUNT).fill(''))



// ---- CSS style string constructors ----

// Normal cards (stack-card): simple translate + rotate + scale
function _cardStyleStr(s: CardState): string {
  const sy = s.scaleY !== 1 ? ` scaleY(${s.scaleY})` : ''
  return (
    `transform: translateX(${s.x}px) translateY(${s.y}px) rotate(${s.rotation}deg) scale(${s.scale})${sy};` +
    ` opacity: ${s.opacity}; will-change: transform`
  )
}

// Centered cards (stage-center): transform includes calc(-50% + Xpx) offset, replaces GSAP xPercent/yPercent:-50
function _centerStyleStr(s: CenterCardState): string {
  return (
    `transform: translateX(calc(-50% + ${s.x}px)) translateY(calc(-50% + ${s.y}px))` +
    ` rotate(${s.rotation}deg) scale(${s.scale});` +
    ` opacity: ${s.opacity}; z-index: ${s.zIndex}; will-change: transform`
  )
}

// Card size style string constructor (uses solver-returned dimensions)
function _cardSizeStyleStr(width: number, height: number): { width: string; height: string } {
  return {
    width: `${width}px`,
    height: `${height}px`,
  }
}

// 3D flip inner
function _innerStyleStr(s: InnerState): string {
  return `transform: rotateY(${s.rotationY}deg)`
}

// ---- Refresh functions (called in GSAP onUpdate, sync state objects to Vue refs) ----

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
const refreshDraws = () => {
  drawsStyle.value = _draws.map(s => _centerStyleStr(s))
}
const refreshInners = () => { innersStyle.value = _inners.map(s => _innerStyleStr(s)) }

function clearReadingRequestTimer() {
  if (readingRequestTimer !== null) {
    clearTimeout(readingRequestTimer)
    readingRequestTimer = null
  }
}

function scheduleReadingRequest() {
  clearReadingRequestTimer()
  readingRequestTimer = setTimeout(() => {
    readingRequestTimer = null
    tarotStore.startReadingRequest().catch(() => {
      // Keep the overlay in revealing state when the request fails.
    })
  }, 0)
}

/**
 * Ensure the entry animation is fully settled before a user-triggered flow animation starts.
 * This prevents the first shuffle from competing with the mount-time tweens and causing a hitch.
 */
function settleEntryAnimation() {
  if (entryTimeline) {
    entryTimeline.progress(1)
    entryTimeline.kill()
    entryTimeline = null
  }

  _bg.opacity = 1
  refreshBg()

  _initials.forEach((state, index) => {
    state.x = 0
    state.y = -(index * 0.8)
    state.rotation = 0
    state.scale = 1
    state.scaleY = 1
    state.opacity = 1
  })
  refreshInitials()

  _header.y = 0
  _header.opacity = 1
  _footer.y = 0
  _footer.opacity = 1
  refreshHeader()
  refreshFooter()

  entryAnimationComplete.value = true
}

// ---- Window resize (cross-platform: replaces window.addEventListener('resize')) ----
// UniApp spec: uni.onWindowResize / uni.offWindowResize
let _resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

function _checkWidth(windowWidth: number) {
  const wasWide = isWide.value
  isWide.value = windowWidth >= 768
  if (wasWide !== isWide.value && showResults.value) {
    nextTick(() => updateLayout())
  }
}

// ---- Lifecycle ----

onMounted(() => {
  const { windowWidth } = uni.getWindowInfo()
  _checkWidth(windowWidth)

  // Initialize card dimensions from solver before entry animation
  const initDims = getCardDimensions()
  layoutCardWidth.value = initDims.width
  layoutCardHeight.value = initDims.height

  // Listen for window size changes (unified API for mini program / H5)
  _resizeHandler = (res) => { _checkWidth(res.size.windowWidth) }
  uni.onWindowResize(_resizeHandler)

  nextTick(() => {
    const cardHeight = getCardHeight()
    const entryDrop = cardHeight * 4
    entryAnimationComplete.value = false

    entryTimeline = gsap.timeline({
      onComplete: () => {
        entryAnimationComplete.value = true
        entryTimeline = null
        setTimeout(() => { playShuffle() }, 300)
      },
    })

    entryTimeline.fromTo(_bg, { opacity: 0 }, {
      opacity: 1,
      duration: 0.7,
      onUpdate: refreshBg,
    }, 0)

    entryTimeline.fromTo(
      _initials,
      { y: -entryDrop, rotation: 180, scale: 0.5, opacity: 1, scaleY: 1, x: 0 },
      {
        y: (index: number) => -(index * 0.8),
        rotation: 0,
        scale: 1,
        scaleY: 1,
        duration: 1.05,
        ease: 'power3.out',
        stagger: 0.02,
        onUpdate: refreshInitials,
      },
      0,
    )

    entryTimeline.fromTo(_header, { y: 100, opacity: 0 }, {
      y: 0,
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: refreshHeader,
    }, 0.4)

    entryTimeline.fromTo(_footer, { y: 100, opacity: 0 }, {
      y: 0,
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
      onUpdate: refreshFooter,
    }, 0.6)
  })
})

onUnmounted(() => {
  clearReadingRequestTimer()
  if (_resizeHandler) uni.offWindowResize(_resizeHandler)
  if (entryTimeline) {
    entryTimeline.kill()
  }
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

// ---- Shuffle animation ----
// Deck splits left/right → cross-merge → bounce back; shows "next step" button on complete
function playShuffle() {
  settleEntryAnimation()

  const cardWidth = getCardWidth()
  const spreadX = cardWidth * 0.85

  // Timeline-level onUpdate fires once per RAF frame regardless of how many sub-tweens are active,
  // eliminating the O(stagger_count) per-frame refresh calls during the cross-interleave phase.
  const timeline = gsap.timeline({
    onComplete: () => {
      playCut()
    },
    onUpdate: () => {
      refreshInitials()
      refreshLefts()
      refreshRights()
    },
  })

  // Init: hide initial cards, show left/right cards (equivalent to original .set + autoAlpha)
  // Position 0 — run immediately at t=0, parallel with phase indicator tween
  timeline.add(() => {
    _initials.forEach(s => { s.opacity = 0 })
    refreshInitials()

    _lefts.forEach((s, i) => { s.opacity = 1; s.x = 0; s.y = -(i * 0.8); s.rotation = 0; s.scale = 1; s.scaleY = 1 })
    _rights.forEach((s, i) => { s.opacity = 1; s.x = 0; s.y = -4.8 - i * 0.8; s.rotation = 0; s.scale = 1; s.scaleY = 1 })
    leftsVisible.value = true
    rightsVisible.value = true
    refreshLefts()
    refreshRights()
  }, 0)

  // Split left/right — starts at t=0, parallel with phase indicator
  timeline
    .to(_lefts, { x: -spreadX, y: (i: number) => -30 - i * 0.8, rotation: -16, duration: 0.5, ease: 'power2.out' }, 0)
    .to(_rights, { x: spreadX, y: (i: number) => 30 - i * 0.8, rotation: 16, duration: 0.5, ease: 'power2.out' }, '<')

    // Cross interleave — previously each staggered sub-tween had its own onUpdate (6× per frame each)
    .to(_lefts, { x: 0, y: (i: number) => -(i * 1.6), rotation: -2, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '+=0.2')
    .to(_rights, { x: 0, y: (i: number) => -0.8 - i * 1.6, rotation: 2, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '<0.03')

    // Return to position
    .to(
      [..._lefts, ..._rights],
      { x: 0, rotation: 0, duration: 0.3, ease: 'back.out(1.5)' },
      '+=0.1',
    )

    // Hide left/right cards, restore initial cards with bounce effect
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
    .to(_initials, { scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
}

// ---- Cut animation ----
// 3 cards expand → swap positions → merge back; shows "draw spread" button on complete
function playCut() {
  phase.value = 'cutting'
  tarotStore.setPhase('cutting')

  const cardWidth = getCardWidth()
  const cardHeight = getCardHeight()
  const spread = isWide.value ? cardWidth * 1.5 : cardHeight * 1.3
  const leftX = isWide.value ? -spread : 0
  const leftY = isWide.value ? 0 : -spread
  const rightX = isWide.value ? spread : 0
  const rightY = isWide.value ? 0 : spread

  // Timeline-level onUpdate fires once per RAF frame, covering all cut card tweens.
  const timeline = gsap.timeline({
    onComplete: () => {
      playDraw()
    },
    onUpdate: () => {
      refreshInitials()
      refreshCuts()
    },
  })

  // Init cut card state
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
    // Separate: top/bottom swap, middle stays
    .to(_cutTop, { x: leftX, y: leftY, duration: 0.7, ease: 'power3.out' })
    .to(_cutBot, { x: rightX, y: rightY, duration: 0.7, ease: 'power3.out' }, '<')

    // Overall scale up (levitation effect)
    .to([_cutTop, _cutMid, _cutBot], { scale: 1.1, duration: 0.4, ease: 'power1.out' })

    // Swap: top→right, middle→0, bottom→left
    .to(_cutTop, { x: rightX, y: rightY, zIndex: 11, duration: 0.7, ease: 'power2.inOut' }, '+=0.15')
    .to(_cutMid, { x: 0, y: 0, zIndex: 12, duration: 0.7, ease: 'power2.inOut' }, '<')
    .to(_cutBot, { x: leftX, y: leftY, zIndex: 13, duration: 0.7, ease: 'power2.inOut' }, '<')

    // Merge back (stagger simulates original logic)
    .to(_cutTop, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, '+=0.2')
    .to(_cutMid, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.6, delay: 0.15, ease: 'back.out(1.5)' }, '<')
    .to(_cutBot, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.6, delay: 0.3, ease: 'back.out(1.5)' }, '<')

    // Hide cut cards, restore initial deck
    .add(() => {
      cutTopVisible.value = false
      cutMidVisible.value = false
      cutBotVisible.value = false
      refreshCuts()

      _initials.forEach(s => { s.opacity = 1 })
      refreshInitials()
    })
}

// ---- Draw animation ----
// Deck trembles → stage lifts → cards fall staggered → flip → triggers result display
function playDraw() {
  phase.value = 'drawing'
  tarotStore.setPhase('drawing')
  tarotStore.drawCards()

  const { width: stage_width, height: stage_height } = getStageDimensions()
  const card_height = getCardHeight()

  // Use spread layout solver for draw stage
  const drawLayout = resolveSpreadLayout({
    spreadKind: tarotStore.spreadKind,
    scene: 'draw_stage',
    containerWidth: stage_width,
    containerHeight: stage_height,
    isWide: isWide.value,
    cardAspectRatio: 1.6,
  })

  const targetX = drawLayout.cards.map(c => c.x)
  const targetY = drawLayout.cards.map(c => c.y)
  const liftY = drawLayout.stageShiftY

  // Set initial card sizes from solver output
  drawsSizeStyle.value = drawLayout.cards.map(c => _cardSizeStyleStr(c.width, c.height))

  // Sync CSS vars with solver output for the draw phase
  layoutCardWidth.value = drawLayout.cardWidth
  layoutCardHeight.value = drawLayout.cardHeight

  // Random initial rotation angles (pre-generate to avoid re-randomizing per frame)
  const preRotations = Array.from({ length: cardCount.value }, () => (Math.random() - 0.5) * 15)



  // Timeline-level onUpdate fires once per RAF frame, covering all draw-phase sub-tweens.
  const timeline = gsap.timeline({
    onUpdate: () => {
      refreshDeckCtn()
      refreshStage()
      refreshInitials()
      refreshDraws()
      refreshInners()
    },
  })

  // Deck trembles (shake effect)
  timeline
    .to(_deckCtn, { x: '+=4', yoyo: true, repeat: 10, duration: 0.05 })
    .to(_deckCtn, { x: 0, duration: 0.1 })

  // Stage lifts + initial cards fade out
  timeline
    .to(_stage, { y: -liftY, duration: 1.8, ease: 'power2.inOut' }, '+=0.2')
    .to(_initials, { opacity: 0, y: (i: number) => -card_height * 0.4 - i * 0.8, scale: 0.8, duration: 0.6, ease: 'power1.in' }, '<0.2')

  // Cards fall from above to target positions
  Array.from({ length: cardCount.value }, (_, i) => i).forEach((index) => {
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
      .to(_draws[index], { x: targetX[index], y: targetY[index] + card_height * 0.4, duration: 0.7, ease: 'power2.in' }, '>')
      .to(_draws[index], { y: targetY[index] + card_height * 0.56, duration: 0.4, ease: 'power1.out' }, '>')
      .to(_draws[index], { y: targetY[index], duration: 1.5, ease: 'power3.out' }, '>')
  })

  // After all cards land: align → compress → flip
  // alignTime is based on the last card's fall sequence
  const alignTime = 1 + (cardCount.value - 1) * 0.3 + 0.7 + 0.4 + 1.5 + 0.5
  // revealingStart: after align(0.8s) + compress(0.5s) + flip(1s + stagger) with small buffer
  const flipDuration = 1 + (cardCount.value - 1) * 0.4
  const revealingStart = alignTime + 1.2 + flipDuration + 0.1
  // finishTime: 0.3s after revealing starts — reading request was fired at t=0, already resolved
  const finishTime = revealingStart + 0.3

  timeline
    .to(
      _draws,
      {
        x: (index: number) => targetX[index],
        y: (index: number) => targetY[index],
        rotation: 0,
        duration: 0.8,
        ease: 'power3.inOut',
      },
      alignTime + 0.1,
    )
    .to(_draws, { scale: 0.92, duration: 0.5, ease: 'power1.out' }, alignTime + 0.9)
    // Flip (3D rotationY: 180deg, stagger sequential flip) — previously 3× onUpdate per frame
    .to(
      _inners,
      { rotationY: 180, duration: 1, stagger: 0.4, ease: 'back.out(1.1)' },
      alignTime + 1.2,
    )
    .add(() => {
      phase.value = 'revealing'
      tarotStore.setPhase('revealing')
    }, revealingStart)
    .add(() => { void finish() }, finishTime)

  scheduleReadingRequest()
}

// ---- Result layout update (called on resize or when entering result display) ----
// Recalculate target coordinates for cards and animate to new positions
function updateLayout() {
  if (phase.value !== 'revealing' && phase.value !== 'drawing') return

  const { width: stage_width, height: stage_height } = getStageDimensions()

  // Use spread layout solver for result stage
  const scene: SpreadScene = showResults.value ? 'result_stage' : 'draw_stage'
  const layout = resolveSpreadLayout({
    spreadKind: tarotStore.spreadKind,
    scene,
    containerWidth: stage_width,
    containerHeight: stage_height,
    isWide: isWide.value,
    cardAspectRatio: 1.6,
  })

  // Consume solver-returned card dimensions for result stage
  layoutCardWidth.value = layout.cardWidth
  layoutCardHeight.value = layout.cardHeight

  // Update per-card size styles from solver output
  drawsSizeStyle.value = layout.cards.map(c => _cardSizeStyleStr(c.width, c.height))

  const targetX = layout.cards.map(c => c.x)
  const targetY = layout.cards.map(c => c.y)

  if (showResults.value) {
    gsap.to(_stage, { y: 0, duration: 0.6, ease: 'power2.out', onUpdate: refreshStage })
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

async function finish() {
  try {
    if (!tarotStore.readingResult) {
      await tarotStore.waitForReadingResult()
    }
  } catch {
    return
  }

  if (!tarotStore.readingResult) {
    return
  }

  tarotStore.revealResult()
  showResults.value = true
  nextTick(() => { updateLayout() })
}

function handleRestart() {
  clearReadingRequestTimer()
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
  /* Layout transition */
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
  /* Dark mystical background; opacity driven by GSAP fade-in */
  background: rgba(242, 232, 208, 0.97);
}

/* Post-result container deformation */
.stage-container {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: flex 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  /* Default fills all vertical space */
  flex: 1 0 100%;
  height: 100vh;
}

/* Narrow screen: after results shown, animation area shrinks to upper half */
.show-results .stage-container {
  flex: 0 0 42vh;
  height: 42vh;
  min-height: 260px;
}

/* Wide screen: after results shown, animation area becomes left column */
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

.is-wide .result-zone {
  animation-name: result-slide-in-right;
}

/* Progress header position */
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
  /* Mini program needs larger top margin to avoid notch(44px) + capsule button(32px) + extra spacing */
  margin-top: calc(env(safe-area-inset-top, 44px) + 140rpx);
}

.show-results .progress-header {
  margin-top: calc(env(safe-area-inset-top, 44px) + 80rpx);
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
  box-shadow: 0 4px 12rpx rgba(0, 0, 0, 0.15);
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
}

.front-img {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
  object-fit: cover;
}

/* Upright/Reversed badge */
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
/* Mini program uses class names instead of nth-child */
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
