<template>
  <!--
    Deck — unified stage-content for the always-mounted PlayView (task 8.2.3).
    Replaces the previous IdleDeck + DivinationDeck pair. One persistent
    instance carries the user from idle (fan loop) → divination (shuffle /
    cut / draw / reveal) → reading without unmounting, so there is no
    visual gap or scale-1→1.5 push-fade hand-off between the two scenes.

    Composition (P3-1 split — file-size cap):
      - DeckFanStack  — idle fan-loop visuals (12-card stack + bottom hint).
                        Visible only during phase === 'idle'.
      - DeckRig       — divination GSAP rig (initials/shuffle halves/cut
                        piles/3D-flip draws). Always mounted; visibility
                        of its sub-elements is gated by the animation
                        controller's own phase-driven flags.

    Accessibility:
      - In idle the wrapper carries `role="button"` so screen readers
        announce the tap target.
      - In divination the wrapper drops the button role and exposes the
        deck as `role="img"` with the divination label, mirroring the
        legacy DivinationDeck semantics.
  -->
  <view
    class="deck"
    :class="{ 'idle-deck-content': isIdle }"
    :style="rootStyle"
    :role="isIdle ? 'button' : 'img'"
    :tabindex="isIdle ? 0 : -1"
    :aria-label="isIdle ? '开始占卜' : '占卜牌堆'"
    @click="isIdle ? handleClick() : undefined"
    @keydown.enter="isIdle ? handleClick() : undefined"
    @keydown.space.prevent="isIdle ? handleClick() : undefined"
  >
    <DeckFanStack
      :visible="isIdle"
      :deck-size="deckSize"
      :card-back="cardBack"
      :container-style="deckContainerStyle"
      :cards-style="cardsStyle"
      :hint-opacity="hintOpacity"
    />

    <DeckRig
      v-show="!isIdle"
      :anim-ctrl="animCtrl"
      :card-back="cardBack"
      :get-card-img="getCardImg"
      :get-card-img-name="getCardImgName"
    />
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
 *
 *          P3-1 split: the file grew to 437 lines combining idle + rig
 *          DOM. The visuals are now delegated to DeckFanStack +
 *          DeckRig; this file is the assembly + click/keyboard handler
 *          + reactive plumbing for the GSAP fan controller. Behaviour
 *          is byte-identical — DOM, classes, inline styles, and
 *          animation target keys are unchanged.
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
import DeckFanStack from './DeckFanStack.vue'
import DeckRig from './DeckRig.vue'

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
</style>
