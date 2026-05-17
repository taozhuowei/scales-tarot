<template>
  <!--
    DeckRig — divination sub-component of the unified Deck. Renders the
    shuffle / cut / draw / reveal rig that runs in every non-idle phase.
    Always mounted (its inner sub-elements are visibility-gated by the
    animationController's own phase-driven flags: deckCount, drawsVisible,
    pilesVisible, etc.), so the GSAP rig never has to remount mid-flow.

    Migrated wholesale from Deck.vue (P3-1) — DOM, classes, inline
    styles, and bindings are byte-identical to the legacy block. Only
    the wrapper-level idle/click logic stays in the parent.
  -->
  <view class="deck-rig" :class="{ 'deck-rig--show-results': animCtrl.showResults.value }">
    <!-- ── Initial deck + shuffle halves ──────────────────────────── -->
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
 * Name: DeckRig (stage content sub-component)
 * Purpose: encapsulate the divination GSAP rig (initial deck + shuffle
 *          halves + cut piles + 3D-flip draws) so the parent Deck.vue
 *          stays under the file-size cap and reads as a pure assembly of
 *          {idle stack, divination rig}.
 * Reason: extracted from Deck.vue (P3-1). Behaviour-preserving split —
 *          DOM structure, class names, inline styles, GSAP target keys,
 *          and `v-show` gating are byte-identical to the legacy inlined
 *          block; the rig still binds directly to the same injected
 *          animationController state surfaces.
 * Data flow:
 *          - `animCtrl` prop is the same UseAnimationControllerReturn
 *            the parent gets via `inject('animationController')`. We
 *            pass it as a prop (not re-inject) so the binding is
 *            explicit and the component is testable in isolation.
 *          - `cardBack` + `getCardImg`/`getCardImgName` are the parent's
 *            theme- and tarot-store-derived helpers, preserving the
 *            single-source-of-truth contract.
 */
import type { UseAnimationControllerReturn } from '../composables/flows/divination/use_animation_controller'

defineProps<{
  /** Animation controller surface — owns deckCount, draws*, piles*, etc. */
  animCtrl: UseAnimationControllerReturn
  /** Card back image (theme-driven). */
  cardBack: string
  /** Resolve the front image of the drawn card at slot `idx`. */
  getCardImg: (idx: number) => string
  /** Resolve the i18n name of the drawn card at slot `idx` (a11y label). */
  getCardImgName: (idx: number) => string | undefined
}>()
</script>

<style scoped>
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

.stage-pointer { pointer-events: auto; }

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

/* `.deck-rig--show-results` is set on the rig's own wrapper when the
   parent's animationController.showResults flips on. The rig owns the
   modifier locally so Vue's scoped-CSS attribute rewrite still matches
   the descendant `.draw-container` selector — the legacy ancestor
   modifier `.show-results .draw-container` lived on the Deck root,
   which sits one component level up and therefore would not match
   under scoped CSS without a `:global` opt-out. */
.deck-rig--show-results .draw-container {
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
  .draw-container {
    transition: none !important;
    animation: none !important;
  }
}
</style>
