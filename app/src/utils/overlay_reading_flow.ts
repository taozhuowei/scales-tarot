/**
 * Name: overlay_reading_flow
 * Purpose: manage reading request state independently from overlay animation sequencing.
 * Reason: allow the panel, waiting state, failure fallback, and success reveal to evolve without GSAP coupling.
 * Data flow: store request methods flow in; flow status and resolved outcomes flow back to the overlay.
 */

import { computed, ref } from 'vue'
import type { ReadingResult } from './tarotReading'

export type OverlayReadingStatus = 'idle' | 'requesting' | 'ready' | 'failed'

export interface OverlayReadingFlowDeps {
  hasResult: () => boolean
  startRequest: () => Promise<ReadingResult | null>
  waitForResult: () => Promise<ReadingResult | null>
  getErrorMessage: () => string | null
}

export interface OverlayReadingOutcome {
  status: 'ready' | 'failed'
  result: ReadingResult | null
  errorMessage: string | null
}

const DEFAULT_READING_ERROR_MESSAGE = '解读暂时不可用，请稍后重试'

/**
 * Create a small request-state controller dedicated to overlay reading orchestration.
 */
export function createOverlayReadingFlow(deps: OverlayReadingFlowDeps) {
  const status = ref<OverlayReadingStatus>('idle')
  const errorMessage = ref<string | null>(null)
  let requestTimer: ReturnType<typeof setTimeout> | null = null

  function clearScheduledRequest() {
    if (requestTimer !== null) {
      clearTimeout(requestTimer)
      requestTimer = null
    }
  }

  function markReady() {
    status.value = 'ready'
    errorMessage.value = null
  }

  function markFailed(message?: string | null) {
    status.value = 'failed'
    errorMessage.value = message?.trim() || deps.getErrorMessage()?.trim() || DEFAULT_READING_ERROR_MESSAGE
  }

  function reset() {
    clearScheduledRequest()
    status.value = 'idle'
    errorMessage.value = null
  }

  function scheduleRequest(delayMs: number) {
    if (deps.hasResult()) {
      markReady()
      return
    }

    clearScheduledRequest()
    status.value = 'requesting'
    errorMessage.value = null

    requestTimer = setTimeout(() => {
      requestTimer = null
      deps.startRequest()
        .then((result) => {
          if (result) {
            markReady()
          }
        })
        .catch(() => {
          markFailed()
        })
    }, delayMs)
  }

  async function awaitOutcome(): Promise<OverlayReadingOutcome> {
    if (deps.hasResult()) {
      markReady()
      return {
        status: 'ready',
        result: await deps.waitForResult(),
        errorMessage: null,
      }
    }

    if (status.value === 'idle') {
      status.value = 'requesting'
    }

    try {
      const result = await deps.waitForResult()
      if (result) {
        markReady()
        return {
          status: 'ready',
          result,
          errorMessage: null,
        }
      }
    } catch {
      // The store already owns the canonical error text.
    }

    markFailed()
    return {
      status: 'failed',
      result: null,
      errorMessage: errorMessage.value,
    }
  }

  const isLoading = computed(() => status.value === 'requesting')
  const hasFailed = computed(() => status.value === 'failed')

  return {
    status,
    errorMessage,
    isLoading,
    hasFailed,
    scheduleRequest,
    clearScheduledRequest,
    awaitOutcome,
    reset,
    markReady,
    markFailed,
  }
}
