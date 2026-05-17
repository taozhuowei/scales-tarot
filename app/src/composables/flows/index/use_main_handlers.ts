/**
 * Name: composables/flows/index/use_main_handlers
 * Purpose: extracts the two longest event handlers from `pages/main/index.vue`
 *          (`handleRestart` + `settlePipeline`) so the page SFC can stay
 *          inside the 300-line file cap. Both functions orchestrate
 *          multi-step transitions that have to keep the animation
 *          controller, reading controller, and tarot store in lock-step,
 *          which is why they're worth a named home rather than inline
 *          closures.
 * Reason: `pages/main/index.vue` was crossing the 300-line file cap by
 *          ~6 lines because the restart sequence and the pipeline-settle
 *          handler both spelled out their full step-by-step flow inline.
 *          Pulling them into a composable keeps the page focused on
 *          orchestration wiring while the step list stays auditable in
 *          one place.
 * Data flow: caller passes the same controller refs the page already
 *          holds; this composable returns the two handlers and a setter
 *          for the in-flight reading promise the page tracks so
 *          `settlePipeline` can `await` it before promoting to reading.
 */
import type { useTarotStore } from '../../../core/store/tarot'
import type { useAnimationController } from '../divination/use_animation_controller'
import type { useReadingController } from '../reading/use_reading_controller'

export interface UseMainHandlersDeps {
  tarotStore: ReturnType<typeof useTarotStore>
  animationController: ReturnType<typeof useAnimationController>
  readingController: ReturnType<typeof useReadingController>
  /** Read the current in-flight reading promise (or null). */
  getReadingPromise: () => Promise<unknown> | null
  /** Replace the in-flight reading promise (called after settle clears it). */
  setReadingPromise: (next: Promise<unknown> | null) => void
  /** Application-phase entry to (re)start a divination with the same question. */
  startDivination: (question: string) => void
}

export interface MainHandlers {
  /**
   * Settle the in-flight reading and promote the application stage to
   * `reading` for both success AND error outcomes. The reading drawer /
   * split view is gated by phase ∈ {reading, decision} (see
   * useActiveView), so without this branch a failed
   * /api/v1/divinations response leaves the user stuck on the reveal
   * animation with no error UI mounted (docs/prd/state.md（异常与恢复） anomaly recovery;
   * verified by network_error.spec.ts). On error the ReadingPanel
   * renders its `.error-box` + ActionArea swaps the primary CTA to
   * "重试读取" so the user can recover.
   */
  settlePipeline: () => Promise<void>
  /**
   * Restart the divination from the current question. Resumes any paused
   * animations, clears the timeline + reading state, then re-enters the
   * shuffle phase from a clean slate so the second run looks identical
   * to the first (no leaked tweens, no stale draws).
   */
  handleRestart: () => void
}

export function useMainHandlers(deps: UseMainHandlersDeps): MainHandlers {
  async function settlePipeline(): Promise<void> {
    try {
      await (deps.getReadingPromise() ?? Promise.resolve(null))
    } catch (err) {
      console.error('[main] settlePipeline failed', err)
    }
    deps.setReadingPromise(null)
    const status = deps.readingController.readingPanelState.value
    const hasResolvedSuccess =
      status === 'success' && deps.readingController.readingResult.value !== null
    if (hasResolvedSuccess || status === 'error') {
      deps.tarotStore.revealResult()
    }
  }

  function handleRestart(): void {
    const { animationController, readingController } = deps
    animationController.resumeAnimations()
    animationController.setPlaybackRate(1)
    readingController.resetReading()
    animationController.clearTimeline()
    animationController.seek(0)
    animationController.showResults.value = false
    animationController.resetOverlayScene()
    deps.startDivination(deps.tarotStore.currentQuestion)
    animationController.resetProgressModel()
    animationController.phase.value = 'shuffling'
    animationController.start()
  }

  return { settlePipeline, handleRestart }
}
