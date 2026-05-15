<template>
  <!--
    DeckFanStack — idle sub-component of the unified Deck. Renders the
    12-card fan-loop stack (PRD §7.5.1) and the bottom touch-hint band.
    Both roots are gated on `visible` (driven by phase === 'idle' in the
    parent) so the divination rig under it can render cleanly during
    shuffle / cut / draw / reveal.

    Multi-root template note: the fan stack and hint are intentionally
    rendered as siblings (not nested) because the hint is positioned
    relative to the Deck root (`bottom: env(safe-area-inset-bottom) + 80rpx`),
    not the fan-stack box (which is sized to a single card). Wrapping
    them in a single `<view>` would make the fan-stack the positioning
    ancestor for the hint and break its layout.
  -->
  <view
    v-show="visible"
    class="fan-stack"
    :style="containerStyle"
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

  <view
    v-show="visible"
    class="idle-deck-content__hint"
    :style="{ opacity: hintOpacity }"
  >
    <view class="idle-deck-content__hint-line" />
    <text class="idle-deck-content__hint-text font-display">TOUCH TO DIVINE</text>
    <view class="idle-deck-content__hint-line" />
  </view>
</template>

<script setup lang="ts">
/**
 * Name: DeckFanStack (stage content sub-component)
 * Purpose: encapsulate the idle fan-loop visuals (12-card stack + bottom
 *          hint band) so the parent Deck.vue stays under the file-size cap
 *          and reads as a pure assembly of {idle stack, divination rig}.
 * Reason: extracted from Deck.vue (P3-1) — Deck.vue grew to 437 lines as
 *         the unified replacement for IdleDeck + DivinationDeck (task
 *         8.2.3); splitting the idle visuals out keeps each file focused
 *         on a single responsibility.
 * Data flow: pure presentational — every reactive value is passed in as
 *         a prop. The parent owns the GSAP fan controller (via
 *         `usePlayDeckAnimation`); this component is a stateless render.
 */

defineProps<{
  /** Phase gate — fan + hint render only when true (idle phase). */
  visible: boolean
  /** Number of cards in the fan stack (PRD §7.5.1, fixed at 12). */
  deckSize: number
  /** Card back image (theme-driven). */
  cardBack: string
  /** Fan-stack container size — matches the draw card size so idle →
   *  divination keeps stable visual scale with no jump. */
  containerStyle: { width: string; height: string }
  /** Per-card transform inline styles, driven by the GSAP fan timeline. */
  cardsStyle: Record<string, string>[]
  /** Bottom hint opacity (0 → 0.6 entrance fade, idle only). */
  hintOpacity: number
}>()
</script>

<style scoped>
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

@media (prefers-reduced-motion: reduce) {
  .idle-deck-content__card,
  .idle-deck-content__hint {
    transition: none !important;
    animation: none !important;
  }
}
</style>
