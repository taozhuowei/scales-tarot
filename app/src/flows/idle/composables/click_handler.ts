/**
 * Name: flows/idle/composables/click_handler
 * Purpose: build the idle-tap click handler with the double-tap lock
 *          guard. Releases the lock after `DECK_CLICK_RELEASE_MS` and
 *          falls back to a safety timer (`DECK_CLICK_SAFETY_MS`) so the
 *          UI never wedges if a phase callback never fires.
 * Reason: extracted from use_play_deck_animation (P3-2) — keeping the
 *          click guard isolated lets us unit-test the lock logic
 *          without spinning up a full Deck instance, and shrinks the
 *          main composable below the file-size cap.
 * Data flow:
 *          - reads `phase.value` to gate firing on idle-only.
 *          - reads `tarotStore.isAnimating` to skip if a previous
 *            divination is still in flight.
 *          - mutates `rt.isStartingDivination` and `rt.lockTimerHolder`
 *            in place; the runtime container is the single source of
 *            truth shared with the rest of the play composable.
 *          - calls `onTriggerDivination` which the parent SFC wires up
 *            to `tarotStore.startDivination`.
 */

import type { Ref } from 'vue'
import { useTarotStore } from '../../../core/store/tarot'
import type { DivinationPhase } from '../../../core/store/flow'
import type { PlayDeckRuntime } from './deck_runtime'

/** Minimum gap between deck-click events to debounce double-taps (ms). */
const DECK_CLICK_SAFETY_MS = 2000

/** Cooldown after a click before the lock releases. Mirrors the legacy
 *  idle composable so double-tap protection is preserved. */
const DECK_CLICK_RELEASE_MS = 300

/**
 * Build the click handler. The lock guard prevents a second click while
 * the previous transition is still in flight; the safety timer auto-
 * releases the lock so the UI never wedges if a callback never fires.
 */
export function buildClickHandler(
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
