<template>
  <!--
    Deck — unified stage-content for the always-mounted PlayView (task 8.2.3).
    Replaces the previous IdleDeck + DivinationDeck pair. One persistent
    instance carries the user from idle (fan loop) → divination (shuffle /
    cut / draw / reveal) → reading without unmounting, so there is no
    visual gap or scale-1→1.5 push-fade hand-off between the two scenes.

    Layering:
      - `.deck.fan-stack` is the idle fan-loop deck (12 cards). Visible
        only during phase === 'idle'; transparent otherwise so the
        divination rig below renders cleanly.
      - `.deck-divination` is the shuffle / cut / draw / reveal rig.
        Always mounted; its inner visibility is gated by the animation
        controller's own phase-driven flags (deckCount, drawsVisible,
        pilesVisible, etc.).
      - `.idle-deck-content__hint` lives at the bottom of the stage in
        idle and fades in on entrance. Hidden during divination.

    Accessibility:
      - In idle the wrapper carries `role="button"` so screen readers
        announce the tap target.
      - In divination the wrapper drops the button role and exposes the
        deck as `role="img"` with the divination label, mirroring the
        legacy DivinationDeck semantics.
  -->
  <view
    class="deck"
    :class="{
      'idle-deck-content': isIdle,
      'show-results': animCtrl.showResults.value,
    }"
    :style="rootStyle"
    :role="isIdle ? 'button' : 'img'"
    :tabindex="isIdle ? 0 : -1"
    :aria-label="isIdle ? '开始占卜' : '占卜牌堆'"
    @click="isIdle ? handleClick() : undefined"
    @keydown.enter="isIdle ? handleClick() : undefined"
    @keydown.space.prevent="isIdle ? handleClick() : undefined"
  >
    <!-- ── Idle fan-loop stack ────────────────────────────────────── -->
    <view
      v-show="isIdle"
      class="fan-stack"
      :style="deckContainerStyle"
    >
      <image
        v-for="i in deckSize"
        :key="`fan${i}`"
        class="idle-deck-content__card"
        :src="cardBack"
        :style="cardsStyle[i - 1]"
        role="img"
        aria-label="塔罗牌背面"
        lazy-load
      />
    </view>

    <!-- ── Idle touch hint (bottom band) ──────────────────────────── -->
    <view
      v-show="isIdle"
      class="idle-deck-content__hint"
      :style="{ opacity: hintOpacity }"
    >
      <view class="idle-deck-content__hint-line" />
      <text class="idle-deck-content__hint-text font-display">TOUCH TO DIVINE</text>
      <view class="idle-deck-content__hint-line" />
    </view>

    <!-- ── Divination rig (initial deck + shuffle halves) ─────────── -->
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

    <!-- ── Cut piles ─────────────────────────────────────────────── -->
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

    <!-- ── Draw container (3D flip) ──────────────────────────────── -->
    <view class="draw-container">
      <view
        v-for="(_, idx) in animCtrl.drawsVisible.value"
        :key="`draw${idx}`"
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
 * Name: Deck (stage content)
 * Purpose: unified deck/card surface for the always-mounted PlayView.
 *          Renders the idle fan loop in phase 'idle' and the full
 *          shuffle/cut/draw/reveal rig in every other phase, all from a
 *          single persistent instance so there is no exit-tween hand-off
 *          between scenes.
 * Reason: replaces IdleDeck + DivinationDeck (task 8.2.3). The legacy pair
 *          unmounted/mounted on every idle ↔ divination flip, which forced
 *          the idle deck to run a `_scene.scale 1 → 1.5` push-fade exit
 *          tween to mask the visual gap. With a single instance the gap
 *          does not exist and the exit tween was deleted.
 * Data flow:
 *          - injected animationController owns the shuffle/cut/draw/reveal
 *            state surfaces (deckCtnStyle, initialsStyle, drawsStyle, …).
 *          - injected appPhase drives idle vs. non-idle visibility on the
 *            fan stack / hint.
 *          - usePlayDeckAnimation drives the fan loop and click handler;
 *            the SFC is declarative.
 *          - tarotStore / themeStore imported directly for card images
 *            (matches the legacy DivinationDeck pattern).
 */
import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import type { UseAnimationControllerReturn } from '../../composables/use_animation_controller'
import { useTarotStore } from '../../stores/tarot'
import { useThemeStore } from '../../stores/theme'
import { usePlayDeckAnimation } from '../../composables/use_play_deck_animation'
import { RESULT_LIFT_MARGIN_PX } from '../../core/config/layout_constants'
import type { DivinationPhase } from '../../stores/flow'

const animCtrl = inject<UseAnimationControllerReturn>('animationController')!
const phase = inject<Ref<DivinationPhase>>('appPhase')!
const tarotStore = useTarotStore()
const themeStore = useThemeStore()
const isWide = inject<{ value: boolean }>('isWide', { value: false })

const cardBack = computed(() => themeStore.cardBackImage)

/** Idle gate — the fan stack / hint render only in this phase; the
 *  divination rig stays mounted (its inner sub-elements are visibility-
 *  gated by the animation controller's own state). */
const isIdle = computed(() => phase.value === 'idle')

/**
 * Vertical lift applied to the result-stage card when the bottom drawer
 * opens. Mirrors the legacy DivinationDeck behaviour — the GSAP rig
 * anchors the card at the draw-container midpoint, so without a lift the
 * drawer would cover half the result. Lift = drawer-half + breathing
 * margin; wide branch keeps lift = 0 (side panel, not bottom drawer).
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

/* ── Fan / click animation surface ────────────────────────────────── */

const {
  deckSize,
  deckContainerStyle,
  cardsStyle,
  hintOpacity,
  handleClick,
} = usePlayDeckAnimation({
  /**
   * Promote the application phase synchronously. The composable's
   * `watch(phase)` picks up the change and runs the idle→divination
   * hand-off (kill fan + start divination rig).
   */
  onTriggerDivination: () => { tarotStore.startDivination(tarotStore.currentQuestion) },
})
</script>

<style scoped>
/* The deck wrapper occupies the full Stage and stacks every layer in
   one absolute box. `isolation: isolate` matches the legacy
   .divination-deck so blend modes (if any are added later) stay
   contained. `pointer-events: none` lets per-layer pointer-events
   re-enable interaction; the stage-pointer modifier handles that. */
.deck {
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

/* Idle wrapper picks up pointer events so taps are captured. The
   .stage-pointer modifier still re-enables interaction for the
   divination rig sub-layers when those become active. */
.deck.idle-deck-content {
  cursor: pointer;
  pointer-events: auto;
  transform-origin: center center;
}

.stage-pointer { pointer-events: auto; }

/* ── Idle fan stack ──────────────────────────────────────────────── */

.fan-stack {
  position: relative;
  z-index: 10;
}

.idle-deck-content__card {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 10rpx ≈ 5 px at the 750-rpx design baseline — unified across every
     card surface (.tarot-card, cut-pile.pile-card, CardMeaningContainer)
     so the deck reads as the same physical object from idle through
     reveal. */
  border-radius: 10rpx;
  border: 1px solid var(--color-border);
  box-shadow: 0 2rpx 8rpx rgba(30, 15, 6, 0.3);
}

/* Deepest shadow on the bottom card — H5 only because mp-weixin
   doesn't reliably support `:first-child` on `<image>` tags. */
/* #ifdef H5 */
.idle-deck-content__card:first-child {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}
/* #endif */

/* ── Idle touch hint ─────────────────────────────────────────────── */

.idle-deck-content__hint {
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

.idle-deck-content__hint-line {
  width: 50rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, var(--color-border-strong), transparent);
}

.idle-deck-content__hint-text {
  font-size: 20rpx;
  color: var(--color-text-muted);
  letter-spacing: 0.25em;
}

/* ── Divination rig layers (migrated from DivinationDeck) ────────── */

.tarot-card,
.deck-layer,
.card-3d-inner {
  width: var(--card-width);
  height: var(--card-height);
}

.tarot-card { border-radius: 10rpx; overflow: hidden; }

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
  border-radius: 10rpx;
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
     face fills whatever animated size .card-3d-inner currently has. */
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

@media (prefers-reduced-motion: reduce) {
  .idle-deck-content__card,
  .idle-deck-content__hint,
  .draw-container {
    transition: none !important;
    animation: none !important;
  }
}
</style>
