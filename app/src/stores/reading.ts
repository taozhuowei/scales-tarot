/**
 * Name: reading store module
 * Purpose: hold the divination's interpretation result and request status
 *          refs that the reading orchestrator drives.
 * Reason: separates reading concerns from divination flow and deck state.
 *         The orchestrator (see `utils/reading/reading_orchestrator.ts`)
 *         owns the request lifecycle now — this store only exposes the
 *         shared refs it writes into, so the rest of the app can subscribe.
 * Data flow: orchestrator writes `readingResult`/`isReadingLoading`/
 *           `readingError`; templates and other stores read them.
 */

import { ref } from 'vue'
import type { ReadingResult } from '../core/api/types'

export function createReadingState() {
  const readingResult = ref<ReadingResult | null>(null)
  const isReadingLoading = ref(false)
  const readingError = ref<string | null>(null)

  // A monotonic counter consumers can bump to ignore stale in-flight
  // responses (e.g. when restarting a divination mid-request).
  const currentReadingRequestId = ref<number>(0)
  let pendingReadingPromise: Promise<ReadingResult | null> | null = null

  function invalidateReadingRequest() {
    currentReadingRequestId.value += 1
    pendingReadingPromise = null
    isReadingLoading.value = false
  }

  function waitForReadingResult(): Promise<ReadingResult | null> {
    if (pendingReadingPromise) {
      return pendingReadingPromise
    }
    return Promise.resolve(readingResult.value)
  }

  function reset() {
    readingResult.value = null
    readingError.value = null
    invalidateReadingRequest()
  }

  return {
    readingResult,
    isReadingLoading,
    readingError,
    waitForReadingResult,
    invalidateReadingRequest,
    reset,
  }
}
