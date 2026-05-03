/**
 * Name: use_dev_tools
 * Purpose: encapsulates the dev-tools state + event handlers wired into
 *          the main page (DevToolsPanel). Owns the local toggles
 *          (`isDevExpanded`, `showContainerBorders`) and the handlers the
 *          panel emits (replay, skip-to-reading, playback rate, container
 *          border toggle). Reading is normally seeded by the animation
 *          pipeline's `onDrawingStart` hook, but the `revealing` replay
 *          path skips the drawing builder entirely, so this composable
 *          mirrors the skipToReading flow before delegating to the
 *          animation controller.
 * Reason: extracted from `pages/main/index.vue` (was 446 lines) so the
 *          dev-tools surface stays self-contained — the page only has to
 *          spread the returned object onto DevToolsPanel's props +
 *          listeners.
 * Data flow: animation + reading controllers feed in; reactive flags +
 *          handler functions flow out for the SFC to bind.
 */
import { ref, type Ref } from 'vue'
import type { OverlayPhase } from '../core/flow/types'
// #ifdef H5
import { toggleContainerBorders as toggleContainerBordersH5 } from '../utils/dev/container_borders'
// #endif

/** Animation controller surface this composable touches. */
export interface DevAnimationController {
  replayFromPhase: (phase: OverlayPhase) => void
  skipToReading: () => void
  setPlaybackRate: (rate: number) => void
}

/** Reading controller surface this composable touches. */
export interface DevReadingController {
  resetReading: () => void
  startReading: (args: Record<string, unknown>) => Promise<unknown>
}

export interface UseDevToolsDeps {
  animationController: DevAnimationController
  readingController: DevReadingController
  /**
   * Setter for the page-owned in-flight reading promise. The replay path
   * for `revealing` synchronously kicks off a new reading (because the
   * drawing builder is skipped) and the page needs to await the same
   * promise in `settlePipeline`.
   */
  setReadingPromise: (promise: Promise<unknown> | null) => void
}

export interface DevTools {
  isDevExpanded: Ref<boolean>
  showContainerBorders: Ref<boolean>
  handleDevReplay: (targetPhase: OverlayPhase) => void
  handleDevSkipToReading: () => void
  handleDevPlaybackRate: (rate: number) => void
  toggleContainerBorders: () => void
}

export function useDevTools(deps: UseDevToolsDeps): DevTools {
  const isDevExpanded = ref(true)
  const showContainerBorders = ref(false)

  function handleDevReplay(targetPhase: OverlayPhase): void {
    // Reading is normally seeded by the animation pipeline's
    // `onDrawingStart` hook. Replays that resume *at or before* drawing
    // still cross that hook on their way through. But replays that jump
    // straight to `revealing` skip the drawing builder entirely, so the
    // hook never fires and the panel opens with no reading in flight
    // (empty body). Mirror the skipToReading flow: fire the request
    // synchronously before delegating to the animation controller. Any
    // in-flight reading is reset first to avoid resolving against the
    // previous run.
    if (targetPhase === 'revealing') {
      deps.readingController.resetReading()
      deps.setReadingPromise(deps.readingController.startReading({}))
    }
    deps.animationController.replayFromPhase(targetPhase)
  }

  function handleDevSkipToReading(): void {
    deps.animationController.skipToReading()
  }

  function handleDevPlaybackRate(rate: number): void {
    deps.animationController.setPlaybackRate(rate)
  }

  function toggleContainerBorders(): void {
    showContainerBorders.value = !showContainerBorders.value
    // #ifdef H5
    toggleContainerBordersH5(showContainerBorders.value)
    // #endif
  }

  return {
    isDevExpanded,
    showContainerBorders,
    handleDevReplay,
    handleDevSkipToReading,
    handleDevPlaybackRate,
    toggleContainerBorders,
  }
}
