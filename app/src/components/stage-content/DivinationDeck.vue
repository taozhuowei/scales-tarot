<template>
  <view
    class="divination-deck"
    :class="{ 'show-results': animCtrl.showResults.value }"
    :style="rootStyle"
    role="img"
    aria-label="占卜牌堆"
  >
    <!-- 初始牌堆层 -->
    <view class="deck-layer stage-pointer" :style="animCtrl.deckCtnStyle.value">
      <image
        v-for="i in animCtrl.deckCount"
        :key="`m${i}`"
        class="tarot-card stack-card initial-deck"
        :src="cardBack"
        :style="animCtrl.initialsStyle.value[i - 1]"
        alt="塔罗牌背面"
        lazy-load
      />
      <image
        v-for="i in animCtrl.shuffleHalfCount"
        :key="`l${i}`"
        v-show="animCtrl.leftsVisible.value"
        class="tarot-card stack-card"
        :src="cardBack"
        :style="animCtrl.leftsStyle.value[i - 1]"
        alt="塔罗牌背面"
        lazy-load
      />
      <image
        v-for="i in animCtrl.shuffleHalfCount"
        :key="`r${i}`"
        v-show="animCtrl.rightsVisible.value"
        class="tarot-card stack-card"
        :src="cardBack"
        :style="animCtrl.rightsStyle.value[i - 1]"
        alt="塔罗牌背面"
        lazy-load
      />
    </view>

    <!-- 切牌堆 -->
    <view
      v-for="pIdx in animCtrl.cutPileCount"
      :key="`pile${pIdx}`"
      v-show="animCtrl.pilesVisible.value[pIdx - 1]"
      class="cut-pile stage-center stage-pointer"
      :style="animCtrl.pilesStyle.value[pIdx - 1]"
    >
      <image
        v-for="cIdx in animCtrl.cardsPerPile"
        :key="`pile${pIdx}-${cIdx}`"
        class="tarot-card pile-card"
        :src="cardBack"
        :style="`top: ${-(cIdx - 1) * 2.5}px; left: ${(cIdx - 1) * 0.8}px; z-index: ${cIdx};`"
        alt="切牌堆"
        lazy-load
      />
    </view>

    <!-- 抽牌容器（3D 翻牌） -->
    <view class="draw-container">
      <view
        v-for="(_, idx) in animCtrl.drawsVisible.value"
        :key="idx"
        v-show="animCtrl.drawsVisible.value[idx]"
        class="draw-wrapper stage-center stage-pointer"
        :style="[animCtrl.drawsStyle.value[idx], animCtrl.drawsSizeStyle.value[idx]]"
      >
        <view class="card-focus-frame">
          <view
            class="card-3d-inner stage-pointer"
            :style="[animCtrl.innersStyle.value[idx], animCtrl.drawsSizeStyle.value[idx]]"
          >
            <image class="tarot-card face-back" :src="cardBack" alt="塔罗牌背面" />
            <view class="tarot-card face-front">
              <image
                class="front-img"
                :src="getCardImg(idx)"
                :alt="getCardImgName(idx) ?? '塔罗牌'"
                lazy-load
              />
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: DivinationDeck (stage content)
 * Purpose: full deck/card animation rig — shuffling, cutting, drawing, 3-D reveal.
 *          Self-driven via injected animationController; starts pipeline on mount.
 * Reason: migrated from DivinationOverlay.vue §stage in phase 2.2.a. Keeping the
 *         GSAP rig in a dedicated stage-content component lets views stay declarative.
 * Data flow: animationController (injected) → all style refs → template bindings.
 *            tarotStore / themeStore imported directly for card images.
 */
import { computed, inject, nextTick, onMounted, onUnmounted } from 'vue'
import type { UseAnimationControllerReturn } from '../../composables/use_animation_controller'
import { useTarotStore } from '../../stores/tarot'
import { useThemeStore } from '../../stores/theme'
import { RESULT_LIFT_MARGIN_PX } from '../../core/config/layout_constants'

const animCtrl = inject<UseAnimationControllerReturn>('animationController')!
const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const isWide = inject<{ value: boolean }>('isWide', { value: false })

const cardBack = computed(() => themeStore.cardBackImage)

/**
 * Vertical lift applied to the result-stage card when the bottom drawer
 * opens. The reading-stage solver shrinks the result card so it fits in
 * the visible band above the drawer, but the GSAP rig anchors it to the
 * draw-container's centre — without a lift it would still sit half-
 * covered by the drawer sheet. Translating up by half the drawer's
 * initial height moves the card's centre from the container midpoint
 * to the midpoint of the visible space above the drawer, exactly
 * centring it. Wide branch keeps lift = 0 (wide is a side panel, not a
 * bottom drawer).
 */
const resultCardLiftY = computed(() => {
  if (!animCtrl.showResults.value || isWide.value) return 0
  try {
    const drawLayout = animCtrl.getSceneLayout('draw_stage')
    return Math.max(
      0,
      drawLayout.drawer.initialHeight / 2 + RESULT_LIFT_MARGIN_PX,
    )
  } catch {
    return 0
  }
})

const rootStyle = computed(() => {
  const base = animCtrl.overlayVarsStyle.value
  const liftDecl = `--result-card-lift-y: ${resultCardLiftY.value}px`
  return base ? `${base}; ${liftDecl}` : liftDecl
})

function getCardImg(idx: number): string {
  return tarotStore.drawnCards[idx]?.card.image || themeStore.cardBackImage
}

function getCardImgName(idx: number): string | undefined {
  return tarotStore.drawnCards[idx]?.card.name
}

let resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

onMounted(() => {
  animCtrl.resumeAnimations()
  animCtrl.setPlaybackRate(1)
  const { windowWidth } = uni.getWindowInfo()
  animCtrl.checkWidth(windowWidth)
  const drawLayout = animCtrl.getSceneLayout('draw_stage')
  animCtrl.setDrawCardSizes(drawLayout)
  resizeHandler = (res) => {
    animCtrl.checkWidth(res.size.windowWidth)
    const layout = animCtrl.getSceneLayout('draw_stage')
    animCtrl.setDrawCardSizes(layout)
    if (
      animCtrl.showResults.value ||
      animCtrl.phase.value === 'drawing' ||
      animCtrl.phase.value === 'revealing'
    ) {
      nextTick(() => animCtrl.updateLayout())
    }
  }
  uni.onWindowResize(resizeHandler)
  animCtrl.start()
})

onUnmounted(() => {
  animCtrl.resumeAnimations()
  animCtrl.setPlaybackRate(1)
  if (resizeHandler) uni.offWindowResize(resizeHandler)
  animCtrl.clearTimeline()
  animCtrl.killTimeline()
  animCtrl.killAnimationTargets()
})
</script>

<style scoped>
.divination-deck {
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

.stage-pointer { pointer-events: auto; }

.tarot-card,
.deck-layer,
.card-3d-inner {
  width: var(--card-width);
  height: var(--card-height);
}

/* Unified 20rpx (~10 px) radius across every card surface (.face-back /
   .face-front inherit via the shared .tarot-card class). `overflow:
   hidden` clips the inner <image>; `.card-3d-inner` deliberately stays
   unclipped — preserve-3d + overflow: hidden flattens the reveal flip. */
.tarot-card { border-radius: 20rpx; overflow: hidden; }

.deck-layer { position: relative; }

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

.cut-pile {
  width: var(--card-width);
  height: var(--card-height);
}

.cut-pile .pile-card {
  position: absolute;
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 20rpx; /* unified card radius — see .tarot-card above */
  border: 1px solid var(--color-border);
  box-shadow: 0 2rpx 8rpx rgba(30, 15, 6, 0.3);
}

.draw-wrapper {
  perspective: 1200px;
  position: absolute;
}

.card-focus-frame {
  width: 100%;
  height: 100%;
  position: relative;
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
  /* Override .tarot-card's fixed var(--card-width)/(--card-height) so the
     face fills whatever animated size .card-3d-inner currently has —
     otherwise reveal grows the wrapper but the card image stays at draw
     size, looking like "card never enlarged". */
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  margin: 0 !important;
}

.face-front { transform: rotateY(180deg); }

.front-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
