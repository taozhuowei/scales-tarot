/**
 * Name: flows/reading/composables/use_result_card_shrink
 * Purpose: drive the second stage of the two-phase result-card reveal —
 *          when the reading drawer mounts (narrow viewports only), the
 *          card animates from its full safe-area size (240×384 phone-
 *          shell maximum, set by the reveal phase's growAtom) down to
 *          the drawer-reserved size (`cardWidth` × `cardHeight` from
 *          the layout solver). Without this animation the card would
 *          either stay too large and overlap the drawer (PR #12 → buggy
 *          first reveal pre-fix) or pop straight to the small size
 *          without a visual transition (jarring).
 *
 *          The shrink is wired off `showReadingView` (= phase ∈
 *          {reading, decision}) rather than off `showResults` because
 *          showResults flips the moment the reveal phase *starts* —
 *          before the cards have even grown — and showReadingView
 *          flips when the drawer is actually about to mount. The wide
 *          (PC) branch never opens a bottom drawer, so this composable
 *          short-circuits in that case.
 *
 * Reason: keeping the watcher inside the page SFC would push it past
 *          the 300-line cap and entangle the animation lifecycle with
 *          unrelated page wiring. A focused composable keeps the
 *          shrink rules + GSAP cleanup auditable in one place and
 *          dispose-safe across page unmounts.
 *
 * Data flow:
 *   showReadingView false→true ──▶ start GSAP tween on draws[0..n].width
 *   /height (full → shrunk) ──▶ reconciler watch propagates the new
 *   width/height into drawsSizeStyle ──▶ DOM card shrinks.
 *
 *   showReadingView true→false (e.g. restart back to divination) ──▶
 *   kill any in-flight shrink tween so the next reveal cycle starts
 *   from a clean slate. The grow atom rewrites width/height on its
 *   first `set()` call so we don't need to manually restore values
 *   here — only kill the tween.
 */
import { watch, onUnmounted, type Ref } from 'vue'
import gsap from 'gsap'
import type { DrawCardState } from '../../shared/composables/animations/card_state'
import type { useOverlayLayout } from '../../../core/sizing/overlay_layout/use_overlay_layout'

export interface UseResultCardShrinkDeps {
  /**
   * Reading-view gate from `useActiveView`. Goes true when the drawer
   * mounts (narrow viewports) — that is the "phase 2" trigger.
   */
  showReadingView: Ref<boolean>
  /** Wide-screen gate. Wide viewports use the side-panel split, no drawer. */
  isWide: Ref<boolean>
  /**
   * Animation state's `draws` array (mutable plain objects — GSAP can
   * tween their width/height fields, the reconciler's deep-watch
   * mirrors the change into `drawsSizeStyle`).
   */
  draws: DrawCardState[]
  /**
   * Resolve the current scene layout. The shrink tween reads
   * `cardWidth` / `cardHeight` (the drawer-reserved sizes) from the
   * `reading_stage` layout and uses them as the tween target.
   */
  getSceneLayout: ReturnType<typeof useOverlayLayout>['getSceneLayout']
  /**
   * Card count for the current spread. We only tween cards [0, count).
   * The single_card spread (current default) means count = 1.
   */
  cardCount: Ref<number>
}

/** Shrink animation duration (ms). 400 ms reads as deliberate-but-not-slow,
 *  matches the drawer's 350 ms slide-in within ±50 ms so the two changes
 *  feel like one orchestrated motion rather than two separate events. */
const SHRINK_DURATION_S = 0.4

export function useResultCardShrink(deps: UseResultCardShrinkDeps): void {
  let activeTween: gsap.core.Tween | null = null

  function killActive(): void {
    if (activeTween) {
      activeTween.kill()
      activeTween = null
    }
  }

  function shrinkTo(target: { width: number; height: number }): void {
    killActive()
    const targets = deps.draws.slice(0, deps.cardCount.value)
    if (targets.length === 0) return
    activeTween = gsap.to(targets, {
      width: target.width,
      height: target.height,
      duration: SHRINK_DURATION_S,
      ease: 'power2.out',
      onComplete: () => { activeTween = null },
    })
  }

  watch(
    deps.showReadingView,
    (next, prev) => {
      // Only react to the false→true transition. The wide branch uses
      // the side-panel split, no drawer mounts, so the shrink stays
      // inactive there.
      if (deps.isWide.value) return
      if (next && !prev) {
        try {
          const reading = deps.getSceneLayout('reading_stage')
          shrinkTo({ width: reading.cardWidth, height: reading.cardHeight })
        } catch (err) {
          // Layout resolution can throw very early in the lifecycle (no
          // window-info yet). Failing silently is fine because the
          // showReadingView watcher will fire again on the next phase
          // change once the layout is resolvable, but log so a real
          // bug doesn't go unnoticed.
          console.warn('[shrink] failed to resolve reading_stage layout', err)
        }
        return
      }
      // true→false: the page returned to draw / idle. Cancel any
      // in-flight shrink tween so the next reveal cycle starts clean.
      if (!next && prev) killActive()
    },
    { immediate: false },
  )

  onUnmounted(killActive)
}
