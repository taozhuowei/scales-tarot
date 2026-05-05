/**
 * Name: use_play_deck_animation
 * Purpose: drives the unified Deck stage-content (idle fan loop + divination
 *          rig) for the always-mounted PlayView. Replaces
 *          `use_idle_deck_animation` after task 8.2.3 collapsed the two
 *          stage-content components (IdleDeck + DivinationDeck) into one
 *          persistent instance under a single Stage.
 *
 * Reason: keeping a single Deck instance mounted across phases removes the
 *         scene-push-fade exit tween that the legacy idle deck used to
 *         hand off to a freshly mounted divination deck. The previous
 *         approach (`scale 1 → 1.5` + opacity fade out) was a workaround
 *         for the unmount/mount visual gap and never matched the new
 *         single-card spread visual language. Now the same deck simply
 *         transitions from fan-loop to shuffle directly — no exit tween,
 *         no new component mount.
 *
 * Data flow:
 *   - injected `appPhase` (Ref<DivinationPhase>) watched to switch between
 *     fan loop ('idle') and the divination pipeline (any non-idle phase).
 *   - tarotStore consulted for the click guard (already animating? skip).
 *   - injected animationController owns the divination GSAP rig — this
 *     composable kicks it off on idle→divination via `animCtrl.start()`,
 *     and tears it down on phase→idle reset.
 *   - layout solver (`solve_from_window('draw_stage')`) gives the fan
 *     stack the same card size as the draw card so idle→shuffle keeps
 *     stable visual scale.
 *
 * Deletions vs. `use_idle_deck_animation`:
 *   - `runScenePushFade` / `runExitTween` (the scale 1→1.5 + push-down
 *     fade) — single-instance Deck has no exit tween anymore.
 *   - `sceneStyle` / `sceneState` — driven the exit tween only; the
 *     Deck root carries no inline transform now.
 *   - `winHeightHolder` — only consumed by the deleted runScenePushFade.
 */

import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { gsap } from 'gsap'
import { useTarotStore } from '../stores/tarot'
import { prefersReducedMotion } from '../utils/accessibility'
import { DECK_CLICK_SAFETY_MS } from '../core/config/layout_constants'
import { solveLayoutFromWindow } from '../core/sizing/solve_from_window'
import { buildFanTimeline } from '../animation/phases/fan/builder'
import type { UseAnimationControllerReturn } from './use_animation_controller'
import type { DivinationPhase } from '../stores/flow'

/** Cards stacked in the idle fan deck (PRD §7.5.1). */
const DECK_SIZE = 12
/** Cooldown after a click before the lock releases. Mirrors the legacy
 *  idle composable so double-tap protection is preserved. */
const DECK_CLICK_RELEASE_MS = 300

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
 * Internal mutable state. Holders wrap primitive values that mutate
 * inside GSAP callbacks / lifecycle hooks without losing reference
 * identity.
 *
 * Note (vs. use_idle_deck_animation): we deliberately keep a SEPARATE
 * `cards` array for the fan stack — it MUST NOT be reused with
 * animationController.cardElements. The fan stack is a 12-card visual
 * decoration; the divination rig has its own initials/lefts/rights/
 * piles/draws targets and reuses different DOM nodes. Sharing the
 * proxy array would cause GSAP target collisions when the watcher
 * flips phase mid-animation.
 */
interface PlayDeckRuntime {
  cardWidth: Ref<number>
  cardHeight: Ref<number>
  cardsStyle: Ref<Record<string, string>[]>
  hintOpacity: Ref<number>
  isStartingDivination: Ref<boolean>
  cards: { x: number; y: number; rotation: number; scale: number }[]
  hintState: { opacity: number }
  timelineHolder: { value: gsap.core.Timeline | null }
  animatingHolder: { value: boolean }
  lockTimerHolder: { value: ReturnType<typeof setTimeout> | null }
}

/** Build the runtime container — refs + mutable holders only. */
function createPlayDeckRuntime(): PlayDeckRuntime {
  return {
    cardWidth: ref(100),
    cardHeight: ref(160),
    cardsStyle: ref<Record<string, string>[]>(Array(DECK_SIZE).fill({})),
    hintOpacity: ref(0),
    isStartingDivination: ref(false),
    cards: Array(DECK_SIZE).fill(0).map(() => ({ x: 0, y: 0, rotation: 0, scale: 1 })),
    hintState: { opacity: 0 },
    timelineHolder: { value: null },
    animatingHolder: { value: false },
    lockTimerHolder: { value: null },
  }
}

/**
 * Resolve the fan-stack card width/height from the draw stage layout
 * solver. Mirrors the legacy idle composable so idle → divination keeps
 * stable card size with no visual jump.
 */
function resolveDeckCardSize(): { cardWidth: number; cardHeight: number } {
  try {
    const { layout } = solveLayoutFromWindow('draw_stage')
    return {
      cardWidth: layout.drawCardWidth,
      cardHeight: layout.drawCardHeight,
    }
  } catch {
    return { cardWidth: 100, cardHeight: 160 }
  }
}

/**
 * Touch-hint fade — runs once per idle entrance so it doesn't compete
 * with the title GSAP entrance. Honors reduced-motion.
 */
function runEntranceHint(hintOpacity: Ref<number>, hintState: { opacity: number }): void {
  hintState.opacity = 0
  if (prefersReducedMotion()) {
    hintOpacity.value = 0.6
    return
  }
  gsap.to(hintState, {
    opacity: 0.6,
    duration: 0.8,
    delay: 0.6,
    onUpdate: () => { hintOpacity.value = hintState.opacity },
  })
}

/** Reactive surface for the fan-loop sub-system. */
interface FanController {
  flushCardsStyle: () => void
  resetCardsToStack: () => void
  killFanTimeline: () => void
  startFanLoop: () => void
}

/**
 * Build the fan-loop controller around a runtime container. All
 * imperative GSAP plumbing for the idle fan stays here so the main
 * composable body reads as a state-machine.
 */
function createFanController(rt: PlayDeckRuntime): FanController {
  function flushCardsStyle(): void {
    rt.cardsStyle.value = rt.cards.map((c) => ({
      transform: `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.rotation}deg) scale(${c.scale})`,
      willChange: rt.animatingHolder.value ? 'transform' : 'auto',
    }))
  }
  function resetCardsToStack(): void {
    rt.cards.forEach((c) => { c.x = 0; c.y = 0; c.rotation = 0; c.scale = 1 })
    flushCardsStyle()
  }
  function killFanTimeline(): void {
    if (rt.timelineHolder.value) {
      rt.timelineHolder.value.kill()
      rt.timelineHolder.value = null
    }
    gsap.killTweensOf(rt.cards)
    rt.animatingHolder.value = false
  }
  function startFanLoop(): void {
    killFanTimeline()
    resetCardsToStack()
    rt.animatingHolder.value = !prefersReducedMotion()
    rt.timelineHolder.value = buildFanTimeline({ targets: rt.cards, onUpdate: flushCardsStyle })
  }
  return { flushCardsStyle, resetCardsToStack, killFanTimeline, startFanLoop }
}

/** Reactive surface for the divination-rig sub-system. */
interface DivinationRig {
  start: () => void
  tearDown: () => void
  detachResize: () => void
}

/**
 * Build the divination-rig controller. Wraps the controller calls that
 * used to live inside DivinationDeck.onMounted so the watch handler can
 * fire them on phase transitions without re-mounting the component.
 */
function createDivinationRig(animCtrl: UseAnimationControllerReturn): DivinationRig {
  let resizeHandler: ((res: UniApp.WindowResizeResult) => void) | null = null

  function start(): void {
    animCtrl.resumeAnimations()
    animCtrl.setPlaybackRate(1)
    const { windowWidth } = uni.getWindowInfo()
    animCtrl.checkWidth(windowWidth)
    const drawLayout = animCtrl.getSceneLayout('draw_stage')
    animCtrl.setDrawCardSizes(drawLayout)
    if (!resizeHandler) {
      resizeHandler = (res) => {
        animCtrl.checkWidth(res.size.windowWidth)
        const layout = animCtrl.getSceneLayout('draw_stage')
        animCtrl.setDrawCardSizes(layout)
        if (
          animCtrl.showResults.value ||
          animCtrl.phase.value === 'drawing' ||
          animCtrl.phase.value === 'revealing'
        ) {
          animCtrl.updateLayout()
        }
      }
      uni.onWindowResize(resizeHandler)
    }
    animCtrl.start()
  }
  function tearDown(): void {
    animCtrl.resumeAnimations()
    animCtrl.setPlaybackRate(1)
    animCtrl.clearTimeline()
    animCtrl.killTimeline()
    animCtrl.killAnimationTargets()
  }
  function detachResize(): void {
    if (resizeHandler) {
      uni.offWindowResize(resizeHandler)
      resizeHandler = null
    }
  }
  return { start, tearDown, detachResize }
}

/**
 * Build the click handler. The lock guard prevents a second click while
 * the previous transition is still in flight; the safety timer auto-
 * releases the lock so the UI never wedges if a callback never fires.
 */
function buildClickHandler(
  rt: PlayDeckRuntime,
  phase: Ref<DivinationPhase>,
  onTriggerDivination: () => void,
): () => void {
  const tarotStore = useTarotStore()
  return function handleClick(): void {
    if (phase.value !== 'idle') return
    if (rt.isStartingDivination.value || tarotStore.isAnimating) return
    rt.isStartingDivination.value = true
    rt.lockTimerHolder.value = setTimeout(() => {
      rt.isStartingDivination.value = false
      rt.lockTimerHolder.value = null
    }, DECK_CLICK_SAFETY_MS)
    onTriggerDivination()
    if (rt.lockTimerHolder.value !== null) clearTimeout(rt.lockTimerHolder.value)
    rt.lockTimerHolder.value = setTimeout(() => {
      rt.isStartingDivination.value = false
      rt.lockTimerHolder.value = null
    }, DECK_CLICK_RELEASE_MS)
  }
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
    // The Deck is always-mounted with PlayView, so onUnmounted only
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
