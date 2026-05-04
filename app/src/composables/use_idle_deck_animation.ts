/**
 * Name: use_idle_deck_animation
 * Purpose: encapsulates the GSAP-driven animation logic for the IdleDeck
 *          stage-content (PRD §7.5.1 fan animation): card-size resolution
 *          from the layout solver, the looping fan-out / fan-in timeline,
 *          the touch-hint fade-in, and the click-triggered "scene push +
 *          fade" exit animation that hands off to the divination view.
 * Reason: the previous IdleDeck.vue mixed template, style, and ~170 lines
 *          of imperative GSAP plumbing in a single 346-line SFC. Pulling
 *          the animation state + lifecycle into this composable keeps the
 *          SFC declarative and the animation logic unit-test-friendly.
 * Data flow: theme + tarot stores feed in via callbacks; layout solver
 *          provides card width/height; the composable exposes reactive
 *          style refs + a `handleClick` handler the SFC binds.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { gsap } from 'gsap'
import { useTarotStore } from '../stores/tarot'
import { prefersReducedMotion } from '../utils/accessibility'
import { DECK_CLICK_SAFETY_MS } from '../core/config/layout_constants'
import { solveLayoutFromWindow } from '../core/sizing/solve_from_window'
import { buildFanTimeline } from '../animation/phases/fan/builder'

/** Cards stacked in the idle deck (PRD §7.5.1). */
const DECK_SIZE = 12
/** Cooldown after the exit tween before the click lock releases. */
const DECK_CLICK_RELEASE_MS = 300

/** Reactive surface returned to the SFC. */
export interface IdleDeckAnimation {
  /** Number of cards in the deck (for the v-for). */
  deckSize: number
  /** Deck container width/height tracking the card size. */
  deckContainerStyle: ComputedRef<{ width: string; height: string }>
  /** Per-card transform + will-change inline styles, indexed [0, DECK_SIZE). */
  cardsStyle: Ref<Record<string, string>[]>
  /** Scene wrapper style (drives the exit transform + fade). */
  sceneStyle: Ref<Record<string, string>>
  /** Touch-hint opacity (0 → 0.6 entrance fade). */
  hintOpacity: Ref<number>
  /** Click handler: emits trigger then runs snap-back + push-fade exit. */
  handleClick: () => void
}

/** Dependencies the SFC injects. */
export interface IdleDeckAnimationDeps {
  /** Called the moment the user taps the deck. Parent promotes the phase. */
  onTriggerDivination: () => void
}

/**
 * Resolve card width/height + viewport height from the layout solver.
 * Mirrors the draw stage so idle → divination keeps stable card size.
 * On failure (no `uni`, malformed window info) returns sane defaults so
 * the static stack still renders.
 */
function resolveDeckCardSize(): { cardWidth: number; cardHeight: number; windowHeight: number } {
  try {
    const { layout, windowHeight } = solveLayoutFromWindow('draw_stage')
    return {
      cardWidth: layout.drawCardWidth,
      cardHeight: layout.drawCardHeight,
      windowHeight,
    }
  } catch {
    return { cardWidth: 100, cardHeight: 160, windowHeight: 667 }
  }
}

/**
 * Touch hint fade — runs once per mount, slightly after the deck appears
 * so it doesn't compete with the title entrance. Honors reduced-motion.
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

/**
 * Internal mutable state held by `useIdleDeckAnimation`. Holders wrap
 * primitive values that need to mutate from inside GSAP callbacks /
 * lifecycle hooks without losing reference identity. Each `*Holder.value`
 * is also reachable from the unmount path so cleanup covers it.
 */
interface IdleDeckRuntime {
  cardWidth: Ref<number>
  cardHeight: Ref<number>
  cardsStyle: Ref<Record<string, string>[]>
  sceneStyle: Ref<Record<string, string>>
  hintOpacity: Ref<number>
  isStartingDivination: Ref<boolean>
  cards: { x: number; y: number; rotation: number; scale: number }[]
  sceneState: { scale: number; y: number; opacity: number }
  hintState: { opacity: number }
  winHeightHolder: { value: number }
  timelineHolder: { value: gsap.core.Timeline | null }
  animatingHolder: { value: boolean }
  lockTimerHolder: { value: ReturnType<typeof setTimeout> | null }
}

/** Build the runtime state container — refs + mutable holders only. */
function createIdleDeckRuntime(): IdleDeckRuntime {
  return {
    cardWidth: ref(100),
    cardHeight: ref(160),
    cardsStyle: ref<Record<string, string>[]>(Array(DECK_SIZE).fill({})),
    sceneStyle: ref<Record<string, string>>({}),
    hintOpacity: ref(0),
    isStartingDivination: ref(false),
    cards: Array(DECK_SIZE).fill(0).map(() => ({ x: 0, y: 0, rotation: 0, scale: 1 })),
    sceneState: { scale: 1, y: 0, opacity: 1 },
    hintState: { opacity: 0 },
    winHeightHolder: { value: 667 },
    timelineHolder: { value: null },
    animatingHolder: { value: false },
    lockTimerHolder: { value: null },
  }
}

/** Second leg of the exit (scene push + fade) — runs after snap-back completes. */
function runScenePushFade(rt: IdleDeckRuntime, releaseLock: () => void): void {
  rt.sceneState.scale = 1
  rt.sceneState.y = 0
  rt.sceneState.opacity = 1
  gsap.to(rt.sceneState, {
    scale: 1.5,
    y: rt.winHeightHolder.value * 0.2,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.in',
    onUpdate: () => {
      rt.sceneStyle.value = {
        transform: `scale(${rt.sceneState.scale}) translateY(${rt.sceneState.y}px)`,
        opacity: String(rt.sceneState.opacity),
        willChange: 'transform, opacity',
      }
    },
    onComplete: () => {
      rt.sceneStyle.value = { ...rt.sceneStyle.value, willChange: 'auto' }
      releaseLock()
    },
  })
}

/** Hand-off animation: snap cards to centre, then push scene down + fade. */
function runExitTween(rt: IdleDeckRuntime, flushCardsStyle: () => void, releaseLock: () => void): void {
  if (prefersReducedMotion()) {
    rt.sceneStyle.value = { opacity: '0' }
    releaseLock()
    return
  }
  gsap.to(rt.cards, {
    duration: 0.3,
    ease: 'power2.out',
    x: 0, y: 0, rotation: 0, scale: 1,
    onUpdate: flushCardsStyle,
    onComplete: () => { runScenePushFade(rt, releaseLock) },
  })
}

/**
 * Build the click handler. Reactive lock + safety/cooldown timers prevent
 * double-trigger; both timers go through `rt.lockTimerHolder` so unmount
 * can cancel whichever is in flight.
 */
function buildClickHandler(
  rt: IdleDeckRuntime,
  onTriggerDivination: () => void,
  flushCardsStyle: () => void,
): () => void {
  const tarotStore = useTarotStore()
  return function handleClick(): void {
    if (rt.isStartingDivination.value || tarotStore.isAnimating) return
    rt.isStartingDivination.value = true
    // Safety timer — fires if the exit tween never reaches releaseLock.
    rt.lockTimerHolder.value = setTimeout(() => {
      rt.isStartingDivination.value = false
      rt.lockTimerHolder.value = null
    }, DECK_CLICK_SAFETY_MS)
    const releaseLock = (): void => {
      if (rt.lockTimerHolder.value !== null) clearTimeout(rt.lockTimerHolder.value)
      // Cooldown timer — keeps the lock briefly past the exit fade.
      rt.lockTimerHolder.value = setTimeout(() => {
        rt.isStartingDivination.value = false
        rt.lockTimerHolder.value = null
      }, DECK_CLICK_RELEASE_MS)
    }
    onTriggerDivination()
    if (rt.timelineHolder.value) {
      rt.timelineHolder.value.kill()
      rt.timelineHolder.value = null
    }
    rt.animatingHolder.value = false
    flushCardsStyle()
    runExitTween(rt, flushCardsStyle, releaseLock)
  }
}

/**
 * Wire the resize listener + start the fan loop on mount, and tear down
 * everything (listener, timeline, in-flight timer, queued GSAP tweens)
 * on unmount.
 */
function wireLifecycle(rt: IdleDeckRuntime, resolveCardSize: () => void, startFanLoop: () => void): void {
  const handleResize = (): void => { resolveCardSize() }
  onMounted(() => {
    resolveCardSize()
    uni.onWindowResize(handleResize)
    startFanLoop()
    runEntranceHint(rt.hintOpacity, rt.hintState)
  })
  onUnmounted(() => {
    uni.offWindowResize(handleResize)
    if (rt.timelineHolder.value) {
      rt.timelineHolder.value.kill()
      rt.timelineHolder.value = null
    }
    if (rt.lockTimerHolder.value !== null) {
      clearTimeout(rt.lockTimerHolder.value)
      rt.lockTimerHolder.value = null
    }
    rt.animatingHolder.value = false
    gsap.killTweensOf(rt.cards)
    gsap.killTweensOf(rt.sceneState)
    gsap.killTweensOf(rt.hintState)
  })
}

/** Build the full IdleDeck animation surface for the SFC to consume. */
export function useIdleDeckAnimation(deps: IdleDeckAnimationDeps): IdleDeckAnimation {
  const rt = createIdleDeckRuntime()

  const deckContainerStyle = computed(() => ({
    width: `${rt.cardWidth.value}px`,
    height: `${rt.cardHeight.value}px`,
  }))

  function resolveCardSize(): void {
    const resolved = resolveDeckCardSize()
    rt.cardWidth.value = resolved.cardWidth
    rt.cardHeight.value = resolved.cardHeight
    rt.winHeightHolder.value = resolved.windowHeight
  }

  function flushCardsStyle(): void {
    rt.cardsStyle.value = rt.cards.map((c) => ({
      transform: `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.rotation}deg) scale(${c.scale})`,
      willChange: rt.animatingHolder.value ? 'transform' : 'auto',
    }))
  }

  function startFanLoop(): void {
    if (rt.timelineHolder.value) rt.timelineHolder.value.kill()
    // Reset every card to the centred stack before the loop kicks off.
    rt.cards.forEach((c) => { c.x = 0; c.y = 0; c.rotation = 0; c.scale = 1 })
    flushCardsStyle()
    rt.animatingHolder.value = !prefersReducedMotion()
    rt.timelineHolder.value = buildFanTimeline({ targets: rt.cards, onUpdate: flushCardsStyle })
  }

  const handleClick = buildClickHandler(rt, deps.onTriggerDivination, flushCardsStyle)
  wireLifecycle(rt, resolveCardSize, startFanLoop)

  return {
    deckSize: DECK_SIZE,
    deckContainerStyle,
    cardsStyle: rt.cardsStyle,
    sceneStyle: rt.sceneStyle,
    hintOpacity: rt.hintOpacity,
    handleClick,
  }
}
