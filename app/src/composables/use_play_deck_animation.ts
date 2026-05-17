/**
 * Name: composables/use_play_deck_animation
 * Purpose: drives the single persistent Deck stage-content (idle fan loop +
 *          divination rig). Holds the runtime container, lifecycle wiring,
 *          and the phase-driven state-machine watch; the fan loop, the
 *          divination rig start/teardown, and the click guard each live in
 *          their own sibling composable.
 *
 * Data flow:
 *   - injected `appPhase` (Ref<DivinationPhase>) watched to switch between
 *     fan loop ('idle') and the divination pipeline (any non-idle phase).
 *   - tarotStore consulted for the click guard (already animating? skip).
 *   - injected animationController owns the divination GSAP rig — this
 *     composable kicks it off on idle→divination via `animCtrl.start()`,
 *     and tears it down on phase→idle reset.
 *   - flows/idle/deck_card_size (`resolveDeckCardSize`) gives the fan
 *     stack the same card size as the draw card so idle→shuffle keeps
 *     stable visual scale.
 */

import { computed, inject, onMounted, onUnmounted, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { gsap } from 'gsap'
import type { UseAnimationControllerReturn } from './flows/divination/use_animation_controller'
import type { DivinationPhase } from '../core/store/flow'
import { DECK_SIZE, createPlayDeckRuntime } from './flows/idle/deck_runtime'
import type { PlayDeckRuntime } from './flows/idle/deck_runtime'
import { resolveDeckCardSize } from './flows/idle/deck_card_size'
import { runEntranceHint } from './flows/idle/entrance_hint'
import { createFanController } from './flows/idle/fan_controller'
import type { FanController } from './flows/idle/fan_controller'
import { buildClickHandler } from './flows/idle/click_handler'
import { createDivinationRig } from './flows/divination/divination_rig'
import type { DivinationRig } from './flows/divination/divination_rig'

/** Reactive surface returned to Deck.vue. */
export interface PlayDeckAnimation {
  /** Number of fan-stack cards (template v-for). */
  deckSize: number
  /** Fan stack container width/height (matches draw card size). */
  deckContainerStyle: ComputedRef<{ width: string; height: string }>
  /** Per-card transform inline styles for the fan stack. */
  cardsStyle: Ref<Record<string, string>[]>
  /** Touch-hint opacity (0 → 0.6 entrance fade, idle only). */
  hintOpacity: Ref<number>
  /** Click handler: starts divination on idle taps; no-op otherwise. */
  handleClick: () => void
}

/** Dependencies the SFC injects. */
export interface PlayDeckAnimationDeps {
  /**
   * Called the moment a valid idle-phase tap is registered. The parent
   * promotes the application phase synchronously so the watch below
   * sees it and kicks off the divination rig.
   */
  onTriggerDivination: () => void
}

/**
 * Build the phase-driven state-machine watcher.
 *
 * Phase transitions:
 *   idle             → fan loop running, hint visible
 *   divination/...   → fan killed (cards snapped to rest), divination
 *                       rig kicked off the FIRST time we leave idle
 *                       (subsequent reading/decision phases keep the
 *                       rig running — animationController is one-shot
 *                       per pipeline, restarted only on reset-to-idle).
 *   idle (re-entry)  → divination rig torn down, fan loop restarted
 *
 * Watching `phase` (rather than maintaining a parallel boolean) keeps a
 * single source of truth — the store value is what the rest of the UI
 * sees, so any drift between the deck and the rest of the app is
 * impossible by construction.
 */
function watchPhaseStateMachine(
  rt: PlayDeckRuntime,
  phase: Ref<DivinationPhase>,
  fan: FanController,
  rig: DivinationRig,
): void {
  watch(phase, (next, prev) => {
    if (next === 'idle' && prev !== 'idle' && prev !== undefined) {
      rig.tearDown()
      runEntranceHint(rt.hintOpacity, rt.hintState)
      fan.startFanLoop()
      return
    }
    if (prev === 'idle' && next !== 'idle') {
      // Force-flush cards to rest so the visual hand-off into shuffle
      // has no micro-jump (GSAP target arrays are about to change).
      fan.killFanTimeline()
      fan.resetCardsToStack()
      rig.start()
    }
    // All other transitions (divination → reading → decision) keep
    // the divination rig alive; it manages its own internal state via
    // the animationController's pipeline.
  })
}

/** Build the full PlayDeck animation surface for Deck.vue. */
export function usePlayDeckAnimation(deps: PlayDeckAnimationDeps): PlayDeckAnimation {
  const rt = createPlayDeckRuntime()
  const animCtrl = inject<UseAnimationControllerReturn>('animationController')
  if (!animCtrl) {
    throw new Error('[use_play_deck_animation] animationController not provided')
  }
  const phase = inject<Ref<DivinationPhase>>('appPhase')
  if (!phase) {
    throw new Error('[use_play_deck_animation] appPhase not provided')
  }

  const deckContainerStyle = computed(() => ({
    width: `${rt.cardWidth.value}px`,
    height: `${rt.cardHeight.value}px`,
  }))

  function resolveCardSize(): void {
    const resolved = resolveDeckCardSize()
    rt.cardWidth.value = resolved.cardWidth
    rt.cardHeight.value = resolved.cardHeight
  }

  const fan = createFanController(rt)
  const rig = createDivinationRig(animCtrl)
  const handleResize = (): void => { resolveCardSize() }

  onMounted(() => {
    resolveCardSize()
    uni.onWindowResize(handleResize)
    if (phase.value === 'idle') {
      fan.startFanLoop()
      runEntranceHint(rt.hintOpacity, rt.hintState)
    }
  })

  watchPhaseStateMachine(rt, phase, fan, rig)

  const handleClick = buildClickHandler(rt, phase, deps.onTriggerDivination)

  onUnmounted(() => {
    uni.offWindowResize(handleResize)
    rig.detachResize()
    fan.killFanTimeline()
    if (rt.lockTimerHolder.value !== null) {
      clearTimeout(rt.lockTimerHolder.value)
      rt.lockTimerHolder.value = null
    }
    gsap.killTweensOf(rt.hintState)
    // The Deck stays mounted for the whole route, so onUnmounted only
    // fires on full app teardown (route swap / fallback). Tear the
    // divination rig down too if it was running.
    if (phase.value !== 'idle') {
      rig.tearDown()
    }
  })

  return {
    deckSize: DECK_SIZE,
    deckContainerStyle,
    cardsStyle: rt.cardsStyle,
    hintOpacity: rt.hintOpacity,
    handleClick,
  }
}
