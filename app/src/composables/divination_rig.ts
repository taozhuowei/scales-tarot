/**
 * Name: state/play/divination_rig
 * Purpose: start / tear-down / resize-attach controller for the
 *          divination GSAP rig. Owns the uni-app `onWindowResize` handle
 *          so the rig can be torn down cleanly when the user resets to
 *          idle, even though the Deck stays mounted.
 * Reason: extracted from use_play_deck_animation (P3-2) — the rig
 *          start/teardown encapsulation is what replaced the legacy
 *          DivinationDeck `onMounted`/`onUnmounted` pair when the
 *          IdleDeck + DivinationDeck were merged into the unified
 *          always-mounted Deck (task 8.2.3). Splitting it out keeps the
 *          main composable small and leaves the rig lifecycle testable
 *          in isolation.
 * Data flow:
 *          - takes the injected animationController surface as an
 *            explicit dependency (no inject() inside this file — the
 *            main composable owns the inject + null-guard).
 *          - the resize handler closes over animCtrl and is registered
 *            once per `start()` call; `detachResize()` is called on
 *            unmount AND from teardown so a reset-to-idle clears the
 *            listener.
 */

import type { UseAnimationControllerReturn } from './flows/divination/use_animation_controller'
import type { DivinationRig } from './play_deck_runtime_types'

/**
 * Build the divination-rig controller. Wraps the controller calls that
 * used to live inside DivinationDeck.onMounted so the watch handler can
 * fire them on phase transitions without re-mounting the component.
 */
export function createDivinationRig(animCtrl: UseAnimationControllerReturn): DivinationRig {
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
